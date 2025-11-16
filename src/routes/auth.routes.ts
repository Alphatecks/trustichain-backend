import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRegister } from '../middleware/validation';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, fullName, password, confirmPassword, agreeToTerms, country? }
 */
router.post('/register', validateRegister, (req, res) => {
  authController.register(req, res);
});

export default router;


