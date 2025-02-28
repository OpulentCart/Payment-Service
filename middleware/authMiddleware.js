// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables

const authMiddleware = (req, res, next) => {
  // Extract token from Authorization header (e.g., "Bearer <token>")
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if token exists
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    // Verify token using the secret from .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user data (e.g., userId) to request
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;