const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI )
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Kafka setup
const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9093']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-service-group' });

// Define mongoose schema and model
const paymentSchema = new mongoose.Schema({
  transactionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  policyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  amount: { 
    type: Number, 
    required: true 
  },
  paymentMethod: { 
    type: String, 
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'upi'], 
    required: true 
  },
  paymentFrequency: { 
    type: String, 
    enum: ['monthly', 'quarterly', 'yearly'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'successful', 'failed'], 
    default: 'pending' 
  },
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Pre-save hook to generate transaction ID
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = 'TXN-' + uuidv4().toUpperCase();
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Payment Service is running' });
});

// Process new payment
app.post('/payments', async (req, res) => {
  try {
    const newPayment = new Payment(req.body);
    
    // For demo purposes, simulate payment processing
    // In production, this would integrate with actual payment gateways
    // and handle async callbacks
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Randomly determine payment status for demo
    // In production, this would be determined by the payment gateway's response
    const success = Math.random() > 0.1; // 90% success rate for demo
    
    newPayment.status = success ? 'successful' : 'failed';
    const savedPayment = await newPayment.save();
    
    // Produce Kafka message for payment result
    const eventKey = success ? 'payment-successful' : 'payment-failed';
    const eventType = success ? 'PAYMENT_SUCCESSFUL' : 'PAYMENT_FAILED';
    
    await producer.send({
      topic: 'payment-events',
      messages: [
        { 
          key: eventKey, 
          value: JSON.stringify({
            event: eventType,
            data: savedPayment
          })
        }
      ]
    });
    
    res.status(201).json(savedPayment);
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(400).json({ error: 'Failed to process payment' });
  }
});

// Get payment by ID
app.get('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    console.error(`Error fetching payment ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Get payments by policy ID
app.get('/payments/policy/:policyId', async (req, res) => {
  try {
    const payments = await Payment.find({ policyId: req.params.policyId });
    res.json(payments);
  } catch (error) {
    console.error(`Error fetching payments for policy ${req.params.policyId}:`, error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payments by user ID
app.get('/payments/user/:userId', async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.params.userId });
    res.json(payments);
  } catch (error) {
    console.error(`Error fetching payments for user ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Initialize Kafka producer and consumer
const startKafka = async () => {
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topics: ['payment-events', 'policy-events'] });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`Received message from ${topic}: ${message.key?.toString()}`, data);
      
      // Process messages if needed
    }
  });
};

// Start the server
app.listen(PORT, async () => {
  console.log(`Payment Service listening on port ${PORT}`);
  try {
    await startKafka();
    console.log('Kafka producer and consumer are connected');
  } catch (error) {
    console.error('Failed to start Kafka:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server and Kafka connections');
  await producer.disconnect();
  await consumer.disconnect();
  process.exit(0);
});