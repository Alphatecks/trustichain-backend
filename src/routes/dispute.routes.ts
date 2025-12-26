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


