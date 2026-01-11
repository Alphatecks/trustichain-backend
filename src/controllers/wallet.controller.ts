import { Request, Response } from 'express';
import { walletService } from '../services/wallet/wallet.service';
import { validateSignedTransactionFormat } from '../utils/transactionValidation';


export class WalletController {
  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.getBalance(userId);
      if (result.success && result.data) {
        res.json({
          success: true,
          message: result.message,
          data: {
            balance: result.data.balance,
            xrplAddress: '', // TODO: Add address if available from data
          },
        });
      } else {
        res.json({
          success: false,
          message: result.message,
          error: result.error || 'Failed to fetch balance',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async getSwapQuote(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.getSwapQuote(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async executeSwap(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.executeSwap(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async submitSignedDeposit(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const { transactionId, signedTxBlob, signedTransaction, txBlob, signedTx } = req.body;
      const txId = transactionId;
      const signedBlob = signedTxBlob || signedTransaction || txBlob || signedTx;
      if (!txId || !signedBlob) {
        res.json({
          success: false,
          message: 'Transaction ID and signed transaction blob are required',
          error: 'Missing required fields',
          details: {
            received: {
              transactionId: !!txId,
              signedTxBlob: !!signedBlob,
              bodyKeys: req.body ? Object.keys(req.body) : [],
            },
            expected: ['transactionId', 'signedTxBlob'],
          },
        });
        return;
      }
      const formatValidation = validateSignedTransactionFormat(signedBlob);
      if (!formatValidation.valid && formatValidation.detectedFormat === 'uuid') {
        res.json({
          success: false,
          message: formatValidation.error || 'Invalid signed transaction format',
          error: 'Invalid transaction format',
          details: {
            detectedFormat: formatValidation.detectedFormat,
            hint: 'You are sending a transaction ID instead of the signed transaction. Please send the actual signed transaction returned by MetaMask/XRPL Snap.',
            receivedValue: typeof signedBlob === 'string' 
              ? signedBlob.substring(0, 100) : undefined,
          },
        });
        return;
      }
      const result = await walletService.submitSignedDeposit(userId, txId, signedBlob);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async getXUMMPayloadStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const transactionId = req.query.transactionId as string;
      if (!transactionId) {
        res.json({
          success: false,
          message: 'Transaction ID is required',
          error: 'Transaction ID is required',
        });
        return;
      }
      const result = await walletService.getXUMMPayloadStatus(userId, transactionId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await walletService.getTransactions(userId, limit, offset);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async fundWallet(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.fundWallet(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async withdrawWallet(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.withdrawWallet(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async connectWallet(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.connectWallet(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async disconnectWallet(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.disconnectWallet(userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async validateAddress(req: Request, res: Response): Promise<void> {
    try {
      const result = await walletService.validateAddress(req.body.walletAddress);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async connectWalletViaXUMM(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.connectWalletViaXUMM(userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async checkXUMMConnectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const xummUuid = req.query.xummUuid as string;
      if (!xummUuid) {
        res.json({
          success: false,
          message: 'XUMM UUID is required',
          error: 'Missing xummUuid parameter',
        });
        return;
      }
      const result = await walletService.checkXUMMConnectionStatus(userId, xummUuid);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async fundWalletViaXUMM(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const result = await walletService.fundWalletViaXUMM(userId, req.body);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  async checkXUMMFundStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { userId?: string }).userId!;
      const transactionId = req.query.transactionId as string;
      const xummUuid = req.query.xummUuid as string;
      if (!transactionId || !xummUuid) {
        res.json({
          success: false,
          message: 'Transaction ID and XUMM UUID are required',
          error: 'Missing required parameters',
        });
        return;
      }
      const result = await walletService.checkXUMMFundStatus(userId, transactionId, xummUuid);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }
}

  
    