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

// --- User Management (admin only) ---

/**
 * @route   GET /api/admin/user-management/stats
 * @desc    User management overview: total users, verified, personal suite, business suite + growth %
 * @access  Private (admin)
 */
router.get('/user-management/stats', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getUserManagementStats(req, res);
}));

/**
 * @route   GET /api/admin/user-management/users
 * @desc    User list with search, accountType (personal|business_suite), kycStatus, page, pageSize, sortBy, sortOrder
 * @access  Private (admin)
 */
router.get('/user-management/users', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getUserManagementUsers(req, res);
}));

/**
 * @route   PUT /api/admin/user-management/users/batch-kyc-status
 * @desc    Batch update KYC status (body: { userIds: string[], status })
 * @access  Private (admin) — must be before /:userId to avoid "batch-kyc-status" as userId
 */
router.put('/user-management/users/batch-kyc-status', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.batchUpdateUserKycStatus(req, res);
}));

/**
 * @route   GET /api/admin/user-management/users/:userId
 * @desc    Single user detail
 * @access  Private (admin)
 */
router.get('/user-management/users/:userId', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getUserManagementUserById(req, res);
}));

/**
 * @route   PUT /api/admin/user-management/users/:userId/kyc-status
 * @desc    Update one user's KYC status (body: { status: 'verified'|'pending'|'declined'|'suspended' })
 * @access  Private (admin)
 */
router.put('/user-management/users/:userId/kyc-status', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.updateUserKycStatus(req, res);
}));

// --- Escrow Management (admin only) ---

/**
 * @route   GET /api/admin/escrow-management/stats
 * @desc    Escrow dashboard stats: total amount, total count, completed, disputed + change % vs last month
 * @access  Private (admin)
 */
router.get('/escrow-management/stats', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getEscrowManagementStats(req, res);
}));

/**
 * @route   GET /api/admin/escrow-management/escrows
 * @desc    Paginated escrow list (query: search, status, page, pageSize, sortBy, sortOrder)
 * @access  Private (admin)
 */
router.get('/escrow-management/escrows', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getEscrowManagementList(req, res);
}));

/**
 * @route   GET /api/admin/escrow-management/escrows/:idOrRef
 * @desc    Escrow detail by UUID or ESC-YYYY-XXX
 * @access  Private (admin)
 */
router.get('/escrow-management/escrows/:idOrRef', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getEscrowManagementDetail(req, res);
}));

/**
 * @route   PATCH /api/admin/escrow-management/escrows/:idOrRef/status
 * @desc    Update escrow status (body: { status: 'pending'|'active'|'completed'|'cancelled'|'disputed' })
 * @access  Private (admin)
 */
router.patch('/escrow-management/escrows/:idOrRef/status', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.updateEscrowManagementStatus(req, res);
}));

// --- Business Management (admin only) ---

/**
 * @route   GET /api/admin/business-management/overview
 * @desc    Business overview: payrolls created, suppliers, API integrated, average resolution time + change %
 * @access  Private (admin)
 */
router.get('/business-management/overview', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getBusinessManagementOverview(req, res);
}));

/**
 * @route   GET /api/admin/business-management/activities
 * @desc    Paginated business activities list (query: search, status, page, pageSize, sortBy, sortOrder). status: 'In progress' | 'Completed' | 'Pending'
 * @access  Private (admin)
 */
router.get('/business-management/activities', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getBusinessManagementActivities(req, res);
}));

/**
 * @route   GET /api/admin/business-management/activities/:idOrRef
 * @desc    Single activity detail by UUID or ESC-YYYY-XXX
 * @access  Private (admin)
 */
router.get('/business-management/activities/:idOrRef', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getBusinessManagementActivityDetail(req, res);
}));

// --- Transaction Management (admin only) ---

/**
 * @route   GET /api/admin/transaction-management/overview
 * @desc    Transaction overview: total count, total amount, escrowed amount, payroll amount + change %
 * @access  Private (admin)
 */
router.get('/transaction-management/overview', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getTransactionManagementOverview(req, res);
}));

/**
 * @route   GET /api/admin/transaction-management/transactions
 * @desc    Paginated transaction list (query: search, accountType, status, type, page, pageSize, sortBy, sortOrder)
 * @access  Private (admin)
 */
router.get('/transaction-management/transactions', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getTransactionManagementList(req, res);
}));

/**
 * @route   GET /api/admin/transaction-management/transactions/:transactionId
 * @desc    Single transaction detail by UUID
 * @access  Private (admin)
 */
