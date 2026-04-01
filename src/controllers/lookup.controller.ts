import { Request, Response } from 'express';
import { lookupService } from '../services/lookup/lookup.service';

export class LookupController {
  /**
   * GET /api/lookup/business-name?email=...
   * Returns the business (company) name for the account with the given email, if any.
   */
  async getBusinessNameByEmail(req: Request, res: Response): Promise<void> {
    try {
      const email = (req.query.email as string) ?? (req.body?.email as string) ?? '';
      const result = await lookupService.getBusinessNameByEmail(email);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error('LookupController.getBusinessNameByEmail error:', error);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * GET /api/lookup/business-email?businessName=...
   * Returns the business (owner) email and business XRP address for the registered business with the given company name, if any.
   */
  async getBusinessEmailByName(req: Request, res: Response): Promise<void> {
    try {
      const businessName = (req.query.businessName as string) ?? (req.query.business_name as string) ?? (req.body?.business_name as string) ?? '';
      const result = await lookupService.getBusinessEmailByName(businessName);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error('LookupController.getBusinessEmailByName error:', error);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}

export const lookupController = new LookupController();
