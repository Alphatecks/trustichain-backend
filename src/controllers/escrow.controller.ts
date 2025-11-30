import { Request, Response } from 'express';
import {
  CreateEscrowRequest,
  CreateEscrowResponse,
  EscrowListResponse,
  ActiveEscrowsResponse,
  TotalEscrowedResponse,
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
   * Get escrow list
   * GET /api/escrow/list?limit=50&offset=0
   */
  async getEscrowList(req: Request, res: Response<EscrowListResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await escrowService.getEscrowList(userId, limit, offset);

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




