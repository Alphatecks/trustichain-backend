import { Router } from 'express';
import { escrowController } from '../controllers/escrow.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/escrow/active/list
 * @desc    Get list of active escrows (pending or active status)
 * @access  Private
 * @query   limit?, offset?
 */
router.get('/active/list', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getActiveEscrowList(req, res);
}));

/**
 * @route   GET /api/escrow/active
 * @desc    Get active escrows count and locked amount
 * @access  Private
 */
router.get('/active', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getActiveEscrows(req, res);
}));

/**
 * @route   GET /api/escrow/total
 * @desc    Get total escrowed amount
 * @access  Private
 */
router.get('/total', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getTotalEscrowed(req, res);
}));

/**
 * @route   POST /api/escrow/create
 * @desc    Create a new escrow
 * @access  Private
 * @body    { counterpartyId: string, amount: number, currency: 'USD' | 'XRP', description?: string }
 */
router.post('/create', authenticate, asyncHandler(async (req, res) => {
  await escrowController.createEscrow(req, res);
}));

/**
 * @route   GET /api/escrow/completed/month
 * @desc    Get completed escrows count for the current month
 * @access  Private
 */
router.get('/completed/month', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getCompletedEscrowsForMonth(req, res);
}));

/**
 * @route   GET /api/escrow/list
 * @desc    Get escrow list with filters
 * @access  Private
 * @query   transactionType, industry, month, year, limit, offset
 */
router.get('/list', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getEscrowList(req, res);
}));

/**
 * @route   GET /api/escrow/industries
 * @desc    Get list of unique industries
 * @access  Private
 * @query   transactionType (optional) - Filter industries by transaction type
 */
router.get('/industries', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getIndustries(req, res);
}));

/**
 * @route   GET /api/escrow/:id
 * @desc    Get escrow by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getEscrowById(req, res);
}));

/**
 * @route   GET /api/escrow/:id/xrpl-status
 * @desc    Get detailed escrow status from XRPL ledger
 * @access  Private
 */
router.get('/:id/xrpl-status', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getEscrowXrplStatus(req, res);
}));

/**
 * @route   POST /api/escrow/:id/release
 * @desc    Release (finish) an escrow - creates XUMM payload for user signing
 * @access  Private
 * @body    { notes?: string }
 */
router.post('/:id/release', authenticate, asyncHandler(async (req, res) => {
  await escrowController.releaseEscrow(req, res);
}));

/**
 * @route   GET /api/escrow/:id/release/status
 * @desc    Get XUMM payload status for escrow release and complete if signed
 * @access  Private
 */
router.get('/:id/release/status', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getEscrowReleaseXUMMStatus(req, res);
}));

/**
 * @route   POST /api/escrow/:id/cancel
 * @desc    Cancel an escrow
 * @access  Private
 * @body    { reason: string }
 */
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  await escrowController.cancelEscrow(req, res);
}));

/**
 * @route   POST /api/escrow/validate-payer-email
 * @desc    Validate payer email matches authenticated user's email
 * @access  Private
 * @body    { payerEmail: string }
 */
router.post('/validate-payer-email', authenticate, asyncHandler(async (req, res) => {
  await escrowController.validatePayerEmail(req, res);
}));

/**
 * @route   POST /api/escrow/validate-counterparty-email
 * @desc    Validate counterparty email exists in database
 * @access  Private
 * @body    { counterpartyEmail: string }
 */
router.post('/validate-counterparty-email', authenticate, asyncHandler(async (req, res) => {
  await escrowController.validateCounterpartyEmail(req, res);
}));

export default router;


