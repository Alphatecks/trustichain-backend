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

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with token (API call)
 * @access  Public
 * @body    { token }
 */
router.post('/verify-email', (req, res) => {
  authController.verifyEmail(req, res);
});

/**
 * @route   GET /api/auth/verify-email?token=xxx
 * @desc    Verify user email via link click (redirects to frontend)
 * @access  Public
 * @query   token - Verification token from email
 */
router.get('/verify-email', (req, res) => {
  authController.verifyEmailGet(req, res);
});

/**
 * @route   GET /api/auth/google
 * @desc    Get Google OAuth URL for sign-in
 * @access  Public
 */
router.get('/google', (req, res) => {
  authController.getGoogleOAuthUrl(req, res);
});

/**
 * @route   GET /api/auth/google/callback?code=xxx
 * @desc    Handle Google OAuth callback
 * @access  Public
 * @query   code - OAuth authorization code from Google
 */
router.get('/google/callback', (req, res) => {
  authController.handleGoogleOAuthCallback(req, res);
});

export default router;


