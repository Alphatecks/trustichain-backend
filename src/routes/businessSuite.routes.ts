import { Router } from 'express';
import multer from 'multer';
import { businessSuiteController } from '../controllers/businessSuite.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
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
 * @route   GET /api/business-suite/supply-contracts/overview
 * @desc    Supplier contract overview stats: totalSupplier, lockedUsd, pendingCount, pendingTotal, tier, totalSupplierAmount (for the three cards UI).
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/overview', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplierContractOverview(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/for-supplier
 * @desc    View new supply contract – supplier only. Contracts escrowed to this business (counterparty). Call this for the supplier view.
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/for-supplier', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractsEscrowedToMe(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/for-contractor
 * @desc    View supply status – contractor only. Contracts created by this business (creator). Call this for the contractor view.
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/for-contractor', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractsCreatedByMe(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/created-by-me
 * @desc    View supply status: contracts created by this business (contractor/buyer). Status + release button. Contractor only.
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/created-by-me', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractsCreatedByMe(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/created-by-me/:escrowId
 * @desc    Single supply contract detail for contractor modal (includes contract documents uploaded at creation).
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/created-by-me/:escrowId', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractCreatedByMeDetail(req, res);
}));

/**
 * @route   PATCH /api/business-suite/supply-contracts/created-by-me/:escrowId/documents
 * @desc    Set or append contract document URLs (contractor only). Body: { contractDocumentUrls: string[], append?: boolean }.
 * @access  Private (business suite only)
 */
router.patch('/supply-contracts/created-by-me/:escrowId/documents', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.updateSupplyContractDocuments(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/escrowed-to-me
 * @desc    View new supply contract: contracts escrowed to this business (supplier/receiver). Supplier only.
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/escrowed-to-me', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractsEscrowedToMe(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/escrowed-to-me/:escrowId
 * @desc    Single supply contract detail for supplier modal (contract summary, timeline, terms, documents from contractor).
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/escrowed-to-me/:escrowId', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractEscrowedToMeDetail(req, res);
}));

/**
 * @route   POST /api/business-suite/supply-contracts/escrowed-to-me/:escrowId/release
 * @desc    Release a supplier contract escrow (locked funds). Counterparty or owner can release manually or on/after the release day set at creation.
 * @access  Private (business suite only)
 */
router.post('/supply-contracts/escrowed-to-me/:escrowId/release', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.releaseSupplyContractEscrow(req, res);
}));

/**
 * @route   POST /api/business-suite/supplier-disputes
 * @desc    File dispute for suppliers. Body: supplierReference (SUPP-YYYY-NNN or business name), reason, amount, currency, description, evidence? (optional array of { fileUrl, fileName, fileType?, fileSize? }).
 * @access  Private (business suite only)
 */
router.post('/supplier-disputes', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.fileSupplierDispute(req, res);
}));

/**
 * @route   POST /api/business-suite/supply-contracts
 * @desc    Create supplier contract (Contract Info + Payment Terms from modal). Body: supplierName, supplierWalletAddress, contractTitle, deliveryMethod, disputeWindow, paymentAmount, currency, escrowType, releaseCondition, contractDocumentUrls (optional), etc.
 * @access  Private (business suite only)
 */
router.post('/supply-contracts', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.createSupplierContract(req, res);
}));

/**
 * @route   POST /api/business-suite/supply-contracts/documents/upload
 * @desc    Upload a contract document (Invoice, Agreement, Delivery Terms). Multipart field: document. Returns fileUrl to pass in contractDocumentUrls when creating the contract.
 * @access  Private (business suite only)
 */
router.post('/supply-contracts/documents/upload', authenticate, upload.single('document'), asyncHandler(async (req, res) => {
  await businessSuiteController.uploadSupplyContractDocument(req, res);
}));

/**
 * @route   GET /api/business-suite/supply-contracts/documents/signed-url
 * @desc    Get a signed URL to view a supply contract document (bucket is private). Query: url=<encoded-document-url>. Returns { signedUrl, expiresIn }.
 * @access  Private (business suite only)
 */
router.get('/supply-contracts/documents/signed-url', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplyContractDocumentSignedUrl(req, res);
}));

/**
 * @route   GET /api/business-suite/suppliers/details
 * @desc    Supplier details list for UI cards (supplierId, progressPercentage, statusDetail, amount, dueDate).
 * @access  Private (business suite only)
 */
router.get('/suppliers/details', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplierDetails(req, res);
}));

/**
 * @route   GET /api/business-suite/suppliers/transactions
 * @desc    Supplier transaction history (transactionId, supplierName, amount XRP/USD, status, type). Query: page, pageSize, month (YYYY-MM), status
 * @access  Private (business suite only)
 */
router.get('/suppliers/transactions', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getSupplierTransactionHistory(req, res);
}));

