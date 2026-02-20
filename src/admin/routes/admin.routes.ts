import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { validateAdminLogin } from '../middleware/adminValidation';
import { adminAuthenticate } from '../middleware/adminAuth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /api/admin/login
 * @desc    Login an admin user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateAdminLogin, asyncHandler(async (req, res) => {
  await adminController.login(req, res);
}));

/**
 * @route   POST /api/admin/logout
 * @desc    Logout an admin user (invalidates session)
 * @access  Private (requires admin authentication)
 * @header  Authorization: Bearer <access_token>
 */
router.post('/logout', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.logout(req, res);
}));

// --- Dashboard (all require admin auth) ---

/**
 * @route   GET /api/admin/dashboard/overview
 * @desc    Platform overview: total users, escrows, transactions, pending actions + growth %
 * @access  Private (admin)
 */
router.get('/dashboard/overview', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getOverview(req, res);
}));

/**
 * @route   GET /api/admin/dashboard/escrow-insight
 * @desc    Escrow insight: approved vs pending for period (query: period=last_month|last_6_months)
 * @access  Private (admin)
 */
router.get('/dashboard/escrow-insight', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getEscrowInsight(req, res);
}));

/**
 * @route   GET /api/admin/dashboard/dispute-resolution
 * @desc    Dispute resolution: total resolved + by month (query: period=last_6_months)
 * @access  Private (admin)
 */
router.get('/dashboard/dispute-resolution', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeResolution(req, res);
}));

/**
 * @route   GET /api/admin/dashboard/live-feed
 * @desc    Live transactions feed (query: limit=10)
 * @access  Private (admin)
 */
router.get('/dashboard/live-feed', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getLiveTransactionsFeed(req, res);
}));

/**
 * @route   GET /api/admin/dashboard/users
 * @desc    User & business overview: users with account type, KYC, volume, last activity (query: limit, offset)
 * @access  Private (admin)
 */
router.get('/dashboard/users', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getUserOverview(req, res);
}));

/**
 * @route   GET /api/admin/kyc
 * @desc    List users for KYC verification
 * @access  Private (admin)
 */
router.get('/kyc', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getKycList(req, res);
}));

/**
 * @route   GET /api/admin/kyc/:userId
 * @desc    KYC detail for a user
 * @access  Private (admin)
 */
router.get('/kyc/:userId', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getKycDetail(req, res);
}));

/**
 * @route   POST /api/admin/kyc/approve
 * @desc    Approve/decline/suspend KYC (body: { userId, status: 'verified'|'declined'|'suspended' })
 * @access  Private (admin)
 */
router.post('/kyc/approve', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.approveKyc(req, res);
}));

/**
 * @route   GET /api/admin/search
 * @desc    Search users, escrows, disputes (query: q=term, limit=20)
 * @access  Private (admin)
 */
router.get('/search', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.search(req, res);
}));

/**
 * @route   GET /api/admin/alerts
 * @desc    Alerts for admin panel
 * @access  Private (admin)
 */
router.get('/alerts', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getAlerts(req, res);
}));

export default router;
