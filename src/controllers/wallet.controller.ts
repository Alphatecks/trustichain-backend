import { Request, Response } from 'express';
import {
  WalletBalanceResponse,
  FundWalletRequest,
  FundWalletResponse,
  WithdrawWalletRequest,
  WithdrawWalletResponse,
  WalletTransactionsResponse,
  XUMMPayloadStatusResponse,
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
   * Submit signed deposit transaction (for browser wallets)
   * POST /api/wallet/fund/submit
   */
  async submitSignedDeposit(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { transactionId, signedTxBlob, signedTransaction, txBlob, signedTx } = req.body;

      // Support multiple field names for flexibility
      const txId = transactionId;
      const signedBlob = signedTxBlob || signedTransaction || txBlob || signedTx;

      // Log received data for debugging
      console.log('Submit signed deposit request:', {
        userId,
        transactionId: txId,
        hasSignedBlob: !!signedBlob,
        bodyKeys: Object.keys(req.body),
      });

      if (!txId || !signedBlob) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID and signed transaction blob are required',
          error: 'Missing required fields',
          details: {
            received: {
              transactionId: !!txId,
              signedTxBlob: !!signedBlob,
              bodyKeys: Object.keys(req.body),
            },
            expected: ['transactionId', 'signedTxBlob'],
          },
        });
        return;
      }

      const result = await walletService.submitSignedDeposit(userId, txId, signedBlob);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error submitting signed deposit:', error);
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


