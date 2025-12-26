/**
 * Dispute Service
 * Handles dispute statistics and listing for the dispute dashboard
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import {
  DisputeStatus,
  GetDisputeSummaryResponse,
  GetDisputesResponse,
  GetDisputeDetailResponse,
  DisputeListItem,
  CreateDisputeRequest,
  CreateDisputeResponse,
} from '../../types/api/dispute.types';
import { exchangeService } from '../exchange/exchange.service';

export class DisputeService {
  /**
   * Format dispute case ID as #DSP-YYYY-XXX
   */
  private formatDisputeId(year: number, sequence: number): string {
    return `#DSP-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Get party names (initiator and respondent) for disputes
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
   * Compute start and end of a month (UTC) from "YYYY-MM" or current month
   */
  private getMonthRange(month?: string): { start: Date; end: Date } {
    let year: number;
    let monthIndex: number; // 0-based

    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthIndex = (m || 1) - 1;
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIndex = now.getUTCMonth();
    }

    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Get previous month range for a given month
   */
  private getPreviousMonthRange(month?: string): { start: Date; end: Date } {
    let year: number;
    let monthIndex: number; // 0-based

    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthIndex = (m || 1) - 1;
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIndex = now.getUTCMonth();
    }

    // Move to previous month
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }

    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Get dispute summary metrics for the dashboard
   * GET /api/disputes/summary
   */
  async getSummary(userId: string, month?: string): Promise<GetDisputeSummaryResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end } = this.getMonthRange(month);
      const prevRange = this.getPreviousMonthRange(month);

      // Current period disputes (user is initiator or respondent)
      const { data: currentDisputes, error: currentError } = await adminClient
        .from('disputes')
        .select('status, opened_at, resolved_at')
        .or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`)
        .gte('opened_at', start.toISOString())
        .lte('opened_at', end.toISOString());

      // Previous period disputes for trend
      const { data: prevDisputes, error: prevError } = await adminClient
        .from('disputes')
        .select('status, opened_at, resolved_at')
        .or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`)
        .gte('opened_at', prevRange.start.toISOString())
        .lte('opened_at', prevRange.end.toISOString());

      if (currentError || prevError) {
        return {
          success: false,
          message: 'Failed to fetch dispute summary',
          error: 'Failed to fetch dispute summary',
        };
      }

      const computeMetrics = (rows: any[]) => {
        const total = rows.length;
        const active = rows.filter(d => d.status === 'pending' || d.status === 'active').length;
        const resolved = rows.filter(d => d.status === 'resolved').length;

        const resolvedRows = rows.filter(d => d.status === 'resolved' && d.resolved_at);
        let avgResolutionTimeSeconds = 0;
        if (resolvedRows.length > 0) {
          const totalSeconds = resolvedRows.reduce((sum, d) => {
            const opened = new Date(d.opened_at).getTime();
            const resolvedAt = new Date(d.resolved_at).getTime();
            return sum + Math.max(0, (resolvedAt - opened) / 1000);
          }, 0);
          avgResolutionTimeSeconds = totalSeconds / resolvedRows.length;
        }

        return { total, active, resolved, avgResolutionTimeSeconds };
      };

      const current = computeMetrics(currentDisputes || []);
      const previous = computeMetrics(prevDisputes || []);

      const percentChange = (currentValue: number, previousValue: number): number | undefined => {
        if (previousValue === 0) return undefined;
        return ((currentValue - previousValue) / previousValue) * 100;
      };

      return {
        success: true,
        message: 'Dispute summary retrieved successfully',
        data: {
          metrics: {
            totalDisputes: current.total,
            activeDisputes: current.active,
            resolvedDisputes: current.resolved,
            avgResolutionTimeSeconds: current.avgResolutionTimeSeconds,
            totalChangePercent: percentChange(current.total, previous.total),
            activeChangePercent: percentChange(current.active, previous.active),
            resolvedChangePercent: percentChange(current.resolved, previous.resolved),
            avgResolutionTimeChangePercent: percentChange(
              current.avgResolutionTimeSeconds,
              previous.avgResolutionTimeSeconds
            ),
          },
        },
      };
    } catch (error) {
      console.error('Error getting dispute summary:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get dispute summary',
        error: error instanceof Error ? error.message : 'Failed to get dispute summary',
      };
    }
  }

  /**
   * Get list of disputes for the table
   * GET /api/disputes
   */
  async getDisputes(params: {
    userId: string;
    status?: DisputeStatus | 'all';
    month?: string;
    page?: number;
    pageSize?: number;
  }): Promise<GetDisputesResponse> {
    const { userId, status = 'all', month, page = 1, pageSize = 10 } = params;

    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end } = this.getMonthRange(month);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = adminClient
        .from('disputes')
        .select('*')
        .or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`)
        .gte('opened_at', start.toISOString())
        .lte('opened_at', end.toISOString());

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      query = query.order('opened_at', { ascending: false }).range(from, to);

      const { data: disputes, error: listError } = await query;

      // Build count query separately (no .modify in Supabase client)
      let countQuery = adminClient
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`)
        .gte('opened_at', start.toISOString())
        .lte('opened_at', end.toISOString());

      if (status !== 'all') {
        countQuery = countQuery.eq('status', status);
      }

      const { count } = await countQuery;

      if (listError) {
        return {
          success: false,
          message: 'Failed to fetch disputes',
          error: 'Failed to fetch disputes',
        };
      }

      const rows = disputes || [];

      // Get party names
      const userIds = Array.from(
        new Set(
          rows.flatMap((d: any) => [d.initiator_user_id, d.respondent_user_id]).filter(Boolean)
        )
      );
      const partyNames = await this.getPartyNames(userIds);

      const now = new Date();

      const formatted: DisputeListItem[] = rows.map((d: any) => {
        const openedAt = new Date(d.opened_at);
        const endTime = d.resolved_at ? new Date(d.resolved_at) : now;
        const durationSeconds = Math.max(0, (endTime.getTime() - openedAt.getTime()) / 1000);

        return {
          id: d.id,
          caseId: d.case_id,
          initiatorName: partyNames[d.initiator_user_id] || 'Unknown',
          respondentName: partyNames[d.respondent_user_id] || 'Unknown',
          amount: {
            xrp: parseFloat(d.amount_xrp),
            usd: parseFloat(d.amount_usd),
          },
          status: d.status as DisputeStatus,
          reason: d.reason,
          openedAt: d.opened_at,
          resolvedAt: d.resolved_at || undefined,
          durationSeconds,
        };
      });

      return {
        success: true,
        message: 'Disputes retrieved successfully',
        data: {
          disputes: formatted,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting disputes:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get disputes',
        error: error instanceof Error ? error.message : 'Failed to get disputes',
      };
    }
  }

  /**
   * Get dispute detail by ID
   * GET /api/disputes/:id
   */
  async getDisputeById(userId: string, disputeId: string): Promise<GetDisputeDetailResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { data: dispute, error } = await adminClient
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`)
        .single();

      if (error || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      const userIds = [dispute.initiator_user_id, dispute.respondent_user_id].filter(Boolean);
      const partyNames = await this.getPartyNames(userIds);

      const openedAt = new Date(dispute.opened_at);
      const endTime = dispute.resolved_at ? new Date(dispute.resolved_at) : new Date();
      const durationSeconds = Math.max(0, (endTime.getTime() - openedAt.getTime()) / 1000);

      return {
        success: true,
        message: 'Dispute retrieved successfully',
        data: {
          id: dispute.id,
          caseId: dispute.case_id,
          initiatorName: partyNames[dispute.initiator_user_id] || 'Unknown',
          respondentName: partyNames[dispute.respondent_user_id] || 'Unknown',
          amount: {
            xrp: parseFloat(dispute.amount_xrp),
            usd: parseFloat(dispute.amount_usd),
          },
          status: dispute.status as DisputeStatus,
          reason: dispute.reason,
          openedAt: dispute.opened_at,
          resolvedAt: dispute.resolved_at || undefined,
          durationSeconds,
          description: dispute.description || undefined,
          cancelReason: dispute.cancel_reason || undefined,
          escrowId: dispute.escrow_id || undefined,
        },
      };
    } catch (error) {
      console.error('Error getting dispute detail:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get dispute',
        error: error instanceof Error ? error.message : 'Failed to get dispute',
      };
    }
  }

  /**
   * Create a new dispute
   * POST /api/disputes
   */
  async createDispute(userId: string, request: CreateDisputeRequest): Promise<CreateDisputeResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Validate required fields
      if (!request.escrowId) {
        return {
          success: false,
          message: 'Escrow ID is required',
          error: 'Escrow ID is required',
        };
      }

      if (!request.disputeCategory || !request.disputeReasonType) {
        return {
          success: false,
          message: 'Dispute category and reason type are required',
          error: 'Missing required fields',
        };
      }

      if (!request.payerXrpWalletAddress || !request.respondentXrpWalletAddress) {
        return {
          success: false,
          message: 'Both payer and respondent XRP wallet addresses are required',
          error: 'Wallet addresses required',
        };
      }

      if (!request.disputeReason || !request.description) {
        return {
          success: false,
          message: 'Dispute reason and description are required',
          error: 'Missing required fields',
        };
      }

      if (!request.amount || request.amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0',
          error: 'Invalid amount',
        };
      }

      // Validate escrow exists and user has access
      // Accept both UUID and formatted ID (#ESC-YYYY-XXX)
      // Trim whitespace and handle case variations
      const escrowIdInput = (request.escrowId || '').trim();
      
      console.log('[DEBUG] createDispute: Escrow ID validation', {
        original: request.escrowId,
        trimmed: escrowIdInput,
        length: escrowIdInput.length,
        firstChar: escrowIdInput[0],
        lastChar: escrowIdInput[escrowIdInput.length - 1],
      });
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(escrowIdInput);
      // More flexible regex - allow case variations and optional leading/trailing spaces
      const isFormattedId = /^#?ESC[-_]?\d{4}[-_]?\d{3}$/i.test(escrowIdInput) || /^#ESC-\d{4}-\d{3}$/i.test(escrowIdInput);
      
      let escrow;
      let escrowError;

      if (isUUID) {
        // Query by UUID
        console.log('[DEBUG] createDispute: Querying by UUID', { escrowId: escrowIdInput });
        const result = await adminClient
          .from('escrows')
          .select('id, user_id, counterparty_id, escrow_sequence, created_at')
          .eq('id', escrowIdInput)
          .single();
        
        escrow = result.data;
        escrowError = result.error;
      } else if (isFormattedId) {
        // Parse formatted ID: #ESC-YYYY-XXX (with various formats)
        console.log('[DEBUG] createDispute: Querying by formatted ID', { escrowId: escrowIdInput });
        
        // Try multiple patterns
        let match = escrowIdInput.match(/^#?ESC[-_]?(\d{4})[-_]?(\d{3})$/i);
        if (!match) {
          match = escrowIdInput.match(/^#ESC-(\d{4})-(\d{3})$/i);
        }
        
        if (match) {
          const year = parseInt(match[1], 10);
          const sequence = parseInt(match[2], 10);
          
          console.log('[DEBUG] createDispute: Parsed formatted ID', { year, sequence });
          
          // Query by year and sequence
          const yearStart = new Date(year, 0, 1).toISOString();
          const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();
          
          const result = await adminClient
            .from('escrows')
            .select('id, user_id, counterparty_id, escrow_sequence, created_at')
            .eq('escrow_sequence', sequence)
            .gte('created_at', yearStart)
            .lte('created_at', yearEnd)
            .single();
          
          escrow = result.data;
          escrowError = result.error;
          
          console.log('[DEBUG] createDispute: Formatted ID query result', {
            found: !!escrow,
            error: escrowError?.message,
          });
        } else {
          console.error('[DEBUG] createDispute: Failed to parse formatted ID', { escrowId: escrowIdInput });
          return {
            success: false,
            message: `Invalid escrow ID format: "${escrowIdInput}". Expected format: #ESC-YYYY-XXX or UUID`,
            error: 'Invalid escrow ID format',
          };
        }
      } else {
        console.error('[DEBUG] createDispute: Escrow ID does not match any format', {
          escrowId: escrowIdInput,
          isUUID,
          isFormattedId,
          charCodes: escrowIdInput.split('').map(c => c.charCodeAt(0)),
        });
        return {
          success: false,
          message: `Invalid escrow ID format: "${escrowIdInput}". Expected format: #ESC-YYYY-XXX or UUID`,
          error: 'Invalid escrow ID format',
        };
      }

      if (escrowError || !escrow) {
        console.error('Error fetching escrow:', {
          escrowId: request.escrowId,
          error: escrowError,
          isUUID,
          isFormattedId,
        });
        
        // Provide more helpful error message
        if (escrowError?.code === 'PGRST116') {
          return {
            success: false,
            message: 'Escrow not found. Please verify the escrow ID is correct.',
            error: 'Escrow not found',
          };
        }
        
        return {
          success: false,
          message: escrowError?.message || 'Escrow not found',
          error: escrowError?.message || 'Escrow not found',
        };
      }

      // Verify user is either the initiator or counterparty of the escrow
      if (escrow.user_id !== userId && escrow.counterparty_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this escrow',
          error: 'Access denied',
        };
      }

      // Look up payer (initiator) user by wallet address
      // The authenticated user is the initiator, but we validate the wallet address matches
      const { data: payerWallet, error: payerWalletError } = await adminClient
        .from('wallets')
        .select('user_id, xrpl_address')
        .eq('xrpl_address', request.payerXrpWalletAddress)
        .maybeSingle();

      if (payerWalletError || !payerWallet) {
        return {
          success: false,
          message: 'Payer wallet not found. The payer must have a registered wallet.',
          error: 'Payer wallet not found',
        };
      }

      // Verify the payer wallet belongs to the authenticated user
      if (payerWallet.user_id !== userId) {
        return {
          success: false,
          message: 'Payer wallet address does not match your registered wallet',
          error: 'Wallet address mismatch',
        };
      }

      // Look up respondent user by wallet address
      const { data: respondentWallet, error: respondentWalletError } = await adminClient
        .from('wallets')
        .select('user_id, xrpl_address')
        .eq('xrpl_address', request.respondentXrpWalletAddress)
        .maybeSingle();

      if (respondentWalletError || !respondentWallet) {
        return {
          success: false,
          message: 'Respondent wallet not found. The respondent must have a registered wallet.',
          error: 'Respondent wallet not found',
        };
      }

      const respondentUserId = respondentWallet.user_id;

      // Prevent creating dispute with yourself
      if (userId === respondentUserId) {
        return {
          success: false,
          message: 'You cannot create a dispute with yourself',
          error: 'Invalid dispute parties',
        };
      }

      // Convert amount to XRP and USD
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
      } else {
        // Currency is XRP, convert to USD
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
      }

      // Round to appropriate decimal places
      amountXrp = parseFloat(amountXrp.toFixed(6));
      amountUsd = parseFloat(amountUsd.toFixed(2));

      // Generate case ID
      const currentYear = new Date().getFullYear();
      const { data: lastDispute } = await adminClient
        .from('disputes')
        .select('case_id')
        .gte('created_at', new Date(currentYear, 0, 1).toISOString())
        .order('created_at', { ascending: false })
        .limit(100); // Get last 100 to find max sequence

      // Extract sequence numbers from case IDs
      let maxSequence = 0;
      if (lastDispute && lastDispute.length > 0) {
        for (const dispute of lastDispute) {
          const match = dispute.case_id.match(/^#DSP-\d{4}-(\d{3})$/);
          if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      }

      const nextSequence = maxSequence + 1;
      const caseId = this.formatDisputeId(currentYear, nextSequence);

      // Create dispute record
      const { data: dispute, error: disputeError } = await adminClient
        .from('disputes')
        .insert({
          case_id: caseId,
          escrow_id: request.escrowId,
          initiator_user_id: userId,
          respondent_user_id: respondentUserId,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          reason: request.disputeReason,
          description: request.description,
          dispute_category: request.disputeCategory,
          dispute_reason_type: request.disputeReasonType,
          payer_name: request.payerName || null,
          payer_email: request.payerEmail || null,
          payer_phone: request.payerPhone || null,
          respondent_name: request.respondentName || null,
          respondent_email: request.respondentEmail || null,
          respondent_phone: request.respondentPhone || null,
          resolution_period: request.resolutionPeriod || null,
          expected_resolution_date: request.expectedResolutionDate
            ? new Date(request.expectedResolutionDate).toISOString()
            : null,
          payer_xrp_wallet_address: request.payerXrpWalletAddress,
          respondent_xrp_wallet_address: request.respondentXrpWalletAddress,
        })
        .select()
        .single();

      if (disputeError || !dispute) {
        console.error('Failed to create dispute:', disputeError);
        return {
          success: false,
          message: 'Failed to create dispute record',
          error: 'Database error',
        };
      }

      // Create evidence records if provided
      if (request.evidence && request.evidence.length > 0) {
        const evidenceRecords = request.evidence.map((item) => ({
          dispute_id: dispute.id,
          file_url: item.fileUrl,
          file_name: item.fileName,
          file_type: item.fileType || null,
          file_size: item.fileSize || null,
          uploaded_by_user_id: userId,
        }));

        const { error: evidenceError } = await adminClient
          .from('dispute_evidence')
          .insert(evidenceRecords);

        if (evidenceError) {
          console.error('Failed to create evidence records:', evidenceError);
          // Don't fail the dispute creation if evidence fails, just log it
        }
      }

      return {
        success: true,
        message: 'Dispute created successfully',
        data: {
          disputeId: dispute.id,
          caseId: dispute.case_id,
        },
      };
    } catch (error) {
      console.error('Error creating dispute:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create dispute',
        error: error instanceof Error ? error.message : 'Failed to create dispute',
      };
    }
  }
}

export const disputeService = new DisputeService();