/**
 * @route   POST /api/business-suite/suppliers/check
 * @desc    Check if a supplier (business) name is registered. Body: { name }. Returns { registered: boolean, message }.
 * @access  Private (business suite only)
 */
router.post('/suppliers/check', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.checkSupplierRegistered(req, res);
}));

/**
 * @route   GET /api/business-suite/business-email/status
 * @desc    Check if the business account has a business email. Returns { hasBusinessEmail, businessEmail }. Demand this before flows that require it.
 * @access  Private (authenticated)
 */
router.get('/business-email/status', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getBusinessEmailStatus(req, res);
}));

/**
 * @route   PATCH /api/business-suite/business-email
 * @desc    Set or update business contact email. Body: { businessEmail }.
 * @access  Private (business suite)
 */
router.patch('/business-email', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.setBusinessEmail(req, res);
}));

/**
 * @route   GET /api/business-suite/company-name?email=
 * @desc    Get company (business) name for the account with this email. Returns { success, message, data: { businessName } }.
 * @access  Private (business suite only)
 */
router.get('/company-name', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getCompanyNameByEmail(req, res);
}));

/**
 * @route   POST /api/business-suite/suppliers
 * @desc    Add supplier (body: name, walletAddress?, country?, kycStatus?, contractType?, tags?). Fails with 404 if supplier not registered.
 * @access  Private (business suite only)
 */
router.post('/suppliers', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.createSupplier(req, res);
}));

/**
 * @route   GET /api/business-suite/kyc
 * @desc    Get business suite KYC (business_suite_kyc table)
 * @access  Private (business suite only)
 */
router.get('/kyc', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getKyc(req, res);
}));

/**
 * @route   POST /api/business-suite/kyc/logo
 * @desc    [Legacy] Upload company logo. Prefer POST /kyc/documents/logo with field "document".
 * @access  Private
 */
router.post('/kyc/logo', authenticate, upload.single('logo'), asyncHandler(async (req, res) => {
  await businessSuiteController.uploadKycLogo(req, res);
}));

/**
 * @route   POST /api/business-suite/kyc/documents/:type
 * @desc    Upload KYC file (local file). type = logo (image) | identity | address | enhanced-due-diligence (PDF or image). Multipart field: document. Returns URL to include in POST /kyc.
 * @access  Private
 */
router.post('/kyc/documents/:type', authenticate, upload.single('document'), asyncHandler(async (req, res) => {
  await businessSuiteController.uploadKycDocument(req, res);
}));

/**
 * @route   POST /api/business-suite/kyc
 * @desc    Submit/update business suite KYC (body: companyName, businessDescription?, companyLogoUrl?, identityVerificationDocumentUrl?, addressVerificationDocumentUrl?, enhancedDueDiligenceDocumentUrl?, defaultEscrowFeeRate?, ...)
 * @access  Private
 */
router.post('/kyc', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.submitKyc(req, res);
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
 * @route   GET /api/business-suite/teams/members?name=
 * @desc    Get list of team members by team name (query: name). Returns teamId, teamName, members.
 * @access  Private (business suite only)
 */
router.get('/teams/members', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.getTeamMembersByName(req, res);
}));

/**
 * @route   GET /api/business-suite/teams/members/check?fullName=
 * @route   POST /api/business-suite/teams/members/check (body: { fullName })
 * @desc    Check if a personal user exists by full name; returns email, phone, country. Errors if name is the business owner (cannot add self).
 * @access  Private (business suite only)
 */
router.get('/teams/members/check', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.checkTeamMemberByName(req, res);
}));
router.post('/teams/members/check', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.checkTeamMemberByName(req, res);
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
 * @route   POST /api/business-suite/teams
 * @desc    Create a new team (body: name, nextDate?)
 * @access  Private (business suite only)
 */
router.post('/teams', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.createTeam(req, res);
}));

/**
 * @route   POST /api/business-suite/teams/:teamId/members
 * @desc    Add team member (full modal: personal, job, payment details)
 * @access  Private (business suite only)
 */
router.post('/teams/:teamId/members', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.addTeamMember(req, res);
}));

/**
 * @route   DELETE /api/business-suite/teams/:teamId/members/:memberId
 * @desc    Remove a team member from the team. memberId is the member row id (from team detail members[].id).
 * @access  Private (business suite only)
 */
router.delete('/teams/:teamId/members/:memberId', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.removeTeamMember(req, res);
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
 * @route   POST /api/business-suite/wallet/create
 * @desc    Create a new custodial wallet for business suite (Bearer only). Returns existing address if one already exists.
 * @access  Private (business suite only)
 */
router.post('/wallet/create', authenticate, asyncHandler(async (req, res) => {
  await businessSuiteController.createWallet(req, res);
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
