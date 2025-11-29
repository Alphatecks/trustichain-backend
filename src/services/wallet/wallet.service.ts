/**
 * Wallet Service
 * Handles wallet operations including balance, funding, and withdrawals
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { FundWalletRequest, WithdrawWalletRequest, WalletTransaction } from '../../types/api/wallet.types';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { exchangeService } from '../exchange/exchange.service';

export class WalletService {
  /**
   * Get wallet balance for a user
   */
  async getBalance(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      balance: {
        xrp: number;
        usdt: number;
        usdc: number;
      };
      xrplAddress: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get or create wallet
      let { data: wallet, error: walletError } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      // If wallet doesn't exist, create one
      if (walletError || !wallet) {
        // Generate XRPL address (this would normally be done through XRPL wallet service)
        const xrplAddress = await xrplWalletService.generateAddress();
        
        const { data: newWallet, error: createError } = await adminClient
          .from('wallets')
          .insert({
            user_id: userId,
            xrpl_address: xrplAddress,
            balance_xrp: 0,
            balance_usdt: 0,
            balance_usdc: 0,
          })
          .select()
          .single();

        if (createError || !newWallet) {
          return {
            success: false,
            message: 'Failed to create wallet',
            error: 'Failed to create wallet',
          };
        }

        wallet = newWallet;
      }

      // Get live balances from XRPL (XRP, USDT, USDC)
      const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);

      // Update wallet balance in database
      await adminClient
        .from('wallets')
        .update({
          balance_xrp: balances.xrp,
          balance_usdt: balances.usdt,
          balance_usdc: balances.usdc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      return {
        success: true,
        message: 'Wallet balance retrieved successfully',
        data: {
          balance: {
            xrp: parseFloat(balances.xrp.toFixed(6)),
            usdt: parseFloat(balances.usdt.toFixed(6)),
            usdc: parseFloat(balances.usdc.toFixed(6)),
          },
          xrplAddress: wallet.xrpl_address,
        },
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get wallet balance',
        error: error instanceof Error ? error.message : 'Failed to get wallet balance',
      };
    }
  }

  /**
   * Fund wallet (deposit) - Prepare transaction for user signing
   * Returns unsigned transaction blob that frontend sends to user's wallet
   */
  async fundWallet(userId: string, request: FundWalletRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      transactionId: string;
      transaction: any;
      transactionBlob: string;
      instructions: string;
      amount: {
        xrp: number;
        usdt: number;
        usdc: number;
      };
      requiresTrustLine?: boolean;
      trustLineTransaction?: {
        transaction: any;
        transactionBlob: string;
        instructions: string;
      };
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get wallet
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found',
          error: 'Wallet not found',
        };
      }

      // Determine currency type
      let currency: 'XRP' | 'USDT' | 'USDC' = 'XRP';
      let amount = request.amount;

      if (request.currency === 'USD') {
        // For USD, we'll default to USDT (or could prompt user to choose)
        currency = 'USDT';
      } else if (request.currency === 'XRP') {
        currency = 'XRP';
      } else if (request.currency === 'USDT') {
        currency = 'USDT';
      } else if (request.currency === 'USDC') {
        currency = 'USDC';
      }

      // Create transaction record
      const { data: transaction, error: txError } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount_xrp: currency === 'XRP' ? amount : 0,
          amount_usd: currency !== 'XRP' ? amount : 0,
          status: 'pending',
          description: `Deposit ${request.amount} ${currency}`,
        })
        .select()
        .single();

      if (txError || !transaction) {
        return {
          success: false,
          message: 'Failed to create transaction',
          error: 'Failed to create transaction',
        };
      }

      // Prepare payment transaction for user signing
      const paymentTx = await xrplWalletService.preparePaymentTransaction(
        wallet.xrpl_address,
        amount,
        currency
      );

      // For tokens, check if trust line is needed
      let requiresTrustLine = false;
      let trustLineTx = undefined;

      if (currency !== 'XRP') {
        // Check if user has trust line (simplified - in production, check actual trust lines)
        // For now, we'll prepare trust line transaction as backup
        trustLineTx = await xrplWalletService.prepareTrustLineTransaction(currency);
        requiresTrustLine = true; // Frontend should check and prompt if needed
      }

      // Calculate amounts for response
      const amounts = {
        xrp: currency === 'XRP' ? amount : 0,
        usdt: currency === 'USDT' ? amount : 0,
        usdc: currency === 'USDC' ? amount : 0,
      };

      return {
        success: true,
        message: 'Transaction prepared. Please sign in your wallet.',
        data: {
          transactionId: transaction.id,
          transaction: paymentTx.transaction,
          transactionBlob: paymentTx.transactionBlob,
          instructions: paymentTx.instructions,
          amount: amounts,
          requiresTrustLine,
          trustLineTransaction: trustLineTx,
        },
      };
    } catch (error) {
      console.error('Error preparing fund wallet transaction:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to prepare fund transaction',
        error: error instanceof Error ? error.message : 'Failed to prepare fund transaction',
      };
    }
  }

  /**
   * Complete wallet funding after user signs transaction
   * Called by frontend after user signs the transaction in their wallet
   */
  async completeFundWallet(
    userId: string,
    transactionId: string,
    signedTxBlob: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      transactionId: string;
      xrplTxHash: string;
      status: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get transaction
      const { data: transaction } = await adminClient
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('user_id', userId)
        .single();

      if (!transaction) {
        return {
          success: false,
          message: 'Transaction not found',
          error: 'Transaction not found',
        };
      }

      // Submit signed transaction to XRPL
      const submitResult = await xrplWalletService.submitSignedTransaction(signedTxBlob);

      // Update transaction with XRPL hash and status
      const status = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
      
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: submitResult.hash,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      return {
        success: true,
        message: status === 'completed' ? 'Wallet funded successfully' : 'Transaction failed',
        data: {
          transactionId: transaction.id,
          xrplTxHash: submitResult.hash,
          status: status,
        },
      };
    } catch (error) {
      console.error('Error completing fund wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete fund transaction',
        error: error instanceof Error ? error.message : 'Failed to complete fund transaction',
      };
    }
  }

  /**
   * Withdraw from wallet
   */
  async withdrawWallet(userId: string, request: WithdrawWalletRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      transactionId: string;
      amount: {
        usd: number;
        xrp: number;
      };
      xrplTxHash?: string;
      status: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get wallet
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found',
          error: 'Wallet not found',
        };
      }

      // Convert amount to XRP if needed
      let amountXrp = request.amount;
      let amountUsd = request.amount;

      if (request.currency === 'USD') {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountXrp = request.amount / usdRate;
      } else {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountUsd = request.amount * usdRate;
      }

      // Check balance
      const balance = await this.getBalance(userId);
      if (!balance.success || !balance.data) {
        return {
          success: false,
          message: 'Failed to check balance',
          error: 'Failed to check balance',
        };
      }

      if (balance.data.balance.xrp < amountXrp) {
        return {
          success: false,
          message: 'Insufficient balance',
          error: 'Insufficient balance',
        };
      }

      // Create transaction record
      const { data: transaction, error: txError } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'withdrawal',
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          description: `Withdrawal to ${request.destinationAddress}`,
        })
        .select()
        .single();

      if (txError || !transaction) {
        return {
          success: false,
          message: 'Failed to create transaction',
          error: 'Failed to create transaction',
        };
      }

      // Create XRPL withdrawal transaction
      const xrplTxHash = await xrplWalletService.createWithdrawalTransaction(
        wallet.xrpl_address,
        request.destinationAddress,
        amountXrp
      );

      // Update transaction
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: xrplTxHash,
          status: 'processing',
        })
        .eq('id', transaction.id);

      return {
        success: true,
        message: 'Withdrawal initiated successfully',
        data: {
          transactionId: transaction.id,
          amount: {
            usd: parseFloat(amountUsd.toFixed(2)),
            xrp: parseFloat(amountXrp.toFixed(6)),
          },
          xrplTxHash,
          status: 'processing',
        },
      };
    } catch (error) {
      console.error('Error withdrawing from wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to withdraw from wallet',
        error: error instanceof Error ? error.message : 'Failed to withdraw from wallet',
      };
    }
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    message: string;
    data?: {
      transactions: WalletTransaction[];
      total: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get transactions
      const { data: transactions, error: txError } = await adminClient
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Get total count
      const { count } = await adminClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (txError) {
        return {
          success: false,
          message: 'Failed to fetch transactions',
          error: 'Failed to fetch transactions',
        };
      }

      const formattedTransactions: WalletTransaction[] = (transactions || []).map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: {
          usd: parseFloat(tx.amount_usd),
          xrp: parseFloat(tx.amount_xrp),
        },
        status: tx.status,
        xrplTxHash: tx.xrpl_tx_hash || undefined,
        description: tx.description || undefined,
        createdAt: tx.created_at,
      }));

      return {
        success: true,
        message: 'Transactions retrieved successfully',
        data: {
          transactions: formattedTransactions,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get transactions',
        error: error instanceof Error ? error.message : 'Failed to get transactions',
      };
    }
  }
}

export const walletService = new WalletService();


