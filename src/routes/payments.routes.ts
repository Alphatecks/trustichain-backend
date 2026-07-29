import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { paymentsController } from '../controllers/payments.controller';

const router = Router();

/**
 * @route   POST /api/payments/payment-intent
 * @desc    Create Stripe PaymentIntent and return client_secret
 * @access  Private
 */
router.post('/payment-intent', authenticate, asyncHandler(async (req, res) => {
  await paymentsController.createPaymentIntent(req, res);
}));

/**
 * @route   POST /api/payments/escrow/:escrowId/payment-intent
 * @desc    Create Stripe PaymentIntent for a specific escrow
 * @access  Private
 */
router.post('/escrow/:escrowId/payment-intent', authenticate, asyncHandler(async (req, res) => {
  await paymentsController.createPaymentIntent(req, res);
}));

/**
 * @route   POST /api/payments/setup-intent
 * @desc    Create Stripe SetupIntent and return client_secret
 * @access  Private
 */
router.post('/setup-intent', authenticate, asyncHandler(async (req, res) => {
  await paymentsController.createSetupIntent(req, res);
}));

/**
 * @route   POST /api/payments/escrow/:escrowId/setup-intent
 * @desc    Create Stripe SetupIntent for a specific escrow
 * @access  Private
 */
router.post('/escrow/:escrowId/setup-intent', authenticate, asyncHandler(async (req, res) => {
  await paymentsController.createSetupIntent(req, res);
}));

/**
 * @route   GET /api/payments/escrow/:escrowId/status
 * @desc    Get latest payment status linked to escrow
 * @access  Private
 */
router.get('/escrow/:escrowId/status', authenticate, asyncHandler(async (req, res) => {
  await paymentsController.getEscrowPaymentStatus(req, res);
}));

export default router;
