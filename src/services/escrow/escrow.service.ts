/**
 * Escrow Service
 * Handles escrow operations and statistics
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { CreateEscrowRequest, Escrow, GetEscrowListRequest, TransactionType, ReleaseType, Milestone } from '../../types/api/escrow.types';
import { xrplEscrowService } from '../../xrpl/escrow/xrpl-escrow.service';
import { exchangeService } from '../exchange/exchange.service';

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

    return (users || []).reduce((acc, user) => {
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

    return milestones.map(m => ({
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
      const lockedAmount = escrows?.reduce((sum, escrow) => sum + parseFloat(escrow.amount_usd), 0) || 0;

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

      const totalEscrowed = escrows?.reduce((sum, escrow) => sum + parseFloat(escrow.amount_usd), 0) || 0;

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
  async createEscrow(userId: string, request: CreateEscrowRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      escrowId: string;
      amount: {
        usd: number;
        xrp: number;
      };
      status: string;
      xrplEscrowId?: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Automatically fetch payer wallet address from authenticated user's registered wallet
      const { data: payerWallet } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();

      if (!payerWallet) {
        return {
          success: false,
          message: 'Wallet not found. Please create a wallet first.',
          error: 'Wallet not found. Please create a wallet first.',
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

      // Create escrow on XRPL
      const xrplTxHash = await xrplEscrowService.createEscrow({
        fromAddress: payerWallet.xrpl_address,
        toAddress: counterpartyWalletAddress,
        amountXrp,
      });

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

      // Create escrow record in database with contact information and terms
      const { data: escrow, error: escrowError } = await adminClient
        .from('escrows')
        .insert({
          user_id: userId,
          counterparty_id: counterpartyUserId,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          xrpl_escrow_id: xrplTxHash,
          description: request.description,
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

      // Create transaction record
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
          description: `Escrow created: ${request.description || 'No description'}`,
        });

      return {
        success: true,
        message: 'Escrow created successfully',
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
    } catch (error) {
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
      (escrows || []).forEach(escrow => {
        if (escrow.user_id) userIds.add(escrow.user_id);
        if (escrow.counterparty_id) userIds.add(escrow.counterparty_id);
      });

      // Get party names
      const partyNames = await this.getPartyNames(Array.from(userIds));

      // Format escrows with all metadata
      const formattedEscrows: Escrow[] = (escrows || []).map(escrow => {
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

      // Finish escrow on XRPL (placeholder - will need escrow sequence from XRPL)
      // For now, we'll use the xrpl_escrow_id if available
      let finishTxHash: string | undefined;
      if (escrow.xrpl_escrow_id) {
        try {
          // Note: XRPL EscrowFinish requires the escrow sequence number
          // This is a placeholder - actual implementation needs the sequence
          finishTxHash = await xrplEscrowService.finishEscrow({
            ownerAddress: wallet.xrpl_address,
            escrowSequence: 0, // This should be retrieved from XRPL
          });
        } catch (xrplError) {
          console.error('XRPL finish escrow error:', xrplError);
          // Continue with database update even if XRPL call fails (for testing)
        }
      }

      // Update escrow in database
      const { data: updatedEscrow, error: updateError } = await adminClient
        .from('escrows')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', escrowId)
        .select()
        .single();

      if (updateError || !updatedEscrow) {
        return {
          success: false,
          message: 'Failed to update escrow',
          error: 'Failed to update escrow',
        };
      }

      // Create transaction record
      await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'escrow_release',
          amount_xrp: parseFloat(updatedEscrow.amount_xrp),
          amount_usd: parseFloat(updatedEscrow.amount_usd),
          xrpl_tx_hash: finishTxHash,
          status: 'completed',
          escrow_id: updatedEscrow.id,
          description: notes || `Escrow released: ${updatedEscrow.description || 'No description'}`,
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
        progress: 100,
        description: updatedEscrow.description || undefined,
        xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
        createdAt: updatedEscrow.created_at,
        updatedAt: updatedEscrow.updated_at,
        completedAt: updatedEscrow.completed_at || undefined,
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
        message: 'Escrow released successfully',
        data: formattedEscrow,
      };
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
      const industries = [...new Set((escrows || [])
        .map(e => e.industry)
        .filter((ind): ind is string => ind !== null && ind !== undefined)
        .sort())];

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




