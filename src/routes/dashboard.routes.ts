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

export default router;


