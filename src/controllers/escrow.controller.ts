import { Request, Response } from 'express';
import {
  CreateEscrowRequest,
  CreateEscrowResponse,
  EscrowListResponse,
  ActiveEscrowsResponse,
  TotalEscrowedResponse,
  CompletedEscrowsMonthResponse,
  EscrowDetailResponse,
  ReleaseEscrowRequest,
  ReleaseEscrowResponse,
  CancelEscrowRequest,
  CancelEscrowResponse,
  GetIndustriesResponse,
  GetEscrowListRequest,
  TransactionType,
} from '../types/api/escrow.types';
import { escrowService } from '../services/escrow/escrow.service';

export class EscrowController {
  /**
   * Get active escrows count and locked amount
   * GET /api/escrow/active
   */
  async getActiveEscrows(req: Request, res: Response<ActiveEscrowsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await escrowService.getActiveEscrows(userId);

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
   * Get total escrowed amount
   * GET /api/escrow/total
   */
  async getTotalEscrowed(req: Request, res: Response<TotalEscrowedResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await escrowService.getTotalEscrowed(userId);

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
   * Create a new escrow
   * POST /api/escrow/create
   */
  async createEscrow(req: Request<{}, CreateEscrowResponse, CreateEscrowRequest>, res: Response<CreateEscrowResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await escrowService.createEscrow(userId, req.body);

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
   * Get completed escrows count for the current month
   * GET /api/escrow/completed/month
   */
  async getCompletedEscrowsForMonth(req: Request, res: Response<CompletedEscrowsMonthResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await escrowService.getCompletedEscrowsForMonth(userId);

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
   * Get escrow list with filters
   * GET /api/escrow/list?transactionType=freelance&industry=Technology&month=11&year=2024&limit=50&offset=0
   */
  async getEscrowList(req: Request, res: Response<EscrowListResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      
      // Parse query parameters
      const filters: GetEscrowListRequest = {
        transactionType: req.query.transactionType as TransactionType | 'all' | undefined,
        industry: req.query.industry as string | undefined,
        month: req.query.month ? parseInt(req.query.month as string) : undefined,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await escrowService.getEscrowListWithFilters(userId, filters);

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
   * Get escrow by ID
   * GET /api/escrow/:id
   */
  async getEscrowById(req: Request, res: Response<EscrowDetailResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const escrowId = req.params.id as string;

      const result = await escrowService.getEscrowById(userId, escrowId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
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
   * Release (finish) an escrow
   * POST /api/escrow/:id/release
   */
  async releaseEscrow(req: Request, res: Response<ReleaseEscrowResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const escrowId = req.params.id as string;
      const { notes } = req.body as ReleaseEscrowRequest;

      const result = await escrowService.releaseEscrow(userId, escrowId, notes);

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
   * Cancel an escrow
   * POST /api/escrow/:id/cancel
   */
  async cancelEscrow(req: Request, res: Response<CancelEscrowResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const escrowId = req.params.id as string;
      const { reason } = req.body as CancelEscrowRequest;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cancel reason is required',
          error: 'Cancel reason is required',
        });
        return;
      }

      const result = await escrowService.cancelEscrow(userId, escrowId, reason);

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
   * Get unique industries
   * GET /api/escrow/industries?transactionType=freelance
   */
  async getIndustries(req: Request, res: Response<GetIndustriesResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const transactionType = req.query.transactionType as TransactionType | undefined;

      const result = await escrowService.getUniqueIndustries(userId, transactionType);

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

export const escrowController = new EscrowController();




