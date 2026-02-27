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

/**
 * @route   POST /api/business-suite/payrolls
 * @desc    Create payroll (+ Add Payroll)
 * @access  Private (business suite only)
 */
router.post('/payrolls', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.createPayroll(req, res);
}));

/**
 * @route   GET /api/business-suite/payrolls
 * @desc    List payrolls (left pane cards)
 * @access  Private (business suite only)
 */
router.get('/payrolls', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.listPayrolls(req, res);
}));

/**
 * @route   GET /api/business-suite/payrolls/summary
 * @desc    Payroll dashboard summary (total payroll, team members, escrowed)
 * @access  Private (business suite only)
 */
router.get('/payrolls/summary', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPayrollSummary(req, res);
}));

/**
 * @route   GET /api/business-suite/payrolls/transactions
 * @desc    Transaction history. Query: page, pageSize, month (YYYY-MM)
 * @access  Private (business suite only)
 */
router.get('/payrolls/transactions', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPayrollTransactions(req, res);
}));

/**
 * @route   GET /api/business-suite/payrolls/transactions/:id
 * @desc    Single transaction (payroll item) detail
 * @access  Private (business suite only)
 */
router.get('/payrolls/transactions/:id', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPayrollTransactionDetail(req, res);
}));

/**
 * @route   GET /api/business-suite/payrolls/:id
 * @desc    Payroll detail (View)
 * @access  Private (business suite only)
 */
router.get('/payrolls/:id', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getPayrollDetail(req, res);
}));

/**
 * @route   PATCH /api/business-suite/payrolls/:id
 * @desc    Update payroll (Freeze Auto release, name, release date)
 * @access  Private (business suite only)
 */
router.patch('/payrolls/:id', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.updatePayroll(req, res);
}));

/**
 * @route   POST /api/business-suite/payrolls/:id/release
 * @desc    Release payroll now
 * @access  Private (business suite only)
 */
router.post('/payrolls/:id/release', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.releasePayroll(req, res);
}));

/**
 * @route   GET /api/business-suite/wallet/balance
 * @desc    Business suite XRP wallet balance (separate from personal wallet)
 * @access  Private (business suite only)
 */
router.get('/wallet/balance', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getWalletBalance(req, res);
}));

/**
 * @route   POST /api/business-suite/wallet/connect
 * @desc    Connect XRPL wallet to business suite (body: { walletAddress })
 * @access  Private (business suite only)
 */
router.post('/wallet/connect', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.connectWallet(req, res);
}));

/**
 * @route   POST /api/business-suite/wallet/disconnect
 * @desc    Disconnect business suite XRPL wallet
 * @access  Private (business suite only)
 */
router.post('/wallet/disconnect', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.disconnectWallet(req, res);
}));

/**
 * @route   POST /api/business-suite/wallet/connect/xumm
 * @desc    Create XUMM payload to connect XRPL wallet to business suite (same as personal flow, independent wallet)
 * @access  Private (business suite only)
 */
router.post('/wallet/connect/xumm', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.connectWalletViaXUMM(req, res);
}));

/**
 * @route   GET /api/business-suite/wallet/connect/xumm/status
 * @desc    Check XUMM connection status and connect business wallet when signed. Query: xummUuid
 * @access  Private (business suite only)
 */
router.get('/wallet/connect/xumm/status', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.checkXUMMConnectionStatus(req, res);
}));

export default router;
