import { Request, Response } from 'express';
import { TrustiscoreResponse } from '../types/api/dashboard.types';
import { trustiscoreService } from '../services/trustiscore/trustiscore.service';

export class TrustiscoreController {
  /**
   * Get trustiscore
   * GET /api/trustiscore
   */
  async getTrustiscore(req: Request, res: Response<TrustiscoreResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await trustiscoreService.getTrustiscore(userId);

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

  /**
   * View trustiscore level details
   * GET /api/trustiscore/level
   */
  async viewLevel(req: Request, res: Response<TrustiscoreResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      // Same as getTrustiscore but with more detailed factors
      const result = await trustiscoreService.getTrustiscore(userId);

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

export const trustiscoreController = new TrustiscoreController();




