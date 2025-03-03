const express = require('express');
const { createCheckoutSession, handlePaymentSuccess, handlePaymentFailure } = require('../controllers/paymentController');
// const authMiddleware = require('../middleware/authMiddleware'); // No longer needed

const router = express.Router();

router.post('/create-checkout-session', createCheckoutSession); // No authMiddleware
router.get('/success', handlePaymentSuccess);
router.get('/failure', handlePaymentFailure);

module.exports = router;