const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');


exports.register = async (req, res) => {
    const { email, password } = req.body;
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'User already exists' });
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ email, password: hashedPassword });
      await newUser.save();
  
      res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.json({ accessToken, refreshToken });
};
exports.refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken(user._id);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};
exports.logout = async (req, res) => {
  const user = await User.findById(req.userId);
  user.refreshToken = null;
  await user.save();
  res.json({ message: 'Logged out successfully' });
};

// exports.login = async (req, res) => {
//   // same login logic
//   const { email, password } = req.body;
//     try {
//       const user = await User.findOne({ email });
//       if (!user) return res.status(400).json({ message: 'Invalid email or password' });
  
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
  
//       const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
//       res.json({ token });
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
// };
// app.post('/register', async (req, res) => {
//     const { email, password } = req.body;
//     try {
//       const existingUser = await User.findOne({ email });
//       if (existingUser) return res.status(400).json({ message: 'User already exists' });
  
//       const hashedPassword = await bcrypt.hash(password, 10);
//       const newUser = new User({ email, password: hashedPassword });
//       await newUser.save();
  
//       res.status(201).json({ message: 'User registered successfully' });
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });
//   app.post('/login', async (req, res) => {
//     const { email, password } = req.body;
//     try {
//       const user = await User.findOne({ email });
//       if (!user) return res.status(400).json({ message: 'Invalid email or password' });
  
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
  
//       const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
//       res.json({ token });
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });