const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Payment request routes
router.post('/request', validate(schemas.createPaymentRequest), PaymentController.createPaymentRequest);
router.get('/requests', PaymentController.getPaymentRequests);
router.get('/requests/approved', PaymentController.getApprovedPaymentRequests);
router.get('/requests/:paymentRequestId', PaymentController.getPaymentRequestById);
router.delete('/requests/:paymentRequestId', PaymentController.deletePaymentRequest);

// Payment approval/rejection routes
router.post('/approve', validate(schemas.approvePaymentRequest), PaymentController.approvePaymentRequest);
router.post('/reject', validate(schemas.rejectPaymentRequest), PaymentController.rejectPaymentRequest);

// Payment processing routes
router.post('/process', validate(schemas.processPayments), PaymentController.processPayments);

// Payment statistics
router.get('/stats', PaymentController.getPaymentStats);

module.exports = router;