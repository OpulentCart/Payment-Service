const amqp = require("amqplib");
require("dotenv").config();

let channel = null;

const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue("notifications", { durable: true });

        console.log("✅ Connected to RabbitMQ");
    } catch (error) {
        console.error("❌ RabbitMQ Connection Error:", error.message);
    }
};

module.exports = { connectRabbitMQ, getChannel: () => channel };