router.get('/transaction-management/transactions/:transactionId', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getTransactionManagementDetail(req, res);
}));

// --- Dispute Resolution (admin only) ---

/**
 * @route   GET /api/admin/dispute-resolution/metrics
 * @desc    Dispute metrics: total, active, resolved, average resolution time + change %
 * @access  Private (admin)
 */
router.get('/dispute-resolution/metrics', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeResolutionMetrics(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/alerts
 * @desc    Recent dispute alerts (query: limit=10)
 * @access  Private (admin)
 */
router.get('/dispute-resolution/alerts', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeResolutionAlerts(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes
 * @desc    Paginated dispute list (query: search, status, page, pageSize, sortBy, sortOrder)
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeResolutionList(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId
 * @desc    Single dispute detail by UUID or case_id
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeResolutionDetail(req, res);
}));

// --- Dispute Chat Details Screen (admin only) ---

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/detail-screen
 * @desc    Full detail screen: dispute, parties, mediator, evidence, timeline, verdict, assessment, messages
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/detail-screen', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeDetailScreen(req, res);
}));

/**
 * @route   POST /api/admin/dispute-resolution/disputes/:idOrCaseId/mediator
 * @desc    Assign mediator (body: { mediatorUserId })
 * @access  Private (admin)
 */
router.post('/dispute-resolution/disputes/:idOrCaseId/mediator', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.assignDisputeMediator(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/evidence
 * @desc    List evidence for dispute
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/evidence', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeEvidence(req, res);
}));

/**
 * @route   POST /api/admin/dispute-resolution/disputes/:idOrCaseId/evidence
 * @desc    Add evidence (body: title, description?, evidenceType?, fileUrl, fileName, fileType, fileSize)
 * @access  Private (admin)
 */
router.post('/dispute-resolution/disputes/:idOrCaseId/evidence', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.addDisputeEvidence(req, res);
}));

/**
 * @route   PATCH /api/admin/dispute-resolution/disputes/:idOrCaseId/evidence/:evidenceId
 * @desc    Update evidence (body: verified?, title?, description?)
 * @access  Private (admin)
 */
router.patch('/dispute-resolution/disputes/:idOrCaseId/evidence/:evidenceId', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.updateDisputeEvidence(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/timeline
 * @desc    List timeline events
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/timeline', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeTimeline(req, res);
}));

/**
 * @route   POST /api/admin/dispute-resolution/disputes/:idOrCaseId/timeline
 * @desc    Create timeline event (body: eventType, title, description?)
 * @access  Private (admin)
 */
router.post('/dispute-resolution/disputes/:idOrCaseId/timeline', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.createDisputeTimelineEvent(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/verdict
 * @desc    Get verdict info
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/verdict', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeVerdict(req, res);
}));

/**
 * @route   POST /api/admin/dispute-resolution/disputes/:idOrCaseId/verdict
 * @desc    Submit final verdict (body: finalVerdict, decisionSummary?, decisionOutcome?)
 * @access  Private (admin)
 */
router.post('/dispute-resolution/disputes/:idOrCaseId/verdict', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.submitDisputeVerdict(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/assessments/preliminary
 * @desc    Get preliminary assessment with findings
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/assessments/preliminary', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputePreliminaryAssessment(req, res);
}));

/**
 * @route   PUT /api/admin/dispute-resolution/disputes/:idOrCaseId/assessments/preliminary
 * @desc    Create or update preliminary assessment (body: title?, summary?, findings: [{ findingText, findingType?, orderIndex? }])
 * @access  Private (admin)
 */
router.put('/dispute-resolution/disputes/:idOrCaseId/assessments/preliminary', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.upsertDisputePreliminaryAssessment(req, res);
}));

/**
 * @route   GET /api/admin/dispute-resolution/disputes/:idOrCaseId/messages
 * @desc    Get chat messages (query: limit?)
 * @access  Private (admin)
 */
router.get('/dispute-resolution/disputes/:idOrCaseId/messages', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.getDisputeMessages(req, res);
}));

/**
 * @route   POST /api/admin/dispute-resolution/disputes/:idOrCaseId/messages
 * @desc    Send message as admin/mediator (body: messageText, senderRole?: 'admin'|'mediator')
 * @access  Private (admin)
 */
router.post('/dispute-resolution/disputes/:idOrCaseId/messages', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.sendDisputeMessage(req, res);
}));

export default router;
