import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRegister, validateLogin } from '../middleware/validation';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, fullName, password, confirmPassword, agreeToTerms, country? }
 */
router.post('/register', validateRegister, asyncHandler(async (req, res) => {
  await authController.register(req, res);
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login a user (requires email verification)
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  await authController.login(req, res);
}));

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with token (API call)
 * @access  Public
 * @body    { token }
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  await authController.verifyEmail(req, res);
}));

/**
 * @route   GET /api/auth/verify-email?token=xxx
 * @desc    Verify user email via link click (redirects to frontend)
 * @access  Public
 * @query   token - Verification token from email
 */
router.get('/verify-email', asyncHandler(async (req, res) => {
  await authController.verifyEmailGet(req, res);
}));

/**
 * @route   GET /api/auth/google
 * @desc    Get Google OAuth URL for sign-in
 * @access  Public
 */
router.get('/google', async (req, res) => {
  try {
    console.log('GET /api/auth/google - Request received');
    console.log('Headers:', JSON.stringify(req.headers));
    await authController.getGoogleOAuthUrl(req, res);
  } catch (error) {
    console.error('Error in /api/auth/google route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage, error);
    
    // If it's a browser request, show error page, otherwise return JSON
    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      res.status(500).send(`
        <html>
          <body>
            <h1>OAuth Error</h1>
            <p>Failed to initiate Google OAuth: ${errorMessage}</p>
            <a href="/api/auth/google">Try again</a>
          </body>
        </html>
      `);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to initiate Google OAuth',
        error: errorMessage,
      });
    }
  }
});

/**
 * @route   GET /api/auth/google/callback?code=xxx
 * @desc    Handle Google OAuth callback
 * @access  Public
 * @query   code - OAuth authorization code from Google
 */
router.get('/google/callback', async (req, res) => {
  try {
    await authController.handleGoogleOAuthCallback(req, res);
  } catch (error) {
    console.error('Error in /api/auth/google/callback route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle Google OAuth callback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout a user (invalidates session)
 * @access  Private (requires authentication)
 * @header  Authorization: Bearer <access_token>
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await authController.logout(req, res);
}));

export default router;


