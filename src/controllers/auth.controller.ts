import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, VerifyEmailRequest, VerifyEmailResponse } from '../types/api/auth.types';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request<{}, RegisterResponse, RegisterRequest>, res: Response<RegisterResponse>): Promise<void> {
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
  async login(req: Request<{}, LoginResponse, LoginRequest>, res: Response<LoginResponse>): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;
      const result = await authService.login(loginData);

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
  async verifyEmail(req: Request<{}, VerifyEmailResponse, VerifyEmailRequest>, res: Response<VerifyEmailResponse>): Promise<void> {
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
}

export const authController = new AuthController();


