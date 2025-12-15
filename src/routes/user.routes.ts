import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  await userController.getUserProfile(req, res);
}));

/**
 * @route   GET /api/user/linked-accounts
 * @desc    Get user linked accounts
 * @access  Private
 */
router.get('/linked-accounts', authenticate, asyncHandler(async (req, res) => {
  await userController.getLinkedAccounts(req, res);
}));

/**
 * @route   GET /api/user/beneficiaries
 * @desc    Get user beneficiaries
 * @access  Private
 */
router.get('/beneficiaries', authenticate, asyncHandler(async (req, res) => {
  await userController.getBeneficiaries(req, res);
}));

export default router;


