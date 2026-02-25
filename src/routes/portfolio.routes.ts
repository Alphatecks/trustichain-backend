import { Router } from 'express';
import { portfolioController } from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/portfolio/performance
 * @desc    Get portfolio performance data
 * @access  Private
 * @query   timeframe - 'daily' | 'weekly' | 'monthly' | 'yearly' (default: monthly)
 * @query   year - optional; filter data to this year (e.g. 2024 => Jan 1 - Dec 31)
 */
router.get('/performance', authenticate, asyncHandler(async (req, res) => {
  await portfolioController.getPortfolioPerformance(req, res);
}));

export default router;


