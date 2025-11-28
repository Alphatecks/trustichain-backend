import { Router } from 'express';
import { exchangeController } from '../controllers/exchange.controller';

const router = Router();

/**
 * @route   GET /api/exchange/rates
 * @desc    Get live exchange rates for XRP
 * @access  Public
 */
router.get('/rates', (req, res) => {
  exchangeController.getLiveExchangeRates(req, res);
});

export default router;
