import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { AdminLoginRequest, AdminLoginResponse, AdminLogoutResponse } from '../../types/api/admin.types';

export class AdminController {
  /**
   * Login an admin
   * POST /api/admin/login
   */
  async login(req: Request, res: Response<AdminLoginResponse>): Promise<void> {
    try {
      const loginData: AdminLoginRequest = req.body;
      const result = await adminService.login(loginData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Return 401 for authentication failures
        res.status(401).json(result);
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
   * Logout an admin
   * POST /api/admin/logout
   */
  async logout(req: Request, res: Response<AdminLogoutResponse>): Promise<void> {
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
      const result = await adminService.logout(accessToken);

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

export const adminController = new AdminController();
