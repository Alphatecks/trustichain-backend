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
 * @desc    Fund wallet (deposit) - Prepare transaction for user signing
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP' | 'USDT' | 'USDC' }
 */
router.post('/fund', authenticate, asyncHandler(async (req, res) => {
  await walletController.fundWallet(req, res);
}));

/**
 * @route   POST /api/wallet/fund/complete
 * @desc    Complete wallet funding after user signs transaction
 * @access  Private
 * @body    { transactionId: string, signedTxBlob: string }
 */
router.post('/fund/complete', authenticate, asyncHandler(async (req, res) => {
  await walletController.completeFundWallet(req, res);
}));

/**
 * @route   POST /api/wallet/fund/create-payload
 * @desc    Create XUMM payload for transaction signing
 * @access  Private
 * @body    { transactionId: string, transactionBlob: string }
 */
router.post('/fund/create-payload', authenticate, asyncHandler(async (req, res) => {
  await walletController.createXUMMPayload(req, res);
}));

/**
 * @route   GET /api/wallet/fund/status
 * @desc    Get XUMM payload status
 * @access  Private
 * @query   transactionId
 */
router.get('/fund/status', authenticate, asyncHandler(async (req, res) => {
  await walletController.getXUMMPayloadStatus(req, res);
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


