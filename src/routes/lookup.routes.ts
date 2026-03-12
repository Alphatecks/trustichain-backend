import { Router } from 'express';
import { lookupController } from '../controllers/lookup.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/lookup/business-name
 * @query   email - user email
 * @desc    Get business (company) name for the account with this email. Returns { success, message, data: { businessName } }.
 * @access  Public
 */
router.get('/business-name', asyncHandler(async (req, res) => {
  await lookupController.getBusinessNameByEmail(req, res);
}));

export default router;
