import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/wallet/balance
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/balance', authenticate, async (req, res) => {
  await walletController.getBalance(req, res);
});

/**
 * @route   POST /api/wallet/fund
 * @desc    Fund wallet (deposit)
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP' }
 */
router.post('/fund', authenticate, async (req, res) => {
  await walletController.fundWallet(req, res);
});

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Withdraw from wallet
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP', destinationAddress: string }
 */
router.post('/withdraw', authenticate, async (req, res) => {
  await walletController.withdrawWallet(req, res);
});

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transactions
 * @access  Private
 * @query   limit, offset
 */
router.get('/transactions', authenticate, async (req, res) => {
  await walletController.getTransactions(req, res);
});

export default router;


