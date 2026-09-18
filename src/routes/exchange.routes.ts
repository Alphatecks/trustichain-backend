import { Router } from 'express';
import { exchangeController } from '../controllers/exchange.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/exchange/rates
 * @desc    Fiat FX (units per 1 USD/RLUSD) plus xrpUsdRate for coin-to-fiat display
 * @access  Public
 */
router.get('/rates', asyncHandler(async (req, res) => {
  await exchangeController.getLiveExchangeRates(req, res);
}));

export default router;


