/**
 * Wallet Service
 * Handles wallet operations including balance, funding, and withdrawals
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { FundWalletRequest, WithdrawWalletRequest, WalletTransaction } from '../../types/api/wallet.types';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { exchangeService } from '../exchange/exchange.service';
import { encryptionService } from '../encryption/encryption.service';
import { xummService } from '../xumm/xumm.service';

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
        // Generate XRPL wallet (address + secret)
        const { address: xrplAddress, secret: walletSecret } = await xrplWalletService.generateWallet();
        
        // Encrypt the wallet secret before storing
        const encryptedSecret = encryptionService.encrypt(walletSecret);
        
        const { data: newWallet, error: createError } = await adminClient
          .from('wallets')
          .insert({
            user_id: userId,
            xrpl_address: xrplAddress,
            encrypted_wallet_secret: encryptedSecret,
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:73',message:'getBalance: Fetching balances from XRPL',data:{userId,xrplAddress:wallet.xrpl_address,dbBalanceXrp:wallet.balance_xrp,dbBalanceUsdt:wallet.balance_usdt,dbBalanceUsdc:wallet.balance_usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[DEBUG] wallet.service.getBalance: Querying XRPL for user wallet', {
        userId,
        xrplAddress: wallet.xrpl_address,
        walletId: wallet.id,
        dbBalanceXrp: wallet.balance_xrp,
        dbBalanceUsdt: wallet.balance_usdt,
        dbBalanceUsdc: wallet.balance_usdc,
        note: 'Verify this address matches what user funded. Check network (testnet vs mainnet) if account not found.',
      });
      const balances = await xrplWalletService.getAllBalances(wallet.xrpl_address);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:75',message:'getBalance: Got balances from XRPL',data:{userId,xrp:balances.xrp,usdt:balances.usdt,usdc:balances.usdc,dbBalanceXrp:wallet.balance_xrp,dbBalanceUsdt:wallet.balance_usdt,dbBalanceUsdc:wallet.balance_usdc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

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
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountXrp = request.amount / usdRate;
      } else if (request.currency === 'XRP') {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountUsd = request.amount * usdRate;
      } else if (request.currency === 'USDT' || request.currency === 'USDC') {
        // For USDT/USDC, amount is already in USD value
        amountUsd = request.amount;
        amountToken = request.amount;
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'wallet.service.ts:343',message:'getXUMMPayloadStatus: About to check XUMM payload',data:{userId,transactionId,xummUuid,currentTxStatus:transaction.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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
      // Log for debugging
      console.log('Submitting signed transaction:', {
        transactionId,
        type: typeof signedTxBlob,
        isString: typeof signedTxBlob === 'string',
        isObject: typeof signedTxBlob === 'object',
        length: typeof signedTxBlob === 'string' ? signedTxBlob.length : 'N/A',
        preview: typeof signedTxBlob === 'string' 
          ? signedTxBlob.substring(0, 200) 
          : JSON.stringify(signedTxBlob).substring(0, 200),
      });

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

      // Get and decrypt wallet secret for signing withdrawal
      if (!wallet.encrypted_wallet_secret) {
        return {
          success: false,
          message: 'Wallet secret not available. Cannot process withdrawal.',
          error: 'Wallet secret not available',
        };
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
      try {
        xrplTxHash = await xrplWalletService.createWithdrawalTransaction(
          wallet.xrpl_address,
          request.destinationAddress,
          amountXrp,
          walletSecret
        );
      } catch (xrplError) {
        // Update transaction status to failed if XRPL submission fails
        await adminClient
          .from('transactions')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            description: `Withdrawal failed: ${xrplError instanceof Error ? xrplError.message : 'Unknown error'}`,
          })
          .eq('id', transaction.id);

        return {
          success: false,
          message: xrplError instanceof Error ? xrplError.message : 'Failed to submit withdrawal to XRPL',
          error: 'XRPL submission failed',
        };
      }

      // Update transaction to completed only after successful XRPL submission
      await adminClient
        .from('transactions')
        .update({
          xrpl_tx_hash: xrplTxHash,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

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


