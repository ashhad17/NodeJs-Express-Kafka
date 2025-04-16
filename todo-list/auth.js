const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your-secret-key';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Expecting "Bearer TOKEN"
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = auth;
