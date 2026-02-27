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

/**
 * @route   GET /api/business-suite/dashboard/summary
 * @desc    Business suite dashboard summary (balance, escrows, trustiscore, payrolls, suppliers, completed this month)
 * @access  Private (business suite only)
 */
router.get('/dashboard/summary', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getDashboardSummary(req, res);
}));

/**
 * @route   GET /api/business-suite/dashboard/activity
 * @desc    Paginated activity list (escrows created by this business user). Query: status, page, pageSize, sortBy, sortOrder
 * @access  Private (business suite only)
 */
router.get('/dashboard/activity', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getActivityList(req, res);
}));

/**
 * @route   GET /api/business-suite/dashboard/portfolio
 * @desc    Portfolio chart: Subscription and Payroll amounts and percentages by period. Query: period (weekly|monthly|quarterly|yearly), year (optional)
 * @access  Private (business suite only)
 */
router.get('/dashboard/portfolio', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPortfolioChart(req, res);
}));

/**
 * @route   GET /api/business-suite/dashboard/upcoming-supply
 * @desc    Upcoming Supply list (name, email, amount, due date). Query: page, pageSize
 * @access  Private (business suite only)
 */
router.get('/dashboard/upcoming-supply', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getUpcomingSupply(req, res);
}));

/**
 * @route   GET /api/business-suite/dashboard/subscription
 * @desc    Subscription list (name, email, amount, next payment date). Query: page, pageSize
 * @access  Private (business suite only)
 */
router.get('/dashboard/subscription', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSubscriptionList(req, res);
}));

/**
 * @route   GET /api/business-suite/teams
 * @desc    My Teams list (paginated). Query: page, pageSize
 * @access  Private (business suite only)
 */
router.get('/teams', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getTeamList(req, res);
}));

/**
 * @route   GET /api/business-suite/teams/:id
 * @desc    Single team detail with members (for View)
 * @access  Private (business suite only)
 */
router.get('/teams/:id', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getTeamDetail(req, res);
}));

export default router;
