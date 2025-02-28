// routes/paymentRoutes.js
const express = require('express');
const { createCheckoutSession, handlePaymentSuccess, handlePaymentFailure } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create-checkout-session', authMiddleware, createCheckoutSession);
router.get('/success', authMiddleware, handlePaymentSuccess);
router.get('/failure', authMiddleware, handlePaymentFailure);

module.exports = router;