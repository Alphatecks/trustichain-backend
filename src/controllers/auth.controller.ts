import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, VerifyEmailRequest, VerifyEmailResponse, GoogleOAuthResponse, LogoutResponse } from '../types/api/auth.types';

export class AuthController {
  /**
   * Forgot Password - send OTP to user's email
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email is required.' });
        return;
      }
      const result = await authService.forgotPassword(email);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
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

  /**
   * Reset Password - verify OTP and set new password
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
        return;
      }
      const result = await authService.resetPassword(email, otp, newPassword);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
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
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response<RegisterResponse>): Promise<void> {
    try {
      const registerData: RegisterRequest = req.body;
      const result = await authService.register(registerData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
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

  /**
   * Login a user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response<LoginResponse>): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;

    
    

      const result = await authService.login(loginData);


      // #region agent log
      
      // #endregion

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Return 403 if email not verified, 401 for other auth failures
        const statusCode = result.emailVerificationRequired ? 403 : 401;
        res.status(statusCode).json(result);
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

  /**
   * Verify user email
   * POST /api/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response<VerifyEmailResponse>): Promise<void> {
    try {
      const verifyData: VerifyEmailRequest = req.body;
      const result = await authService.verifyEmail(verifyData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
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

  /**
   * Verify user email via GET (for direct link clicks)
   * GET /api/auth/verify-email?token=xxx
   * Returns a beautiful HTML page showing verification status
   */
  async verifyEmailGet(req: Request, res: Response): Promise<void> {
    try {
      const token = req.query.token as string;

      if (!token) {
        res.status(400).send(this.getErrorPage('Missing Verification Token', 'The verification link is invalid. Please check your email and try again.'));
        return;
      }

      const result = await authService.verifyEmail({ token });

      if (result.success) {
        res.status(200).send(this.getSuccessPage());
      } else {
        res.status(400).send(this.getErrorPage('Verification Failed', result.message || 'Unable to verify your email.'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).send(this.getErrorPage('Error', errorMessage));
    }
  }

  /**
   * Generate beautiful success page HTML
   */
  private getSuccessPage(): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified - TrustiChain</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 50px 40px;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .success-icon {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
            animation: scaleIn 0.5s ease-out 0.2s both;
        }
        
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
        
        .success-icon svg {
            width: 60px;
            height: 60px;
            color: white;
        }
        
        h1 {
            color: #333;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 15px;
        }
        
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        
        .button:active {
            transform: translateY(0);
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
        </div>
        <h1>Email Verified!</h1>
        <p>Your email has been successfully verified. You can now log in to your TrustiChain account and start using our platform.</p>
        <a href="${frontendUrl}/auth/login" class="button">Go to Login</a>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} TrustiChain. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate beautiful error page HTML
   */
  private getErrorPage(title: string, message: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Error - TrustiChain</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 50px 40px;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .error-icon {
            width: 100px;
            height: 100px;
            background: #fee;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px;
            animation: scaleIn 0.5s ease-out 0.2s both;
        }
        
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
        
        .error-icon svg {
            width: 60px;
            height: 60px;
            color: #e74c3c;
        }
        
        h1 {
            color: #333;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 15px;
        }
        
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            margin-right: 10px;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        
        .button-secondary {
            background: #f0f0f0;
            color: #333;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .button-secondary:hover {
            background: #e0e0e0;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div>
            <a href="/api/auth/google" class="button">Try Google Sign-In Again</a>
            <a href="${frontendUrl}/auth/signup" class="button button-secondary">Go to Sign Up</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} TrustiChain. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;
  }

  /**
   * Get Google OAuth URL
   * GET /api/auth/google
   * Redirects directly to Google OAuth (for browser access)
   * Or returns JSON with URL (for API calls)
   */
  async getGoogleOAuthUrl(req: Request, res: Response<GoogleOAuthResponse>): Promise<void> {
    try {
      const result = await authService.getGoogleOAuthUrl();

      if (result.success && result.data?.url) {
        // If accessed from browser (has Accept: text/html), redirect directly
        const acceptsHtml = req.headers.accept?.includes('text/html');
        if (acceptsHtml) {
          res.redirect(result.data.url);
          return;
        }
        // Otherwise return JSON for API calls
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
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

  /**
   * Handle Google OAuth callback
   * GET /api/auth/google/callback?code=xxx
   */
  async handleGoogleOAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      // Log all query parameters and request details for debugging
      console.log('=== OAuth Callback Handler ===');
      console.log('Full URL:', req.url);
      console.log('Query params:', JSON.stringify(req.query));
      console.log('Request method:', req.method);
      console.log('Request headers:', JSON.stringify(req.headers));
      console.log('Request host:', req.get('host'));
      console.log('Request protocol:', req.protocol);
      console.log('Request original URL:', req.originalUrl);
      
      const code = req.query.code as string;
      const access_token = req.query.access_token as string;
      const refresh_token = req.query.refresh_token as string;
      const error = req.query.error as string;
      const errorDescription = req.query.error_description as string;
      const state = req.query.state as string | undefined;

      // Check if Google returned an error
      if (error) {
        console.error('OAuth Error:', error, errorDescription);
        const errorMsg = errorDescription || error || 'Google OAuth authentication was cancelled or failed.';
        res.status(400).send(this.getErrorPage('Google Sign-In Cancelled', errorMsg));
        return;
      }

      // Prefer code exchange; otherwise accept tokens (forwarded from intermediary page when Supabase used hash)
      let result;
      if (code) {
        console.log('Authorization code received:', code.substring(0, 20) + '...');
        console.log('State parameter:', state || 'none');
        result = await authService.handleGoogleOAuthCallback(code);
      } else if (access_token && refresh_token) {
        console.log('Tokens received (hash forwarded as query by intermediary)');
        result = await authService.handleGoogleOAuthCallbackWithTokens(access_token, refresh_token);
      } else {
        // Neither code nor tokens
        console.error('=== Missing Authorization Code ===');
        console.error('Query params received:', JSON.stringify(req.query, null, 2));
        console.error('All query keys:', Object.keys(req.query));
        const baseUrl = process.env.RENDER_URL || process.env.BACKEND_URL || 'https://trustichain-backend.onrender.com';
        const callbackUrl = `${baseUrl}/api/auth/google/callback`;
        const oauthCallbackUrl = baseUrl.replace(/\/$/, '') + '/auth/oauth-callback';
        const configMessage = `
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Configuration Required</h3>
            <p style="color: #856404; margin-bottom: 10px;">
              The authorization code or tokens are missing. Supabase often returns the response in the URL <strong>hash</strong> (not query), which the server never receives.
            </p>
            <p style="color: #856404; margin-bottom: 10px;"><strong>Fix:</strong> Use the intermediary callback so the browser can read the hash and forward it here.</p>
            <ol style="color: #856404; margin-left: 20px;">
              <li>Go to <strong>Supabase Dashboard → Authentication → URL Configuration</strong></li>
              <li><strong>Add to Redirect URLs</strong> (where Supabase redirects after Google sign-in):
                <br><code style="background: #f8f9fa; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">${oauthCallbackUrl}</code>
              </li>
              <li>Keep this backend callback in Redirect URLs if needed:
                <br><code style="background: #f8f9fa; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">${callbackUrl}</code>
              </li>
              <li>Click <strong>Save</strong>, then try again</li>
            </ol>
          </div>
        `;
        const debugInfo = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production'
          ? `<br><br><small style="color: #666;">Debug: URL ${req.originalUrl}<br>Params: ${JSON.stringify(req.query, null, 2)}</small>`
          : '';
        res.status(400).send(this.getErrorPage(
          'Missing Authorization Code',
          `The Google OAuth callback is missing the authorization code.${configMessage}${debugInfo}<br><br><a href="/api/auth/google" style="color: #667eea; text-decoration: none; font-weight: bold;">Try again</a>.`
        ));
        return;
      }

      if (result.success && result.data) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/callback?success=true&provider=google`);
        return;
      } else {
        res.status(400).send(this.getErrorPage('Google Sign-In Failed', result.message || 'Unable to sign in with Google.'));
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).send(this.getErrorPage('Error', errorMessage));
    }
  }

  /**
   * Logout a user
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response<LogoutResponse>): Promise<void> {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Authorization token required',
          error: 'Unauthorized',
        });
        return;
      }

      const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      const result = await authService.logout(accessToken);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
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

export const authController = new AuthController();


