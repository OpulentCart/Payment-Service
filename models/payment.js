const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  payment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Matches nullable column
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'payments',
  timestamps: false,
});

module.exports = Payment;