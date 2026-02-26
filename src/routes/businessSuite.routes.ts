import { Router } from 'express';
import { businessSuiteController } from '../controllers/businessSuite.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/business-suite/pin-status
 * @desc    Get whether user has business suite and whether PIN is set
 * @access  Private
 */
router.get('/pin-status', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPinStatus(req, res);
}));

/**
 * @route   POST /api/business-suite/verify-pin
 * @desc    Verify 6-digit PIN when switching from personal to business suite
 * @access  Private
 */
router.post('/verify-pin', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.verifyPin(req, res);
}));

/**
 * @route   POST /api/business-suite/set-pin
 * @desc    Set or update 6-digit business suite PIN
 * @access  Private
 */
router.post('/set-pin', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.setPin(req, res);
}));

export default router;
