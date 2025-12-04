import { Request, Response } from 'express';
import { PortfolioResponse } from '../types/api/dashboard.types';
import { portfolioService } from '../services/portfolio/portfolio.service';

export class PortfolioController {
  /**
   * Get portfolio performance
   * GET /api/portfolio/performance?timeframe=monthly
   */
  async getPortfolioPerformance(req: Request, res: Response<PortfolioResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const timeframe = (req.query.timeframe as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly';

      // Validate timeframe
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(timeframe)) {
        res.status(400).json({
          success: false,
          message: 'Invalid timeframe. Must be one of: daily, weekly, monthly, yearly',
          error: 'Validation error',
        });
        return;
      }

      const result = await portfolioService.getPortfolioPerformance(userId, timeframe);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }
}

export const portfolioController = new PortfolioController();






