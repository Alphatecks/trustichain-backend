/**
 * Escrow Service
 * Handles escrow operations and statistics
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { CreateEscrowRequest, CreateEscrowResponse, Escrow, GetEscrowListRequest, Milestone, ReleaseType } from '../../types/api/escrow.types';
import type { TransactionType } from '../../types/api/transaction.types';
import { xrplEscrowService } from '../../xrpl/escrow/xrpl-escrow.service';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { exchangeService } from '../exchange/exchange.service';
import { xummService } from '../xumm/xumm.service';
import { notificationService } from '../notification/notification.service';
import { encryptionService } from '../encryption/encryption.service';

export class EscrowService {
  /**
   * Format escrow ID as #ESC-YYYY-XXX
   */
  private formatEscrowId(year: number, sequence: number): string {
    return `#ESC-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Get party names (initiator and counterparty) for escrows
   */
  private async getPartyNames(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    
    const adminClient = supabaseAdmin || supabase;
    const { data: users } = await adminClient
      .from('users')
      .select('id, full_name')
      .in('id', userIds);

    return (users || []).reduce((acc: Record<string, string>, user: { id: string; full_name: string }) => {
      acc[user.id] = user.full_name;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Get milestones for an escrow
   */
  private async getMilestones(escrowId: string): Promise<Milestone[]> {
    const adminClient = supabaseAdmin || supabase;
    const { data: milestones, error } = await adminClient
      .from('escrow_milestones')
      .select('*')
      .eq('escrow_id', escrowId)
      .order('milestone_order', { ascending: true });

    if (error || !milestones) {
      return [];
    }

    return milestones.map((m: any) => ({
      id: m.id,
      milestoneDetails: m.milestone_details,
      milestoneAmount: parseFloat(m.milestone_amount),
      milestoneAmountUsd: parseFloat(m.milestone_amount_usd),
      milestoneOrder: m.milestone_order,
      status: m.status,
      createdAt: m.created_at,
      completedAt: m.completed_at || undefined,
    }));
  }
  /**
   * Get active escrows count and locked amount for a user
   */
  async getActiveEscrows(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      count: number;
      lockedAmount: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get active escrows (pending or active status)
      const { data: escrows, error } = await adminClient
        .from('escrows')
        .select('amount_usd')
        .eq('user_id', userId)
        .in('status', ['pending', 'active']);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch active escrows',
          error: 'Failed to fetch active escrows',
        };
      }

      const count = escrows?.length || 0;
      const lockedAmount = escrows?.reduce((sum: number, escrow: { amount_usd: string | number }) => sum + parseFloat(String(escrow.amount_usd)), 0) || 0;

      return {
        success: true,
        message: 'Active escrows retrieved successfully',
        data: {
          count,
          lockedAmount: parseFloat(lockedAmount.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting active escrows:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get active escrows',
        error: error instanceof Error ? error.message : 'Failed to get active escrows',
      };
    }
  }

  /**
   * Get total escrowed amount (all time, all statuses)
   */
  async getTotalEscrowed(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalEscrowed: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get all escrows for user
      const { data: escrows, error } = await adminClient
        .from('escrows')
        .select('amount_usd')
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch escrows',
          error: 'Failed to fetch escrows',
        };
      }

      const totalEscrowed = escrows?.reduce((sum: number, escrow: { amount_usd: string | number }) => sum + parseFloat(String(escrow.amount_usd)), 0) || 0;

      return {
        success: true,
        message: 'Total escrowed retrieved successfully',
        data: {
          totalEscrowed: parseFloat(totalEscrowed.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting total escrowed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get total escrowed',
        error: error instanceof Error ? error.message : 'Failed to get total escrowed',
      };
    }
  }

  /**
   * Create a new escrow
   */
  async createEscrow(userId: string, request: CreateEscrowRequest): Promise<CreateEscrowResponse> {
      // #region agent log
      const logEntry = {location:'escrow.service.ts:166',message:'createEscrow: Function entry',data:{userId,hasRequest:!!request,amount:request.amount,currency:request.currency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ENTRY'};
      console.log('[DEBUG ENTRY]', JSON.stringify(logEntry));
      console.error('[DEBUG ENTRY]', JSON.stringify(logEntry)); // Also log to stderr
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'debug.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
      } catch (e) {}
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry)}).catch(()=>{});
      // #endregion
    
    try {
      const adminClient = supabaseAdmin || supabase;

      // Automatically fetch payer wallet address and encrypted secret from authenticated user's registered wallet
      const { data: payerWallet } = await adminClient
        .from('wallets')
        .select('xrpl_address, encrypted_wallet_secret')
        .eq('user_id', userId)
        .single();

      if (!payerWallet) {
        return {
          success: false,
          message: 'Wallet not found. Please create a wallet first.',
          error: 'Wallet not found. Please create a wallet first.',
        };
      }

      if (!payerWallet.xrpl_address) {
        return {
          success: false,
          message: 'Wallet address not found. Please connect a wallet first.',
          error: 'Wallet address not found',
        };
      }

      // Use the authenticated user's registered wallet address automatically
      // If payerXrpWalletAddress is provided, it will be ignored (for backward compatibility)

      // Look up counterparty by wallet address or use provided counterpartyId
      let counterpartyUserId: string | null = null;
      let counterpartyWalletAddress: string;

      if (request.counterpartyId) {
        // If counterpartyId is provided, use it but still validate wallet address
        const { data: counterpartyWallet, error: walletError } = await adminClient
          .from('wallets')
          .select('xrpl_address, user_id')
          .eq('user_id', request.counterpartyId)
          .maybeSingle();

        if (walletError || !counterpartyWallet) {
          return {
            success: false,
            message: 'Counterparty wallet not found',
            error: 'Counterparty wallet not found',
          };
        }

        // Validate that the provided wallet address matches the counterparty's wallet
        if (counterpartyWallet.xrpl_address !== request.counterpartyXrpWalletAddress) {
          return {
            success: false,
            message: 'Provided counterparty wallet address does not match the counterparty user',
            error: 'Provided counterparty wallet address does not match the counterparty user',
          };
        }

        counterpartyUserId = request.counterpartyId;
        counterpartyWalletAddress = counterpartyWallet.xrpl_address;
      } else {
        // Look up counterparty by wallet address
        const { data: counterpartyWallet, error: walletLookupError } = await adminClient
          .from('wallets')
          .select('user_id, xrpl_address')
          .eq('xrpl_address', request.counterpartyXrpWalletAddress)
          .maybeSingle();

        if (walletLookupError || !counterpartyWallet) {
          return {
            success: false,
            message: 'Counterparty wallet not found. The counterparty must have a registered wallet.',
            error: 'Counterparty wallet not found. The counterparty must have a registered wallet.',
          };
        }

        counterpartyUserId = counterpartyWallet.user_id;
        counterpartyWalletAddress = counterpartyWallet.xrpl_address;
      }

      // Prevent creating escrow with yourself
      if (userId === counterpartyUserId) {
        return {
          success: false,
          message: 'You cannot create an escrow with yourself',
          error: 'You cannot create an escrow with yourself',
        };
      }

      // Validate "Time based" release type requirements
      if (request.releaseType === 'Time based') {
        if (!request.expectedReleaseDate) {
          return {
            success: false,
            message: 'Expected release date is required for time-based escrows',
            error: 'Expected release date is required for time-based escrows',
          };
        }
        if (request.totalAmount === undefined || request.totalAmount === null) {
          return {
            success: false,
            message: 'Total amount is required for time-based escrows',
            error: 'Total amount is required for time-based escrows',
          };
        }
      }

      // Validate "Milestones" release type requirements
      if (request.releaseType === 'Milestones') {
        if (!request.expectedCompletionDate) {
          return {
            success: false,
            message: 'Expected completion date is required for milestone-based escrows',
            error: 'Expected completion date is required for milestone-based escrows',
          };
        }
        if (request.totalAmount === undefined || request.totalAmount === null) {
          return {
            success: false,
            message: 'Total amount is required for milestone-based escrows',
            error: 'Total amount is required for milestone-based escrows',
          };
        }
        if (!request.milestones || request.milestones.length === 0) {
          return {
            success: false,
            message: 'At least one milestone is required for milestone-based escrows',
            error: 'At least one milestone is required for milestone-based escrows',
          };
        }
        // Validate each milestone
        for (let i = 0; i < request.milestones.length; i++) {
          const milestone = request.milestones[i];
          if (!milestone.milestoneDetails || milestone.milestoneDetails.trim().length === 0) {
            return {
              success: false,
              message: `Milestone ${i + 1} details are required`,
              error: `Milestone ${i + 1} details are required`,
            };
          }
          if (!milestone.milestoneAmount || milestone.milestoneAmount <= 0) {
            return {
              success: false,
              message: `Milestone ${i + 1} amount must be greater than 0`,
              error: `Milestone ${i + 1} amount must be greater than 0`,
            };
          }
        }
      }

      // Use totalAmount if provided, otherwise use amount
      const escrowAmount = request.totalAmount !== undefined ? request.totalAmount : request.amount;

      // Convert amount to XRP if needed
      let amountXrp = escrowAmount;
      let amountUsd = escrowAmount;

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
        amountXrp = escrowAmount / usdRate;
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
        amountUsd = escrowAmount * usdRate;
      }

      // Use user's wallet address (payerWallet already fetched above)
      const userWalletAddress = payerWallet.xrpl_address;
      let hasEncryptedSecret = !!payerWallet.encrypted_wallet_secret;

      // Check user's XRPL balance on-chain before proceeding
      console.log('[Escrow Create] Checking user XRPL balance on-chain...', {
        userWalletAddress,
        requiredAmountXrp: amountXrp,
      });

      try {
        const userBalanceXrp = await xrplWalletService.getBalance(userWalletAddress);
        const transactionFeeXrp = 0.000012; // Standard XRPL transaction fee (~12 drops)
        const requiredTotalXrp = amountXrp + transactionFeeXrp;

        console.log('[Escrow Create] Balance check result:', {
          userBalanceXrp,
          requiredAmountXrp: amountXrp,
          transactionFeeXrp,
          requiredTotalXrp,
          sufficient: userBalanceXrp >= requiredTotalXrp,
        });

        if (userBalanceXrp < requiredTotalXrp) {
          return {
            success: false,
            message: `Insufficient XRP balance. You have ${userBalanceXrp.toFixed(6)} XRP but need ${requiredTotalXrp.toFixed(6)} XRP (${amountXrp.toFixed(6)} XRP for escrow + ${transactionFeeXrp.toFixed(6)} XRP for transaction fee).`,
            error: 'Insufficient balance',
          };
        }
      } catch (balanceError) {
        console.error('[Escrow Create] Failed to check user balance:', balanceError);
        return {
          success: false,
          message: 'Failed to verify wallet balance. Please try again.',
          error: 'Balance check failed',
        };
      }

      // Create escrow on XRPL using user's wallet
      // If user has encrypted_wallet_secret, auto-sign the transaction
      // Otherwise, use XUMM for user signing
      // XRPL requires either FinishAfter or CancelAfter to be specified
      // Use expectedReleaseDate if provided, otherwise set a default (30 days from now)
      // XRPL uses Ripple Epoch (seconds since Jan 1, 2000), not Unix Epoch (seconds since Jan 1, 1970)
      // Convert Unix timestamp to Ripple Epoch by subtracting 946684800 seconds (30 years difference)
      const RIPPLE_EPOCH_OFFSET = 946684800; // Seconds between Unix Epoch (1970) and Ripple Epoch (2000)
      let finishAfter: number | undefined;
      
      console.log('[Escrow Create] Expected release date check:', {
        hasExpectedReleaseDate: !!request.expectedReleaseDate,
        expectedReleaseDate: request.expectedReleaseDate,
        expectedReleaseDateType: typeof request.expectedReleaseDate,
        releaseType: request.releaseType,
      });
      
      if (request.expectedReleaseDate) {
        // Parse date string as LOCAL midnight, not UTC midnight
        // Date strings like "2026-01-31" are interpreted as UTC by default
        // We need to parse the components and create a Date in local timezone
        let releaseDate: Date;
        
        // Check if it's a simple date string (YYYY-MM-DD) or includes time
        if (/^\d{4}-\d{2}-\d{2}$/.test(request.expectedReleaseDate)) {
          // Parse as local midnight: "2026-01-31" -> Jan 31, 2026 00:00:00 local time
          const [year, month, day] = request.expectedReleaseDate.split('-').map(Number);
          releaseDate = new Date(year, month - 1, day, 0, 0, 0, 0); // month is 0-indexed
        } else {
          // If it includes time, parse normally (handles ISO strings with time)
          releaseDate = new Date(request.expectedReleaseDate);
        }
        
        const now = new Date();
        
        // Validate that the date is not in the past
        if (releaseDate < now) {
          console.warn('[Escrow Create] Expected release date is in the past, using default 30 days:', {
            providedDate: request.expectedReleaseDate,
            parsedDate: releaseDate.toISOString(),
            parsedDateLocal: releaseDate.toString(),
            currentDate: now.toISOString(),
          });
          // Use default instead of invalid past date
          const unixTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days in seconds
          finishAfter = unixTimestamp - RIPPLE_EPOCH_OFFSET; // Convert to Ripple Epoch
        } else {
          const unixTimestamp = Math.floor(releaseDate.getTime() / 1000);
          finishAfter = unixTimestamp - RIPPLE_EPOCH_OFFSET; // Convert to Ripple Epoch
          console.log('[Escrow Create] Using provided expected release date:', {
            originalDate: request.expectedReleaseDate,
            parsedDate: releaseDate.toISOString(),
            parsedDateLocal: releaseDate.toString(),
            unixTimestamp,
            rippleEpoch: finishAfter,
            rippleEpochDate: new Date((finishAfter + RIPPLE_EPOCH_OFFSET) * 1000).toISOString(),
            rippleEpochDateLocal: new Date((finishAfter + RIPPLE_EPOCH_OFFSET) * 1000).toString(),
          });
        }
      } else {
        // Default: 30 days from now (allows escrow to be released after this time)
        // This satisfies XRPL's requirement while allowing reasonable release time
        const unixTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days in seconds
        finishAfter = unixTimestamp - RIPPLE_EPOCH_OFFSET; // Convert to Ripple Epoch
        console.log('[Escrow Create] Using default 30-day finishAfter:', {
          unixTimestamp,
          rippleEpoch: finishAfter,
          rippleEpochDate: new Date((finishAfter + RIPPLE_EPOCH_OFFSET) * 1000).toISOString(),
        });
      }

      console.log('[Escrow Create] Creating escrow on XRPL using user wallet:', {
        userWalletAddress,
        toAddress: counterpartyWalletAddress,
        amountXrp,
        finishAfter: new Date((finishAfter + RIPPLE_EPOCH_OFFSET) * 1000).toISOString(),
        hasEncryptedSecret,
      });

      let xrplTxHash: string | null = null;
      let xummUrl: string | undefined;
      let xummUuid: string | undefined;

      // Branch: Use encrypted secret for auto-sign if available, otherwise use XUMM
      if (hasEncryptedSecret) {
        // Auto-sign flow: Decrypt secret and sign directly
        try {
          console.log('[Escrow Create] Using encrypted wallet secret for auto-signing...');
          const decryptedSecret = encryptionService.decrypt(payerWallet.encrypted_wallet_secret);
          const trimmedSecret = decryptedSecret.trim();

          xrplTxHash = await xrplEscrowService.createEscrow({
            fromAddress: userWalletAddress,
            toAddress: counterpartyWalletAddress,
            amountXrp,
            finishAfter, // XRPL requires either FinishAfter or CancelAfter
            walletSecret: trimmedSecret,
          });

          console.log('[Escrow Create] Escrow created on XRPL (auto-signed):', {
            txHash: xrplTxHash,
            userWalletAddress,
            toAddress: counterpartyWalletAddress,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Escrow Create] Failed to create escrow with encrypted secret:', errorMessage);
          
          // If decryption fails, fall back to XUMM
          if (errorMessage.includes('decrypt') || errorMessage.includes('Decryption')) {
            console.log('[Escrow Create] Decryption failed, falling back to XUMM flow...');
            hasEncryptedSecret = false; // Force XUMM flow
          } else {
            return {
              success: false,
              message: `Failed to create escrow on XRPL: ${errorMessage}`,
              error: 'XRPL transaction failed',
            };
          }
        }
      }

      // XUMM flow: If no encrypted secret or decryption failed
      if (!hasEncryptedSecret || !xrplTxHash) {
        console.log('[Escrow Create] Using XUMM for user signing...');
        
        try {
          // Prepare unsigned EscrowCreate transaction
          const preparedTx = await xrplEscrowService.prepareEscrowCreateTransaction({
            fromAddress: userWalletAddress,
            toAddress: counterpartyWalletAddress,
            amountXrp,
            finishAfter,
          });

          // Create XUMM payload
          const xummPayload = await xummService.createPayload(preparedTx.transaction);

          xummUrl = xummPayload.next.always;
          xummUuid = xummPayload.uuid;

          console.log('[Escrow Create] XUMM payload created:', {
            xummUuid,
            userWalletAddress,
            toAddress: counterpartyWalletAddress,
          });

          // Store pending transaction record for tracking
          await adminClient
            .from('transactions')
            .insert({
              user_id: userId,
              type: 'escrow_create',
              status: 'pending',
              amount_xrp: amountXrp,
              amount_usd: amountUsd,
              description: `Escrow creation pending XUMM signature | XUMM_UUID:${xummUuid}`,
            });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Escrow Create] Failed to create XUMM payload:', errorMessage);
          return {
            success: false,
            message: `Failed to create XUMM payload: ${errorMessage}`,
            error: 'XUMM payload creation failed',
          };
        }
      }

      // Get sequence number for the current year
      const currentYear = new Date().getFullYear();
      const { data: lastEscrow } = await adminClient
        .from('escrows')
        .select('escrow_sequence')
        .gte('created_at', new Date(currentYear, 0, 1).toISOString())
        .order('escrow_sequence', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSequence = lastEscrow?.escrow_sequence ? lastEscrow.escrow_sequence + 1 : 1;

      // Determine escrow status based on signing method
      const escrowStatus = xrplTxHash ? 'active' : 'pending';
      const escrowDescription = xrplTxHash
        ? request.description || `Escrow created on XRPL: ${xrplTxHash}`
        : request.description || (xummUuid ? `Escrow creation pending XUMM signature | XUMM_UUID:${xummUuid}` : 'Escrow creation pending');

      // Create escrow record in database with contact information and terms
      const { data: escrow, error: escrowError } = await adminClient
        .from('escrows')
        .insert({
          user_id: userId,
          counterparty_id: counterpartyUserId,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: escrowStatus, // 'active' if auto-signed, 'pending' if XUMM
          xrpl_escrow_id: xrplTxHash || null, // Store XRPL transaction hash if available
          description: escrowDescription,
          transaction_type: request.transactionType || 'custom',
          industry: request.industry || null,
          progress: 0,
          escrow_sequence: nextSequence,
          // Payer contact information
          payer_email: request.payerEmail || null,
          payer_name: request.payerName || null,
          payer_phone: request.payerPhoneNumber || null,
          // Counterparty contact information
          counterparty_email: request.counterpartyEmail || null,
          counterparty_name: request.counterpartyName || null,
          counterparty_phone: request.counterpartyPhoneNumber || null,
          // Step 2: Terms and Release conditions
          release_type: request.releaseType || null,
          expected_completion_date: request.expectedCompletionDate ? new Date(request.expectedCompletionDate).toISOString() : null,
          expected_release_date: request.expectedReleaseDate ? new Date(request.expectedReleaseDate).toISOString() : null,
          dispute_resolution_period: request.disputeResolutionPeriod || null,
          release_conditions: request.releaseConditions || null,
        })
        .select()
        .single();

      if (escrowError || !escrow) {
        return {
          success: false,
          message: 'Failed to create escrow',
          error: escrowError?.message || 'Failed to create escrow',
        };
      }

      // Create milestones if this is a milestone-based escrow
      if (request.releaseType === 'Milestones' && request.milestones && request.milestones.length > 0) {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        if (!exchangeRates.success || !exchangeRates.data) {
          return {
            success: false,
            message: 'Failed to fetch exchange rates for milestone currency conversion',
            error: 'Exchange rate fetch failed',
          };
        }
        const usdRate = exchangeRates.data.rates.find(r => r.currency === 'USD')?.rate;
        if (!usdRate || usdRate <= 0) {
          return {
            success: false,
            message: 'XRP/USD exchange rate not available for milestones',
            error: 'Exchange rate not available',
          };
        }

        const milestonesToInsert = request.milestones.map((milestone, index) => {
          let milestoneAmountXrp = milestone.milestoneAmount;
          let milestoneAmountUsd = milestone.milestoneAmount;

          // Convert milestone amount to XRP if currency is USD
          if (request.currency === 'USD') {
            milestoneAmountXrp = milestone.milestoneAmount / usdRate;
          } else {
            milestoneAmountUsd = milestone.milestoneAmount * usdRate;
          }

          return {
            escrow_id: escrow.id,
            milestone_order: milestone.milestoneOrder || (index + 1),
            milestone_details: milestone.milestoneDetails,
            milestone_amount: milestoneAmountXrp,
            milestone_amount_usd: milestoneAmountUsd,
            status: 'pending',
          };
        });

        const { error: milestonesError } = await adminClient
          .from('escrow_milestones')
          .insert(milestonesToInsert);

        if (milestonesError) {
          console.error('Error creating milestones:', milestonesError);
          // Don't fail the escrow creation if milestones fail - log and continue
          // Optionally, you could rollback the escrow creation here
        }
      }

      // Create transaction record for escrow creation
      // Only create if not already created (XUMM flow creates it earlier)
      if (!xummUuid) {
        await adminClient
          .from('transactions')
          .insert({
            user_id: userId,
            type: 'escrow_create',
            amount_xrp: amountXrp,
            amount_usd: amountUsd,
            xrpl_tx_hash: xrplTxHash,
            status: 'completed',
            escrow_id: escrow.id,
            description: `Escrow create: ${request.description || 'No description'} | XRPL TX: ${xrplTxHash}`,
          });
      } else {
        // Update the existing pending transaction with escrow_id
        await adminClient
          .from('transactions')
          .update({
            escrow_id: escrow.id,
          })
          .eq('user_id', userId)
          .eq('type', 'escrow_create')
          .eq('status', 'pending')
          .like('description', `%XUMM_UUID:${xummUuid}%`);
      }

      // Create notifications for initiator and counterparty (if user)
      // Only send notifications if escrow was auto-signed (active status)
      if (xrplTxHash) {
        try {
          // Initiator
          await notificationService.createNotification({
            userId,
            type: 'escrow_created',
            title: 'Escrow created',
            message: `Escrow was created for ${amountXrp.toFixed(6)} XRP.`,
            metadata: {
              escrowId: escrow.id,
              xrplTxHash: xrplTxHash,
            },
          });

          // Counterparty
          if (counterpartyUserId) {
            await notificationService.createNotification({
              userId: counterpartyUserId,
              type: 'escrow_created',
              title: 'New escrow assigned',
              message: `You have been added to a new escrow for ${amountXrp.toFixed(6)} XRP.`,
              metadata: {
                escrowId: escrow.id,
                xrplTxHash: xrplTxHash,
              },
            });
          }
        } catch (notifyError) {
          console.warn('Failed to create escrow created notifications:', notifyError);
        }
      }

      // Return response with appropriate message and data
      if (xrplTxHash) {
        // Auto-signed: Escrow created successfully
        return {
          success: true,
          message: 'Escrow created successfully on XRPL',
          data: {
            escrowId: escrow.id,
            amount: {
              usd: parseFloat(amountUsd.toFixed(2)),
              xrp: parseFloat(amountXrp.toFixed(6)),
            },
            status: escrow.status,
            xrplEscrowId: xrplTxHash,
          },
        };
      } else {
        // XUMM flow: Return XUMM URL for user signing
        return {
          success: true,
          message: 'Please sign the escrow creation transaction in your Xaman (XUMM) wallet',
          data: {
            escrowId: escrow.id,
            amount: {
              usd: parseFloat(amountUsd.toFixed(2)),
              xrp: parseFloat(amountXrp.toFixed(6)),
            },
            status: escrow.status,
            xummUrl: xummUrl,
            xummUuid: xummUuid,
          },
        };
      }
    } catch (error) {
      // #region agent log
      const logCatch = {location:'escrow.service.ts:catch',message:'createEscrow: Outer catch block',data:{errorMessage:error instanceof Error ? error.message : String(error),errorName:error instanceof Error ? error.name : 'Unknown',errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'CATCH'};
      console.error('[DEBUG CATCH]', JSON.stringify(logCatch));
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'debug.log');
        fs.appendFileSync(logPath, JSON.stringify(logCatch) + '\n');
      } catch (e) {}
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logCatch)}).catch(()=>{});
      // #endregion
      console.error('Error creating escrow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create escrow',
        error: error instanceof Error ? error.message : 'Failed to create escrow',
      };
    }
  }

  /**
   * Get completed escrows count for the current month
   */
  async getCompletedEscrowsForMonth(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      count: number;
      month: string;
      year: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get start and end of current month
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // Format month name
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[month];

      // Get completed escrows for the current month
      // User can be either initiator (user_id) or counterparty (counterparty_id)
      const { count, error } = await adminClient
        .from('escrows')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .gte('completed_at', monthStart.toISOString())
        .lte('completed_at', monthEnd.toISOString());

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch completed escrows for month',
          error: 'Failed to fetch completed escrows for month',
        };
      }

      return {
        success: true,
        message: 'Completed escrows for month retrieved successfully',
        data: {
          count: count || 0,
          month: monthName,
          year,
        },
      };
    } catch (error) {
      console.error('Error getting completed escrows for month:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get completed escrows for month',
        error: error instanceof Error ? error.message : 'Failed to get completed escrows for month',
      };
    }
  }

  /**
   * Get escrow list for a user with filters
   */
  async getEscrowListWithFilters(userId: string, filters: GetEscrowListRequest = {}): Promise<{
    success: boolean;
    message: string;
    data?: {
      escrows: Escrow[];
      total: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build query
      let query = adminClient
        .from('escrows')
        .select('*', { count: 'exact' })
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`);

      // Apply transaction type filter
      if (filters.transactionType && filters.transactionType !== 'all') {
        query = query.eq('transaction_type', filters.transactionType);
      }

      // Apply industry filter
      if (filters.industry && filters.industry !== 'all') {
        query = query.ilike('industry', `%${filters.industry}%`);
      }

      // Apply date filter (month/year)
      if (filters.month && filters.year) {
        const monthStart = new Date(filters.year, filters.month - 1, 1);
        const monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
        query = query.gte('created_at', monthStart.toISOString())
                     .lte('created_at', monthEnd.toISOString());
      }

      // Order and paginate
      const { data: escrows, error: escrowError, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (escrowError) {
        return {
          success: false,
          message: 'Failed to fetch escrows',
          error: 'Failed to fetch escrows',
        };
      }

      // Get all unique user IDs (both initiators and counterparties)
      const userIds = new Set<string>();
      (escrows || []).forEach((escrow: any) => {
        if (escrow.user_id) userIds.add(escrow.user_id);
        if (escrow.counterparty_id) userIds.add(escrow.counterparty_id);
      });

      // Get party names
      const partyNames = await this.getPartyNames(Array.from(userIds));

      // Format escrows with all metadata
      const formattedEscrows: Escrow[] = (escrows || []).map((escrow: any) => {
        const year = new Date(escrow.created_at).getFullYear();
        const escrowId = this.formatEscrowId(year, escrow.escrow_sequence || 1);

        return {
          id: escrow.id,
          escrowId,
          userId: escrow.user_id,
          counterpartyId: escrow.counterparty_id || '',
          initiatorName: partyNames[escrow.user_id] || 'Unknown',
          counterpartyName: escrow.counterparty_id ? partyNames[escrow.counterparty_id] : undefined,
          amount: {
            usd: parseFloat(escrow.amount_usd),
            xrp: parseFloat(escrow.amount_xrp),
          },
          status: escrow.status,
          transactionType: escrow.transaction_type as TransactionType,
          industry: escrow.industry || null,
          progress: parseFloat(escrow.progress || 0),
          description: escrow.description || undefined,
          xrplEscrowId: escrow.xrpl_escrow_id || undefined,
          createdAt: escrow.created_at,
          updatedAt: escrow.updated_at,
          completedAt: escrow.completed_at || undefined,
          cancelReason: escrow.cancel_reason || undefined,
          // Contact information
          payerEmail: escrow.payer_email || undefined,
          payerName: escrow.payer_name || undefined,
          payerPhone: escrow.payer_phone || undefined,
          counterpartyEmail: escrow.counterparty_email || undefined,
          counterpartyPhone: escrow.counterparty_phone || undefined,
          // Step 2: Terms and Release conditions
          releaseType: escrow.release_type as ReleaseType | undefined,
          expectedCompletionDate: escrow.expected_completion_date || undefined,
          expectedReleaseDate: escrow.expected_release_date || undefined,
          disputeResolutionPeriod: escrow.dispute_resolution_period || undefined,
          releaseConditions: escrow.release_conditions || undefined,
        };
      });

      return {
        success: true,
        message: 'Escrows retrieved successfully',
        data: {
          escrows: formattedEscrows,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting escrow list:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get escrow list',
        error: error instanceof Error ? error.message : 'Failed to get escrow list',
      };
    }
  }

  /**
   * Get escrow list for a user (backward compatibility)
   */
  async getEscrowList(userId: string, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    message: string;
    data?: {
      escrows: Escrow[];
      total: number;
    };
    error?: string;
  }> {
    return this.getEscrowListWithFilters(userId, { limit, offset });
  }

  /**
   * Get escrow by ID with full details
   */
  async getEscrowById(userId: string, escrowId: string): Promise<{
    success: boolean;
    message: string;
    data?: Escrow;
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow where user is initiator or counterparty
      const { data: escrow, error } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (error || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      // Get party names
      const userIds = [escrow.user_id];
      if (escrow.counterparty_id) userIds.push(escrow.counterparty_id);
      const partyNames = await this.getPartyNames(userIds);

      // Get milestones if this is a milestone-based escrow
      const milestones = await this.getMilestones(escrow.id);

      const year = new Date(escrow.created_at).getFullYear();
      const formattedEscrowId = this.formatEscrowId(year, escrow.escrow_sequence || 1);

      const formattedEscrow: Escrow = {
        id: escrow.id,
        escrowId: formattedEscrowId,
        userId: escrow.user_id,
        counterpartyId: escrow.counterparty_id || '',
        initiatorName: partyNames[escrow.user_id] || 'Unknown',
        counterpartyName: escrow.counterparty_id ? partyNames[escrow.counterparty_id] : undefined,
        amount: {
          usd: parseFloat(escrow.amount_usd),
          xrp: parseFloat(escrow.amount_xrp),
        },
        status: escrow.status,
        transactionType: escrow.transaction_type as TransactionType,
        industry: escrow.industry || null,
        progress: parseFloat(escrow.progress || 0),
        description: escrow.description || undefined,
        xrplEscrowId: escrow.xrpl_escrow_id || undefined,
        createdAt: escrow.created_at,
        updatedAt: escrow.updated_at,
        completedAt: escrow.completed_at || undefined,
        cancelReason: escrow.cancel_reason || undefined,
        // Contact information
        payerEmail: escrow.payer_email || undefined,
        payerName: escrow.payer_name || undefined,
        payerPhone: escrow.payer_phone || undefined,
        counterpartyEmail: escrow.counterparty_email || undefined,
        counterpartyPhone: escrow.counterparty_phone || undefined,
        // Step 2: Terms and Release conditions
        releaseType: escrow.release_type as ReleaseType | undefined,
        expectedCompletionDate: escrow.expected_completion_date || undefined,
        expectedReleaseDate: escrow.expected_release_date || undefined,
        disputeResolutionPeriod: escrow.dispute_resolution_period || undefined,
        releaseConditions: escrow.release_conditions || undefined,
        milestones: milestones.length > 0 ? milestones : undefined,
      };

      return {
        success: true,
        message: 'Escrow retrieved successfully',
        data: formattedEscrow,
      };
    } catch (error) {
      console.error('Error getting escrow by ID:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get escrow',
        error: error instanceof Error ? error.message : 'Failed to get escrow',
      };
    }
  }

  /**
   * Get detailed escrow status from XRPL
   * Checks the actual state of the escrow on XRPL ledger
   */
  async getEscrowXrplStatus(userId: string, escrowId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      exists: boolean;
      status: 'active' | 'finished' | 'cancelled' | 'unknown';
      sequence?: number;
      amount?: number;
      destination?: string;
      finishAfter?: number;
      cancelAfter?: number;
      finishTxHash?: string;
      cancelTxHash?: string;
      finishedAt?: number;
      cancelledAt?: number;
      canFinish: boolean;
      canCancel: boolean;
      canFinishAsOwner?: boolean; // Whether the owner (creator) can finish
      canFinishAsDestination?: boolean; // Whether the destination can finish
      finishAfterDate?: string; // ISO date string for FinishAfter
      error?: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow and verify user has permission
      const { data: escrow, error: fetchError } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (fetchError || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      if (!escrow.xrpl_escrow_id) {
        return {
          success: false,
          message: 'Escrow does not have an XRPL transaction hash',
          error: 'No XRPL transaction hash',
        };
      }

      // Get platform wallet address
      const platformAddress = process.env.XRPL_PLATFORM_ADDRESS;
      if (!platformAddress) {
        return {
          success: false,
          message: 'Platform wallet not configured',
          error: 'Platform wallet not configured',
        };
      }

      // Determine requester role
      const isRequesterOwner = escrow.user_id === userId;
      const isRequesterDestination = escrow.counterparty_id === userId;

      // Get escrow status from XRPL
      const status = await xrplEscrowService.getEscrowStatus(
        escrow.xrpl_escrow_id,
        platformAddress
      );

      // Enhance status with user-specific permissions
      let canFinishAsOwner = status.canFinish;
      let canFinishAsDestination = status.canFinish;
      let finishAfterDate: string | undefined;

      if (status.finishAfter) {
        // Convert Ripple Epoch to Unix timestamp for display
        finishAfterDate = new Date((status.finishAfter + 946684800) * 1000).toISOString();
        
        // Get current ledger close time to check if FinishAfter has passed
        try {
          const { Client } = await import('xrpl');
          const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
          const xrplServer = xrplNetwork === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          const client: any = new Client(xrplServer);
          await client.connect();
          
          try {
            const ledgerResponse = await client.request({
              command: 'ledger',
              ledger_index: 'validated',
            });
            
            const currentLedgerTime = ledgerResponse.result.ledger.close_time;
            const finishAfterPassed = currentLedgerTime >= status.finishAfter;
            
            // XRPL Rule: Before FinishAfter, only Destination can finish
            // After FinishAfter, either Owner or Destination can finish
            if (!finishAfterPassed) {
              canFinishAsOwner = false; // Owner cannot finish before FinishAfter
              canFinishAsDestination = true; // Destination can finish before FinishAfter
            } else {
              // After FinishAfter, both can finish
              canFinishAsOwner = true;
              canFinishAsDestination = true;
            }
          } finally {
            await client.disconnect();
          }
        } catch (ledgerError) {
          console.error('[Escrow Status] Error getting ledger time:', ledgerError);
          // If we can't get ledger time, use the basic canFinish logic
        }
      }

      // Determine if current user can finish based on their role
      const userCanFinish = isRequesterOwner 
        ? canFinishAsOwner 
        : (isRequesterDestination ? canFinishAsDestination : false);

      return {
        success: true,
        message: 'Escrow status retrieved successfully',
        data: {
          ...status,
          canFinish: userCanFinish, // Override with user-specific permission
          canFinishAsOwner,
          canFinishAsDestination,
          finishAfterDate,
        },
      };
    } catch (error) {
      console.error('Error getting escrow XRPL status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get escrow status',
        error: error instanceof Error ? error.message : 'Failed to get escrow status',
      };
    }
  }

  /**
   * Release (finish) an escrow
   */
  async releaseEscrow(userId: string, escrowId: string, notes?: string): Promise<{
    success: boolean;
    message: string;
    data?: Escrow;
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow and verify user has permission
      const { data: escrow, error: fetchError } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (fetchError || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      // Check if escrow can be released
      if (escrow.status === 'completed') {
        return {
          success: false,
          message: 'Escrow is already completed',
          error: 'Escrow is already completed',
        };
      }

      if (escrow.status === 'cancelled') {
        return {
          success: false,
          message: 'Cannot release a cancelled escrow',
          error: 'Cannot release a cancelled escrow',
        };
      }

      // Get platform wallet credentials from environment variables
      const platformAddress = process.env.XRPL_PLATFORM_ADDRESS;
      const platformSecret = process.env.XRPL_PLATFORM_SECRET;

      if (!platformAddress || !platformSecret) {
        return {
          success: false,
          message: 'Platform wallet not configured. XRPL_PLATFORM_ADDRESS and XRPL_PLATFORM_SECRET must be set.',
          error: 'Platform wallet not configured',
        };
      }

      // Finish escrow on XRPL
      // First, retrieve the escrow sequence number from XRPL using the transaction hash
      if (!escrow.xrpl_escrow_id) {
        return {
          success: false,
          message: 'Cannot release escrow: XRPL transaction hash not found. Escrow may not have been created on XRPL.',
          error: 'XRPL transaction hash missing',
        };
      }

      try {
        // First, get the actual owner address from the EscrowCreate transaction
        // Escrows are now created with user wallets, not platform wallet
        let actualOwnerAddress: string;
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
              transaction: escrow.xrpl_escrow_id,
            });
            
            if (txResponse.result) {
              const txResult = txResponse.result as any;
              actualOwnerAddress = 
                txResult.tx_json?.Account || 
                txResult.Account || 
                txResult.tx?.Account ||
                null;
              
              if (!actualOwnerAddress) {
                throw new Error('Could not determine owner address from EscrowCreate transaction');
              }
              
              console.log('[Escrow Release] Extracted owner address from EscrowCreate transaction:', {
                txHash: escrow.xrpl_escrow_id,
                ownerAddress: actualOwnerAddress,
              });
            } else {
              throw new Error('Transaction not found');
            }
          } finally {
            await client.disconnect();
          }
        } catch (txError) {
          console.error('[Escrow Release] Failed to get owner address from transaction:', txError);
          // Fallback: Try to get owner from user's wallet (for new escrows) or platform (for old escrows)
          const { data: userWallet } = await adminClient
            .from('wallets')
            .select('xrpl_address')
            .eq('user_id', escrow.user_id)
            .single();
          
          actualOwnerAddress = userWallet?.xrpl_address || platformAddress;
          console.log('[Escrow Release] Using fallback owner address:', {
            ownerAddress: actualOwnerAddress,
            source: userWallet ? 'user_wallet' : 'platform_wallet',
          });
        }

        // Get escrow details from XRPL to retrieve the sequence number
        console.log('[Escrow Release] Retrieving escrow details from XRPL:', {
          txHash: escrow.xrpl_escrow_id,
          ownerAddress: actualOwnerAddress,
        });

        // CRITICAL: Always query the EscrowCreate transaction directly to get the correct sequence
        // Don't rely on getEscrowDetailsByTxHash - query the transaction ourselves
        console.log('[Escrow Release] Querying EscrowCreate transaction directly for sequence...', {
          txHash: escrow.xrpl_escrow_id,
          ownerAddress: actualOwnerAddress,
        });
        
        let actualTxSequence: number | null = null;
        let escrowDetails: any = null;
        
        try {
          const { Client } = await import('xrpl');
          const { dropsToXrp } = await import('xrpl');
          const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
          const xrplServer = xrplNetwork === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          const client: any = new Client(xrplServer);
          await client.connect();
          
          try {
            // Query the EscrowCreate transaction directly
            const txResponse = await client.request({
              command: 'tx',
              transaction: escrow.xrpl_escrow_id,
            });
            
            if (txResponse.result) {
              const txResult = txResponse.result as any;
              const txJson = txResult.tx_json || txResult.tx || txResult;
              
              // Extract sequence from transaction
              actualTxSequence = 
                txJson.Sequence || 
                txResult.tx_json?.Sequence || 
                txResult.Sequence || 
                null;
              
              // Extract other details
              const txAccount = txJson.Account || txResult.tx_json?.Account || txResult.Account;
              const txDestination = txJson.Destination || txResult.tx_json?.Destination || txResult.Destination;
              const txAmount = txJson.Amount || txResult.tx_json?.Amount || txResult.Amount;
              const txFinishAfter = txJson.FinishAfter || txResult.tx_json?.FinishAfter || txResult.FinishAfter;
              const txCancelAfter = txJson.CancelAfter || txResult.tx_json?.CancelAfter || txResult.CancelAfter;
              const txCondition = txJson.Condition || txResult.tx_json?.Condition || txResult.Condition;
              
              console.log('[Escrow Release] EscrowCreate transaction details:', {
                sequence: actualTxSequence,
                account: txAccount,
                destination: txDestination,
                amount: txAmount,
                finishAfter: txFinishAfter,
                transactionType: txJson.TransactionType || txResult.tx_json?.TransactionType,
              });
              
              if (!actualTxSequence) {
                throw new Error('Could not extract sequence from EscrowCreate transaction');
              }
              
              // Verify account matches
              if (txAccount !== actualOwnerAddress) {
                console.error('[Escrow Release] CRITICAL: Transaction account mismatch!', {
                  transactionAccount: txAccount,
                  expectedOwner: actualOwnerAddress,
                  txHash: escrow.xrpl_escrow_id,
                });
                throw new Error(`EscrowCreate transaction account (${txAccount}) does not match expected owner (${actualOwnerAddress})`);
              }
              
              // Build escrow details from transaction
              const amountDrops = typeof txAmount === 'string' ? txAmount : String(txAmount);
              const amountXrp = parseFloat(dropsToXrp(amountDrops) as any);
              
              escrowDetails = {
                sequence: actualTxSequence, // CRITICAL: Use transaction sequence
                amount: amountXrp,
                destination: txDestination || '',
                finishAfter: txFinishAfter ? Number(txFinishAfter) : undefined,
                cancelAfter: txCancelAfter ? Number(txCancelAfter) : undefined,
                condition: txCondition || undefined,
              };
              
              console.log('[Escrow Release] Built escrow details from transaction:', escrowDetails);
            } else {
              throw new Error('EscrowCreate transaction not found');
            }
          } finally {
            await client.disconnect();
          }
        } catch (txError) {
          console.error('[Escrow Release] Failed to query EscrowCreate transaction directly, falling back to getEscrowDetailsByTxHash:', txError);
          // Fallback to original method
          escrowDetails = await xrplEscrowService.getEscrowDetailsByTxHash(
            escrow.xrpl_escrow_id,
            actualOwnerAddress
          );
        }
        
        if (!escrowDetails || !escrowDetails.sequence) {
          return {
            success: false,
            message: 'Cannot release escrow: Could not determine escrow sequence from EscrowCreate transaction.',
            error: 'Escrow sequence not found',
          };
        }
        
        console.log('[Escrow Release] Using escrow details:', {
          sequence: escrowDetails.sequence,
          amount: escrowDetails.amount,
          destination: escrowDetails.destination,
          finishAfter: escrowDetails.finishAfter,
          source: actualTxSequence ? 'direct_transaction_query' : 'getEscrowDetailsByTxHash',
        });

        // If transaction hash lookup failed, try fallback: query account_objects directly
        // This handles escrows created with placeholder hashes
        if (!escrowDetails) {
          console.log('[Escrow Release] Transaction hash lookup failed, trying fallback: querying account_objects');
          
          // Get counterparty wallet address to match destination
          let counterpartyWalletAddress: string | null = null;
          if (escrow.counterparty_id) {
            const { data: counterpartyWallet } = await adminClient
              .from('wallets')
              .select('xrpl_address')
              .eq('user_id', escrow.counterparty_id)
              .single();
            counterpartyWalletAddress = counterpartyWallet?.xrpl_address || null;
          }

          // Try to find escrow by querying account_objects and matching by destination and amount
          // First, try to get the transaction sequence from the transaction hash if available
          try {
            const { Client } = await import('xrpl');
            const { xrpToDrops, dropsToXrp } = await import('xrpl');
            
            const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
            const xrplServer = xrplNetwork === 'mainnet'
              ? 'wss://xrplcluster.com'
              : 'wss://s.altnet.rippletest.net:51233';
            
            const client: any = new Client(xrplServer);
            await client.connect();

            try {
              // First, try to get the transaction sequence from the transaction hash
              let transactionSequence: number | null = null;
              if (escrow.xrpl_escrow_id && /^[a-f0-9]{64}$/i.test(escrow.xrpl_escrow_id)) {
                try {
                  const txResponse = await client.request({
                    command: 'tx',
                    transaction: escrow.xrpl_escrow_id,
                  });
                  if (txResponse.result && (txResponse.result as any).Sequence) {
                    transactionSequence = (txResponse.result as any).Sequence as number;
                    console.log('[Escrow Release] Got transaction sequence from hash:', transactionSequence);
                  }
                } catch (txError) {
                  // Transaction hash query failed, continue with fallback
                  console.log('[Escrow Release] Could not get sequence from transaction hash, continuing with account_objects fallback');
                }
              }

              const accountObjectsResponse = await client.request({
                command: 'account_objects',
                account: actualOwnerAddress,
                type: 'escrow',
              });

              const escrowObjects = accountObjectsResponse.result.account_objects || [];
              
              // Find escrow matching destination and approximate amount
              const targetAmountDrops = xrpToDrops(escrow.amount_xrp.toString());
              const escrowObject = escrowObjects.find((obj: any) => {
                const matchesDestination = !counterpartyWalletAddress || 
                  (obj as any).Destination === counterpartyWalletAddress;
                const objAmount = (obj as any).Amount;
                const matchesAmount = objAmount && Math.abs(parseInt(String(objAmount)) - parseInt(String(targetAmountDrops))) < 1000; // Allow small difference for fees
                // If we have a transaction hash, also try to match by PreviousTxnID
                const matchesTxHash = !escrow.xrpl_escrow_id || (obj as any).PreviousTxnID === escrow.xrpl_escrow_id;
                return matchesDestination && matchesAmount && (transactionSequence !== null || matchesTxHash);
              }) as any;

              if (escrowObject) {
                const escrowAmount = (escrowObject as any).Amount;
                const amountDropsStr: string = escrowAmount ? String(escrowAmount) : '0';
                const amount = parseFloat(dropsToXrp(amountDropsStr) as any);

                // IMPORTANT: Use transaction sequence for EscrowFinish OfferSequence, not escrow object sequence
                // If we couldn't get transaction sequence, this fallback won't work correctly
                const sequenceToUse = transactionSequence || null;
                
                if (!sequenceToUse) {
                  console.error('[Escrow Release] Fallback method cannot determine transaction sequence - cannot proceed');
                  throw new Error('Cannot determine escrow transaction sequence for EscrowFinish');
                }

                escrowDetails = {
                  sequence: sequenceToUse, // Use transaction sequence, not escrow object sequence
                  amount,
                  destination: (escrowObject as any).Destination || '',
                  finishAfter: (escrowObject as any).FinishAfter ? ((escrowObject as any).FinishAfter as number) : undefined,
                  cancelAfter: (escrowObject as any).CancelAfter ? ((escrowObject as any).CancelAfter as number) : undefined,
                  condition: (escrowObject as any).Condition || undefined,
                };

                console.log('[Escrow Release] Found escrow via fallback method:', {
                  sequence: escrowDetails.sequence,
                  amount: escrowDetails.amount,
                  destination: escrowDetails.destination,
                });
              }
            } finally {
              await client.disconnect();
            }
          } catch (fallbackError) {
            console.error('[Escrow Release] Fallback query failed:', fallbackError);
          }
        }

        if (!escrowDetails) {
          // Check if escrow was already finished by looking at transaction history
          // The escrow object not existing means it was already finished or cancelled
          // OR the transaction was never validated
          try {
            const { Client } = await import('xrpl');
            const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
            const xrplServer = xrplNetwork === 'mainnet'
              ? 'wss://xrplcluster.com'
              : 'wss://s.altnet.rippletest.net:51233';
            
            const client: any = new Client(xrplServer);
            await client.connect();
            
            try {
              // First, check if the transaction exists and was validated
              let txResponse: any;
              let transactionExists = false;
              let transactionValidated = false;
              
              try {
                txResponse = await client.request({
                  command: 'tx',
                  transaction: escrow.xrpl_escrow_id,
                });
                
                if (txResponse.result) {
                  transactionExists = true;
                  // Check if transaction was validated (has validated field or ledger_index)
                  transactionValidated = !!(txResponse.result.validated || txResponse.result.ledger_index);
                  
                  if (!transactionValidated) {
                    await client.disconnect();
                    return {
                      success: false,
                      message: 'Cannot release escrow: The escrow creation transaction has not been validated on XRPL yet. Please wait a few moments and try again.',
                      error: 'Transaction not validated',
                    };
                  }
                  
                  // Check if transaction was successful (not failed)
                  const txResult = txResponse.result as any;
                  if (txResult.meta && txResult.meta.TransactionResult && txResult.meta.TransactionResult !== 'tesSUCCESS') {
                    await client.disconnect();
                    return {
                      success: false,
                      message: `Cannot release escrow: The escrow creation transaction failed on XRPL with error: ${txResult.meta.TransactionResult}. The escrow was never created.`,
                      error: 'Transaction failed',
                    };
                  }
                  
                  const txSequence = (txResponse.result as any).Sequence;
                  
                  // Check account transaction history for EscrowFinish/EscrowCancel
                  const accountTxResponse = await client.request({
                    command: 'account_tx',
                    account: platformAddress,
                    ledger_index_min: -1,
                    ledger_index_max: -1,
                    limit: 200,
                  });
                  
                  const transactions = accountTxResponse.result.transactions || [];
                  const relatedTx = transactions.find((txData: any) => {
                    const tx = txData.tx || txData;
                    return ((tx as any).TransactionType === 'EscrowFinish' || (tx as any).TransactionType === 'EscrowCancel') &&
                           (tx as any).Owner === platformAddress &&
                           (tx as any).OfferSequence === txSequence;
                  });
                  
                  if (relatedTx) {
                    const tx = (relatedTx as any).tx || relatedTx;
                    const wasFinished = (tx as any).TransactionType === 'EscrowFinish';
                    
                    // Update database status if it's still showing as active
                    if (escrow.status === 'active') {
                      console.log(`[Escrow Release] Updating database: Escrow was already ${wasFinished ? 'finished' : 'cancelled'} on XRPL`);
                      await adminClient
                        .from('escrows')
                        .update({
                          status: wasFinished ? 'completed' : 'cancelled',
                          completed_at: wasFinished ? new Date().toISOString() : null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', escrowId);
                    }
                    
                    await client.disconnect();
                    
                    return {
                      success: false,
                      message: `Cannot release escrow: The escrow was already ${wasFinished ? 'finished' : 'cancelled'} on XRPL. The database status has been updated.`,
                      error: `Escrow already ${wasFinished ? 'finished' : 'cancelled'}`,
                    };
                  }
                }
              } catch (txError: any) {
                // Transaction not found - might not have been validated or might have failed
                const errorCode = txError?.data?.error;
                const errorMessage = txError?.data?.error_message || txError?.message;
                
                if (errorCode === 'txnNotFound') {
                  transactionExists = false;
                  console.log('[Escrow Release] Transaction not found on XRPL:', {
                    txHash: escrow.xrpl_escrow_id,
                    errorCode,
                    errorMessage,
                  });
                } else {
                  console.error('[Escrow Release] Error checking transaction:', {
                    txHash: escrow.xrpl_escrow_id,
                    errorCode,
                    errorMessage,
                    fullError: txError,
                  });
                }
              }
              
              await client.disconnect();
              
              // If transaction doesn't exist, the escrow was never created on XRPL
              if (!transactionExists) {
                return {
                  success: false,
                  message: 'Cannot release escrow: The escrow creation transaction was not found on XRPL. This may mean the transaction failed or was never validated. Please contact support if this escrow was recently created.',
                  error: 'Transaction not found on XRPL',
                };
              }
            } catch (checkError) {
              await client.disconnect();
              console.error('[Escrow Release] Error checking escrow status:', checkError);
            }
          } catch (error) {
            console.error('[Escrow Release] Error checking transaction history:', error);
          }
          
          return {
            success: false,
            message: 'Cannot release escrow: Escrow not found on XRPL. The escrow object does not exist, which means it was already finished or cancelled on the XRPL ledger, or the transaction was never validated. Please refresh your escrow list to see the updated status.',
            error: 'Escrow not found on XRPL - already finished or cancelled',
          };
        }

        console.log('[Escrow Release] Found escrow on XRPL:', {
          sequence: escrowDetails.sequence,
          sequenceType: typeof escrowDetails.sequence,
          amount: escrowDetails.amount,
          destination: escrowDetails.destination,
          finishAfter: escrowDetails.finishAfter,
          txHash: escrow.xrpl_escrow_id,
          ownerAddress: actualOwnerAddress,
        });

        // CRITICAL: Double-verify the sequence is the transaction sequence, not object sequence
        // Query the EscrowCreate transaction directly to ensure we have the correct sequence
        console.log('[Escrow Release] Starting sequence verification...', {
          txHash: escrow.xrpl_escrow_id,
          returnedSequence: escrowDetails.sequence,
          ownerAddress: actualOwnerAddress,
        });
        
        try {
          const { Client } = await import('xrpl');
          const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
          const xrplServer = xrplNetwork === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          const client: any = new Client(xrplServer);
          await client.connect();
          
          try {
            console.log('[Escrow Release] Querying EscrowCreate transaction for sequence verification...');
            const txResponse = await client.request({
              command: 'tx',
              transaction: escrow.xrpl_escrow_id,
            });
            
            console.log('[Escrow Release] Transaction query result:', {
              hasResult: !!txResponse.result,
              resultKeys: txResponse.result ? Object.keys(txResponse.result) : [],
            });
            
            if (txResponse.result) {
              const txResult = txResponse.result as any;
              const actualTxSequence = 
                txResult.tx_json?.Sequence || 
                txResult.Sequence || 
                txResult.tx?.Sequence ||
                null;
              
              console.log('[Escrow Release] Sequence extraction:', {
                actualTxSequence,
                returnedSequence: escrowDetails.sequence,
                txJsonSequence: txResult.tx_json?.Sequence,
                txResultSequence: txResult.Sequence,
                txSequence: txResult.tx?.Sequence,
              });
              
              if (actualTxSequence !== null) {
                if (actualTxSequence !== escrowDetails.sequence) {
                  console.error('[Escrow Release] CRITICAL: Sequence mismatch detected!', {
                    returnedSequence: escrowDetails.sequence,
                    actualTxSequence: actualTxSequence,
                    txHash: escrow.xrpl_escrow_id,
                    ownerAddress: actualOwnerAddress,
                    difference: Math.abs(actualTxSequence - escrowDetails.sequence),
                  });
                  // Correct the sequence to use the actual transaction sequence
                  escrowDetails.sequence = actualTxSequence;
                  console.log('[Escrow Release] Corrected sequence to transaction sequence:', actualTxSequence);
                } else {
                  console.log('[Escrow Release] Sequence verified: matches EscrowCreate transaction', {
                    sequence: actualTxSequence,
                  });
                }
              } else {
                console.error('[Escrow Release] CRITICAL: Could not extract sequence from transaction!', {
                  txHash: escrow.xrpl_escrow_id,
                  txResultKeys: Object.keys(txResult),
                  txJsonKeys: txResult.tx_json ? Object.keys(txResult.tx_json) : [],
                });
              }
            } else {
              console.error('[Escrow Release] CRITICAL: Transaction query returned no result!', {
                txHash: escrow.xrpl_escrow_id,
              });
            }
          } finally {
            await client.disconnect();
          }
        } catch (verifyError) {
          console.error('[Escrow Release] CRITICAL: Sequence verification failed!', {
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
            txHash: escrow.xrpl_escrow_id,
            returnedSequence: escrowDetails.sequence,
          });
        }

        // Check if escrow has a condition that requires fulfillment
        if (escrowDetails.condition) {
          // Conditional escrows require fulfillment - this is not yet implemented
          // For now, return error. In future, this could accept fulfillment parameter
          return {
            success: false,
            message: 'Cannot release escrow: Escrow has a condition that requires fulfillment. This feature is not yet implemented.',
            error: 'Conditional escrow not supported',
          };
        }

        // Determine requester role: Owner (escrow creator) or Destination (counterparty)
        const isRequesterOwner = escrow.user_id === userId;
        const isRequesterDestination = escrow.counterparty_id === userId;
        
        if (!isRequesterOwner && !isRequesterDestination) {
          return {
            success: false,
            message: 'Unauthorized: You are not authorized to release this escrow',
            error: 'Unauthorized',
          };
        }

        // Check FinishAfter timestamp and validate permissions
        let canFinish = true;
        let finishAfterPassed = true;
        let requiresDestination = false;

        if (escrowDetails.finishAfter) {
          // Get current ledger close time from XRPL
          const { Client } = await import('xrpl');
          const xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
          const xrplServer = xrplNetwork === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          const client: any = new Client(xrplServer);
          await client.connect();
          
          try {
            // Get the latest validated ledger to get close time
            const ledgerResponse = await client.request({
              command: 'ledger',
              ledger_index: 'validated',
            });
            
            // XRPL ledger close_time is in seconds since Ripple Epoch (Jan 1, 2000)
            // FinishAfter is also in Ripple Epoch seconds
            const currentLedgerTime = ledgerResponse.result.ledger.close_time;
            finishAfterPassed = currentLedgerTime >= escrowDetails.finishAfter;
            
            console.log('[Escrow Release] FinishAfter check:', {
              finishAfter: escrowDetails.finishAfter,
              currentLedgerTime: currentLedgerTime,
              finishAfterPassed: finishAfterPassed,
              finishAfterDate: new Date((escrowDetails.finishAfter + 946684800) * 1000).toISOString(), // Convert Ripple Epoch to Unix timestamp
              currentLedgerDate: new Date((currentLedgerTime + 946684800) * 1000).toISOString(),
            });

            // XRPL Rule: Before FinishAfter, only Destination can finish
            // After FinishAfter, either Owner or Destination can finish
            if (!finishAfterPassed) {
              requiresDestination = true;
              if (isRequesterOwner) {
                canFinish = false;
              } else if (isRequesterDestination) {
                canFinish = true; // Destination can finish before FinishAfter
              }
            } else {
              // After FinishAfter, either party can finish
              canFinish = true;
            }
          } catch (ledgerError) {
            console.error('[Escrow Release] Error getting ledger time:', ledgerError);
            // If we can't get ledger time, allow the attempt but log warning
            console.warn('[Escrow Release] Could not verify FinishAfter timestamp, proceeding with caution');
          } finally {
            await client.disconnect();
          }
        }

        // Validate permissions
        if (!canFinish) {
          // FinishAfter is in Ripple Epoch seconds (since Jan 1, 2000)
          // Convert to Unix timestamp for display: Ripple Epoch + 946684800 = Unix timestamp
          const finishAfterDate = escrowDetails.finishAfter 
            ? new Date((escrowDetails.finishAfter + 946684800) * 1000).toISOString()
            : 'N/A';
          
          return {
            success: false,
            message: `Cannot release escrow: Only the destination can finish this escrow before the FinishAfter time (${finishAfterDate}). The escrow owner cannot finish it until after that time.`,
            error: 'FinishAfter permission denied',
          };
        }

        // Determine which wallet to use for finishing
        let finisherAddress: string;
        let finisherSecret: string;
        let isFinishingAsDestination = false;

        if (requiresDestination && isRequesterDestination) {
          // Destination needs to finish before FinishAfter
          isFinishingAsDestination = true;
          
          // Get destination wallet address and secret
          const { data: destinationWallet } = await adminClient
            .from('wallets')
            .select('xrpl_address, encrypted_wallet_secret')
            .eq('user_id', escrow.counterparty_id)
            .single();

          if (!destinationWallet) {
            return {
              success: false,
              message: 'Cannot release escrow: Destination wallet not found',
              error: 'Destination wallet not found',
            };
          }

          finisherAddress = destinationWallet.xrpl_address;
          
          // Verify destination address matches escrow destination
          if (finisherAddress !== escrowDetails.destination) {
            return {
              success: false,
              message: `Cannot release escrow: Destination wallet address (${finisherAddress}) does not match escrow destination (${escrowDetails.destination})`,
              error: 'Destination address mismatch',
            };
          }

          // If destination doesn't have wallet secret, use XUMM for signing
          if (!destinationWallet.encrypted_wallet_secret) {
            console.log('[Escrow Release] Destination wallet secret not available, creating XUMM payload for user signing');
            
            // Prepare EscrowFinish transaction for XUMM signing
            const platformAddress = process.env.XRPL_PLATFORM_ADDRESS;
            if (!platformAddress) {
              return {
                success: false,
                message: 'Platform wallet not configured',
                error: 'Platform wallet not configured',
              };
            }

            const escrowFinishTx = await xrplEscrowService.prepareEscrowFinishTransaction({
              ownerAddress: actualOwnerAddress, // Original owner from EscrowCreate (always required)
              finisherAddress: finisherAddress, // Destination address (who will sign)
              escrowSequence: escrowDetails.sequence,
              condition: escrowDetails.condition,
              fulfillment: undefined,
            });

            // Create XUMM payload
            const xummPayload = await xummService.createPayload(escrowFinishTx.transaction);

            // Create pending transaction record
            await adminClient
              .from('transactions')
              .insert({
                user_id: userId,
                type: 'escrow_release',
                amount_xrp: parseFloat(escrow.amount_xrp),
                amount_usd: parseFloat(escrow.amount_usd),
                status: 'pending',
                escrow_id: escrowId,
                description: `Escrow release pending XUMM signature | XUMM_UUID:${xummPayload.uuid}${notes ? ` | Notes: ${notes}` : ''}`,
              })
              .select()
              .single();

            return {
              success: true,
              message: 'Please sign the transaction in your Xaman (XUMM) wallet to release the escrow',
              data: {
                requiresSigning: true,
                xummUrl: xummPayload.next.always,
                xummUuid: xummPayload.uuid,
                qrCode: xummPayload.refs?.qr_png || xummPayload.refs?.qr_uri || null,
                instructions: 'Open the Xaman app and sign the EscrowFinish transaction to release the escrow funds.',
              } as any,
            };
          }

          // Destination has wallet secret, decrypt it
          try {
            finisherSecret = encryptionService.decrypt(destinationWallet.encrypted_wallet_secret);
          } catch (decryptError) {
            console.error('[Escrow Release] Failed to decrypt destination wallet secret:', decryptError);
            return {
              success: false,
              message: 'Cannot release escrow: Failed to decrypt destination wallet secret',
              error: 'Wallet secret decryption failed',
            };
          }
        } else {
          // Owner can finish (either no FinishAfter or FinishAfter has passed)
          finisherAddress = platformAddress;
          finisherSecret = platformSecret;
        }

        // Finish escrow on XRPL
        console.log('[Escrow Release] Finishing escrow on XRPL:', {
          escrowSequence: escrowDetails.sequence,
          ownerAddress: actualOwnerAddress,
          finisherAddress: finisherAddress,
          isFinishingAsDestination: isFinishingAsDestination,
          finishAfterPassed: finishAfterPassed,
          txHash: escrow.xrpl_escrow_id,
        });

        // Pre-finish verification: Verify escrow exists on XRPL before attempting to finish
        console.log('[Escrow Release] Performing pre-finish verification...');
        try {
          const verification = await xrplEscrowService.verifyEscrowExists({
            ownerAddress: actualOwnerAddress,
            escrowSequence: escrowDetails.sequence,
            finisherAddress: finisherAddress,
            expectedTxHash: escrow.xrpl_escrow_id || undefined,
          });

          if (!verification.exists) {
            if (verification.alreadyFinished) {
              // Update database to reflect that escrow is already finished
              await adminClient
                .from('escrows')
                .update({
                  status: 'completed',
                  progress: 100,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', escrowId);

              return {
                success: false,
                message: `Cannot release escrow: The escrow has already been finished on XRPL. The database status has been updated.`,
                error: 'Escrow already finished',
              };
            }

            if (verification.alreadyCancelled) {
              // Update database to reflect that escrow is already cancelled
              await adminClient
                .from('escrows')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', escrowId);

              return {
                success: false,
                message: `Cannot release escrow: The escrow has already been cancelled on XRPL. The database status has been updated.`,
                error: 'Escrow already cancelled',
              };
            }

            return {
              success: false,
              message: verification.error || `Cannot release escrow: Escrow not found on XRPL with sequence ${escrowDetails.sequence}. The sequence number may be incorrect.`,
              error: 'Escrow not found on XRPL',
            };
          }

          if (verification.error) {
            return {
              success: false,
              message: verification.error,
              error: 'Escrow verification failed',
            };
          }

          // Verify escrow details match
          if (verification.destination && verification.destination !== escrowDetails.destination) {
            console.warn('[Escrow Release] Destination mismatch:', {
              verificationDestination: verification.destination,
              escrowDetailsDestination: escrowDetails.destination,
            });
          }

          console.log('[Escrow Release] Pre-finish verification passed:', {
            exists: verification.exists,
            hasFinishAfter: !!verification.finishAfter,
            hasCondition: !!verification.condition,
            destination: verification.destination,
          });
        } catch (verificationError) {
          console.error('[Escrow Release] Pre-finish verification error:', verificationError);
          // Continue with finish attempt, but log the error
          console.warn('[Escrow Release] Continuing with finish attempt despite verification error');
        }

        let finishTxHash: string;
        try {
          finishTxHash = await xrplEscrowService.finishEscrow({
            ownerAddress: actualOwnerAddress, // Original owner from EscrowCreate (always required)
            escrowSequence: escrowDetails.sequence,
            finisherAddress: finisherAddress, // Who is finishing (Owner or Destination)
            condition: escrowDetails.condition,
            fulfillment: undefined, // TODO: Implement fulfillment if condition exists
            walletSecret: finisherSecret,
            expectedTxHash: escrow.xrpl_escrow_id || undefined, // Pass transaction hash to help verification
          });
          console.log('[Escrow Release] Escrow finished on XRPL:', {
            txHash: finishTxHash,
          escrowSequence: escrowDetails.sequence,
            finisherAddress: finisherAddress,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Escrow Release] Failed to finish escrow on XRPL:', {
            error: errorMessage,
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorStack: error instanceof Error ? error.stack : undefined,
            escrowId,
            escrowSequence: escrowDetails.sequence,
            ownerAddress: actualOwnerAddress,
            finisherAddress: finisherAddress,
            isFinishingAsDestination,
          });
          throw new Error(`Failed to finish escrow on XRPL: ${errorMessage}`);
        }

        // Update escrow status to completed
        const { data: updatedEscrow } = await adminClient
          .from('escrows')
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description: escrow.description 
              ? `${escrow.description} | Released: ${finishTxHash}`
              : `Escrow released: ${finishTxHash}`,
          })
          .eq('id', escrowId)
          .select()
          .single();

        // Create completed transaction record
        await adminClient
          .from('transactions')
          .insert({
            user_id: userId,
            type: 'escrow_release',
            amount_xrp: parseFloat(escrow.amount_xrp),
            amount_usd: parseFloat(escrow.amount_usd),
            xrpl_tx_hash: finishTxHash,
            status: 'completed',
            escrow_id: escrowId,
            description: notes 
              ? `${notes} | XRPL TX: ${finishTxHash}`
              : `Escrow release: ${escrow.description || 'No description'} | XRPL TX: ${finishTxHash}`,
          });

        // Update wallet balances for both parties
        if (updatedEscrow) {
          // Update sender's wallet balance
          try {
            const { data: senderWallet } = await adminClient
              .from('wallets')
              .select('xrpl_address')
              .eq('user_id', updatedEscrow.user_id)
              .single();

            if (senderWallet) {
              const senderBalances = await xrplWalletService.getAllBalances(senderWallet.xrpl_address);
              await adminClient
                .from('wallets')
                .update({
                  balance_xrp: senderBalances.xrp,
                  balance_usdt: senderBalances.usdt,
                  balance_usdc: senderBalances.usdc,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', updatedEscrow.user_id);
            }
          } catch (error) {
            console.error('Error updating sender wallet balance:', error);
          }

          // Update receiver's wallet balance
          if (updatedEscrow.counterparty_id) {
            try {
              const { data: receiverWallet } = await adminClient
                .from('wallets')
                .select('xrpl_address')
                .eq('user_id', updatedEscrow.counterparty_id)
                .single();

              if (receiverWallet) {
                const receiverBalances = await xrplWalletService.getAllBalances(receiverWallet.xrpl_address);
                await adminClient
                  .from('wallets')
                  .update({
                    balance_xrp: receiverBalances.xrp,
                    balance_usdt: receiverBalances.usdt,
                    balance_usdc: receiverBalances.usdc,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', updatedEscrow.counterparty_id);
              }
            } catch (error) {
              console.error('Error updating receiver wallet balance:', error);
            }
          }
        }

        // Format and return escrow
        const userIds = [updatedEscrow.user_id];
        if (updatedEscrow.counterparty_id) userIds.push(updatedEscrow.counterparty_id);
        const partyNames = await this.getPartyNames(userIds);
        const milestones = await this.getMilestones(updatedEscrow.id);
        const year = new Date(updatedEscrow.created_at).getFullYear();
        const formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);
        
        const formattedEscrow: Escrow = {
          id: updatedEscrow.id,
            escrowId: formattedEscrowId,
          userId: updatedEscrow.user_id,
          counterpartyId: updatedEscrow.counterparty_id || '',
          initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
          counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
            amount: {
            usd: parseFloat(updatedEscrow.amount_usd),
            xrp: parseFloat(updatedEscrow.amount_xrp),
            },
          status: updatedEscrow.status,
          transactionType: updatedEscrow.transaction_type as TransactionType,
          industry: updatedEscrow.industry || null,
          progress: 100,
          description: updatedEscrow.description || undefined,
          xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
          createdAt: updatedEscrow.created_at,
          updatedAt: updatedEscrow.updated_at,
          completedAt: updatedEscrow.completed_at || undefined,
          payerEmail: updatedEscrow.payer_email || undefined,
          payerName: updatedEscrow.payer_name || undefined,
          payerPhone: updatedEscrow.payer_phone || undefined,
          counterpartyEmail: updatedEscrow.counterparty_email || undefined,
          counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
          releaseType: updatedEscrow.release_type as ReleaseType | undefined,
          expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
          expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
          disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
          releaseConditions: updatedEscrow.release_conditions || undefined,
          milestones: milestones.length > 0 ? milestones : undefined,
        };

        // Create notifications for initiator and counterparty
        try {
          if (updatedEscrow.user_id) {
            await notificationService.createNotification({
              userId: updatedEscrow.user_id,
              type: 'escrow_completed',
              title: 'Escrow released',
              message: 'Funds for your escrow have been released.',
              metadata: {
                escrowId: updatedEscrow.id,
                xrplTxHash: updatedEscrow.xrpl_escrow_id,
              },
            });
          }

          if (updatedEscrow.counterparty_id) {
            await notificationService.createNotification({
              userId: updatedEscrow.counterparty_id,
              type: 'escrow_completed',
              title: 'Escrow completed',
              message: 'You received funds from a completed escrow.',
              metadata: {
                escrowId: updatedEscrow.id,
                xrplTxHash: updatedEscrow.xrpl_escrow_id,
              },
            });
          }
        } catch (notifyError) {
          console.warn('Failed to create escrow completed notifications:', notifyError);
        }

        return {
          success: true,
          message: 'Escrow released successfully',
          data: formattedEscrow,
        };
      } catch (xrplError) {
        const errorMessage = xrplError instanceof Error ? xrplError.message : String(xrplError);
        console.error('[Escrow Release] XRPL finish escrow error:', {
          error: errorMessage,
          escrowId: escrowId,
          txHash: escrow.xrpl_escrow_id,
        });

        // DO NOT update database if XRPL transaction fails
        return {
          success: false,
          message: `Failed to release escrow on XRPL: ${errorMessage}`,
          error: 'XRPL transaction failed',
        };
      }
    } catch (error) {
      console.error('Error releasing escrow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to release escrow',
        error: error instanceof Error ? error.message : 'Failed to release escrow',
      };
    }
  }

  /**
   * Get XUMM payload status for escrow release and complete the release if signed
   * Similar to getXUMMPayloadStatus for deposits
   */
  async getEscrowReleaseXUMMStatus(
    userId: string,
    escrowId: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      signed: boolean;
      signedTxBlob: string | null;
      cancelled: boolean;
      expired: boolean;
      xrplTxHash: string | null;
      escrow?: Escrow;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow and verify user has permission
      const { data: escrow, error: fetchError } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (fetchError || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      // Find the pending escrow_release transaction
      const { data: transaction } = await adminClient
        .from('transactions')
        .select('*')
        .eq('escrow_id', escrowId)
        .eq('type', 'escrow_release')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!transaction) {
        return {
          success: false,
          message: 'No pending escrow release transaction found',
          error: 'No pending transaction',
        };
      }

      // Extract XUMM UUID from description
      const uuidMatch = transaction.description?.match(/XUMM_UUID:([a-f0-9-]+)/i);
      if (!uuidMatch) {
        return {
          success: false,
          message: 'XUMM UUID not found for this escrow release',
          error: 'XUMM UUID not found',
        };
      }

      const xummUuid = uuidMatch[1];

      // Get payload status from XUMM
      const payloadStatus = await xummService.getPayloadStatus(xummUuid);

      // Check if transaction is signed and needs processing
      if (payloadStatus.meta.signed && payloadStatus.response?.hex) {
        // Case 1: Transaction signed but not yet submitted to XRPL
        console.log('[Escrow Release XUMM] Submitting signed transaction to XRPL');

        const submitResult = await xrplWalletService.submitSignedTransaction(
          payloadStatus.response.hex
        );

        if (submitResult.status !== 'tesSUCCESS') {
          return {
            success: false,
            message: `Escrow release transaction failed on XRPL: ${submitResult.status}`,
            error: 'XRPL transaction failed',
            data: {
              signed: true,
              signedTxBlob: payloadStatus.response.hex,
              cancelled: payloadStatus.meta.cancelled,
              expired: payloadStatus.meta.expired,
              xrplTxHash: submitResult.hash,
            },
          };
        }

        const finishTxHash = submitResult.hash;

        // Update transaction record
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: finishTxHash,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id);

        // Update escrow status to completed
        const { data: updatedEscrow } = await adminClient
          .from('escrows')
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', escrowId)
          .select()
          .single();

        // Update wallet balances
        if (updatedEscrow) {
          // Update sender's wallet balance
          try {
            const { data: senderWallet } = await adminClient
              .from('wallets')
              .select('xrpl_address')
              .eq('user_id', updatedEscrow.user_id)
              .single();

            if (senderWallet) {
              const senderBalances = await xrplWalletService.getAllBalances(senderWallet.xrpl_address);
              await adminClient
                .from('wallets')
                .update({
                  balance_xrp: senderBalances.xrp,
                  balance_usdt: senderBalances.usdt,
                  balance_usdc: senderBalances.usdc,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', updatedEscrow.user_id);
            }
          } catch (error) {
            console.error('Error updating sender wallet balance:', error);
          }

          // Update receiver's wallet balance
          if (updatedEscrow.counterparty_id) {
            try {
              const { data: receiverWallet } = await adminClient
                .from('wallets')
                .select('xrpl_address')
                .eq('user_id', updatedEscrow.counterparty_id)
                .single();

              if (receiverWallet) {
                const receiverBalances = await xrplWalletService.getAllBalances(receiverWallet.xrpl_address);
                await adminClient
                  .from('wallets')
                  .update({
                    balance_xrp: receiverBalances.xrp,
                    balance_usdt: receiverBalances.usdt,
                    balance_usdc: receiverBalances.usdc,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', updatedEscrow.counterparty_id);
              }
            } catch (error) {
              console.error('Error updating receiver wallet balance:', error);
            }
          }
        }

        // Format and return escrow
        const userIds = [updatedEscrow.user_id];
        if (updatedEscrow.counterparty_id) userIds.push(updatedEscrow.counterparty_id);
        const partyNames = await this.getPartyNames(userIds);
        const milestones = await this.getMilestones(updatedEscrow.id);
        const year = new Date(updatedEscrow.created_at).getFullYear();
        const formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);

        const formattedEscrow: Escrow = {
          id: updatedEscrow.id,
          escrowId: formattedEscrowId,
          userId: updatedEscrow.user_id,
          counterpartyId: updatedEscrow.counterparty_id || '',
          initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
          counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
          amount: {
            usd: parseFloat(updatedEscrow.amount_usd),
            xrp: parseFloat(updatedEscrow.amount_xrp),
          },
          status: updatedEscrow.status,
          transactionType: updatedEscrow.transaction_type as TransactionType,
          industry: updatedEscrow.industry || null,
          progress: 100,
          description: updatedEscrow.description || undefined,
          xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
          createdAt: updatedEscrow.created_at,
          updatedAt: updatedEscrow.updated_at,
          completedAt: updatedEscrow.completed_at || undefined,
          payerEmail: updatedEscrow.payer_email || undefined,
          payerName: updatedEscrow.payer_name || undefined,
          payerPhone: updatedEscrow.payer_phone || undefined,
          counterpartyEmail: updatedEscrow.counterparty_email || undefined,
          counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
          releaseType: updatedEscrow.release_type as ReleaseType | undefined,
          expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
          expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
          disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
          releaseConditions: updatedEscrow.release_conditions || undefined,
          milestones: milestones.length > 0 ? milestones : undefined,
        };

        return {
          success: true,
          message: 'Escrow released successfully',
          data: {
            signed: true,
            signedTxBlob: payloadStatus.response.hex,
            cancelled: false,
            expired: false,
            xrplTxHash: finishTxHash,
            escrow: formattedEscrow,
          },
        };
      }

      // Case 2: XUMM auto-submitted the transaction (already on XRPL)
      if (payloadStatus.meta.signed && payloadStatus.response?.txid && payloadStatus.meta.submit) {
        const finishTxHash = payloadStatus.response.txid;

        // Update transaction record
        await adminClient
          .from('transactions')
          .update({
            xrpl_tx_hash: finishTxHash,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id);

        // Update escrow status
        const { data: updatedEscrow } = await adminClient
          .from('escrows')
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', escrowId)
          .select()
          .single();

        // Format escrow (similar to above)
        if (updatedEscrow) {
          const userIds = [updatedEscrow.user_id];
          if (updatedEscrow.counterparty_id) userIds.push(updatedEscrow.counterparty_id);
          const partyNames = await this.getPartyNames(userIds);
          const milestones = await this.getMilestones(updatedEscrow.id);
          const year = new Date(updatedEscrow.created_at).getFullYear();
          const formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);

          const formattedEscrow: Escrow = {
            id: updatedEscrow.id,
            escrowId: formattedEscrowId,
            userId: updatedEscrow.user_id,
            counterpartyId: updatedEscrow.counterparty_id || '',
            initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
            counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
            amount: {
              usd: parseFloat(updatedEscrow.amount_usd),
              xrp: parseFloat(updatedEscrow.amount_xrp),
            },
            status: updatedEscrow.status,
            transactionType: updatedEscrow.transaction_type as TransactionType,
            industry: updatedEscrow.industry || null,
            progress: 100,
            description: updatedEscrow.description || undefined,
            xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
            createdAt: updatedEscrow.created_at,
            updatedAt: updatedEscrow.updated_at,
            completedAt: updatedEscrow.completed_at || undefined,
            payerEmail: updatedEscrow.payer_email || undefined,
            payerName: updatedEscrow.payer_name || undefined,
            payerPhone: updatedEscrow.payer_phone || undefined,
            counterpartyEmail: updatedEscrow.counterparty_email || undefined,
            counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
            releaseType: updatedEscrow.release_type as ReleaseType | undefined,
            expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
            expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
            disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
            releaseConditions: updatedEscrow.release_conditions || undefined,
            milestones: milestones.length > 0 ? milestones : undefined,
          };

          return {
            success: true,
            message: 'Escrow released successfully (auto-submitted by XUMM)',
            data: {
              signed: true,
              signedTxBlob: null,
              cancelled: false,
              expired: false,
              xrplTxHash: finishTxHash,
              escrow: formattedEscrow,
            },
          };
        }
      }

      // Transaction not yet signed
      return {
        success: true,
        message: 'Transaction status retrieved',
        data: {
          signed: payloadStatus.meta.signed,
          signedTxBlob: payloadStatus.response?.hex || null,
          cancelled: payloadStatus.meta.cancelled,
          expired: payloadStatus.meta.expired,
          xrplTxHash: payloadStatus.response?.txid || null,
        },
      };
    } catch (error) {
      console.error('Error getting escrow release XUMM status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get XUMM status',
        error: error instanceof Error ? error.message : 'Failed to get XUMM status',
      };
    }
  }

  /**
   * Get XUMM payload status for escrow creation and finalize on XRPL when signed
   * Mirrors wallet.getXUMMPayloadStatus but for EscrowCreate + escrow records
   */
  async getEscrowCreateXUMMStatus(
    userId: string,
    escrowId: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      signed: boolean;
      signedTxBlob: string | null;
      cancelled: boolean;
      expired: boolean;
      xrplTxHash: string | null;
      escrow?: Escrow;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow and verify user has permission
      const { data: escrow, error: fetchError } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (fetchError || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      // Find the pending escrow_create transaction
      const { data: transaction } = await adminClient
        .from('transactions')
        .select('*')
        .eq('escrow_id', escrowId)
        .eq('type', 'escrow_create')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!transaction) {
        return {
          success: false,
          message: 'No pending escrow create transaction found',
          error: 'No pending transaction',
        };
      }

      // Extract XUMM UUID from description
      const uuidMatch = transaction.description?.match(/XUMM_UUID:([a-f0-9-]+)/i);
      if (!uuidMatch) {
        return {
          success: false,
          message: 'XUMM UUID not found for this escrow creation',
          error: 'XUMM UUID not found',
        };
      }

      const xummUuid = uuidMatch[1];

      // Get payload status from XUMM
      const payloadStatus = await xummService.getPayloadStatus(xummUuid);

      // If not yet resolved, return current status
      if (!payloadStatus.meta.resolved) {
        return {
          success: true,
          message: 'Escrow creation pending user action in XUMM',
          data: {
            signed: payloadStatus.meta.signed,
            signedTxBlob: payloadStatus.response?.hex || null,
            cancelled: payloadStatus.meta.cancelled,
            expired: payloadStatus.meta.expired,
            xrplTxHash: payloadStatus.response?.txid || null,
            escrow: escrow as any,
          },
        };
      }

      // Handle cancelled or expired
      if (payloadStatus.meta.cancelled || payloadStatus.meta.expired) {
        // Mark transaction as cancelled
        await adminClient
          .from('transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id);

        return {
          success: true,
          message: payloadStatus.meta.cancelled
            ? 'Escrow creation cancelled in XUMM'
            : 'Escrow creation payload expired in XUMM',
          data: {
            signed: false,
            signedTxBlob: null,
            cancelled: payloadStatus.meta.cancelled,
            expired: payloadStatus.meta.expired,
            xrplTxHash: null,
            escrow: escrow as any,
          },
        };
      }

      // At this point, payload is resolved and signed or auto-submitted
      let xrplTxHash: string | null = null;

      // Case 1: Signed transaction blob needs submission
      if (payloadStatus.meta.signed && payloadStatus.response?.hex) {
        const submitResult = await xrplWalletService.submitSignedTransaction(
          payloadStatus.response.hex
        );

        if (submitResult.status !== 'tesSUCCESS') {
          return {
            success: false,
            message: `Escrow create transaction failed on XRPL: ${submitResult.status}`,
            error: 'XRPL transaction failed',
            data: {
              signed: true,
              signedTxBlob: payloadStatus.response.hex,
              cancelled: false,
              expired: false,
              xrplTxHash: submitResult.hash || null,
              escrow: escrow as any,
            },
          };
        }

        xrplTxHash = submitResult.hash;
      } else if (
        payloadStatus.meta.signed &&
        payloadStatus.meta.submit &&
        payloadStatus.response?.txid
      ) {
        // Case 2: XUMM auto-submitted the transaction (already on XRPL)
        xrplTxHash = payloadStatus.response.txid;
      } else {
        // Signed = false but resolved (e.g. user declined)
        await adminClient
          .from('transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id);

        return {
          success: true,
          message: 'Escrow creation not signed by user in XUMM',
          data: {
            signed: false,
            signedTxBlob: null,
            cancelled: true,
            expired: false,
            xrplTxHash: null,
            escrow: escrow as any,
          },
        };
      }

      // Finalize escrow in database: store real XRPL tx hash and mark active
      await adminClient
        .from('escrows')
        .update({
          xrpl_escrow_id: xrplTxHash,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', escrowId);

      await adminClient
        .from('transactions')
        .update({
          status: 'completed',
          xrpl_tx_hash: xrplTxHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      const { data: updatedEscrow } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .single();

      return {
        success: true,
        message: 'Escrow created successfully on XRPL',
        data: {
          signed: true,
          signedTxBlob: payloadStatus.response?.hex || null,
          cancelled: false,
          expired: false,
          xrplTxHash,
          escrow: updatedEscrow as any,
        },
      };
    } catch (error) {
      console.error('Error getting escrow create XUMM status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get escrow create XUMM status',
        error: error instanceof Error ? error.message : 'Failed to get escrow create XUMM status',
      };
    }
  }

  /**
   * Cancel an escrow
   */
  async cancelEscrow(userId: string, escrowId: string, reason: string): Promise<{
    success: boolean;
    message: string;
    data?: Escrow;
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrow and verify user has permission
      const { data: escrow, error: fetchError } = await adminClient
        .from('escrows')
        .select('*')
        .eq('id', escrowId)
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .single();

      if (fetchError || !escrow) {
        return {
          success: false,
          message: 'Escrow not found or access denied',
          error: 'Escrow not found or access denied',
        };
      }

      // Check if escrow can be cancelled
      if (escrow.status === 'completed') {
        return {
          success: false,
          message: 'Cannot cancel a completed escrow',
          error: 'Cannot cancel a completed escrow',
        };
      }

      if (escrow.status === 'cancelled') {
        return {
          success: false,
          message: 'Escrow is already cancelled',
          error: 'Escrow is already cancelled',
        };
      }

      // Get user's wallet for XRPL transaction
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();

      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found',
          error: 'Wallet not found',
        };
      }

      // Cancel escrow on XRPL (placeholder)
      let cancelTxHash: string | undefined;
      if (escrow.xrpl_escrow_id) {
        try {
          cancelTxHash = await xrplEscrowService.cancelEscrow({
            ownerAddress: wallet.xrpl_address,
            escrowSequence: 0, // This should be retrieved from XRPL
          });
        } catch (xrplError) {
          console.error('XRPL cancel escrow error:', xrplError);
          // Continue with database update even if XRPL call fails (for testing)
        }
      }

      // Update escrow in database
      const { data: updatedEscrow, error: updateError } = await adminClient
        .from('escrows')
        .update({
          status: 'cancelled',
          cancel_reason: reason,
        })
        .eq('id', escrowId)
        .select()
        .single();

      if (updateError || !updatedEscrow) {
        return {
          success: false,
          message: 'Failed to cancel escrow',
          error: 'Failed to cancel escrow',
        };
      }

      // Create transaction record
      await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'escrow_cancel',
          amount_xrp: parseFloat(updatedEscrow.amount_xrp),
          amount_usd: parseFloat(updatedEscrow.amount_usd),
          xrpl_tx_hash: cancelTxHash,
          status: 'completed',
          escrow_id: updatedEscrow.id,
          description: `Escrow cancelled: ${reason}`,
        });

      // Get party names and format response
      const userIds = [updatedEscrow.user_id];
      if (updatedEscrow.counterparty_id) userIds.push(updatedEscrow.counterparty_id);
      const partyNames = await this.getPartyNames(userIds);

      // Get milestones if this is a milestone-based escrow
      const milestones = await this.getMilestones(updatedEscrow.id);

      const year = new Date(updatedEscrow.created_at).getFullYear();
      const formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);

      const formattedEscrow: Escrow = {
        id: updatedEscrow.id,
        escrowId: formattedEscrowId,
        userId: updatedEscrow.user_id,
        counterpartyId: updatedEscrow.counterparty_id || '',
        initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
        counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
        amount: {
          usd: parseFloat(updatedEscrow.amount_usd),
          xrp: parseFloat(updatedEscrow.amount_xrp),
        },
        status: updatedEscrow.status,
        transactionType: updatedEscrow.transaction_type as TransactionType,
        industry: updatedEscrow.industry || null,
        progress: parseFloat(updatedEscrow.progress || 0),
        description: updatedEscrow.description || undefined,
        xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
        createdAt: updatedEscrow.created_at,
        updatedAt: updatedEscrow.updated_at,
        completedAt: updatedEscrow.completed_at || undefined,
        cancelReason: reason,
        // Contact information
        payerEmail: updatedEscrow.payer_email || undefined,
        payerName: updatedEscrow.payer_name || undefined,
        payerPhone: updatedEscrow.payer_phone || undefined,
        counterpartyEmail: updatedEscrow.counterparty_email || undefined,
        counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
        // Step 2: Terms and Release conditions
        releaseType: updatedEscrow.release_type as ReleaseType | undefined,
        expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
        expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
        disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
        releaseConditions: updatedEscrow.release_conditions || undefined,
        milestones: milestones.length > 0 ? milestones : undefined,
      };

      return {
        success: true,
        message: 'Escrow cancelled successfully',
        data: formattedEscrow,
      };
    } catch (error) {
      console.error('Error cancelling escrow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel escrow',
        error: error instanceof Error ? error.message : 'Failed to cancel escrow',
      };
    }
  }

  /**
   * Get unique industries, optionally filtered by transaction type
   */
  async getUniqueIndustries(userId: string, transactionType?: TransactionType): Promise<{
    success: boolean;
    message: string;
    data?: {
      industries: string[];
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Build query - only get industries from escrows user is involved in
      let query = adminClient
        .from('escrows')
        .select('industry')
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .not('industry', 'is', null);

      // Filter by transaction type if provided
      if (transactionType) {
        query = query.eq('transaction_type', transactionType);
      }

      const { data: escrows, error } = await query;

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch industries',
          error: 'Failed to fetch industries',
        };
      }

      // Get unique industries
      const industries: string[] = [...new Set((escrows || [])
        .map((e: any) => e.industry)
        .filter((ind: string | null | undefined): ind is string => ind !== null && ind !== undefined)
        .sort())] as string[];

      return {
        success: true,
        message: 'Industries retrieved successfully',
        data: {
          industries,
        },
      };
    } catch (error) {
      console.error('Error getting industries:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get industries',
        error: error instanceof Error ? error.message : 'Failed to get industries',
      };
    }
  }
}

export const escrowService = new EscrowService();




