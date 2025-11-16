import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRegister, validateLogin } from '../middleware/validation';

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

/**
 * @route   POST /api/auth/login
 * @desc    Login a user (requires email verification)
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateLogin, (req, res) => {
  authController.login(req, res);
});

export default router;


