import { Request, Response } from 'express';
import { DashboardSummaryResponse } from '../types/api/dashboard.types';
import { walletService } from '../services/wallet/wallet.service';
import { escrowService } from '../services/escrow/escrow.service';
import { trustiscoreService } from '../services/trustiscore/trustiscore.service';

export class DashboardController {
  /**
   * Get dashboard summary (aggregates all dashboard data)
   * GET /api/dashboard/summary
   */
  async getDashboardSummary(req: Request, res: Response<DashboardSummaryResponse>): Promise<void> {
    try {
      const userId = req.userId!; // Set by auth middleware

      // Fetch all dashboard data in parallel
      const [balanceResult, activeEscrowsResult, totalEscrowedResult, trustiscoreResult] = await Promise.all([
        walletService.getBalance(userId),
        escrowService.getActiveEscrows(userId),
        escrowService.getTotalEscrowed(userId),
        trustiscoreService.getTrustiscore(userId),
      ]);

      // Check for errors
      if (!balanceResult.success || !activeEscrowsResult.success || !totalEscrowedResult.success || !trustiscoreResult.success) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch dashboard data',
          error: 'Data fetch error',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: {
          balance: balanceResult.data!.balance,
          activeEscrows: {
            count: activeEscrowsResult.data!.count,
            lockedAmount: activeEscrowsResult.data!.lockedAmount,
          },
          trustiscore: {
            score: trustiscoreResult.data!.score,
            level: trustiscoreResult.data!.level,
          },
          totalEscrowed: totalEscrowedResult.data!.totalEscrowed,
        },
      });
    } catch (error) {
      console.error('Error in getDashboardSummary:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }
}

export const dashboardController = new DashboardController();




