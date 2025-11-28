import { Request, Response } from 'express';
import {
  WalletBalanceResponse,
  FundWalletRequest,
  FundWalletResponse,
  WithdrawWalletRequest,
  WithdrawWalletResponse,
  WalletTransactionsResponse,
} from '../types/api/wallet.types';
import { walletService } from '../services/wallet/wallet.service';

export class WalletController {
  /**
   * Get wallet balance
   * GET /api/wallet/balance
   */
  async getBalance(req: Request, res: Response<WalletBalanceResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await walletService.getBalance(userId);

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
   * Fund wallet (deposit)
   * POST /api/wallet/fund
   */
  async fundWallet(req: Request<{}, FundWalletResponse, FundWalletRequest>, res: Response<FundWalletResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await walletService.fundWallet(userId, req.body);

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
   * Withdraw from wallet
   * POST /api/wallet/withdraw
   */
  async withdrawWallet(req: Request<{}, WithdrawWalletResponse, WithdrawWalletRequest>, res: Response<WithdrawWalletResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await walletService.withdrawWallet(userId, req.body);

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
   * Get wallet transactions
   * GET /api/wallet/transactions?limit=50&offset=0
   */
  async getTransactions(req: Request, res: Response<WalletTransactionsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await walletService.getTransactions(userId, limit, offset);

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

export const walletController = new WalletController();
