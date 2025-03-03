require('dotenv').config();
const express = require('express');
const paymentRoutes = require('./routes/paymentRoutes');
const sequelize = require('./config/database');
const cors = require('cors');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/payment', paymentRoutes);

sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced successfully');
    const PORT = process.env.PORT || 5009;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('Database sync error:', err));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});