import { Request, Response } from 'express';
import { ExchangeRateResponse } from '../types/api/dashboard.types';
import { exchangeService } from '../services/exchange/exchange.service';

export class ExchangeController {
  /**
   * Get live exchange rates
   * GET /api/exchange/rates
   * Public endpoint (no auth required)
   */
  async getLiveExchangeRates(_req: Request, res: Response<ExchangeRateResponse>): Promise<void> {
    try {
      const result = await exchangeService.getLiveExchangeRates();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
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

export const exchangeController = new ExchangeController();


