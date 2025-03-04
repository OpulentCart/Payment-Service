require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/payment');
const { getChannel } = require("../config/rabbitmqConfig");

const createCheckoutSession = async (req, res) => {
  try {
    const { items, totalAmount, userId } = req.body; // Removed email from req.body

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

    // Create the Checkout Session without pre-filling email
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      billing_address_collection: 'required', // Mandatory for Indian export compliance, email will be collected here
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'], // Adjust for your target countries
      },
      success_url: `${req.protocol}://${req.get('host')}/api/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/payment/failure`,
      metadata: { userId: userId.toString() },
    });

    // Save payment details to database
    try {
      await Payment.create({
        customer_id: userId,
        amount: totalAmount,
        payment_method: 'card',
        transaction_id: session.id,
        payment_status: 'pending',
        // Note: stripe_customer_id is not available since we didn’t create a customer explicitl
      });

      // Send orders to RabbitMQ
      const channel = getChannel();
      if (channel) {
          const order = {
            user_id: userId,
            items,
            totalAmount
          };
          channel.sendToQueue("orders", Buffer.from(JSON.stringify(order)), { persistent: true });
          console.log("📨 Sent order to RabbitMQ:", order);
      } else {
          console.error("❌ RabbitMQ channel not available");
      }


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
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata.userId;

    await Payment.update(
      { payment_status: 'success', updated_at: new Date() },
      { where: { transaction_id: sessionId, customer_id: userId } }
    );

    

    res.status(200).json({ message: 'Payment successful' });
  } catch (error) {
    console.error('Payment success error:', error.message);
    res.status(500).json({ message: 'Error processing payment success', error: error.message });
  }
};

const handlePaymentFailure = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata.userId;

    await Payment.update(
      { payment_status: 'failed', updated_at: new Date() },
      { where: { transaction_id: sessionId, customer_id: userId } }
    );

    res.status(400).json({ message: 'Payment failed' });
  } catch (error) {
    console.error('Payment failure error:', error.message);
    res.status(500).json({ message: 'Error processing payment failure', error: error.message });
  }
};

module.exports = { createCheckoutSession, handlePaymentSuccess, handlePaymentFailure };