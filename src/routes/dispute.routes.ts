import { Router } from 'express';
import multer from 'multer';
import { disputeController } from '../controllers/dispute.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

// Configure multer for memory storage (files stored in memory before upload to Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

const router = Router();

/**
 * @route   GET /api/disputes/summary
 * @desc    Get dispute summary metrics for dashboard
 * @access  Private
 * @query   month? - Optional month filter in YYYY-MM format
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.getSummary(req, res);
  })
);

/**
 * @route   POST /api/disputes/evidence/upload
 * @desc    Upload evidence file for dispute
 * @access  Private
 * @body    multipart/form-data with 'file' field
 */
router.post(
  '/evidence/upload',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await disputeController.uploadEvidence(req, res);
  })
);

/**
 * @route   POST /api/disputes
 * @desc    Create a new dispute
 * @access  Private
 * @body    CreateDisputeRequest - Dispute details including escrow ID, category, reason, parties, amount, etc.
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.createDispute(req, res);
  })
);

/**
 * @route   GET /api/disputes
 * @desc    Get list of disputes for dispute dashboard table
 * @access  Private
 * @query   status? - all | pending | active | resolved | cancelled (default: all)
 * @query   month?  - Optional month filter in YYYY-MM format
 * @query   page?   - Page number (default: 1)
 * @query   pageSize? - Page size (default: 10)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.getDisputes(req, res);
  })
);

/**
 * @route   POST /api/disputes/:disputeId/evidence
 * @desc    Add evidence to a dispute
 * @access  Private
 * @body    AddEvidenceRequest - Evidence details including title, description, type, and file info
 */
router.post(
  '/:disputeId/evidence',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.addEvidence(req, res);
  })
);

/**
 * @route   GET /api/disputes/:disputeId/evidence
 * @desc    Get all evidence for a dispute
 * @access  Private
 */
router.get(
  '/:disputeId/evidence',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.getEvidence(req, res);
  })
);

/**
 * @route   PUT /api/disputes/:disputeId/evidence/:evidenceId
 * @desc    Update evidence metadata
 * @access  Private
 * @body    UpdateEvidenceRequest - Updated evidence metadata
 */
router.put(
  '/:disputeId/evidence/:evidenceId',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.updateEvidence(req, res);
  })
);

/**
 * @route   DELETE /api/disputes/:disputeId/evidence/:evidenceId
 * @desc    Delete evidence from a dispute
 * @access  Private
 */
router.delete(
  '/:disputeId/evidence/:evidenceId',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.deleteEvidence(req, res);
  })
);

/**
 * @route   GET /api/disputes/:id
 * @desc    Get dispute detail by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await disputeController.getDisputeById(req, res);
  })
);

export default router;


