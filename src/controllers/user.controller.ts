import { Request, Response } from 'express';
import { userService } from '../services/user/user.service';
import type { AddBeneficiaryResponse, RemoveBeneficiaryResponse } from '../types/api/beneficiary.types';

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
    /** True when TOTP MFA is active (sync toggle from GET /api/user/profile). */
    mfaEnabled?: boolean;
    /** Unique handle for P2P sends (same as login / ensure-profile) */
    trustitag?: string;
    avatarUrl?: string | null;
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

  /**
   * Upload profile picture (multipart image field "photo").
   * POST /api/user/profile/photo
   */
  async uploadProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Image file is required (multipart field name: photo)',
          error: 'Bad request',
        });
        return;
      }
      const result = await userService.uploadProfilePhoto(userId, file);
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
   * Update trustitag handle
   * PATCH /api/user/trustitag
   */
  async updateTrustitag(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { trustitag } = req.body ?? {};
      const result = await userService.updateTrustitag(userId, trustitag);
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
   * Get linked accounts
   * GET /api/user/linked-accounts
   */
  async getLinkedAccounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await userService.getLinkedAccounts(userId);

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
   * Get beneficiaries
   * GET /api/user/beneficiaries
   */
  async getBeneficiaries(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await userService.getBeneficiaries(userId);

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
   * Add a saved beneficiary (Trustitag contact)
   * POST /api/user/beneficiaries
   */
  async addBeneficiary(req: Request, res: Response<AddBeneficiaryResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const trustitag = req.body?.trustitag ?? req.body?.trustiTag ?? req.body?.handle;
      const result = await userService.addBeneficiary(userId, trustitag);

      if (result.success) {
        const status = result.message === 'Beneficiary already saved' ? 200 : 201;
        res.status(status).json(result);
        return;
      }

      const err = result.error || '';
      if (err === 'Not found') {
        res.status(404).json(result);
        return;
      }
      if (err === 'Service unavailable' || err === 'Migration required') {
        res.status(503).json(result);
        return;
      }
      res.status(400).json(result);
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
   * Remove a saved beneficiary (Trustitag contact)
   * DELETE /api/user/beneficiaries/:beneficiaryId
   */
  async removeBeneficiary(req: Request, res: Response<RemoveBeneficiaryResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const beneficiaryId = req.params.beneficiaryId?.trim();
      if (!beneficiaryId) {
        res.status(400).json({
          success: false,
          message: 'beneficiaryId is required',
          error: 'Validation failed',
        });
        return;
      }

      const result = await userService.removeBeneficiary(userId, beneficiaryId);

      if (result.success) {
        res.status(200).json(result);
        return;
      }

      const err = result.error || '';
      if (err === 'Not found') {
        res.status(404).json(result);
        return;
      }
      if (err === 'Service unavailable') {
        res.status(503).json(result);
        return;
      }
      res.status(400).json(result);
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






