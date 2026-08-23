import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get all dashboard summary data (balance, escrows, trustiscore, total escrowed)
 * @access  Private
 */
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
  await dashboardController.getDashboardSummary(req, res);
}));

/**
 * @route   GET /api/dashboard/display-currency
 * @desc    Get user's saved display currency for portfolio graph
 * @access  Private
 */
router.get('/display-currency', authenticate, asyncHandler(async (req, res) => {
  await dashboardController.getDisplayCurrency(req, res);
}));

/**
 * @route   PATCH /api/dashboard/display-currency
 * @desc    Save display currency when user changes dashboard currency selector
 * @access  Private
 * @body    { displayCurrency: "EUR" } or { display_currency: "EUR" }
 */
router.patch('/display-currency', authenticate, asyncHandler(async (req, res) => {
  await dashboardController.updateDisplayCurrency(req, res);
}));

/**
 * @route   GET /api/dashboard/display-currencies
 * @desc    List supported display currency codes for the dashboard selector
 * @access  Private
 */
router.get('/display-currencies', authenticate, asyncHandler(async (req, res) => {
  await dashboardController.listDisplayCurrencies(req, res);
}));

export default router;


