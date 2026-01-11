/**
 * Wallet Service
 * Handles wallet operations including balance, funding, and withdrawals
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import {
  FundWalletRequest,
  WithdrawWalletRequest,
  WalletTransaction,
  SwapQuoteRequest,
  SwapQuoteResponse,
  SwapExecuteRequest,
  SwapExecuteResponse,
} from '../../types/api/wallet.types';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { xrplDexService } from '../../xrpl/dex/xrpl-dex.service';
import { exchangeService } from '../exchange/exchange.service';
import { encryptionService } from '../encryption/encryption.service';
import { xummService } from '../xumm/xumm.service';
import { notificationService } from '../notification/notification.service';

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
        usd: number;
      };
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { data: wallet, error } = await adminClient
        .from('wallets')
        .select('balance_xrp, balance_usdt, balance_usdc')
        .eq('user_id', userId)
        .single();

      if (error || !wallet) {
        return {
          success: false,
          message: 'Wallet not found',
          error: 'Wallet not found',
        };
      }

      return {
        success: true,
        message: 'Balance retrieved successfully',
        data: {
          balance: {
            xrp: wallet.balance_xrp ?? 0,
            usdt: wallet.balance_usdt ?? 0,
            usdc: wallet.balance_usdc ?? 0,
            usd: 0, // TODO: Calculate USD equivalent if needed
          },
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
   * Connect a wallet to a user
   */
  async connectWallet(userId: string, request: { walletAddress: string }): Promise<{
    success: boolean;
    message: string;
    data?: { walletAddress: string; previousAddress?: string };
    error?: string;
    help?: { detectedType?: 'ethereum' | 'invalid' | 'wrong_length'; exampleCode?: string; correctFormat?: string };
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      let { walletAddress } = request;
      walletAddress = String(walletAddress || '').trim();
      if (!walletAddress) {
        return { success: false, message: 'Wallet address is required', error: 'Missing wallet address' };
      }
      if (walletAddress.startsWith('0x')) {
        return {
          success: false,
          message: 'Invalid address format: This appears to be an Ethereum address (starts with 0x).',
          error: 'Ethereum address detected',
          help: { detectedType: 'ethereum', correctFormat: 'XRPL addresses start with "r" and are 25-35 characters long.' },
        };
      }
      if (!walletAddress.startsWith('r')) {
        return {
          success: false,
          message: 'Invalid XRPL wallet address format. XRPL addresses must start with "r".',
          error: 'Invalid wallet address format',
          help: { detectedType: 'invalid', correctFormat: 'XRPL addresses start with "r" and are 25-35 characters long.' },
        };
      }
      if (walletAddress.length < 25 || walletAddress.length > 35) {
        return {
          success: false,
          message: 'Invalid XRPL wallet address length.',
          error: 'Invalid wallet address format',
          help: { detectedType: 'wrong_length', correctFormat: 'XRPL addresses are 25-35 characters long.' },
        };
      }
      const { data: existingWallet, error: checkError } = await adminClient
        .from('wallets')
        .select('user_id, xrpl_address')
        .eq('xrpl_address', walletAddress)
        .maybeSingle();
      if (checkError) {
        return { success: false, message: 'Failed to verify wallet address', error: 'Database error' };
      }
      if (existingWallet && existingWallet.user_id !== userId) {
        return { success: false, message: 'This wallet address is already connected to another account', error: 'Wallet address already in use' };
      }
      const { data: currentWallet, error: walletError } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();
      if (walletError || !currentWallet) {
        const { error: createError } = await adminClient
          .from('wallets')
          .insert({ user_id: userId, xrpl_address: walletAddress, balance_xrp: 0, balance_usdt: 0, balance_usdc: 0 });
        if (createError) {
          return { success: false, message: 'Failed to connect wallet', error: 'Failed to create wallet record' };
        }
        return { success: true, message: 'MetaMask wallet connected successfully. You can now fund your wallet from this connected wallet.', data: { walletAddress } };
      }
      const previousAddress = currentWallet.xrpl_address;
      const { error: updateError } = await adminClient
        .from('wallets')
        .update({ xrpl_address: walletAddress, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updateError) {
        return { success: false, message: 'Failed to update wallet address', error: 'Database update failed' };
      }
      return { success: true, message: 'MetaMask wallet connected successfully. Your wallet address has been updated.', data: { walletAddress, previousAddress: previousAddress !== walletAddress ? previousAddress : undefined } };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to connect wallet', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Disconnect user's connected XRPL wallet (e.g., Xaman/XUMM)
   */
  async disconnectWallet(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: { previousAddress?: string };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { data: currentWallet, error: walletError } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();
      if (walletError || !currentWallet) {
        return { success: false, message: 'No wallet found to disconnect', error: 'Wallet not found' };
      }
      const previousAddress = currentWallet.xrpl_address;
      const { error: updateError } = await adminClient
        .from('wallets')
        .update({ xrpl_address: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updateError) {
        return { success: false, message: 'Failed to disconnect wallet', error: 'Database update failed' };
      }
      return { success: true, message: 'Wallet disconnected successfully.', data: { previousAddress } };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Failed to disconnect wallet', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  // ...existing code...

  /**
   * Connect wallet via XUMM
   * Creates a XUMM payload that requests the user's XRPL address
   */
  async connectWalletViaXUMM(userId: string): Promise<{
    success: boolean,
    message: string,
    data?: {
      xummUrl: string,
      xummUuid: string,
      qrCode?: string,
      qrUri?: string,
      instructions: string
    },
    error?: string
  }> {
    try {
      // Create a SignIn transaction to get the user's XRPL address
      // SignIn is a special XUMM transaction type that just requires signing
      // It doesn't submit anything to XRPL, just gets the account address
      const signInTransaction = {
        TransactionType: 'SignIn',
      };

      // Create XUMM payload
      const xummPayload = await xummService.createPayload(signInTransaction);

      // Store the connection request in database for tracking
      const adminClient = supabaseAdmin || supabase;
      await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'wallet_connect',
          status: 'pending',
          description: `XUMM wallet connection | XUMM_UUID:${xummPayload.uuid}`,
        });

      return {
        success: true,
        message: 'XUMM connection request created. Please scan the QR code with Xaman app to connect your wallet.',
        data: {
          xummUrl: xummPayload.next.always,
          xummUuid: xummPayload.uuid,
          qrCode: xummPayload.refs.qr_png,
          qrUri: xummPayload.refs.qr_uri,
          instructions: 'Open Xaman app and scan the QR code to connect your XRPL wallet',
        },
      };
    } catch (error) {
      console.error('Error creating XUMM connection payload:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create XUMM connection request',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fund wallet via XUMM (Xaman app)
   * Creates a XUMM payload for the user to sign a payment transaction
   * This will debit XRP from the user's Xaman wallet to their connected wallet address
   */
  async fundWalletViaXUMM(userId: string, request: { amount: number }): Promise<{
    success: boolean,
    message: string,
    data?: {
      transactionId: string,
      xummUrl: string,
      xummUuid: string,
      qrCode: string,
      qrUri: string,
      amount: number,
      destinationAddress: string,
      instructions: string
    },
    error?: string
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user's wallet
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found. Please connect your Xaman wallet first.',
          error: 'Wallet not found',
        };
      }

      // Validate amount
      if (!request.amount || request.amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0',
          error: 'Invalid amount',
        };
      }

      // Prepare payment transaction (from user's Xaman wallet to their connected wallet)
      const preparedTx = await xrplWalletService.preparePaymentTransaction(
        wallet.xrpl_address, // Destination: user's connected wallet address
        request.amount,
        'XRP'
      );

      // Create XUMM payload
      const xummPayload = await xummService.createPayload(preparedTx.transaction);

      // Create transaction record
      const { data: transaction, error: txError } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount_xrp: request.amount,
          amount_usd: 0, // Will be calculated later if needed
          status: 'pending',
          description: `XUMM deposit ${request.amount} XRP | XUMM_UUID:${xummPayload.uuid}`,
        })
        .select()
        .single();

      if (txError || !transaction) {
        return {
          success: false,
          message: 'Failed to create transaction record',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'XUMM payment request created. Please scan the QR code with Xaman app to approve the payment.',
        data: {
          transactionId: transaction.id,
          xummUrl: xummPayload.next.always,
          xummUuid: xummPayload.uuid,
          qrCode: xummPayload.refs.qr_png,
          qrUri: xummPayload.refs.qr_uri,
          amount: request.amount,
          destinationAddress: wallet.xrpl_address,
          instructions: `Sign this transaction in Xaman app to deposit ${request.amount} XRP to your wallet`,
        },
      };
    } catch (error) {
      console.error('Error creating XUMM fund request:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create XUMM fund request',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check XUMM fund status and submit transaction when signed
   */
  async checkXUMMFundStatus(userId: string, transactionId: string, xummUuid: string): Promise<{
    success: boolean,
    message: string,
    data?: {
      signed: boolean,
      xummUuid: string,
      transactionId: string,
      status: 'pending' | 'signed' | 'submitted' | 'completed' | 'cancelled' | 'expired' | 'failed',
      xrplTxHash?: string,
      amount?: number
    },
    error?: string
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

      // Get payload status from XUMM
      const payloadStatus = await xummService.getPayloadStatus(xummUuid);

      // Check if cancelled or expired
      if (payloadStatus.meta.cancelled) {
        await adminClient
          .from('transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        return {
          success: true,
          message: 'XUMM payment request was cancelled',
          data: {
            signed: false,
            xummUuid,
            transactionId,
            status: 'cancelled',
          },
        };
      }

      if (payloadStatus.meta.expired) {
        await adminClient
          .from('transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        return {
          success: true,
          message: 'XUMM payment request has expired',
          data: {
            signed: false,
            xummUuid,
            transactionId,
            status: 'expired',
          },
        };
      }

      // Check if signed
      if (!payloadStatus.meta.signed) {
        return {
          success: true,
          message: 'Waiting for user to sign payment in Xaman app',
          data: {
            signed: false,
            xummUuid,
            transactionId,
            status: 'pending',
          },
        };
      }

      // Transaction is signed - submit to XRPL
      if (payloadStatus.response?.hex) {
        // Submit signed transaction to XRPL
        const submitResult = await xrplWalletService.submitSignedTransaction(payloadStatus.response.hex);

        const status = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';

        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: submitResult.hash,
            status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        // Update wallet balance if successful
        if (status === 'completed') {
          const { data: wallet } = await adminClient
            .from('wallets')
            .select('xrpl_address')
            .eq('user_id', userId)
            .single();

          if (wallet) {
            const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
            await adminClient
              .from('wallets')
              .update({
                balance_xrp: balances.xrp,
                balance_usdt: balances.usdt,
                balance_usdc: balances.usdc,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
          }
        }

        return {
          success: true,
          message: status === 'completed' 
            ? 'Payment completed successfully. XRP has been debited from your Xaman wallet.'
            : 'Payment transaction failed',
          data: {
            signed: true,
            xummUuid,
            transactionId,
            status: status === 'completed' ? 'completed' : 'failed',
            xrplTxHash: submitResult.hash,
            amount: transaction.amount_xrp,
          },
        };
      } else if (payloadStatus.response?.txid) {
        // XUMM auto-submitted the transaction
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: payloadStatus.response.txid,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        // Update wallet balance
        const { data: wallet } = await adminClient
          .from('wallets')
          .select('xrpl_address')
          .eq('user_id', userId)
          .single();

        if (wallet) {
          const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: balances.xrp,
              balance_usdt: balances.usdt,
              balance_usdc: balances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        }

        return {
          success: true,
          message: 'Payment completed successfully. XRP has been debited from your Xaman wallet.',
          data: {
            signed: true,
            xummUuid,
            transactionId,
            status: 'completed',
            xrplTxHash: payloadStatus.response.txid,
            amount: transaction.amount_xrp,
          },
        };
      } else {
        return {
          success: false,
          message: 'Transaction signed but no transaction data available',
          error: 'Missing transaction data',
        };
      }
    } catch (error) {
      console.error('Error checking XUMM fund status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to check XUMM fund status',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check XUMM connection status and connect wallet when signed
   */
  async checkXUMMConnectionStatus(userId: string, xummUuid: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      signed: boolean;
      walletAddress?: string;
      xummUuid: string;
      status: 'pending' | 'signed' | 'cancelled' | 'expired' | 'connected';
    };
    error?: string;
  }> {
    try {
      // Get payload status from XUMM
      const payloadStatus = await xummService.getPayloadStatus(xummUuid);

      // Check if cancelled or expired
      if (payloadStatus.meta.cancelled) {
          return {
            success: true,
            message: 'XUMM connection request was cancelled',
            data: {
              signed: false,
              xummUuid,
              status: 'cancelled',
            },
          };
      }

      if (payloadStatus.meta.expired) {
          return {
            success: true,
            message: 'XUMM connection request has expired',
            data: {
              signed: false,
              xummUuid,
              status: 'expired',
            },
          };
      }

      // Check if signed
      if (!payloadStatus.meta.signed) {
          return {
            success: true,
            message: 'Waiting for user to sign in Xaman app',
            data: {
              signed: false,
              xummUuid,
              status: 'pending',
            },
          };
      }

      // Extract account address from response
      const walletAddress = payloadStatus.response?.account;
      
      if (!walletAddress) {
        return {
          success: false,
          message: 'XUMM response does not contain account address',
          error: 'Missing account address in XUMM response',
        };
      }

      // Validate address format
      if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
        return {
          success: false,
          message: `Invalid XRPL address received from XUMM: ${walletAddress}`,
          error: 'Invalid address format',
        };
      }

      // Connect the wallet using existing connectWallet logic
      const connectResult = await this.connectWallet(userId, { walletAddress });

      if (connectResult.success) {
        // Update transaction status
        const adminClient = supabaseAdmin || supabase;
        await adminClient
          .from('transactions')
          .update({
            status: 'completed',
            description: `XUMM wallet connected | Address: ${walletAddress} | XUMM_UUID:${xummUuid}`,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .like('description', `%XUMM_UUID:${xummUuid}%`)
          .eq('status', 'pending');

        return {
          success: true,
          message: 'Wallet connected successfully via XUMM',
          data: {
            signed: true,
            walletAddress,
            xummUuid,
            status: 'connected',
          },
        };
      } else {
        return {
          success: false,
          message: connectResult.message || 'Failed to connect wallet',
          error: connectResult.error || 'Connection failed',
        };
      }
    } catch (error) {
      console.error('Error checking XUMM connection status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to check XUMM connection status',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate wallet address format (helper endpoint)
   * Allows frontend to check address format before attempting to connect
   */
  async validateAddress(address: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      isValid: boolean;
      addressType: 'xrpl' | 'ethereum' | 'invalid';
      formattedAddress?: string;
      suggestions?: string[];
    };
    error?: string;
  }> {
    try {
      // Trim and normalize
      let normalizedAddress = String(address || '').trim();

      if (!normalizedAddress) {
        return {
          success: true,
          message: 'Address is empty',
          data: {
            isValid: false,
            addressType: 'invalid',
            suggestions: ['Please provide a wallet address'],
          },
        };
      }

      // Check if Ethereum address
      if (normalizedAddress.startsWith('0x')) {
        return {
          success: true,
          message: 'This is an Ethereum address. XRPL addresses start with "r".',
          data: {
            isValid: false,
            addressType: 'ethereum',
            formattedAddress: normalizedAddress,
            suggestions: [
              'Use MetaMask XRPL Snap to get XRPL address',
              'Call wallet_invokeSnap with method: "getAddress"',
              'XRPL addresses start with "r" and are 25-35 characters',
            ],
          },
        };
      }

      // Check if XRPL address
      if (normalizedAddress.startsWith('r')) {
        if (normalizedAddress.length >= 25 && normalizedAddress.length <= 35) {
          return {
            success: true,
            message: 'Valid XRPL address format',
            data: {
              isValid: true,
              addressType: 'xrpl',
              formattedAddress: normalizedAddress,
            },
          };
        } else {
          return {
            success: true,
            message: 'XRPL address has invalid length',
            data: {
              isValid: false,
              addressType: 'xrpl',
              formattedAddress: normalizedAddress,
              suggestions: [
                `Expected length: 25-35 characters, got: ${normalizedAddress.length}`,
                'Please verify the address is complete',
              ],
            },
          };
        }
      }

      // Unknown format
      return {
        success: true,
        message: 'Unknown address format',
        data: {
          isValid: false,
          addressType: 'invalid',
          formattedAddress: normalizedAddress,
          suggestions: [
            'XRPL addresses start with "r" and are 25-35 characters',
            'Ethereum addresses start with "0x" and are 42 characters',
            'Make sure you are getting the XRPL address from MetaMask XRPL Snap',
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to validate address',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get swap quote between XRP, USDT, and USDC for the user's wallet.
   * This powers the "Preview Swap" UI and does not execute any on-chain swap.
   */
  async getSwapQuote(userId: string, request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    try {
      const { amount, fromCurrency, toCurrency } = request;

      if (!amount || amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0',
          error: 'Invalid amount',
        };
      }

      if (fromCurrency === toCurrency) {
        return {
          success: false,
          message: 'From and to currencies must be different',
          error: 'Invalid currency pair',
        };
      }

      // Get current wallet balances
      const balanceResult = await this.getBalance(userId);
      if (!balanceResult.success || !balanceResult.data) {
        return {
          success: false,
          message: 'Failed to retrieve wallet balance',
          error: 'Balance fetch failed',
        };
      }

      const { balance } = balanceResult.data;

      // Determine available "from" balance, respecting XRP reserve rules
      let availableFromBalance: number;
      if (fromCurrency === 'XRP') {
        const BASE_RESERVE = 1.0; // XRPL base reserve (as used in withdrawWallet)
        const ESTIMATED_FEE = 0.000015;
        const minimumRequired = BASE_RESERVE + ESTIMATED_FEE;
        const availableXrp = Math.max(0, balance.xrp - minimumRequired);
        availableFromBalance = availableXrp;
      } else if (fromCurrency === 'USDT') {
        availableFromBalance = balance.usdt;
      } else {
        availableFromBalance = balance.usdc;
      }

      if (amount > availableFromBalance) {
        return {
          success: false,
          message: `Insufficient ${fromCurrency} balance for swap`,
          error: 'Insufficient balance',
        };
      }

      // If useDEX is true, get price from XRPL DEX orderbook
      if (request.useDEX) {
        const dexQuote = await xrplDexService.getDEXPrice(
          fromCurrency,
          toCurrency,
          amount
        );

        if (!dexQuote.success || !dexQuote.data) {
          return {
            success: false,
            message: dexQuote.error || 'Failed to get DEX quote',
            error: dexQuote.error || 'DEX quote failed',
          };
        }

        const { toAmount: dexToAmount, rate: dexRate, estimatedFee } = dexQuote.data;

        // Get USD value for fee calculation
        const ratesResult = await exchangeService.getLiveExchangeRates();
        const xrpUsdRate = ratesResult.data?.rates.find((r) => r.currency === 'USD')?.rate || 0.5;
        
        let usdValue = 0;
        if (fromCurrency === 'XRP') {
          usdValue = amount * xrpUsdRate;
        } else {
          usdValue = amount; // USDT/USDC 1:1 with USD
        }

        // DEX fee is just the XRPL transaction fee (converted to USD)
        const feeUsd = estimatedFee * xrpUsdRate;

        return {
          success: true,
          message: 'DEX swap quote calculated successfully',
          data: {
            fromCurrency,
            toCurrency,
            fromAmount: amount,
            toAmount: parseFloat(dexToAmount.toFixed(6)),
            rate: parseFloat(dexRate.toFixed(8)),
            usdValue: parseFloat(usdValue.toFixed(2)),
            feeUsd: parseFloat(feeUsd.toFixed(6)),
          },
        };
      }

      // Default: Use external exchange rates (internal swap)
      // Get XRP/USD rate from exchange service
      const ratesResult = await exchangeService.getLiveExchangeRates();
      const xrpUsdRate = ratesResult.data?.rates.find((r) => r.currency === 'USD')?.rate;

      if (!ratesResult.success || !ratesResult.data || !xrpUsdRate || xrpUsdRate <= 0) {
        return {
          success: false,
          message: 'XRP/USD exchange rate not available',
          error: 'Exchange rate not available',
        };
      }

      // Convert "from" amount to USD-equivalent
      let usdValue = 0;
      if (fromCurrency === 'XRP') {
        usdValue = amount * xrpUsdRate;
      } else {
        // USDT and USDC are treated as USD-pegged
        usdValue = amount;
      }

      // Apply a small platform fee (configurable later)
      const SWAP_FEE_PERCENT = 0.0; // 0% for now – adjust when ready to charge fees
      const feeUsd = usdValue * SWAP_FEE_PERCENT;
      const netUsd = usdValue - feeUsd;

      // Convert net USD value into target currency
      let toAmount = 0;
      if (toCurrency === 'XRP') {
        toAmount = netUsd / xrpUsdRate;
      } else {
        toAmount = netUsd; // USDT/USDC 1:1 with USD
      }

      const rate = toAmount / amount;

      return {
        success: true,
        message: 'Swap quote calculated successfully',
        data: {
          fromCurrency,
          toCurrency,
          fromAmount: amount,
          toAmount: parseFloat(toAmount.toFixed(6)),
          rate: parseFloat(rate.toFixed(8)),
          usdValue: parseFloat(netUsd.toFixed(2)),
          feeUsd: parseFloat(feeUsd.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get swap quote',
        error: error instanceof Error ? error.message : 'Failed to get swap quote',
      };
    }
  }

  /**
   * Execute a swap between XRP, USDT, and USDC.
   * Supports both internal (database) and on-chain (XRPL DEX) swaps.
   */
  async executeSwap(userId: string, request: SwapExecuteRequest): Promise<SwapExecuteResponse> {
    try {
      const { amount, fromCurrency, toCurrency, swapType = 'internal', slippageTolerance = 5 } = request;

      if (!amount || amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0',
          error: 'Invalid amount',
        };
      }

      if (fromCurrency === toCurrency) {
        return {
          success: false,
          message: 'From and to currencies must be different',
          error: 'Invalid currency pair',
        };
      }

      const adminClient = supabaseAdmin || supabase;

      // Get wallet
      const { data: wallet, error: walletError } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        return {
          success: false,
          message: 'Wallet not found',
          error: 'Wallet not found',
        };
      }

      // Handle on-chain swap
      if (swapType === 'onchain') {
        return await this.executeOnChainSwap(
          userId,
          wallet,
          amount,
          fromCurrency,
          toCurrency,
          slippageTolerance
        );
      }

      // Handle internal swap (existing logic)
      return await this.executeInternalSwap(
        userId,
        wallet,
        amount,
        fromCurrency,
        toCurrency
      );
    } catch (error) {
      console.error('Error executing swap:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to execute swap',
        error: error instanceof Error ? error.message : 'Failed to execute swap',
      };
    }
  }

  /**
   * Execute internal swap (database only)
   */
  private async executeInternalSwap(
    userId: string,
    wallet: any,
    amount: number,
    fromCurrency: 'XRP' | 'USDT' | 'USDC',
    toCurrency: 'XRP' | 'USDT' | 'USDC'
  ): Promise<SwapExecuteResponse> {
    const adminClient = supabaseAdmin || supabase;

    // Get fresh quote
    const quoteResult = await this.getSwapQuote(userId, {
      amount,
      fromCurrency,
      toCurrency,
      useDEX: false,
    });

    if (!quoteResult.success || !quoteResult.data) {
      return {
        success: false,
        message: quoteResult.message || 'Failed to get swap quote',
        error: quoteResult.error || 'Quote failed',
      };
    }

    const { fromAmount, toAmount, rate, usdValue, feeUsd } = quoteResult.data;

    // Calculate new balances
    let newBalanceXrp = parseFloat((wallet.balance_xrp || 0).toFixed(6));
    let newBalanceUsdt = parseFloat((wallet.balance_usdt || 0).toFixed(6));
    let newBalanceUsdc = parseFloat((wallet.balance_usdc || 0).toFixed(6));

    // Debit fromCurrency
    if (fromCurrency === 'XRP') {
      newBalanceXrp = Math.max(0, newBalanceXrp - fromAmount);
    } else if (fromCurrency === 'USDT') {
      newBalanceUsdt = Math.max(0, newBalanceUsdt - fromAmount);
    } else {
      newBalanceUsdc = Math.max(0, newBalanceUsdc - fromAmount);
    }

    // Credit toCurrency
    if (toCurrency === 'XRP') {
      newBalanceXrp += toAmount;
    } else if (toCurrency === 'USDT') {
      newBalanceUsdt += toAmount;
    } else {
      newBalanceUsdc += toAmount;
    }

    // Round to 6 decimal places
    newBalanceXrp = parseFloat(newBalanceXrp.toFixed(6));
    newBalanceUsdt = parseFloat(newBalanceUsdt.toFixed(6));
    newBalanceUsdc = parseFloat(newBalanceUsdc.toFixed(6));

    // Calculate XRP and USD amounts for transaction record
    let amountXrp = 0;
    let amountUsd = usdValue;

    if (fromCurrency === 'XRP') {
      amountXrp = fromAmount;
    } else if (toCurrency === 'XRP') {
      amountXrp = toAmount;
    } else {
      const ratesResult = await exchangeService.getLiveExchangeRates();
      const xrpUsdRate = ratesResult.data?.rates.find((r) => r.currency === 'USD')?.rate;
      if (xrpUsdRate && xrpUsdRate > 0) {
        amountXrp = usdValue / xrpUsdRate;
      }
    }

    // Create transaction record
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'swap',
        amount_xrp: amountXrp,
        amount_usd: amountUsd,
        status: 'completed',
        description: `Internal swap ${fromAmount} ${fromCurrency} → ${toAmount.toFixed(6)} ${toCurrency}`,
      })
      .select()
      .single();

    if (txError || !transaction) {
      console.error('Failed to create swap transaction:', txError);
      return {
        success: false,
        message: 'Failed to create transaction record',
        error: 'Transaction creation failed',
      };
    }

    // Update wallet balances
    const { error: updateError } = await adminClient
      .from('wallets')
      .update({
        balance_xrp: newBalanceXrp,
        balance_usdt: newBalanceUsdt,
        balance_usdc: newBalanceUsdc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) {
      console.error('Failed to update wallet balances:', updateError);
      await adminClient
        .from('transactions')
        .update({
          status: 'failed',
          description: `Swap failed: ${updateError.message}`,
        })
        .eq('id', transaction.id);

      return {
        success: false,
        message: 'Failed to update wallet balances',
        error: 'Balance update failed',
      };
    }

    // Create notification
    try {
      await notificationService.createNotification({
        userId,
        type: 'wallet_swap',
        title: 'Swap completed',
        message: `You swapped ${fromAmount.toFixed(6)} ${fromCurrency} for ${toAmount.toFixed(6)} ${toCurrency}.`,
        metadata: {
          transactionId: transaction.id,
          fromCurrency,
          toCurrency,
          fromAmount,
          toAmount,
          rate,
          usdValue,
        },
      });
    } catch (notifyError) {
      console.warn('Failed to create swap notification:', notifyError);
    }

    return {
      success: true,
      message: 'Swap executed successfully',
      data: {
        transactionId: transaction.id,
        fromCurrency,
        toCurrency,
        fromAmount,
        toAmount,
        rate,
        usdValue,
        feeUsd,
        status: 'completed',
        swapType: 'internal',
      },
    };
  }

  /**
   * Execute on-chain swap via XRPL DEX
   */
  private async executeOnChainSwap(
    userId: string,
    wallet: any,
    amount: number,
    fromCurrency: 'XRP' | 'USDT' | 'USDC',
    toCurrency: 'XRP' | 'USDT' | 'USDC',
    slippageTolerance: number
  ): Promise<SwapExecuteResponse> {
    const adminClient = supabaseAdmin || supabase;

    // Get DEX quote
    const dexQuote = await xrplDexService.getDEXPrice(
      fromCurrency,
      toCurrency,
      amount
    );

    if (!dexQuote.success || !dexQuote.data) {
      return {
        success: false,
        message: dexQuote.error || 'Failed to get DEX quote',
        error: dexQuote.error || 'DEX quote failed',
      };
    }

    const { toAmount, rate, minAmount, estimatedFee } = dexQuote.data;
    
    // Apply slippage tolerance
    const slippageMultiplier = (100 - slippageTolerance) / 100;
    const adjustedMinAmount = minAmount * slippageMultiplier;

    // Calculate USD value
    const ratesResult = await exchangeService.getLiveExchangeRates();
    const xrpUsdRate = ratesResult.data?.rates.find((r) => r.currency === 'USD')?.rate || 0.5;
    let usdValue = 0;
    if (fromCurrency === 'XRP') {
      usdValue = amount * xrpUsdRate;
    } else {
      usdValue = amount;
    }
    const feeUsd = estimatedFee * xrpUsdRate;

    // Ensure trust line exists if receiving token
    if (toCurrency !== 'XRP') {
      const hasTrust = await xrplDexService.hasTrustLine(
        wallet.xrpl_address,
        toCurrency as 'USDT' | 'USDC'
      );

      if (!hasTrust) {
        // Check if wallet has secret for creating trust line
        if (!wallet.encrypted_wallet_secret) {
          return {
            success: false,
            message: `Trust line required for ${toCurrency}. Please connect your wallet to create it.`,
            error: 'Trust line required',
          };
        }

        try {
          const walletSecret = encryptionService.decrypt(wallet.encrypted_wallet_secret);
          const trustResult = await xrplDexService.ensureTrustLine(
            wallet.xrpl_address,
            walletSecret,
            toCurrency as 'USDT' | 'USDC'
          );

          if (!trustResult.success) {
            return {
              success: false,
              message: `Failed to create trust line for ${toCurrency}: ${trustResult.error}`,
              error: 'Trust line creation failed',
            };
          }
        } catch (error) {
          return {
            success: false,
            message: 'Failed to decrypt wallet secret for trust line creation',
            error: 'Wallet secret decryption failed',
          };
        }
      }
    }

    // Create transaction record (pending status)
    let amountXrp = 0;
    if (fromCurrency === 'XRP') {
      amountXrp = amount;
    } else if (toCurrency === 'XRP') {
      amountXrp = toAmount;
    } else {
      amountXrp = usdValue / xrpUsdRate;
    }

    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'swap',
        amount_xrp: amountXrp,
        amount_usd: usdValue,
        status: 'pending',
        description: `On-chain swap ${amount} ${fromCurrency} → ${toAmount.toFixed(6)} ${toCurrency}`,
      })
      .select()
      .single();

    if (txError || !transaction) {
      console.error('Failed to create swap transaction:', txError);
      return {
        success: false,
        message: 'Failed to create transaction record',
        error: 'Transaction creation failed',
      };
    }

    // Prepare swap transaction
    const prepareResult = await xrplDexService.prepareSwapTransaction(
      wallet.xrpl_address,
      amount,
      fromCurrency,
      toCurrency,
      adjustedMinAmount
    );

    if (!prepareResult.success || !prepareResult.transaction) {
      await adminClient
        .from('transactions')
        .update({
          status: 'failed',
          description: `Swap preparation failed: ${prepareResult.error}`,
        })
        .eq('id', transaction.id);

      return {
        success: false,
        message: prepareResult.error || 'Failed to prepare swap transaction',
        error: 'Transaction preparation failed',
      };
    }

    // Check if wallet has secret (custodial) or needs user signing (non-custodial)
    if (wallet.encrypted_wallet_secret) {
      // Custodial: Execute swap directly
      try {
        const walletSecret = encryptionService.decrypt(wallet.encrypted_wallet_secret);
        const swapResult = await xrplDexService.executeSwap(
          wallet.xrpl_address,
          walletSecret,
          amount,
          fromCurrency,
          toCurrency,
          adjustedMinAmount
        );

        if (!swapResult.success || !swapResult.txHash) {
          await adminClient
            .from('transactions')
            .update({
              status: 'failed',
              description: `Swap execution failed: ${swapResult.error}`,
            })
            .eq('id', transaction.id);

          return {
            success: false,
            message: swapResult.error || 'Failed to execute swap',
            error: 'Swap execution failed',
          };
        }

        // Update transaction with hash
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: swapResult.txHash,
            status: 'completed',
            description: `On-chain swap completed: ${swapResult.txHash}`,
          })
          .eq('id', transaction.id);

        // Sync balances from XRPL, but preserve internal swap balances
        // Check if user has any internal swaps to preserve
        const { data: internalSwaps } = await adminClient
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'swap')
          .eq('status', 'completed')
          .is('xrpl_tx_hash', null) // Internal swaps have no xrpl_tx_hash
          .limit(1);

        const hasInternalSwaps = internalSwaps && internalSwaps.length > 0;
        
        const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
        
        // Update balances: sync XRP always, but preserve token balances if internal swaps exist
        if (hasInternalSwaps) {
          // Preserve internal swap balances for tokens, but sync XRP
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: balances.xrp,  // Always sync XRP from XRPL
              // Preserve USDT/USDC from database (internal swaps)
              balance_usdt: wallet.balance_usdt || balances.usdt,
              balance_usdc: wallet.balance_usdc || balances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        } else {
          // No internal swaps, safe to sync all from XRPL
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: balances.xrp,
              balance_usdt: balances.usdt,
              balance_usdc: balances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        }

        // Create notification
        try {
          await notificationService.createNotification({
            userId,
            type: 'wallet_swap',
            title: 'On-chain swap completed',
            message: `You swapped ${amount} ${fromCurrency} for ${swapResult.actualToAmount?.toFixed(6) || toAmount.toFixed(6)} ${toCurrency} on XRPL.`,
            metadata: {
              transactionId: transaction.id,
              xrplTxHash: swapResult.txHash,
              fromCurrency,
              toCurrency,
              fromAmount: swapResult.actualFromAmount || amount,
              toAmount: swapResult.actualToAmount || toAmount,
              rate,
              usdValue,
            },
          });
        } catch (notifyError) {
          console.warn('Failed to create swap notification:', notifyError);
        }

        return {
          success: true,
          message: 'On-chain swap executed successfully',
          data: {
            transactionId: transaction.id,
            fromCurrency,
            toCurrency,
            fromAmount: swapResult.actualFromAmount || amount,
            toAmount: swapResult.actualToAmount || toAmount,
            rate,
            usdValue,
            feeUsd,
            status: 'completed',
            swapType: 'onchain',
            xrplTxHash: swapResult.txHash,
          },
        };
      } catch (error) {
        await adminClient
          .from('transactions')
          .update({
            status: 'failed',
            description: `Swap execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          .eq('id', transaction.id);

        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to execute swap',
          error: 'Swap execution failed',
        };
      }
    } else {
      // Non-custodial: Return transaction for user signing
      try {
        // Try to create XUMM payload
        let xummPayload = null;
        try {
          xummPayload = await xummService.createPayload(prepareResult.transaction);
        } catch (xummError) {
          console.log('XUMM not available, returning transaction blob for direct signing');
        }

        // Update transaction with signing info
        const description = xummPayload
          ? `On-chain swap pending signature | XUMM_UUID:${xummPayload.uuid}`
          : `On-chain swap pending signature | Transaction prepared`;

        await adminClient
          .from('transactions')
          .update({
            description,
          })
          .eq('id', transaction.id);

        return {
          success: true,
          message: xummPayload
            ? 'Transaction prepared. Please sign in Xaman app.'
            : 'Transaction prepared. Please sign with your XRPL wallet.',
          data: {
            transactionId: transaction.id,
            fromCurrency,
            toCurrency,
            fromAmount: amount,
            toAmount,
            rate,
            usdValue,
            feeUsd,
            status: 'pending',
            swapType: 'onchain',
            transactionBlob: prepareResult.transactionBlob,
            xummUrl: xummPayload?.next?.always || undefined,
            xummUuid: xummPayload?.uuid || undefined,
          },
        };
      } catch (error) {
        await adminClient
          .from('transactions')
          .update({
            status: 'failed',
            description: `Swap preparation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          .eq('id', transaction.id);

        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to prepare swap',
          error: 'Swap preparation failed',
        };
      }
    }
  }

  /**
   * Fund wallet (deposit)
   */
  async fundWallet(userId: string, request: FundWalletRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      transactionId: string;
      amount: {
        usd: number;
        xrp: number;
      };
      xrplTxHash?: string;
      xummUrl?: string;
      xummUuid?: string;
      transaction?: any;
      transactionBlob?: string;
      destinationAddress?: string;
      amountXrp?: number;
      amountToken?: number;
      currency?: string;
      walletType?: 'xaman' | 'metamask' | 'browser';
      note?: string;
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

      // Convert amounts based on currency
      let amountXrp = request.amount;
      let amountUsd = request.amount;
      let amountToken: number = request.amount; // For USDT/USDC

      if (request.currency === 'USD') {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        if (!exchangeRates.success || !exchangeRates.data) {
          throw new Error('Failed to fetch exchange rates for currency conversion');
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          throw new Error('XRP/USD exchange rate not available');
        }
        amountXrp = request.amount / usdRate;
      } else if (request.currency === 'XRP') {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        if (!exchangeRates.success || !exchangeRates.data) {
          throw new Error('Failed to fetch exchange rates for currency conversion');
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          throw new Error('XRP/USD exchange rate not available');
        }
        amountUsd = request.amount * usdRate;
      } else if (request.currency === 'USDT' || request.currency === 'USDC') {
        // For USDT/USDC, amount is already in USD value
        amountUsd = request.amount;
        amountToken = request.amount;
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        if (!exchangeRates.success || !exchangeRates.data) {
          throw new Error('Failed to fetch exchange rates for currency conversion');
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          throw new Error('XRP/USD exchange rate not available');
        }
        amountXrp = request.amount / usdRate; // For display purposes
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
          message: 'Failed to create transaction',
          error: 'Failed to create transaction',
        };
      }

      // Determine wallet flow based on currency:
      // - XRP → Use Xaman/XUMM (mobile app)
      // - USDT/USDC → Use MetaMask+XRPL Snap (browser wallet)
      const currency = request.currency === 'USD' ? 'XRP' : request.currency;
      const amount = currency === 'XRP' ? amountXrp : amountToken;
      
      const preparedTx = await xrplWalletService.preparePaymentTransaction(
        wallet.xrpl_address,
        amount,
        currency as 'XRP' | 'USDT' | 'USDC'
      );

      // XRP: Use Xaman/XUMM flow
      // USDT/USDC: Use MetaMask flow (no XUMM)
      let xummPayload = null;
      let xummError = null;
      
      if (currency === 'XRP') {
        // For XRP, try to create XUMM payload (Xaman mobile app)
        try {
          xummPayload = await xummService.createPayload(preparedTx.transaction);
        } catch (error) {
          xummError = error instanceof Error ? error.message : 'XUMM not configured';
          console.log('XUMM not configured or error:', xummError);
        }
      } else {
        // For USDT/USDC, use MetaMask (no XUMM)
        console.log(`Using MetaMask flow for ${currency} deposit`);
      }

      // Store transaction info
      const description = xummPayload 
        ? `Deposit ${request.amount} ${request.currency} | XUMM_UUID:${xummPayload.uuid}`
        : `Deposit ${request.amount} ${request.currency} | Direct signing`;
      
      await adminClient
        .from('transactions')
        .update({
          description: description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      // Determine wallet type and message
      const walletType = currency === 'XRP' ? 'Xaman' : 'MetaMask';
      const message = xummPayload 
        ? `Transaction prepared. Please sign in ${walletType} app.`
        : currency === 'XRP'
        ? 'Transaction prepared. Please sign with your XRPL wallet (Xaman, Crossmark, etc.).'
        : `Transaction prepared. Please sign with MetaMask (XRPL Snap) for ${currency} deposit.`;

      return {
        success: true,
        message: message,
        data: {
          transactionId: transaction.id,
          amount: {
            usd: parseFloat(amountUsd.toFixed(2)),
            xrp: parseFloat(amountXrp.toFixed(6)),
          },
          currency: currency,
          // XUMM-specific fields (only for XRP, if XUMM is available)
          ...(xummPayload && {
            xummUrl: xummPayload.next.always,
            xummUuid: xummPayload.uuid,
            walletType: 'xaman',
          }),
          // Transaction for wallet signing (always present)
          transaction: preparedTx.transaction,
          transactionBlob: preparedTx.transactionBlob,
          destinationAddress: wallet.xrpl_address,
          amountXrp: parseFloat(amountXrp.toFixed(6)),
          amountToken: currency !== 'XRP' ? parseFloat(amountToken.toFixed(6)) : undefined,
          status: 'pending',
          // Wallet type indicator
          ...(!xummPayload && {
            walletType: currency === 'XRP' ? 'browser' : 'metamask',
            note: currency === 'XRP' 
              ? 'XUMM not available, use browser wallet instead'
              : `Use MetaMask with XRPL Snap to sign ${currency} transaction`,
          }),
          // Include XUMM error info if XUMM failed (for debugging)
          ...(xummError && {
            xummError: xummError,
          }),
        },
      };
    } catch (error) {
      console.error('Error funding wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fund wallet',
        error: error instanceof Error ? error.message : 'Failed to fund wallet',
      };
    }
  }

  /**
   * Get XUMM payload status for deposit
   */
  async getXUMMPayloadStatus(
    userId: string,
    transactionId: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      signed: boolean;
      signedTxBlob: string | null;
      cancelled: boolean;
      expired: boolean;
      xrplTxHash: string | null;
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

      // Extract XUMM UUID from description
      const uuidMatch = transaction.description?.match(/XUMM_UUID:([a-f0-9-]+)/i);
      if (!uuidMatch) {
        return {
          success: false,
          message: 'XUMM UUID not found for this transaction',
          error: 'XUMM UUID not found',
        };
      }

      const xummUuid = uuidMatch[1];

      // ...existing code...

      // Get payload status from XUMM
      const payloadStatus = await xummService.getPayloadStatus(xummUuid);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:346',message:'getXUMMPayloadStatus: Received XUMM payload status',data:{signed:payloadStatus.meta.signed,submit:payloadStatus.meta.submit,hasHex:!!payloadStatus.response?.hex,hasTxid:!!payloadStatus.response?.txid,txid:payloadStatus.response?.txid,hexLength:payloadStatus.response?.hex?.length,responseKeys:payloadStatus.response?Object.keys(payloadStatus.response):null,metaKeys:Object.keys(payloadStatus.meta)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // If signed, submit to XRPL and update transaction
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:350',message:'getXUMMPayloadStatus: Checking if transaction needs processing',data:{signed:payloadStatus.meta.signed,hasHex:!!payloadStatus.response?.hex,willProcess:payloadStatus.meta.signed && !!payloadStatus.response?.hex,hasTxid:!!payloadStatus.response?.txid,autoSubmitted:payloadStatus.meta.submit && !!payloadStatus.response?.txid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Handle two cases:
      // 1. Transaction signed but not yet submitted (has hex) - submit to XRPL
      // 2. Transaction signed and auto-submitted by XUMM (has txid, no hex) - already on XRPL, just update DB
      if (payloadStatus.meta.signed && payloadStatus.response?.hex) {
        // Case 1: Submit signed transaction to XRPL
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:352',message:'getXUMMPayloadStatus: Submitting signed transaction to XRPL',data:{hasHex:!!payloadStatus.response?.hex,hexLength:payloadStatus.response?.hex?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const submitResult = await xrplWalletService.submitSignedTransaction(payloadStatus.response.hex);

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:355',message:'getXUMMPayloadStatus: XRPL submit result',data:{hash:submitResult.hash,status:submitResult.status,isSuccess:submitResult.status === 'tesSUCCESS'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        // Update transaction status
        const status = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: submitResult.hash,
            status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        // Update wallet balance if successful
        if (status === 'completed') {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:366',message:'getXUMMPayloadStatus: About to update wallet balance',data:{userId,status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          const { data: wallet } = await adminClient
            .from('wallets')
            .select('xrpl_address')
            .eq('user_id', userId)
            .single();

          if (wallet) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:372',message:'getXUMMPayloadStatus: Fetching balances from XRPL',data:{xrplAddress:wallet.xrpl_address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:373',message:'getXUMMPayloadStatus: Got balances from XRPL',data:{xrp:balances.xrp,usdt:balances.usdt,usdc:balances.usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            await adminClient
              .from('wallets')
              .update({
                balance_xrp: balances.xrp,
                balance_usdt: balances.usdt,
                balance_usdc: balances.usdc,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:381',message:'getXUMMPayloadStatus: Updated wallet balance in DB',data:{xrp:balances.xrp,usdt:balances.usdt,usdc:balances.usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
          }
        }

        return {
          success: true,
          message: 'Transaction signed and submitted',
          data: {
            signed: true,
            signedTxBlob: payloadStatus.response.hex,
            cancelled: payloadStatus.meta.cancelled,
            expired: payloadStatus.meta.expired,
            xrplTxHash: submitResult.hash,
          },
        };
      } else if (payloadStatus.meta.signed && payloadStatus.meta.submit && payloadStatus.response?.txid) {
        // Case 2: XUMM auto-submitted the transaction (already on XRPL)
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:433',message:'getXUMMPayloadStatus: XUMM auto-submitted transaction, updating DB',data:{txid:payloadStatus.response.txid,submit:payloadStatus.meta.submit},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        console.log('[XUMM Fix] Auto-submitted transaction detected:', {
          transactionId,
          userId,
          txid: payloadStatus.response.txid,
          signed: payloadStatus.meta.signed,
          submit: payloadStatus.meta.submit,
        });
        
        // Transaction is already on XRPL, just update database
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: payloadStatus.response.txid,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        // Update wallet balance
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:444',message:'getXUMMPayloadStatus: About to update wallet balance (auto-submitted)',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const { data: wallet } = await adminClient
          .from('wallets')
          .select('xrpl_address')
          .eq('user_id', userId)
          .single();

        if (wallet) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:450',message:'getXUMMPayloadStatus: Fetching balances from XRPL (auto-submitted)',data:{xrplAddress:wallet.xrpl_address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:451',message:'getXUMMPayloadStatus: Got balances from XRPL (auto-submitted)',data:{xrp:balances.xrp,usdt:balances.usdt,usdc:balances.usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: balances.xrp,
              balance_usdt: balances.usdt,
              balance_usdc: balances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:459',message:'getXUMMPayloadStatus: Updated wallet balance in DB (auto-submitted)',data:{xrp:balances.xrp,usdt:balances.usdt,usdc:balances.usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          console.log('[XUMM Fix] Balance updated successfully for auto-submitted transaction:', {
            transactionId,
            userId,
            xrp: balances.xrp,
            usdt: balances.usdt,
            usdc: balances.usdc,
            txid: payloadStatus.response.txid,
          });
        }

        return {
          success: true,
          message: 'Transaction signed and auto-submitted by XUMM',
          data: {
            signed: true,
            signedTxBlob: payloadStatus.response?.hex || null,
            cancelled: payloadStatus.meta.cancelled,
            expired: payloadStatus.meta.expired,
            xrplTxHash: payloadStatus.response.txid,
          },
        };
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:400',message:'getXUMMPayloadStatus: Returning status without processing',data:{signed:payloadStatus.meta.signed,hasHex:!!payloadStatus.response?.hex,hasTxid:!!payloadStatus.response?.txid,txid:payloadStatus.response?.txid,submit:payloadStatus.meta.submit,reason:'No hex or not signed'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return {
        success: true,
        message: 'Payload status retrieved',
        data: {
          signed: payloadStatus.meta.signed,
          signedTxBlob: payloadStatus.response?.hex || null,
          cancelled: payloadStatus.meta.cancelled,
          expired: payloadStatus.meta.expired,
          xrplTxHash: payloadStatus.response?.txid || null,
        },
      };
    } catch (error) {
      console.error('Error getting XUMM payload status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get payload status',
        error: error instanceof Error ? error.message : 'Failed to get payload status',
      };
    }
  }

  /**
   * Submit signed deposit transaction (for browser wallets like Crossmark, MetaMask+XRPL Snap)
   */
  async submitSignedDeposit(
    userId: string,
    transactionId: string,
    signedTxBlob: string | object
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
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

      if (transaction.status !== 'pending') {
        return {
          success: false,
          message: 'Transaction is not pending',
          error: 'Transaction already processed',
        };
      }

      // Submit signed transaction to XRPL
      // MetaMask/XRPL Snap may return different formats - pass it directly to handle flexibly
      // ...existing code...

      const submitResult = await xrplWalletService.submitSignedTransaction(signedTxBlob);

      // Update transaction status
      const status = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: submitResult.hash,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      // Update wallet balance if successful
      if (status === 'completed') {
        const { data: walletForBalance } = await adminClient
          .from('wallets')
          .select('xrpl_address')
          .eq('user_id', userId)
          .single();

        if (walletForBalance) {
          const balances = await xrplWalletService.getAllBalances(walletForBalance.xrpl_address);
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: balances.xrp,
              balance_usdt: balances.usdt,
              balance_usdc: balances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          // Create notification for successful deposit
          try {
            await notificationService.createNotification({
              userId,
              type: 'wallet_deposit',
              title: 'Deposit received',
              message: `You deposited ${parseFloat(transaction.amount_xrp).toFixed(6)} XRP (~$${parseFloat(transaction.amount_usd).toFixed(2)}).`,
              metadata: {
                transactionId,
                xrplTxHash: submitResult.hash,
                amountXrp: parseFloat(transaction.amount_xrp),
                amountUsd: parseFloat(transaction.amount_usd),
              },
            });
          } catch (notifyError) {
            console.warn('Failed to create deposit notification:', notifyError);
          }
        }
      }

      return {
        success: true,
        message: 'Deposit transaction submitted successfully',
        data: {
          xrplTxHash: submitResult.hash,
          status: status,
        },
      };
    } catch (error) {
      console.error('Error submitting signed deposit:', {
        error: error instanceof Error ? error.message : String(error),
        transactionId,
        signedTxType: typeof signedTxBlob,
        signedTxPreview: typeof signedTxBlob === 'string' 
          ? signedTxBlob.substring(0, 200) 
          : JSON.stringify(signedTxBlob).substring(0, 200),
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit transaction';
      
      // Provide more helpful error messages based on error type
      let userMessage = errorMessage;
      let helpfulHint = '';
      
      if (errorMessage.includes('transaction ID') || errorMessage.includes('UUID')) {
        userMessage = 'Invalid signed transaction format: You appear to be sending a transaction ID instead of the signed transaction blob.';
        helpfulHint = 'Please ensure you are sending the actual signed transaction returned by MetaMask/XRPL Snap. The signed transaction should be either: (1) A hex string (1000+ characters), (2) A transaction object with TransactionType field, or (3) A wrapped format like { tx_blob: "..." }.';
      } else if (errorMessage.includes('Invalid hex string') || errorMessage.includes('Invalid transaction format')) {
        userMessage = 'Invalid transaction format. The signed transaction from MetaMask/XRPL Snap is not in the expected format.';
        helpfulHint = 'Expected formats: (1) Hex string (1000+ characters) like "1200002280000000...", (2) Transaction object with TransactionType, Account, etc., or (3) Wrapped format like { tx_blob: "..." } or { signedTransaction: {...} }.';
      } else if (errorMessage.includes('too short')) {
        userMessage = 'Transaction blob appears too short to be a valid signed transaction.';
        helpfulHint = 'XRPL transaction blobs are typically 1000+ characters long. Please ensure you are sending the complete signed transaction from MetaMask/XRPL Snap.';
      } else if (errorMessage.includes('TransactionType')) {
        userMessage = 'Transaction object is missing required fields.';
        helpfulHint = 'A valid XRPL transaction object must include TransactionType, Account, and other required fields. Please ensure MetaMask/XRPL Snap returned a complete signed transaction.';
      }
      
      return {
        success: false,
        message: userMessage,
        error: errorMessage,
        ...(helpfulHint && { hint: helpfulHint }),
      };
    }
  }

  /**
   * Withdraw from wallet
   */
  async withdrawWallet(
    userId: string,
    request: WithdrawWalletRequest
  ): Promise<
    {
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
    }
  > {
    // #region agent log
    // ...existing code...
    // #endregion
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get wallet
      // #region agent log
      // ...existing code...
      // #endregion
      let { data: wallet } = await adminClient
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      // #region agent log
      // ...existing code...
      // #endregion

      if (!wallet) {
        // #region agent log
        // ...existing code...
        // #endregion
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
        if (!exchangeRates.success || !exchangeRates.data) {
          return {
            success: false,
            message: 'Failed to fetch exchange rates for currency conversion',
            error: 'Exchange rate fetch failed',
          };
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          return {
            success: false,
            message: 'XRP/USD exchange rate not available',
            error: 'Exchange rate not available',
          };
        }
        amountXrp = request.amount / usdRate;
  // The withdrawWallet method and all other methods are now properly closed and inside the WalletService class.
        // Round to 6 decimal places (XRPL maximum precision)
        amountXrp = Math.round(amountXrp * 1000000) / 1000000;
      } else {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        if (!exchangeRates.success || !exchangeRates.data) {
          return {
            success: false,
            message: 'Failed to fetch exchange rates for currency conversion',
            error: 'Exchange rate fetch failed',
          };
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          return {
            success: false,
            message: 'XRP/USD exchange rate not available',
            error: 'Exchange rate not available',
          };
        }
        amountUsd = request.amount * usdRate;
        // Round XRP amount to 6 decimal places (XRPL maximum precision)
        amountXrp = Math.round(amountXrp * 1000000) / 1000000;
      }

      // Validate destination address is different from source
      if (wallet.xrpl_address === request.destinationAddress) {
        return {
          success: false,
          message: 'Cannot withdraw to the same address. Please provide a different destination address.',
          error: 'Invalid destination address',
        };
      }

      // Validate destination account reserve requirement (pre-flight check)
      // XRPL requires destination accounts to have at least 1 XRP (base reserve) after receiving payment
      const DESTINATION_RESERVE = 1.0; // XRPL base reserve requirement
      try {
        const destinationBalance = await xrplWalletService.getBalance(request.destinationAddress);
        const destinationBalanceAfterPayment = destinationBalance + amountXrp;
        
        // If destination account exists but would have less than reserve after payment, reject early
        if (destinationBalance > 0 && destinationBalanceAfterPayment < DESTINATION_RESERVE) {
          return {
            success: false,
            message: `Transaction would leave destination account with insufficient XRP. Destination currently has ${destinationBalance.toFixed(6)} XRP. After receiving ${amountXrp.toFixed(6)} XRP, it would have ${destinationBalanceAfterPayment.toFixed(6)} XRP, which is less than the required ${DESTINATION_RESERVE} XRP reserve. Please send a larger amount so the destination has at least ${DESTINATION_RESERVE} XRP after the transaction.`,
            error: 'Destination account reserve requirement not met',
          };
        }
        // If destination account doesn't exist (balance is 0 or account not found), amount must be at least reserve
        if (destinationBalance === 0 && amountXrp < DESTINATION_RESERVE) {
          return {
            success: false,
            message: `Cannot send ${amountXrp.toFixed(6)} XRP to a new account. The destination account doesn't exist yet, and creating it requires at least ${DESTINATION_RESERVE} XRP (XRPL base reserve requirement). Please send at least ${DESTINATION_RESERVE} XRP to create a new account.`,
            error: 'Insufficient amount for new account creation',
          };
        }
      } catch (destError) {
        // If account doesn't exist (error getting balance), treat as new account
        // Account not found means it's a new account, so amount must be >= reserve
        const isAccountNotFound = (destError instanceof Error && (destError.message.includes('actNotFound') || destError.message.includes('Account not found'))) || 
          (destError as any)?.data?.error === 'actNotFound' || 
          ((destError as any)?.data?.error_message === 'accountNotFound' || (destError as any)?.data?.error_message === 'Account not found.') ||
          (destError as any)?.data?.error_code === 19;
        
        if (isAccountNotFound && amountXrp < DESTINATION_RESERVE) {
          return {
            success: false,
            message: `Cannot send ${amountXrp.toFixed(6)} XRP to a new account. The destination account doesn't exist yet, and creating it requires at least ${DESTINATION_RESERVE} XRP (XRPL base reserve requirement). Please send at least ${DESTINATION_RESERVE} XRP to create a new account.`,
            error: 'Insufficient amount for new account creation',
          };
        }
        // If it's a different error (network issue, etc.), log but continue
        // The transaction will fail on XRPL with tecNO_DST_INSUF_XRP if this validation was needed
        console.warn('[WARNING] Failed to pre-validate destination account, proceeding with transaction:', {
          destinationAddress: request.destinationAddress,
          error: destError instanceof Error ? destError.message : String(destError),
        });
      }

      // Check balance
      const balance = await this.getBalance(userId);
      // #region agent log
      // ...existing code...
      // #endregion
      if (!balance.success || !balance.data) {
        // #region agent log
        // ...existing code...
        // #endregion
        return {
          success: false,
          message: 'Failed to check balance',
          error: 'Failed to check balance',
        };
      }

      // XRPL reserve requirements (as of Dec 2024: base reserve = 1 XRP)
      // Account must maintain minimum reserve + transaction fee
      const BASE_RESERVE = 1.0; // XRPL base reserve (reduced from 10 to 1 XRP in Dec 2024)
      const ESTIMATED_FEE = 0.000015; // Estimated transaction fee (slightly higher than typical 0.000012 for safety)
      const minimumRequired = BASE_RESERVE + ESTIMATED_FEE;
      const availableBalance = Math.max(0, balance.data.balance.xrp - minimumRequired);
      
      // #region agent log
      // ...existing code...
      // #endregion
      
      if (availableBalance < amountXrp) {
        // #region agent log
        // ...existing code...
        // #endregion
        return {
          success: false,
          message: `Insufficient available balance. You have ${balance.data.balance.xrp.toFixed(6)} XRP total, but must maintain ${BASE_RESERVE} XRP reserve. Available: ${availableBalance.toFixed(6)} XRP. Requested: ${amountXrp.toFixed(6)} XRP.`,
          error: 'Insufficient available balance (reserve requirement)',
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

      // #region agent log
      // ...existing code...
      // #endregion
      if (txError || !transaction) {
        // #region agent log
        // ...existing code...
        // #endregion
        return {
          success: false,
          message: 'Failed to create transaction',
          error: 'Failed to create transaction',
        };
      }

      // #region agent log
      // ...existing code...
      // #endregion

      // Get and decrypt wallet secret for signing withdrawal
      // If wallet doesn't have a secret (old wallet created before encrypted_wallet_secret feature),
      // we cannot migrate if the old address has funds (we can't access them without the secret)
      if (!wallet.encrypted_wallet_secret) {
        // #region agent log
        // ...existing code...
        // #endregion
        
        // Check if old wallet address has balance
        let oldBalance = 0;
        try {
          oldBalance = await xrplWalletService.getBalance(wallet.xrpl_address);
        } catch (error) {
          // If account not found, balance is 0
          oldBalance = 0;
        }
        
        // If old address has funds, we cannot migrate (funds would become inaccessible)
        // Return error explaining the situation
        if (oldBalance > 0) {
          // #region agent log
          // ...existing code...
          // #endregion
          
          return {
            success: false,
            message: `Cannot process withdrawal: Your wallet address (${wallet.xrpl_address}) has ${oldBalance} XRP, but the wallet secret is not available. This wallet was created before automated withdrawals were enabled. Please contact support to recover your funds or manually transfer them to a new wallet.`,
            error: 'Wallet secret not available and old address has funds',
          };
        }
        
        // Old address has no funds, safe to migrate to new address
        // Generate new wallet with secret
        const { address: newXrplAddress, secret: newWalletSecret } = await xrplWalletService.generateWallet();
        const encryptedSecret = encryptionService.encrypt(newWalletSecret);
        
        // Update wallet with new address and secret
        const { data: updatedWallet, error: updateError } = await adminClient
          .from('wallets')
          .update({
            xrpl_address: newXrplAddress,
            encrypted_wallet_secret: encryptedSecret,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)
          .select()
          .single();
        
        if (updateError || !updatedWallet) {
          // #region agent log
          // ...existing code...
          // #endregion
          return {
            success: false,
            message: 'Failed to migrate wallet. Please contact support.',
            error: 'Wallet migration failed',
          };
        }
        
        // #region agent log
        // ...existing code...
        // #endregion
        
        // Update wallet reference to use the new wallet
        wallet = updatedWallet;
        
        // Note: New address needs to be funded to activate, but since old address had no funds,
        // user will need to fund the new address separately
      }

      let walletSecret: string;
      try {
        walletSecret = encryptionService.decrypt(wallet.encrypted_wallet_secret);
      } catch (error) {
        console.error('Error decrypting wallet secret:', error);
        return {
          success: false,
          message: 'Failed to decrypt wallet secret',
          error: 'Decryption failed',
        };
      }

      // Create XRPL withdrawal transaction with wallet secret
      let xrplTxHash: string;
      // #region agent log
      // ...existing code...
      // #endregion
      try {
        xrplTxHash = await xrplWalletService.createWithdrawalTransaction(
          wallet.xrpl_address,
          request.destinationAddress,
          amountXrp,
          walletSecret
        );
        // #region agent log
        // ...existing code...
        // #endregion
      } catch (xrplError) {
        // #region agent log
        // ...existing code...
        // #endregion
        // Update transaction status to failed if XRPL submission fails
        await adminClient
          .from('transactions')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            description: `Withdrawal failed: ${xrplError instanceof Error ? xrplError.message : 'Unknown error'}`,
          })
          .eq('id', transaction.id);
        // #region agent log
        // ...existing code...
        // #endregion

        return {
          success: false,
          message: xrplError instanceof Error ? xrplError.message : 'Failed to submit withdrawal to XRPL',
          error: 'XRPL submission failed',
        };
      }

      // Update transaction to completed only after successful XRPL submission
      // #region agent log
      // ...existing code...
      // #endregion
      
      // Verify transaction exists before update
      await adminClient
        .from('transactions')
        .select('id, status, xrpl_tx_hash')
        .eq('id', transaction.id)
        .single();
      
      // #region agent log
      // ...existing code...
      // #endregion
      
      // #region agent log
      // ...existing code...
      // #endregion
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: xrplTxHash,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)
        .select();
      
      // #region agent log
      // ...existing code...
      // #endregion
      
      // Verify update actually persisted
      await adminClient
        .from('transactions')
        .select('id, status, xrpl_tx_hash')
        .eq('id', transaction.id)
        .single();
      
      // #region agent log
      // ...existing code...
      // #endregion
      
      // Check if update succeeded
      // Update result check removed (variable no longer declared)

      // Update wallet balance after withdrawal
      const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
      await adminClient
        .from('wallets')
        .update({
          balance_xrp: balances.xrp,
          balance_usdt: balances.usdt,
          balance_usdc: balances.usdc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      // Create transaction record for the receiver (if destination is a TrustiChain user)
      try {
        const { data: receiverWallet } = await adminClient
          .from('wallets')
          .select('user_id')
          .eq('xrpl_address', request.destinationAddress)
          .maybeSingle();

        if (receiverWallet && receiverWallet.user_id !== userId) {
          // Destination is a TrustiChain user - create deposit transaction for them
          const { data: receiverTx } = await adminClient
            .from('transactions')
            .insert({
              user_id: receiverWallet.user_id,
              type: 'deposit',
              amount_xrp: amountXrp,
              amount_usd: amountUsd,
              xrpl_tx_hash: xrplTxHash,
              status: 'completed',
              description: `Deposit from ${wallet.xrpl_address}`,
            })
            .select()
            .single();

          // Update receiver's wallet balance
          const receiverBalances = await xrplWalletService.getAllBalances(request.destinationAddress);
          await adminClient
            .from('wallets')
            .update({
              balance_xrp: receiverBalances.xrp,
              balance_usdt: receiverBalances.usdt,
              balance_usdc: receiverBalances.usdc,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', receiverWallet.user_id);

          // Create notification for receiver
          try {
            await notificationService.createNotification({
              userId: receiverWallet.user_id,
              type: 'wallet_deposit',
              title: 'Payment received',
              message: `You received ${amountXrp.toFixed(6)} XRP from ${wallet.xrpl_address}.`,
              metadata: {
                amountXrp,
                amountUsd,
                xrplTxHash,
                transactionId: receiverTx?.id,
                fromAddress: wallet.xrpl_address,
              },
            });
          } catch (notifyError) {
            console.warn('Failed to create receiver deposit notification:', notifyError);
          }
        }
      } catch (receiverError) {
        // Log but don't fail the withdrawal if receiver transaction creation fails
        console.warn('[Withdrawal] Failed to create transaction for receiver:', receiverError);
      }

      // #region agent log
      // ...existing code...
      // #endregion
      return {
        success: true,
        message: 'Withdrawal completed successfully',
        data: {
          transactionId: transaction.id,
          amount: {
            usd: parseFloat(amountUsd.toFixed(2)),
            xrp: parseFloat(amountXrp.toFixed(6)),
          },
          xrplTxHash,
          status: 'completed',
        },
      };
    } catch (error) {
      // #region agent log
      // ...existing code...
      // #endregion
      console.error('Error withdrawing from wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to withdraw from wallet',
        error: error instanceof Error ? error.message : 'Failed to withdraw from wallet',
      };
    }
  }

  /**
   * Sync pending withdrawal transactions that have xrpl_tx_hash but are still marked as pending
   * This fixes old transactions that were created before the status update fix
   */
  private async syncPendingWithdrawals(userId: string): Promise<void> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // #region agent log
      // ...existing code...
      // #endregion

      // Find pending withdrawal transactions that have an xrpl_tx_hash
      // These should be marked as completed since they have a transaction hash
      const { data: pendingWithdrawals } = await adminClient
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'withdrawal')
        .eq('status', 'pending')
        .not('xrpl_tx_hash', 'is', null);

      // #region agent log
      // ...existing code...
      // #endregion

      if (!pendingWithdrawals || pendingWithdrawals.length === 0) {
        // #region agent log
        // ...existing code...
        // #endregion
        return;
      }

      // Update all pending withdrawals with xrpl_tx_hash to completed
      for (const withdrawal of pendingWithdrawals) {
        // #region agent log
        // ...existing code...
        // #endregion
        
        await adminClient
          .from('transactions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', withdrawal.id)
          .select();
        
        // #region agent log
        // ...existing code...
        // #endregion
      }
    } catch (error) {
      // Don't throw - this is a background sync
      console.warn('[Sync] Error syncing pending withdrawals:', error);
      // #region agent log
      // ...existing code...
      // #endregion
    }
  }

  /**
   * Sync pending deposit transactions by checking for completed withdrawals
   * This fixes the issue where receivers don't have transaction records for incoming payments
   */
  private async syncPendingDeposits(userId: string): Promise<void> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user's wallet address
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();

      if (!wallet) return;

      // Find all completed withdrawal transactions with xrpl_tx_hash
      // that might have sent to this user's address
      const { data: withdrawals } = await adminClient
        .from('transactions')
        .select('*')
        .eq('type', 'withdrawal')
        .eq('status', 'completed')
        .not('xrpl_tx_hash', 'is', null);

      if (!withdrawals || withdrawals.length === 0) return;

      // Check each withdrawal transaction on XRPL to see if destination matches this user
      for (const withdrawal of withdrawals) {
        // Skip if we already created a deposit for this tx hash
        const { data: existingDeposit } = await adminClient
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('xrpl_tx_hash', withdrawal.xrpl_tx_hash)
          .eq('type', 'deposit')
          .maybeSingle();

        if (existingDeposit) continue;

        // Query XRPL to get transaction details
        try {
          const { Client } = await import('xrpl');
          const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
          const xrplServer = xrplNetwork === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          const client: any = new Client(xrplServer);
          await client.connect();

          try {
            const txResponse = await client.request({
              command: 'tx',
              transaction: withdrawal.xrpl_tx_hash,
            });

            const txResult = txResponse.result as any;
            const destination = txResult.Destination;

            // If this withdrawal sent to this user's address, create deposit record
            if (destination === wallet.xrpl_address && txResult.TransactionType === 'Payment') {
              // Get amount from transaction
              const { dropsToXrp } = await import('xrpl');
              const amountDrops = txResult.Amount;
              const amountXrp = parseFloat((dropsToXrp as any)(String(amountDrops)));

              // Calculate USD amount (use the same rate as withdrawal if available, or fetch current)
              let amountUsd = withdrawal.amount_usd;
              if (amountXrp !== withdrawal.amount_xrp) {
                // Amounts don't match, recalculate USD
                const exchangeRates = await exchangeService.getLiveExchangeRates();
                if (exchangeRates.success && exchangeRates.data) {
                  const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
                  if (usdRate && usdRate > 0) {
                    amountUsd = amountXrp * usdRate;
                  }
                }
              }

              // Create deposit transaction for this user
              await adminClient
                .from('transactions')
                .insert({
                  user_id: userId,
                  type: 'deposit',
                  amount_xrp: amountXrp,
                  amount_usd: amountUsd,
                  xrpl_tx_hash: withdrawal.xrpl_tx_hash,
                  status: 'completed',
                  description: `Deposit from ${txResult.Account}`,
                });

              // Update wallet balance
              const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);
              await adminClient
                .from('wallets')
                .update({
                  balance_xrp: balances.xrp,
                  balance_usdt: balances.usdt,
                  balance_usdc: balances.usdc,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
            }
          } finally {
            await client.disconnect();
          }
        } catch (txError) {
          // Skip if transaction not found or other error
          console.warn(`[Sync] Could not fetch XRPL transaction ${withdrawal.xrpl_tx_hash}:`, txError);
        }
      }
    } catch (error) {
      // Don't throw - this is a background sync, shouldn't break the main flow
      console.warn('[Sync] Error syncing pending deposits:', error);
    }
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<
    {
      success: boolean;
      message: string;
      data?: {
        transactions: WalletTransaction[];
        total: number;
      };
      error?: string;
    }
  > {
    try {
      const adminClient = supabaseAdmin || supabase;

      // #region agent log
      // ...existing code...
      // #endregion

      // Sync pending transactions in the background (don't wait for it)
      this.syncPendingWithdrawals(userId).catch(() => {});
      this.syncPendingDeposits(userId).catch(() => {});

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

      const formattedTransactions: WalletTransaction[] = (transactions || []).map((tx: any) => ({
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



