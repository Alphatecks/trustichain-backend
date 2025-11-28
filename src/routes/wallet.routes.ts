import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/wallet/balance
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/balance', authenticate, (req, res) => {
  walletController.getBalance(req, res);
});

/**
 * @route   POST /api/wallet/fund
 * @desc    Fund wallet (deposit)
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP' }
 */
router.post('/fund', authenticate, (req, res) => {
  walletController.fundWallet(req, res);
});

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Withdraw from wallet
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP', destinationAddress: string }
 */
router.post('/withdraw', authenticate, (req, res) => {
  walletController.withdrawWallet(req, res);
});

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transactions
 * @access  Private
 * @query   limit, offset
 */
router.get('/transactions', authenticate, (req, res) => {
  walletController.getTransactions(req, res);
});

export default router;
