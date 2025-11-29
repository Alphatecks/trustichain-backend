import { Request, Response } from 'express';
import {
  WalletBalanceResponse,
  FundWalletRequest,
  FundWalletResponse,
  CompleteFundWalletRequest,
  CompleteFundWalletResponse,
  CreateXUMMPayloadRequest,
  CreateXUMMPayloadResponse,
  XUMMPayloadStatusResponse,
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
   * Fund wallet (deposit) - Prepare transaction for user signing
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
   * Complete wallet funding after user signs transaction
   * POST /api/wallet/fund/complete
   */
  async completeFundWallet(req: Request<{}, CompleteFundWalletResponse, CompleteFundWalletRequest>, res: Response<CompleteFundWalletResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await walletService.completeFundWallet(userId, req.body.transactionId, req.body.signedTxBlob);

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
   * Create XUMM payload for transaction signing
   * POST /api/wallet/fund/create-payload
   */
  async createXUMMPayload(req: Request<{}, CreateXUMMPayloadResponse, CreateXUMMPayloadRequest>, res: Response<CreateXUMMPayloadResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await walletService.createXUMMPayload(userId, req.body.transactionId, req.body.transactionBlob);

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
   * Get XUMM payload status
   * GET /api/wallet/fund/status?transactionId=...
   */
  async getXUMMPayloadStatus(req: Request, res: Response<XUMMPayloadStatusResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const transactionId = req.query.transactionId as string;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
          error: 'Transaction ID is required',
        });
        return;
      }

      const result = await walletService.getXUMMPayloadStatus(userId, transactionId);

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


