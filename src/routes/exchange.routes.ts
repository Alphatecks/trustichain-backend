import { Router } from 'express';
import { exchangeController } from '../controllers/exchange.controller';

const router = Router();

/**
 * @route   GET /api/exchange/rates
 * @desc    Get live exchange rates for XRP
 * @access  Public
 */
router.get('/rates', async (req, res) => {
  await exchangeController.getLiveExchangeRates(req, res);
});

export default router;


