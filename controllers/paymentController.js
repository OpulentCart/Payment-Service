// controllers/paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/payment');
const axios = require('axios'); // For API calls to other services

// Initiate a payment
const createCheckoutSession = async (req, res) => {
  const { product_ids } = req.body; // Product IDs from frontend
  const customer_id = req.user.id; // From auth middleware

  try {
    // Fetch product details from Product Service
    const productsResponse = await axios.post('http://product-service/api/products/batch', { product_ids });
    const products = productsResponse.data;

    // Calculate total amount
    const total_amount = products.reduce((sum, product) => sum + product.price, 0);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: products.map(product => ({
        price_data: {
          currency: 'inr',
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100), // Convert to cents
        },
        quantity: 1,
      })),
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/api/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/payment/failure?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { product_ids: product_ids.join(',') }, // Store for later use
    });

    // Record initial payment attempt
    await Payment.create({
      customer_id,
      amount: total_amount,
      payment_method: 'stripe',
      payment_status: 'pending',
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Handle successful payment
const handlePaymentSuccess = async (req, res) => {
  const { session_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      // Create order via Order Service
      const orderResponse = await axios.post('http://order-service/api/orders/create', {
        customer_id: req.user.id,
        total_amount: session.amount_total / 100,
        product_ids: session.metadata.product_ids.split(','),
      });

      const order_id = orderResponse.data.order_id;

      // Update payment record
      await Payment.update(
        {
          order_id,
          transaction_id: session.payment_intent,
          payment_status: 'success',
        },
        { where: { customer_id: req.user.id, payment_status: 'pending' } }
      );

      res.json({ message: 'Payment successful', order_id });
    } else {
      res.status(400).json({ message: 'Payment not completed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Handle failed payment
const handlePaymentFailure = async (req, res) => {
  const { session_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Update payment record
    await Payment.update(
      {
        transaction_id: session.payment_intent || null,
        payment_status: 'failed',
      },
      { where: { customer_id: req.user.id, payment_status: 'pending' } }
    );

    res.json({ message: 'Payment failed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createCheckoutSession, handlePaymentSuccess, handlePaymentFailure };