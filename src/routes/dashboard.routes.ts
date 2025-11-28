import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get all dashboard summary data (balance, escrows, trustiscore, total escrowed)
 * @access  Private
 */
router.get('/summary', authenticate, (req, res) => {
  dashboardController.getDashboardSummary(req, res);
});

export default router;
