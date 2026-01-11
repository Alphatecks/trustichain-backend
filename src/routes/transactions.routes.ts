import { Router } from 'express';
import { walletController } from '../controllers/walletControllerExport';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/transactions
 * @desc    Get wallet transactions (alias for /api/wallet/transactions)
 * @access  Private
 * @query   limit, offset
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  await walletController.getTransactions(req, res);
}));

/**
 * @route   GET /api/transactions/list
 * @desc    Get wallet transactions list (alias for /api/wallet/transactions)
 * @access  Private
 * @query   limit, offset
 */
router.get('/list', authenticate, asyncHandler(async (req, res) => {
  await walletController.getTransactions(req, res);
}));

export default router;
