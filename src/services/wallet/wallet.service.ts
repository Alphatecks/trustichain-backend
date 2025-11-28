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
    data?: {
      balance: {
        usd: number;
        xrp: number;
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
            balance_usd: 0,
          })
          .select()
          .single();

        if (createError || !newWallet) {
          return {
            success: false,
            error: 'Failed to create wallet',
          };
        }

        wallet = newWallet;
      }

      // Get live balance from XRPL
      const xrplBalance = await xrplWalletService.getBalance(wallet.xrpl_address);
      
      // Get exchange rate for USD conversion
      const exchangeRates = await exchangeService.getLiveExchangeRates();
      const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
      const balanceUsd = xrplBalance * usdRate;

      // Update wallet balance in database
      await adminClient
        .from('wallets')
        .update({
          balance_xrp: xrplBalance,
          balance_usd: balanceUsd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      return {
        success: true,
        data: {
          balance: {
            usd: parseFloat(balanceUsd.toFixed(2)),
            xrp: parseFloat(xrplBalance.toFixed(6)),
          },
          xrplAddress: wallet.xrpl_address,
        },
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wallet balance',
      };
    }
  }

  /**
   * Fund wallet (deposit)
   */
  async fundWallet(userId: string, request: FundWalletRequest): Promise<{
    success: boolean;
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

      // Create transaction record
      const { data: transaction, error: txError } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          description: `Deposit ${request.amount} ${request.currency}`,
        })
        .select()
        .single();

      if (txError || !transaction) {
        return {
          success: false,
          error: 'Failed to create transaction',
        };
      }

      // In a real implementation, this would initiate the XRPL transaction
      // For now, we'll simulate it
      const xrplTxHash = await xrplWalletService.createDepositTransaction(
        wallet.xrpl_address,
        amountXrp
      );

      // Update transaction with XRPL hash
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: xrplTxHash,
          status: 'processing',
        })
        .eq('id', transaction.id);

      return {
        success: true,
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
      console.error('Error funding wallet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fund wallet',
      };
    }
  }

  /**
   * Withdraw from wallet
   */
  async withdrawWallet(userId: string, request: WithdrawWalletRequest): Promise<{
    success: boolean;
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
          error: 'Failed to check balance',
        };
      }

      if (balance.data.balance.xrp < amountXrp) {
        return {
          success: false,
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
        error: error instanceof Error ? error.message : 'Failed to withdraw from wallet',
      };
    }
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
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
      const { count, error: countError } = await adminClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (txError) {
        return {
          success: false,
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
        data: {
          transactions: formattedTransactions,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transactions',
      };
    }
  }
}

export const walletService = new WalletService();
