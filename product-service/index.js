const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const { Kafka } = require('kafkajs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

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
  clientId: 'product-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9093']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'product-service-group' });

// Define mongoose schema and model
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  coverageAmount: { 
    type: Number, 
    required: true 
  },
  premiumRates: {
    monthly: { type: Number, required: true },
    quarterly: { type: Number, required: true },
    yearly: { type: Number, required: true }
  },
  coverageDetails: {
    hospitalCoverage: { type: Boolean, default: true },
    medicineCoverage: { type: Boolean, default: true },
    doctorConsultationCoverage: { type: Boolean, default: true },
    specialistCoverage: { type: Boolean, default: false },
    dentalCoverage: { type: Boolean, default: false },
    visionCoverage: { type: Boolean, default: false },
    maternityBenefits: { type: Boolean, default: false }
  },
  waitingPeriod: { 
    type: Number, 
    default: 30,  // days
    required: true 
  },
  maxAge: { 
    type: Number,
    default: 65,
    required: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
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

const Product = mongoose.model('Product', productSchema);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Product Service is running' });
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create new product
app.post('/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    
    // Produce Kafka message for new product
    await producer.send({
      topic: 'product-events',
      messages: [
        { 
          key: 'product-created', 
          value: JSON.stringify({
            event: 'PRODUCT_CREATED',
            data: savedProduct
          })
        }
      ]
    });
    
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ error: 'Failed to create product' });
  }
});

// Update product
app.put('/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Produce Kafka message for updated product
    await producer.send({
      topic: 'product-events',
      messages: [
        { 
          key: 'product-updated', 
          value: JSON.stringify({
            event: 'PRODUCT_UPDATED',
            data: updatedProduct
          })
        }
      ]
    });
    
    res.json(updatedProduct);
  } catch (error) {
    console.error(`Error updating product ${req.params.id}:`, error);
    res.status(400).json({ error: 'Failed to update product' });
  }
});

// Delete product (soft delete)
app.delete('/products/:id', async (req, res) => {
  try {
    const deactivatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!deactivatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Produce Kafka message for deactivated product
    await producer.send({
      topic: 'product-events',
      messages: [
        { 
          key: 'product-deactivated', 
          value: JSON.stringify({
            event: 'PRODUCT_DEACTIVATED',
            data: deactivatedProduct
          })
        }
      ]
    });
    
    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    console.error(`Error deactivating product ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
});

// Initialize Kafka producer and consumer
const startKafka = async () => {
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topics: ['product-events'] });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`Received message from ${topic}: ${message.key?.toString()}`, data);
      
      // Process messages (if needed)
      // This could be used for handling events from other services if needed
    }
  });
};

// Start the server
app.listen(PORT, async () => {
  console.log(`Product Service listening on port ${PORT}`);
  try {
    await startKafka();
    console.log('Kafka producer and consumer are connected');
    
    // Initialize sample products if none exist
    const count = await Product.countDocuments();
    if (count === 0) {
      await initializeProducts();
    }
  } catch (error) {
    console.error('Failed to start Kafka:', error);
  }
});

// Initialize sample products
async function initializeProducts() {
  try {
    const sampleProducts = [
      {
        name: 'Basic Health Plan',
        description: 'Essential healthcare coverage for individuals',
        coverageAmount: 500000,
        premiumRates: {
          monthly: 2500,
          quarterly: 7000,
          yearly: 25000
        },
        coverageDetails: {
          hospitalCoverage: true,
          medicineCoverage: true,
          doctorConsultationCoverage: true,
          specialistCoverage: false,
          dentalCoverage: false,
          visionCoverage: false,
          maternityBenefits: false
        },
        waitingPeriod: 30,
        maxAge: 65
      },
      {
        name: 'Premium Health Plan',
        description: 'Comprehensive healthcare coverage for families',
        coverageAmount: 1000000,
        premiumRates: {
          monthly: 5000,
          quarterly: 14000,
          yearly: 50000
        },
        coverageDetails: {
          hospitalCoverage: true,
          medicineCoverage: true,
          doctorConsultationCoverage: true,
          specialistCoverage: true,
          dentalCoverage: true,
          visionCoverage: true,
          maternityBenefits: true
        },
        waitingPeriod: 15,
        maxAge: 70
      },
      {
        name: 'Senior Care Plan',
        description: 'Specialized healthcare for seniors with additional benefits',
        coverageAmount: 750000,
        premiumRates: {
          monthly: 4000,
          quarterly: 11000,
          yearly: 40000
        },
        coverageDetails: {
          hospitalCoverage: true,
          medicineCoverage: true,
          doctorConsultationCoverage: true,
          specialistCoverage: true,
          dentalCoverage: true,
          visionCoverage: true,
          maternityBenefits: false
        },
        waitingPeriod: 45,
        maxAge: 80
      }
    ];
    
    await Product.insertMany(sampleProducts);
    console.log('Sample products initialized');
  } catch (error) {
    console.error('Error initializing sample products:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server and Kafka connections');
  await producer.disconnect();
  await consumer.disconnect();
  process.exit(0);
});