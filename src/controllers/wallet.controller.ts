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
import { validateSignedTransactionFormat } from '../utils/transactionValidation';

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
        signedBlobType: typeof signedBlob,
        signedBlobPreview: typeof signedBlob === 'string' 
          ? signedBlob.substring(0, 200) 
          : JSON.stringify(signedBlob).substring(0, 200),
        bodyKeys: Object.keys(req.body),
        fullBody: req.body,
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

      // Validate signed transaction format early to catch common mistakes (especially UUIDs)
      const formatValidation = validateSignedTransactionFormat(signedBlob);
      if (!formatValidation.valid) {
        // Only reject if it's clearly a UUID or obviously invalid
        // For other cases, let the XRPL service handle validation
        if (formatValidation.detectedFormat === 'uuid') {
          res.status(400).json({
            success: false,
            message: formatValidation.error || 'Invalid signed transaction format',
            error: 'Invalid transaction format',
            details: {
              detectedFormat: formatValidation.detectedFormat,
              hint: 'You are sending a transaction ID instead of the signed transaction. Please send the actual signed transaction returned by MetaMask/XRPL Snap.',
              receivedValue: typeof signedBlob === 'string' 
                ? signedBlob.substring(0, 100) 
                : JSON.stringify(signedBlob).substring(0, 100),
            },
          });
          return;
        }
        // For other invalid formats, log but let it through to get more specific error from XRPL service
        console.warn('Transaction format validation warning:', {
          detectedFormat: formatValidation.detectedFormat,
          error: formatValidation.error,
          valuePreview: typeof signedBlob === 'string' 
            ? signedBlob.substring(0, 200) 
            : JSON.stringify(signedBlob).substring(0, 200),
        });
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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.controller.ts:161',message:'getXUMMPayloadStatus: Endpoint called',data:{userId,transactionId,hasTransactionId:!!transactionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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


