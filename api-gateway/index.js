const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { Kafka } = require('kafkajs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Kafka setup
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9093']
});

// Service URLs
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3002';
const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://policy-service:3003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Gateway is running' });
});

// Product Service Routes
app.get('/products', async (req, res) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/products`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/products/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// User Service Routes
app.post('/users/register', async (req, res) => {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users/register`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/users/login', async (req, res) => {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users/login`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(401).json({ error: 'Failed to login' });
  }
});

// Policy Service Routes
app.post('/policies', async (req, res) => {
  try {
    const response = await axios.post(`${POLICY_SERVICE_URL}/policies`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error creating policy:', error.message);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

app.get('/policies/user/:userId', async (req, res) => {
  try {
    const response = await axios.get(`${POLICY_SERVICE_URL}/policies/user/${req.params.userId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching policies for user ${req.params.userId}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Payment Service Routes
app.post('/payments', async (req, res) => {
  try {
    const response = await axios.post(`${PAYMENT_SERVICE_URL}/payments`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error processing payment:', error.message);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

app.get('/payments/policy/:policyId', async (req, res) => {
  try {
    const response = await axios.get(`${PAYMENT_SERVICE_URL}/payments/policy/${req.params.policyId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching payments for policy ${req.params.policyId}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});