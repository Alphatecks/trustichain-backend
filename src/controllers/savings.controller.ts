import { Request, Response } from 'express';
import {
  SavingsSummaryResponse,
  SavingsCashflowResponse,
  SavingsWalletsResponse,
  SavingsTransactionsResponse,
  SavingsTransferResponse,
  SavingsWithdrawResponse,
} from '../types/api/savings.types';
import { savingsService } from '../services/savings/savings.service';

export class SavingsController {
  /**
   * Get savings allocation summary for dashboard
   * GET /api/savings/summary
   */
  async getSummary(req: Request, res: Response<SavingsSummaryResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const range = (req.query.range as string | undefined) || undefined; // this_month | last_month | this_year

      const result = await savingsService.getSummary(userId, range);

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
   * Get savings cashflow data
   * GET /api/savings/cashflow
   */
  async getCashflow(req: Request, res: Response<SavingsCashflowResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const interval = (req.query.interval as 'monthly' | 'weekly' | undefined) || 'monthly';
      const from = (req.query.from as string | undefined) || undefined;
      const to = (req.query.to as string | undefined) || undefined;
      const range = (req.query.range as string | undefined) || undefined; // this_month | last_month | this_year (when from/to omitted)

      const result = await savingsService.getCashflow({
        userId,
        interval,
        from,
        to,
        range,
      });

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
   * Get list of savings wallets
   * GET /api/savings/wallets
   */
  async getWallets(req: Request, res: Response<SavingsWalletsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await savingsService.getWallets(userId);

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
   * Withdraw from savings back to custodial XRP wallet
   * POST /api/savings/withdraw
   */
  async withdraw(req: Request, res: Response<SavingsWithdrawResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const body = req.body as {
        savingsWalletId: string;
        targetWalletId?: string;
        withdrawAll?: boolean;
        amountUsd?: number;
        amountXrp?: number;
      };

      const result = await savingsService.withdrawToWallet(userId, body);

      if (result.success) {
        res.status(200).json(result);
        return;
      }

      const err = result.error || '';
      if (err === 'Not found') {
        res.status(404).json(result);
        return;
      }
      if (err === 'Insufficient balance') {
        res.status(400).json(result);
        return;
      }
      if (err === 'Service unavailable') {
        res.status(503).json(result);
        return;
      }
      if (err === 'Rate unavailable') {
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
   * Transfer XRP from custodial wallet balance into a savings account
   * POST /api/savings/transfer
   */
  async transfer(req: Request, res: Response<SavingsTransferResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const { savingsWalletId, sourceWalletId, amountXrp } = req.body as {
        savingsWalletId: string;
        sourceWalletId?: string;
        amountXrp: number;
      };

      const result = await savingsService.transferFromWallet(userId, {
        savingsWalletId,
        sourceWalletId,
        amountXrp,
      });

      if (result.success) {
        res.status(200).json(result);
        return;
      }

      const err = result.error || '';
      if (err === 'Not found') {
        res.status(404).json(result);
        return;
      }
      if (err === 'Insufficient balance') {
        res.status(400).json(result);
        return;
      }
      if (err === 'Service unavailable') {
        res.status(503).json(result);
        return;
      }
      if (err === 'Rate unavailable') {
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
   * Create a new savings wallet
   * POST /api/savings/wallets
   */
  async createWallet(req: Request, res: Response<SavingsWalletsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const { name, targetAmountUsd } = req.body as { name: string; targetAmountUsd?: number };

      const result = await savingsService.createWallet(userId, { name, targetAmountUsd });

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
   * Get savings transaction history
   * GET /api/savings/transactions
   */
  async getTransactions(req: Request, res: Response<SavingsTransactionsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const walletId = (req.query.walletId as string | undefined) || undefined;
      const directionParam = (req.query.direction as string | undefined) || 'all';
      const range = (req.query.range as string | undefined) || undefined; // daily | weekly | monthly
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;

      const direction =
        directionParam === 'received' || directionParam === 'spent'
          ? directionParam
          : 'all';

      const result = await savingsService.getTransactions({
        userId,
        walletId,
        direction,
        range,
        page,
        pageSize,
      });

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

export const savingsController = new SavingsController();


