const { Sequelize } = require("sequelize");
require("dotenv").config();

// Create a new Sequelize instance to connect to the PostgreSQL database
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "postgres",
  dialectOptions: {
    ssl: { rejectUnauthorized: false }
  },
  port: process.env.DB_PORT,
  logging: false,
});

// Authenticate the connection to the database
const connectDB = async () => {
    try {
      await sequelize.authenticate();
      console.log("✅ Database connected successfully.");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
    }
  };
module.exports = sequelize;


