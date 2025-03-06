require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/payment');
const { getChannel } = require("../config/rabbitmqConfig");
const redisClient = require('../config/redisConfig');

const createCheckoutSession = async (req, res) => {
  try {
    const { items, totalAmount, userId, shippingDetails } = req.body; // Removed email from req.body

    // Input validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    if (!totalAmount || isNaN(totalAmount)) {
      return res.status(400).json({ message: 'Invalid total amount' });
    }

    console.log('Order items received:', items);
    console.log('Total amount:', totalAmount);
    console.log('User ID:', userId);

    // Validate and map line items
    const lineItems = items.map(item => {
      if (!item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
        throw new Error('Invalid item data: name, price, and quantity are required');
      }
      if (item.price <= 0 || item.quantity <= 0) {
        throw new Error('Price and quantity must be positive');
      }
      return {
        price_data: {
          currency: 'inr',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // Convert to paise
        },
        quantity: Math.floor(item.quantity), // Ensure integer quantity
      };
    });

    // Generate a unique key for storing order details
    const orderKey = `order:${userId}:${Date.now()}`;
    const orderDetails = { items, totalAmount, shippingDetails };

    // Store order details in Redis with a 1-hour expiration
    await redisClient.setEx(orderKey, 3600, JSON.stringify(orderDetails));

    console.log("🗄️ Order stored in Redis:", orderKey);

    // Create the Checkout Session without pre-filling email
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'] },
      success_url: `${req.protocol}://${req.get('host')}/api/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/payment/failure?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { userId: userId.toString(), orderKey: orderKey.toString()},
    });

    // Save payment details to database
    try {
      const payment = await Payment.create({
        customer_id: userId,
        amount: totalAmount,
        payment_method: 'card',
        transaction_id: session.id,
        payment_status: 'pending',
        // Note: stripe_customer_id is not available since we didn’t create a customer explicitl
      });

    } catch (dbError) {
      console.error('Database error:', dbError.message);
      throw new Error('Failed to save payment record');
    }

    res.status(200).json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error.message);
    res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
  }
};

const handlePaymentSuccess = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.redirect('/payment-failed');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // retrieving userId and orderKey from the metadata of the Stripe.
    const userId = parseInt(session.metadata.userId, 10); 
    const orderKey = session.metadata.orderKey;

    if (session.payment_status === 'paid') {
      await Payment.update(
        { payment_status: 'completed', updated_at: new Date() },
        { where: { transaction_id: sessionId, customer_id: userId } }
      );

      const payment = await Payment.findOne({
        where: { transaction_id: sessionId, customer_id: userId }
      });

      // Retrieve order details from Redis
      const orderData = await redisClient.get(orderKey);
      if (!orderData) {
        console.error('❌ Order not found in Redis');
        return res.redirect('/payment-failed');
      }

      const order = JSON.parse(orderData);

      // Attach payment ID to the order
      order.payment_id = payment.payment_id;
      order.user_id = userId;
      console.log("📦 Retrieved order from Redis:", order);

      // Send orders to RabbitMQ
      const channel = getChannel();
      if (channel) {
          channel.sendToQueue("orders", Buffer.from(JSON.stringify(order)), { persistent: true });
          console.log("📨 Sent order to RabbitMQ:", order);
      } else {
          console.error("❌ RabbitMQ channel not available");
      }

      return res.redirect('/payment-success');
    } else {
      await Payment.update(
        { payment_status: 'failed', updated_at: new Date() },
        { where: { transaction_id: sessionId, customer_id: userId } }
      );
      return res.redirect('/payment-failed');
    }
  } catch (error) {
    console.error('Payment success error:', error.message);
    res.redirect('/payment-failed');
  }
};

const handlePaymentFailure = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.redirect('/payment-failed');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata.userId;

    await Payment.update(
      { payment_status: 'failed', updated_at: new Date() },
      { where: { transaction_id: sessionId, customer_id: userId } }
    );

    res.redirect('/payment-failed');
  } catch (error) {
    console.error('Payment failure error:', error.message);
    res.redirect('/payment-failed');
  }
};

module.exports = { createCheckoutSession, handlePaymentSuccess, handlePaymentFailure };