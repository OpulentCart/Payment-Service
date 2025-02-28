require('dotenv').config();

const express = require('express');
const paymentRoutes = require('./routes/paymentRoutes.js');
const sequelize = require('./config/database.js');


const app = express();

app.use(express.json());
app.use('/api/payment', paymentRoutes);

sequelize.sync({ force: false }).then(() => {
  console.log('Database synced');
  app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
}).catch(err => console.error('Database sync error:', err));

