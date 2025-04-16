const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI|| "mongodb://localhost:27017/" )
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Kafka setup
const kafka = new Kafka({
  clientId: 'user-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9093']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'user-service-group' });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'health-insurance-jwt-secret';

// Define mongoose schema and model
const userSchema = new mongoose.Schema({
  firstName: { 
    type: String, 
    required: true 
  },
  lastName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  dateOfBirth: { 
    type: Date, 
    required: true 
  },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other'], 
    required: true 
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  phoneNumber: { 
    type: String, 
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

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'User Service is running' });
});

// Register new user
app.post('/users/register', async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Create new user
    const newUser = new User(req.body);
    const savedUser = await newUser.save();
    
    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    
    // Produce Kafka message for new user
    await producer.send({
      topic: 'user-events',
      messages: [
        { 
          key: 'user-created', 
          value: JSON.stringify({
            event: 'USER_CREATED',
            data: userResponse
          })
        }
      ]
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(400).json({ error: 'Failed to register user' });
  }
});

// User login
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ user: userResponse, token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get user profile
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json(userResponse);
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
app.put('/users/:id', async (req, res) => {
  try {
    // Remove password from update if present
    const updateData = { ...req.body, updatedAt: Date.now() };
    if (updateData.password) {
      delete updateData.password;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password from response
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    
    // Produce Kafka message for updated user
    await producer.send({
      topic: 'user-events',
      messages: [
        { 
          key: 'user-updated', 
          value: JSON.stringify({
            event: 'USER_UPDATED',
            data: userResponse
          })
        }
      ]
    });
    
    res.json(userResponse);
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    res.status(400).json({ error: 'Failed to update user' });
  }
});

// Deactivate user account
app.delete('/users/:id', async (req, res) => {
  try {
    const deactivatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!deactivatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password from response
    const userResponse = deactivatedUser.toObject();
    delete userResponse.password;
    
    // Produce Kafka message for deactivated user
    await producer.send({
      topic: 'user-events',
      messages: [
        { 
          key: 'user-deactivated', 
          value: JSON.stringify({
            event: 'USER_DEACTIVATED',
            data: userResponse
          })
        }
      ]
    });
    
    res.json({ message: 'User account deactivated successfully' });
  }catch (error) {
    console.error(`Error deactivating user ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to deactivate user' });
}
});
// Change password
app.post('/users/:id/change-password', async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Find user
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Validate current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Update password
      user.password = newPassword;
      user.updatedAt = Date.now();
      await user.save();
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error(`Error changing password for user ${req.params.id}:`, error);
      res.status(400).json({ error: 'Failed to change password' });
    }
  });
  
  // Initialize Kafka producer and consumer
  const startKafka = async () => {
    await producer.connect();
    await consumer.connect();
    
    await consumer.subscribe({ topics: ['user-events'] });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log(`Received message from ${topic}: ${message.key?.toString()}`, data);
        
        // Process messages (if needed)
      }
    });
  };
  
  // Start the server
  app.listen(PORT, async () => {
    console.log(`User Service listening on port ${PORT}`);
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