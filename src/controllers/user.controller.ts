import { Request, Response } from 'express';
import { userService } from '../services/user/user.service';

interface UserProfileResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    email: string;
    fullName: string;
    country: string | null;
    title?: string;
    verified: boolean;
  };
  error?: string;
}

export class UserController {
  /**
   * Get user profile
   * GET /api/user/profile
   */
  async getUserProfile(req: Request, res: Response<UserProfileResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await userService.getUserProfile(userId);

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

export const userController = new UserController();


