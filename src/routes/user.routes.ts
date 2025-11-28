import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, (req, res) => {
  userController.getUserProfile(req, res);
});

export default router;
