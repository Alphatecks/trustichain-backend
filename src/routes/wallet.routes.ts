import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/wallet/balance
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/balance', authenticate, asyncHandler(async (req, res) => {
  await walletController.getBalance(req, res);
}));

/**
 * @route   POST /api/wallet/fund
 * @desc    Fund wallet (deposit)
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP' }
 */
router.post('/fund', authenticate, asyncHandler(async (req, res) => {
  await walletController.fundWallet(req, res);
}));

/**
 * @route   GET /api/wallet/fund/status
 * @desc    Get XUMM payload status for deposit (if using XUMM)
 * @access  Private
 * @query   transactionId
 */
router.get('/fund/status', authenticate, asyncHandler(async (req, res) => {
  await walletController.getXUMMPayloadStatus(req, res);
}));

/**
 * @route   POST /api/wallet/fund/submit
 * @desc    Submit signed transaction (for browser wallets like Crossmark, MetaMask+XRPL Snap)
 * @access  Private
 * @body    { transactionId: string, signedTxBlob: string }
 */
router.post('/fund/submit', authenticate, asyncHandler(async (req, res) => {
  await walletController.submitSignedDeposit(req, res);
}));

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Withdraw from wallet
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP', destinationAddress: string }
 */
router.post('/withdraw', authenticate, asyncHandler(async (req, res) => {
  await walletController.withdrawWallet(req, res);
}));

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transactions
 * @access  Private
 * @query   limit, offset
 */
router.get('/transactions', authenticate, asyncHandler(async (req, res) => {
  await walletController.getTransactions(req, res);
}));

export default router;


