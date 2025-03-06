require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const paymentRoutes = require('./routes/paymentRoutes');
const sequelize = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmqConfig');
const redisClient = require('./redisConfig'); 
const app = express();

connectRabbitMQ();

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Serve static files from 'public' directory for success and failure pages
app.use(express.static(path.join(__dirname, 'public')));

// Payment routes
app.use('/api/payment', paymentRoutes);

// Fallback route for serving payment success and failure pages
app.get('/payment-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});

app.get('/payment-failed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-failed.html'));
});

// 404 handler for API routes (returns JSON)
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Sync database and start server
sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced successfully');
    const PORT = process.env.PORT || 5009;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('Database sync error:', err));
