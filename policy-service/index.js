const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const { Kafka } = require('kafkajs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Kafka setup
const kafka = new Kafka({
  clientId: 'policy-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9093']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'policy-service-group' });

// Define mongoose schema and model
const policySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  policyNumber: {
    type: String,
    required: true,
    unique: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  paymentFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true
  },
  premium: {
    type: Number,
    required: true
  },
  coverageAmount: {
    type: Number,
    required: true
  },
  beneficiaries: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    dateOfBirth: { type: Date },
    percentage: { type: Number, required: true }
  }],
  status: {
    type: String,
    enum: ['active', 'pending', 'expired', 'cancelled'],
    default: 'pending'
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

// Pre-save hook to generate policy number
policySchema.pre('save', async function (next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Use this.constructor instead of mongoose.model
    const count = await this.constructor.countDocuments();
    const sequence = String(count + 1).padStart(6, '0');

    // Format: PLY-YYMMDD-XXXXXX
    this.policyNumber = `PLY-${year}${month}${day}-${sequence}`;
  }
  next();
});

const Policy = mongoose.model('Policy', policySchema);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Policy Service is running' });
});

// Create new policy
app.post('/policies', async (req, res) => {
  try {
    const newPolicy = new Policy(req.body);
    const savedPolicy = await newPolicy.save();

    await producer.send({
      topic: 'policy-events',
      messages: [
        {
          key: 'policy-created',
          value: JSON.stringify({
            event: 'POLICY_CREATED',
            data: savedPolicy
          })
        }
      ]
    });

    res.status(201).json(savedPolicy);
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(400).json({ error: 'Failed to create policy' });
  }
});
app.get('/policy', async (req, res) => {
  try {
    const policies = await Policy.find();
    res.status(200).json(policies);
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});
// Get policy by ID
app.get('/policies/:id', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json(policy);
  } catch (error) {
    console.error(`Error fetching policy ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// Get policies by user ID
app.get('/policies/user/:userId', async (req, res) => {
  try {
    const policies = await Policy.find({ userId: req.params.userId });
    res.json(policies);
  } catch (error) {
    console.error(`Error fetching policies for user ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Update policy
app.put('/policies/:id', async (req, res) => {
  try {
    const updatedPolicy = await Policy.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    await producer.send({
      topic: 'policy-events',
      messages: [
        {
          key: 'policy-updated',
          value: JSON.stringify({
            event: 'POLICY_UPDATED',
            data: updatedPolicy
          })
        }
      ]
    });

    res.json(updatedPolicy);
  } catch (error) {
    console.error(`Error updating policy ${req.params.id}:`, error);
    res.status(400).json({ error: 'Failed to update policy' });
  }
});

// Cancel policy
app.patch('/policies/:id/cancel', async (req, res) => {
  try {
    const cancelledPolicy = await Policy.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', updatedAt: Date.now() },
      { new: true }
    );

    if (!cancelledPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    await producer.send({
      topic: 'policy-events',
      messages: [
        {
          key: 'policy-cancelled',
          value: JSON.stringify({
            event: 'POLICY_CANCELLED',
            data: cancelledPolicy
          })
        }
      ]
    });

    res.json(cancelledPolicy);
  } catch (error) {
    console.error(`Error cancelling policy ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to cancel policy' });
  }
});

// Kafka consumer setup
const startKafka = async () => {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topics: ['policy-events', 'product-events', 'payment-events'] });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`Received message from ${topic}: ${message.key?.toString()}`, data);

      if (topic === 'payment-events' && message.key?.toString() === 'payment-successful') {
        if (data.event === 'PAYMENT_SUCCESSFUL' && data.data.policyId) {
          try {
            const policy = await Policy.findById(data.data.policyId);
            if (policy && policy.status === 'pending') {
              policy.status = 'active';
              policy.updatedAt = Date.now();
              await policy.save();

              console.log(`Policy ${policy._id} activated after successful payment`);

              await producer.send({
                topic: 'policy-events',
                messages: [
                  {
                    key: 'policy-activated',
                    value: JSON.stringify({
                      event: 'POLICY_ACTIVATED',
                      data: policy
                    })
                  }
                ]
              });
            }
          } catch (error) {
            console.error('Error activating policy after payment:', error);
          }
        }
      }
    }
  });
};

// Start the server
app.listen(PORT, async () => {
  console.log(`Policy Service listening on port ${PORT}`);
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
