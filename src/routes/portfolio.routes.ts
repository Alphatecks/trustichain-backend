import { Router } from 'express';
import { portfolioController } from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/portfolio/performance
 * @desc    Get portfolio performance data
 * @access  Private
 * @query   timeframe - 'daily' | 'weekly' | 'monthly' | 'yearly' (default: monthly)
 */
router.get('/performance', authenticate, async (req, res) => {
  await portfolioController.getPortfolioPerformance(req, res);
});

export default router;


