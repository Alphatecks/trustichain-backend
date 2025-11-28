import { Router } from 'express';
import { trustiscoreController } from '../controllers/trustiscore.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/trustiscore
 * @desc    Get trustiscore
 * @access  Private
 */
router.get('/', authenticate, (req, res) => {
  trustiscoreController.getTrustiscore(req, res);
});

/**
 * @route   GET /api/trustiscore/level
 * @desc    View trustiscore level details
 * @access  Private
 */
router.get('/level', authenticate, (req, res) => {
  trustiscoreController.viewLevel(req, res);
});

export default router;
