import { Request, Response } from 'express';
import { mfaService } from '../services/mfa.service';

export class MfaController {
  /** POST /api/user/mfa/setup */
  async setup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await mfaService.setup(userId);
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

  /** POST /api/user/mfa/setup/verify */
  async verifySetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { code } = req.body as { code?: string };
      if (code == null || String(code).trim() === '') {
        res.status(400).json({
          success: false,
          message: 'code is required',
          error: 'Validation failed',
        });
        return;
      }
      const result = await mfaService.verifySetup(userId, String(code));
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

  /** POST /api/user/mfa/disable */
  async disable(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { code } = req.body as { code?: string };
      if (code == null || String(code).trim() === '') {
        res.status(400).json({
          success: false,
          message: 'code is required',
          error: 'Validation failed',
        });
        return;
      }
      const result = await mfaService.disable(userId, String(code));
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

export const mfaController = new MfaController();
