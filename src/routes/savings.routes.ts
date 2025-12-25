import { Router } from 'express';
import { savingsController } from '../controllers/savings.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/savings/summary
 * @desc    Get savings allocation summary (top card)
 * @access  Private
 * @query   range? - this_month | last_month | this_year (default: this_month)
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    await savingsController.getSummary(req, res);
  })
);

/**
 * @route   GET /api/savings/cashflow
 * @desc    Get savings cashflow data (received vs spent)
 * @access  Private
 * @query   interval? - monthly | weekly (default: monthly)
 * @query   from? - ISO date string
 * @query   to?   - ISO date string
 */
router.get(
  '/cashflow',
  authenticate,
  asyncHandler(async (req, res) => {
    await savingsController.getCashflow(req, res);
  })
);

/**
 * @route   GET /api/savings/wallets
 * @desc    Get list of savings wallets for the user
 * @access  Private
 */
router.get(
  '/wallets',
  authenticate,
  asyncHandler(async (req, res) => {
    await savingsController.getWallets(req, res);
  })
);

/**
 * @route   POST /api/savings/wallets
 * @desc    Create a new savings wallet
 * @access  Private
 * @body    { name: string, targetAmountUsd?: number }
 */
router.post(
  '/wallets',
  authenticate,
  asyncHandler(async (req, res) => {
    await savingsController.createWallet(req, res);
  })
);

/**
 * @route   GET /api/savings/transactions
 * @desc    Get savings transaction history for table
 * @access  Private
 * @query   walletId?  - Filter by savings wallet
 * @query   direction? - all | received | spent (default: all)
 * @query   range?     - daily | weekly | monthly
 * @query   page?      - Page number (default: 1)
 * @query   pageSize?  - Page size (default: 10)
 */
router.get(
  '/transactions',
  authenticate,
  asyncHandler(async (req, res) => {
    await savingsController.getTransactions(req, res);
  })
);

export default router;


