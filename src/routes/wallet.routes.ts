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
 * @route   POST /api/wallet/swap/quote
 * @desc    Get quote for swapping between XRP, USDT, and USDC
 * @access  Private
 * @body    { amount: number, fromCurrency: 'XRP' | 'USDT' | 'USDC', toCurrency: 'XRP' | 'USDT' | 'USDC' }
 */
router.post('/swap/quote', authenticate, asyncHandler(async (req, res) => {
  await walletController.getSwapQuote(req, res);
}));

/**
 * @route   POST /api/wallet/swap
 * @desc    Execute a swap between XRP, USDT, and USDC
 * @access  Private
 * @body    { amount: number, fromCurrency: 'XRP' | 'USDT' | 'USDC', toCurrency: 'XRP' | 'USDT' | 'USDC' }
 */
router.post('/swap', authenticate, asyncHandler(async (req, res) => {
  await walletController.executeSwap(req, res);
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
 * @route   POST /api/wallet/fund
 * @desc    Fund wallet (deposit)
 * @access  Private
 * @body    { amount: number, currency: 'USD' | 'XRP' }
 */
router.post('/fund', authenticate, asyncHandler(async (req, res) => {
  await walletController.fundWallet(req, res);
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

/**
 * @route   POST /api/wallet/connect
 * @desc    Connect MetaMask wallet (XRPL address) to user account
 * @access  Private
 * @body    { walletAddress: string }
 */
router.post('/connect', authenticate, asyncHandler(async (req, res) => {
  await walletController.connectWallet(req, res);
}));

/**
 * @route   POST /api/wallet/validate-address
 * @desc    Validate wallet address format (helper endpoint - no auth required)
 * @access  Public
 * @body    { walletAddress: string }
 */
router.post('/validate-address', asyncHandler(async (req, res) => {
  await walletController.validateAddress(req, res);
}));

/**
 * @route   POST /api/wallet/connect/xumm
 * @desc    Connect wallet via XUMM (Xaman app)
 * @access  Private
 * @body    {} (no body needed)
 */
router.post('/connect/xumm', authenticate, asyncHandler(async (req, res) => {
  await walletController.connectWalletViaXUMM(req, res);
}));

/**
 * @route   GET /api/wallet/connect/xumm/status
 * @desc    Check XUMM connection status and connect wallet when signed
 * @access  Private
 * @query   xummUuid
 */
router.get('/connect/xumm/status', authenticate, asyncHandler(async (req, res) => {
  await walletController.checkXUMMConnectionStatus(req, res);
}));

/**
 * @route   POST /api/wallet/fund/xumm
 * @desc    Fund wallet via XUMM (Xaman app) - debits XRP from user's Xaman wallet
 * @access  Private
 * @body    { amount: number } (amount in XRP)
 */
router.post('/fund/xumm', authenticate, asyncHandler(async (req, res) => {
  await walletController.fundWalletViaXUMM(req, res);
}));

/**
 * @route   GET /api/wallet/fund/xumm/status
 * @desc    Check XUMM fund status and submit transaction when signed
 * @access  Private
 * @query   transactionId, xummUuid
 */
router.get('/fund/xumm/status', authenticate, asyncHandler(async (req, res) => {
  await walletController.checkXUMMFundStatus(req, res);
}));

export default router;


