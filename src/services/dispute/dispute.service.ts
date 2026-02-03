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
  EvidenceItem,
  AddEvidenceRequest,
  AddEvidenceResponse,
  GetEvidenceResponse,
  UpdateEvidenceRequest,
  UpdateEvidenceResponse,
  DeleteEvidenceResponse,
  TrackDisputeActivityResponse,
  GetDisputeActivityResponse,
  DisputeAssessment,
  CreateAssessmentRequest,
  CreateAssessmentResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
  GetAssessmentResponse,
  GetAssessmentsResponse,
  DeleteAssessmentResponse,
  AssessmentType,
  AssessmentStatus,
  TimelineEvent,
  CreateTimelineEventRequest,
  CreateTimelineEventResponse,
  GetTimelineEventsResponse,
  DeleteTimelineEventResponse,
  TimelineEventType,
  FinalVerdict,
  GetFinalVerdictResponse,
  AssignMediatorRequest,
  AssignMediatorResponse,
  SubmitFinalVerdictRequest,
  SubmitFinalVerdictResponse,
  UpdateVerdictStatusRequest,
  UpdateVerdictStatusResponse,
  VerdictStatus,
  DecisionOutcome,
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
    interface UserName {
      id: string;
      full_name: string;
    }

    const { data: users } = await adminClient
      .from('users')
      .select('id, full_name')
      .in('id', userIds);

    return (users || []).reduce<Record<string, string>>((acc: Record<string, string>, user: UserName) => {
      acc[user.id] = user.full_name;
      return acc;
    }, {});
  }

  /**
   * Look up dispute by UUID or case_id (#DSP-YYYY-XXX)
   */
  private async lookupDispute(disputeIdInput: string): Promise<{ data: any; error: any }> {
    const adminClient = supabaseAdmin || supabase;
    const disputeId = disputeIdInput.trim();

    // Check if it's a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(disputeId);
    
    if (isUUID) {
      // Query by UUID
      return await adminClient
        .from('disputes')
        .select('id, initiator_user_id, respondent_user_id, case_id')
        .eq('id', disputeId)
        .single();
    } else {
      // Query by case_id (e.g., #DSP-2025-001)
      return await adminClient
        .from('disputes')
        .select('id, initiator_user_id, respondent_user_id, case_id')
        .eq('case_id', disputeId)
        .single();
    }
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
      ).map(String) as string[];
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
      // Accept UUID, formatted ID (#ESC-YYYY-XXX), or XRPL escrow ID (#hexadecimal)
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
      // Formatted ID: #ESC-YYYY-XXX
      const isFormattedId = /^#?ESC[-_]?\d{4}[-_]?\d{3}$/i.test(escrowIdInput) || /^#ESC-\d{4}-\d{3}$/i.test(escrowIdInput);
      // XRPL escrow ID: #hexadecimal (e.g., #60A8AEC3)
      const isXrplEscrowId = /^#[0-9a-f]+$/i.test(escrowIdInput);
      
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
      } else if (isXrplEscrowId) {
        // Query by XRPL escrow ID (hexadecimal with # prefix, e.g., #60A8AEC3)
        console.log('[DEBUG] createDispute: Querying by XRPL escrow ID', { escrowId: escrowIdInput });
        // Remove the # prefix for database query
        const xrplId = escrowIdInput.startsWith('#') ? escrowIdInput.substring(1) : escrowIdInput;
        
        const result = await adminClient
          .from('escrows')
          .select('id, user_id, counterparty_id, escrow_sequence, created_at')
          .eq('xrpl_escrow_id', xrplId)
          .single();
        
        escrow = result.data;
        escrowError = result.error;
        
        console.log('[DEBUG] createDispute: XRPL escrow ID query result', {
          found: !!escrow,
          error: escrowError?.message,
        });
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
          isXrplEscrowId,
          charCodes: escrowIdInput.split('').map(c => c.charCodeAt(0)),
        });
        return {
          success: false,
          message: `Invalid escrow ID format: "${escrowIdInput}". Expected format: UUID, #ESC-YYYY-XXX, or #hexadecimal (XRPL escrow ID)`,
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

      // Create initial timeline event: "Dispute Filed"
      await this.createSystemTimelineEvent(
        dispute.id,
        'dispute_filed',
        'Dispute Filed',
        `Dispute ${dispute.case_id} has been filed`,
        {
          caseId: dispute.case_id,
          reason: request.disputeReason,
        }
      );

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

  /**
   * Add evidence to a dispute
   * POST /api/disputes/:disputeId/evidence
   */
  async addEvidence(
    userId: string,
    disputeId: string,
    request: AddEvidenceRequest
  ): Promise<AddEvidenceResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Validate required fields
      if (!request.title || !request.description || !request.evidenceType || !request.fileUrl) {
        return {
          success: false,
          message: 'Title, description, evidence type, and file URL are required',
          error: 'Missing required fields',
        };
      }

      console.log('[DEBUG] Adding evidence:', { 
        disputeId, 
        disputeDbId: dispute.id,
        caseId: dispute.case_id,
        userId, 
        title: request.title,
        description: request.description,
        evidenceType: request.evidenceType,
        fileUrl: request.fileUrl,
        fileName: request.fileName
      });

      // Insert evidence record - use dispute.id from the database query, not the parameter
      const insertData = {
        dispute_id: dispute.id, // Use the actual dispute ID from database
        title: request.title,
        description: request.description,
        evidence_type: request.evidenceType,
        file_url: request.fileUrl,
        file_name: request.fileName,
        file_type: request.fileType,
        file_size: request.fileSize,
        uploaded_by_user_id: userId,
        verified: false,
      };

      console.log('[DEBUG] Inserting evidence with data:', {
        dispute_id: insertData.dispute_id,
        title: insertData.title,
        evidence_type: insertData.evidence_type,
        file_name: insertData.file_name
      });

      const { data: evidence, error: evidenceError } = await adminClient
        .from('dispute_evidence')
        .insert(insertData)
        .select()
        .single();

      if (evidenceError || !evidence) {
        console.error('[DEBUG] Failed to add evidence:', { 
          evidenceError, 
          disputeId, 
          disputeDbId: dispute.id,
          insertData 
        });
        return {
          success: false,
          message: 'Failed to add evidence',
          error: 'Database error',
        };
      }

      console.log('[DEBUG] Evidence inserted successfully:', { 
        evidenceId: evidence.id, 
        disputeId: evidence.dispute_id,
        expectedDisputeId: dispute.id,
        match: evidence.dispute_id === dispute.id
      });

      // Post-insert verification: verify it was actually saved with correct dispute_id
      const { data: verifyEvidence, error: verifyError } = await adminClient
        .from('dispute_evidence')
        .select('*')
        .eq('id', evidence.id)
        .single();

      if (verifyError || !verifyEvidence) {
        console.error('[DEBUG] Verification query failed after insert:', { 
          verifyError, 
          evidenceId: evidence.id 
        });
      } else {
        console.log('[DEBUG] Verification query after insert:', {
          found: !!verifyEvidence,
          dispute_id_in_db: verifyEvidence.dispute_id,
          expected_dispute_id: dispute.id,
          match: verifyEvidence.dispute_id === dispute.id,
          title: verifyEvidence.title,
          evidence_type: verifyEvidence.evidence_type
        });
      }

      return {
        success: true,
        message: 'Evidence added successfully',
        data: {
          id: evidence.id,
          disputeId: evidence.dispute_id,
          title: evidence.title,
          description: evidence.description || '',
          evidenceType: evidence.evidence_type as any,
          fileUrl: evidence.file_url,
          fileName: evidence.file_name,
          fileType: evidence.file_type || '',
          fileSize: evidence.file_size || 0,
          verified: evidence.verified || false,
          uploadedAt: evidence.uploaded_at,
          uploadedByUserId: evidence.uploaded_by_user_id || '',
        },
      };
    } catch (error) {
      console.error('Error adding evidence:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add evidence',
        error: error instanceof Error ? error.message : 'Failed to add evidence',
      };
    }
  }

  /**
   * Get all evidence for a dispute
   * GET /api/disputes/:disputeId/evidence
   */
  async getEvidence(userId: string, disputeId: string): Promise<GetEvidenceResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      console.log('[DEBUG] getEvidence called', { userId, disputeId });

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        console.error('[DEBUG] Dispute not found or error:', { disputeError, disputeId });
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      console.log('[DEBUG] Dispute found:', { 
        disputeId: dispute.id, 
        caseId: dispute.case_id,
        originalInput: disputeId,
        initiator: dispute.initiator_user_id, 
        respondent: dispute.respondent_user_id 
      });

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        console.error('[DEBUG] User not a party to dispute:', { userId, initiator: dispute.initiator_user_id, respondent: dispute.respondent_user_id });
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get all evidence for the dispute - use dispute.id from database query
      console.log('[DEBUG] Querying evidence with dispute.id:', { 
        disputeDbId: dispute.id, 
        originalDisputeId: disputeId,
        caseId: dispute.case_id,
        userId
      });

      // First, get a count of all evidence for this dispute
      const { count: totalCount, error: countError } = await adminClient
        .from('dispute_evidence')
        .select('*', { count: 'exact', head: true })
        .eq('dispute_id', dispute.id);

      if (countError) {
        console.error('[DEBUG] Failed to get evidence count:', { 
          countError, 
          disputeDbId: dispute.id 
        });
      } else {
        console.log('[DEBUG] Total evidence count for dispute:', {
          disputeDbId: dispute.id,
          totalCount: totalCount || 0
        });
      }
      
      // Get all evidence records
      const { data: evidenceList, error: evidenceError } = await adminClient
        .from('dispute_evidence')
        .select('*')
        .eq('dispute_id', dispute.id) // Use the actual dispute ID from database
        .order('uploaded_at', { ascending: false });

      if (evidenceError) {
        console.error('[DEBUG] Failed to fetch evidence:', { 
          evidenceError, 
          disputeId,
          disputeDbId: dispute.id,
          errorDetails: evidenceError 
        });
        return {
          success: false,
          message: 'Failed to fetch evidence',
          error: 'Database error',
        };
      }

      const returnedCount = evidenceList?.length || 0;
      console.log('[DEBUG] Evidence query result:', { 
        returnedCount,
        totalCount: totalCount || 0,
        match: returnedCount === (totalCount || 0),
        disputeId,
        disputeDbId: dispute.id,
        caseId: dispute.case_id,
        evidenceList: evidenceList?.map((e: any) => ({ 
          id: e.id, 
          dispute_id: e.dispute_id,
          dispute_id_match: e.dispute_id === dispute.id,
          title: e.title,
          fileName: e.file_name,
          evidence_type: e.evidence_type,
          uploadedAt: e.uploaded_at
        }))
      });

      // Log any mismatch between count and returned records
      if (returnedCount !== (totalCount || 0)) {
        console.warn('[DEBUG] WARNING: Count mismatch detected!', {
          totalCount: totalCount || 0,
          returnedCount,
          disputeDbId: dispute.id
        });
      }

      const evidence: EvidenceItem[] = (evidenceList || []).map((e: any) => ({
        id: e.id,
        disputeId: e.dispute_id,
        title: e.title || '',
        description: e.description || '',
        evidenceType: e.evidence_type as any,
        fileUrl: e.file_url,
        fileName: e.file_name,
        fileType: e.file_type || '',
        fileSize: e.file_size || 0,
        verified: e.verified || false,
        uploadedAt: e.uploaded_at,
        uploadedByUserId: e.uploaded_by_user_id || '',
      }));

      return {
        success: true,
        message: 'Evidence retrieved successfully',
        data: {
          evidence,
          disputeDbId: dispute.id, // For debugging - the actual UUID used in database
          totalCount: totalCount || 0, // Total number of evidence items found
        },
      };
    } catch (error) {
      console.error('[DEBUG] Error getting evidence:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get evidence',
        error: error instanceof Error ? error.message : 'Failed to get evidence',
      };
    }
  }

  /**
   * Update evidence metadata
   * PUT /api/disputes/:disputeId/evidence/:evidenceId
   */
  async updateEvidence(
    userId: string,
    disputeId: string,
    evidenceId: string,
    request: UpdateEvidenceRequest
  ): Promise<UpdateEvidenceResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Verify evidence exists and belongs to the dispute
      const { data: existingEvidence, error: evidenceError } = await adminClient
        .from('dispute_evidence')
        .select('*')
        .eq('id', evidenceId)
        .eq('dispute_id', dispute.id) // Use the actual dispute ID from database
        .single();

      if (evidenceError || !existingEvidence) {
        return {
          success: false,
          message: 'Evidence not found',
          error: 'Evidence not found',
        };
      }

      // Verify user uploaded the evidence (only the uploader can update)
      if (existingEvidence.uploaded_by_user_id !== userId) {
        return {
          success: false,
          message: 'You can only update evidence you uploaded',
          error: 'Access denied',
        };
      }

      // Build update object
      const updateData: any = {};
      if (request.title !== undefined) updateData.title = request.title;
      if (request.description !== undefined) updateData.description = request.description;
      if (request.evidenceType !== undefined) updateData.evidence_type = request.evidenceType;

      // Update evidence
      const { data: updatedEvidence, error: updateError } = await adminClient
        .from('dispute_evidence')
        .update(updateData)
        .eq('id', evidenceId)
        .select()
        .single();

      if (updateError || !updatedEvidence) {
        console.error('Failed to update evidence:', updateError);
        return {
          success: false,
          message: 'Failed to update evidence',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'Evidence updated successfully',
        data: {
          id: updatedEvidence.id,
          disputeId: updatedEvidence.dispute_id,
          title: updatedEvidence.title || '',
          description: updatedEvidence.description || '',
          evidenceType: updatedEvidence.evidence_type as any,
          fileUrl: updatedEvidence.file_url,
          fileName: updatedEvidence.file_name,
          fileType: updatedEvidence.file_type || '',
          fileSize: updatedEvidence.file_size || 0,
          verified: updatedEvidence.verified || false,
          uploadedAt: updatedEvidence.uploaded_at,
          uploadedByUserId: updatedEvidence.uploaded_by_user_id || '',
        },
      };
    } catch (error) {
      console.error('Error updating evidence:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update evidence',
        error: error instanceof Error ? error.message : 'Failed to update evidence',
      };
    }
  }

  /**
   * Delete evidence
   * DELETE /api/disputes/:disputeId/evidence/:evidenceId
   */
  async deleteEvidence(
    userId: string,
    disputeId: string,
    evidenceId: string
  ): Promise<DeleteEvidenceResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Verify evidence exists and belongs to the dispute
      const { data: existingEvidence, error: evidenceError } = await adminClient
        .from('dispute_evidence')
        .select('*')
        .eq('id', evidenceId)
        .eq('dispute_id', dispute.id) // Use the actual dispute ID from database
        .single();

      if (evidenceError || !existingEvidence) {
        return {
          success: false,
          message: 'Evidence not found',
          error: 'Evidence not found',
        };
      }

      // Verify user uploaded the evidence (only the uploader can delete)
      if (existingEvidence.uploaded_by_user_id !== userId) {
        return {
          success: false,
          message: 'You can only delete evidence you uploaded',
          error: 'Access denied',
        };
      }

      // Delete evidence
      const { error: deleteError } = await adminClient
        .from('dispute_evidence')
        .delete()
        .eq('id', evidenceId);

      if (deleteError) {
        console.error('Failed to delete evidence:', deleteError);
        return {
          success: false,
          message: 'Failed to delete evidence',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'Evidence deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting evidence:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete evidence',
        error: error instanceof Error ? error.message : 'Failed to delete evidence',
      };
    }
  }

  /**
   * Track user activity on dispute page
   * POST /api/disputes/:disputeId/activity
   * This allows the backend to determine if a user is still on the dispute page
   */
  async trackActivity(userId: string, disputeId: string): Promise<TrackDisputeActivityResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Upsert activity record (insert or update if exists)
      const now = new Date().toISOString();
      const { data: activity, error: activityError } = await adminClient
        .from('dispute_activity')
        .upsert(
          {
            dispute_id: dispute.id,
            user_id: userId,
            last_viewed_at: now,
            is_active: true,
            updated_at: now,
          },
          {
            onConflict: 'dispute_id,user_id',
          }
        )
        .select()
        .single();

      if (activityError) {
        console.error('Error tracking dispute activity:', activityError);
        return {
          success: false,
          message: 'Failed to track activity',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'Activity tracked successfully',
        data: {
          isActive: activity.is_active,
          lastViewedAt: activity.last_viewed_at,
          disputeId: dispute.id,
        },
      };
    } catch (error) {
      console.error('Error tracking dispute activity:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to track activity',
        error: error instanceof Error ? error.message : 'Failed to track activity',
      };
    }
  }

  /**
   * Get activity status for a dispute
   * GET /api/disputes/:disputeId/activity
   * Returns which users are currently active on the dispute page
   */
  async getActivity(userId: string, disputeId: string): Promise<GetDisputeActivityResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get all activity records for this dispute
      // Consider users active if they've viewed within the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: activities, error: activitiesError } = await adminClient
        .from('dispute_activity')
        .select('user_id, last_viewed_at, is_active')
        .eq('dispute_id', dispute.id)
        .gte('last_viewed_at', fiveMinutesAgo)
        .eq('is_active', true);

      if (activitiesError) {
        console.error('Error fetching dispute activity:', activitiesError);
        return {
          success: false,
          message: 'Failed to fetch activity',
          error: 'Database error',
        };
      }

      // Get user names for active users
      const activeUserIds = (activities || [])
        .map((a: any) => a.user_id)
        .filter((id: string) => id !== userId); // Exclude current user

      const partyNames = await this.getPartyNames(
        activeUserIds.length > 0 ? activeUserIds : []
      );

      // Get current user's activity
      const { data: currentUserActivity } = await adminClient
        .from('dispute_activity')
        .select('last_viewed_at, is_active')
        .eq('dispute_id', dispute.id)
        .eq('user_id', userId)
        .single();

      const activeUsers = (activities || [])
        .filter((a: any) => a.user_id !== userId)
        .map((a: any) => ({
          userId: a.user_id,
          userName: partyNames[a.user_id] || 'Unknown',
          lastViewedAt: a.last_viewed_at,
          isActive: a.is_active,
        }));

      return {
        success: true,
        message: 'Activity retrieved successfully',
        data: {
          activeUsers,
          currentUserActive: currentUserActivity?.is_active || false,
          currentUserLastViewed: currentUserActivity?.last_viewed_at || undefined,
        },
      };
    } catch (error) {
      console.error('Error getting dispute activity:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get activity',
        error: error instanceof Error ? error.message : 'Failed to get activity',
      };
    }
  }

  /**
   * Create a new assessment for a dispute
   * POST /api/disputes/:disputeId/assessments
   */
  async createAssessment(
    userId: string,
    disputeId: string,
    request: CreateAssessmentRequest
  ): Promise<CreateAssessmentResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access - support both UUID and case_id
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Validate required fields
      if (!request.findings || request.findings.length === 0) {
        return {
          success: false,
          message: 'At least one finding is required',
          error: 'Missing required fields',
        };
      }

      // Create assessment record
      const assessmentData = {
        dispute_id: dispute.id,
        created_by_user_id: userId,
        assessment_type: (request.assessmentType || 'preliminary') as AssessmentType,
        title: request.title || 'Preliminary Assessment',
        summary: request.summary || null,
        status: 'draft' as AssessmentStatus,
      };

      const { data: assessment, error: assessmentError } = await adminClient
        .from('dispute_assessments')
        .insert(assessmentData)
        .select()
        .single();

      if (assessmentError || !assessment) {
        console.error('Error creating assessment:', assessmentError);
        return {
          success: false,
          message: 'Failed to create assessment',
          error: 'Database error',
        };
      }

      // Create findings
      const findingsData = request.findings.map((finding, index) => ({
        assessment_id: assessment.id,
        finding_text: finding.findingText,
        finding_type: finding.findingType || null,
        order_index: finding.orderIndex !== undefined ? finding.orderIndex : index,
      }));

      const { data: findings, error: findingsError } = await adminClient
        .from('dispute_assessment_findings')
        .insert(findingsData)
        .select();

      if (findingsError) {
        console.error('Error creating findings:', findingsError);
        // Rollback assessment if findings fail
        await adminClient.from('dispute_assessments').delete().eq('id', assessment.id);
        return {
          success: false,
          message: 'Failed to create findings',
          error: 'Database error',
        };
      }

      // Get creator name
      const userIds = [userId];
      const partyNames = await this.getPartyNames(userIds);

      const formattedAssessment: DisputeAssessment = {
        id: assessment.id,
        disputeId: dispute.id,
        createdByUserId: userId,
        createdByName: partyNames[userId] || 'Unknown',
        assessmentType: assessment.assessment_type as AssessmentType,
        title: assessment.title,
        summary: assessment.summary || undefined,
        status: assessment.status as AssessmentStatus,
        findings: (findings || []).map((f: any) => ({
          id: f.id,
          findingText: f.finding_text,
          findingType: f.finding_type as any,
          orderIndex: f.order_index,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
        createdAt: assessment.created_at,
        updatedAt: assessment.updated_at,
        publishedAt: assessment.published_at || undefined,
      };

      return {
        success: true,
        message: 'Assessment created successfully',
        data: {
          assessmentId: assessment.id,
          assessment: formattedAssessment,
        },
      };
    } catch (error) {
      console.error('Error creating assessment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create assessment',
        error: error instanceof Error ? error.message : 'Failed to create assessment',
      };
    }
  }

  /**
   * Get assessment by ID
   * GET /api/disputes/:disputeId/assessments/:assessmentId
   */
  async getAssessmentById(
    userId: string,
    disputeId: string,
    assessmentId: string
  ): Promise<GetAssessmentResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get assessment
      const { data: assessment, error: assessmentError } = await adminClient
        .from('dispute_assessments')
        .select('*')
        .eq('id', assessmentId)
        .eq('dispute_id', dispute.id)
        .single();

      if (assessmentError || !assessment) {
        return {
          success: false,
          message: 'Assessment not found',
          error: 'Assessment not found',
        };
      }

      // Get findings
      const { data: findings, error: findingsError } = await adminClient
        .from('dispute_assessment_findings')
        .select('*')
        .eq('assessment_id', assessment.id)
        .order('order_index', { ascending: true });

      if (findingsError) {
        console.error('Error fetching findings:', findingsError);
      }

      // Get creator name
      const userIds = [assessment.created_by_user_id];
      const partyNames = await this.getPartyNames(userIds);

      const formattedAssessment: DisputeAssessment = {
        id: assessment.id,
        disputeId: assessment.dispute_id,
        createdByUserId: assessment.created_by_user_id,
        createdByName: partyNames[assessment.created_by_user_id] || 'Unknown',
        assessmentType: assessment.assessment_type as AssessmentType,
        title: assessment.title,
        summary: assessment.summary || undefined,
        status: assessment.status as AssessmentStatus,
        findings: (findings || []).map((f: any) => ({
          id: f.id,
          findingText: f.finding_text,
          findingType: f.finding_type as any,
          orderIndex: f.order_index,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
        createdAt: assessment.created_at,
        updatedAt: assessment.updated_at,
        publishedAt: assessment.published_at || undefined,
      };

      return {
        success: true,
        message: 'Assessment retrieved successfully',
        data: formattedAssessment,
      };
    } catch (error) {
      console.error('Error getting assessment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get assessment',
        error: error instanceof Error ? error.message : 'Failed to get assessment',
      };
    }
  }

  /**
   * Get all assessments for a dispute
   * GET /api/disputes/:disputeId/assessments
   */
  async getAssessments(userId: string, disputeId: string): Promise<GetAssessmentsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get all assessments (only published for regular users, all for admins)
      const { data: assessments, error: assessmentsError } = await adminClient
        .from('dispute_assessments')
        .select('*')
        .eq('dispute_id', dispute.id)
        .order('created_at', { ascending: false });

      if (assessmentsError) {
        console.error('Error fetching assessments:', assessmentsError);
        return {
          success: false,
          message: 'Failed to fetch assessments',
          error: 'Database error',
        };
      }

      // Get all findings for all assessments
      const assessmentIds = (assessments || []).map((a: any) => a.id);
      const { data: allFindings, error: findingsError } = await adminClient
        .from('dispute_assessment_findings')
        .select('*')
        .in('assessment_id', assessmentIds)
        .order('order_index', { ascending: true });

      if (findingsError) {
        console.error('Error fetching findings:', findingsError);
      }

      // Group findings by assessment
      const findingsByAssessment = (allFindings || []).reduce((acc: any, f: any) => {
        if (!acc[f.assessment_id]) {
          acc[f.assessment_id] = [];
        }
        acc[f.assessment_id].push(f);
        return acc;
      }, {});

      // Get creator names
      const creatorIds = Array.from(
        new Set((assessments || []).map((a: any) => a.created_by_user_id))
      );
      const partyNames = await this.getPartyNames(creatorIds);

      const formattedAssessments: DisputeAssessment[] = (assessments || []).map((a: any) => ({
        id: a.id,
        disputeId: a.dispute_id,
        createdByUserId: a.created_by_user_id,
        createdByName: partyNames[a.created_by_user_id] || 'Unknown',
        assessmentType: a.assessment_type as AssessmentType,
        title: a.title,
        summary: a.summary || undefined,
        status: a.status as AssessmentStatus,
        findings: (findingsByAssessment[a.id] || []).map((f: any) => ({
          id: f.id,
          findingText: f.finding_text,
          findingType: f.finding_type as any,
          orderIndex: f.order_index,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        publishedAt: a.published_at || undefined,
      }));

      return {
        success: true,
        message: 'Assessments retrieved successfully',
        data: {
          assessments: formattedAssessments,
          total: formattedAssessments.length,
        },
      };
    } catch (error) {
      console.error('Error getting assessments:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get assessments',
        error: error instanceof Error ? error.message : 'Failed to get assessments',
      };
    }
  }

  /**
   * Update an assessment
   * PUT /api/disputes/:disputeId/assessments/:assessmentId
   */
  async updateAssessment(
    userId: string,
    disputeId: string,
    assessmentId: string,
    request: UpdateAssessmentRequest
  ): Promise<UpdateAssessmentResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify assessment exists and belongs to dispute
      const { data: assessment, error: assessmentError } = await adminClient
        .from('dispute_assessments')
        .select('*')
        .eq('id', assessmentId)
        .eq('dispute_id', dispute.id)
        .single();

      if (assessmentError || !assessment) {
        return {
          success: false,
          message: 'Assessment not found',
          error: 'Assessment not found',
        };
      }

      // Verify user created the assessment (or is admin)
      if (assessment.created_by_user_id !== userId) {
        return {
          success: false,
          message: 'You can only update assessments you created',
          error: 'Access denied',
        };
      }

      // Build update object
      const updateData: any = {};
      if (request.title !== undefined) updateData.title = request.title;
      if (request.summary !== undefined) updateData.summary = request.summary;
      if (request.status !== undefined) {
        updateData.status = request.status;
        if (request.status === 'published' && !assessment.published_at) {
          updateData.published_at = new Date().toISOString();
        }
      }

      // Update assessment
      const { data: updatedAssessment, error: updateError } = await adminClient
        .from('dispute_assessments')
        .update(updateData)
        .eq('id', assessmentId)
        .select()
        .single();

      if (updateError || !updatedAssessment) {
        console.error('Error updating assessment:', updateError);
        return {
          success: false,
          message: 'Failed to update assessment',
          error: 'Database error',
        };
      }

      // Update findings if provided
      if (request.findings !== undefined) {
        // Delete existing findings
        await adminClient
          .from('dispute_assessment_findings')
          .delete()
          .eq('assessment_id', assessmentId);

        // Insert new findings
        if (request.findings.length > 0) {
          const findingsData = request.findings.map((finding, index) => ({
            assessment_id: assessmentId,
            finding_text: finding.findingText,
            finding_type: finding.findingType || null,
            order_index: finding.orderIndex !== undefined ? finding.orderIndex : index,
          }));

          const { error: findingsError } = await adminClient
            .from('dispute_assessment_findings')
            .insert(findingsData);

          if (findingsError) {
            console.error('Error updating findings:', findingsError);
            return {
              success: false,
              message: 'Failed to update findings',
              error: 'Database error',
            };
          }
        }
      }

      // Get updated assessment with findings
      const { data: findings } = await adminClient
        .from('dispute_assessment_findings')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index', { ascending: true });

      // Get creator name
      const userIds = [updatedAssessment.created_by_user_id];
      const partyNames = await this.getPartyNames(userIds);

      const formattedAssessment: DisputeAssessment = {
        id: updatedAssessment.id,
        disputeId: updatedAssessment.dispute_id,
        createdByUserId: updatedAssessment.created_by_user_id,
        createdByName: partyNames[updatedAssessment.created_by_user_id] || 'Unknown',
        assessmentType: updatedAssessment.assessment_type as AssessmentType,
        title: updatedAssessment.title,
        summary: updatedAssessment.summary || undefined,
        status: updatedAssessment.status as AssessmentStatus,
        findings: (findings || []).map((f: any) => ({
          id: f.id,
          findingText: f.finding_text,
          findingType: f.finding_type as any,
          orderIndex: f.order_index,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
        createdAt: updatedAssessment.created_at,
        updatedAt: updatedAssessment.updated_at,
        publishedAt: updatedAssessment.published_at || undefined,
      };

      return {
        success: true,
        message: 'Assessment updated successfully',
        data: formattedAssessment,
      };
    } catch (error) {
      console.error('Error updating assessment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update assessment',
        error: error instanceof Error ? error.message : 'Failed to update assessment',
      };
    }
  }

  /**
   * Delete an assessment
   * DELETE /api/disputes/:disputeId/assessments/:assessmentId
   */
  async deleteAssessment(
    userId: string,
    disputeId: string,
    assessmentId: string
  ): Promise<DeleteAssessmentResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify assessment exists and belongs to dispute
      const { data: assessment, error: assessmentError } = await adminClient
        .from('dispute_assessments')
        .select('*')
        .eq('id', assessmentId)
        .eq('dispute_id', dispute.id)
        .single();

      if (assessmentError || !assessment) {
        return {
          success: false,
          message: 'Assessment not found',
          error: 'Assessment not found',
        };
      }

      // Verify user created the assessment (or is admin)
      if (assessment.created_by_user_id !== userId) {
        return {
          success: false,
          message: 'You can only delete assessments you created',
          error: 'Access denied',
        };
      }

      // Delete assessment (findings will be cascade deleted)
      const { error: deleteError } = await adminClient
        .from('dispute_assessments')
        .delete()
        .eq('id', assessmentId);

      if (deleteError) {
        console.error('Error deleting assessment:', deleteError);
        return {
          success: false,
          message: 'Failed to delete assessment',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'Assessment deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting assessment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete assessment',
        error: error instanceof Error ? error.message : 'Failed to delete assessment',
      };
    }
  }

  /**
   * Create a timeline event (manual entry by user/admin)
   * POST /api/disputes/:disputeId/timeline
   */
  async createTimelineEvent(
    userId: string,
    disputeId: string,
    request: CreateTimelineEventRequest
  ): Promise<CreateTimelineEventResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Validate required fields
      if (!request.eventType || !request.title) {
        return {
          success: false,
          message: 'Event type and title are required',
          error: 'Missing required fields',
        };
      }

      // Create timeline event
      const eventData = {
        dispute_id: dispute.id,
        event_type: request.eventType,
        title: request.title,
        description: request.description || null,
        created_by_user_id: userId,
        is_system_event: false, // Manual entry
        metadata: request.metadata || null,
        event_timestamp: request.eventTimestamp 
          ? new Date(request.eventTimestamp).toISOString()
          : new Date().toISOString(),
      };

      const { data: event, error: eventError } = await adminClient
        .from('dispute_timeline_events')
        .insert(eventData)
        .select()
        .single();

      if (eventError || !event) {
        console.error('Error creating timeline event:', eventError);
        return {
          success: false,
          message: 'Failed to create timeline event',
          error: 'Database error',
        };
      }

      // Get creator name
      const userIds = [userId];
      const partyNames = await this.getPartyNames(userIds);

      const formattedEvent: TimelineEvent = {
        id: event.id,
        disputeId: event.dispute_id,
        eventType: event.event_type as TimelineEventType,
        title: event.title,
        description: event.description || undefined,
        createdByUserId: event.created_by_user_id || undefined,
        createdByName: partyNames[userId] || undefined,
        isSystemEvent: event.is_system_event,
        metadata: event.metadata || undefined,
        eventTimestamp: event.event_timestamp,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      };

      return {
        success: true,
        message: 'Timeline event created successfully',
        data: formattedEvent,
      };
    } catch (error) {
      console.error('Error creating timeline event:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create timeline event',
        error: error instanceof Error ? error.message : 'Failed to create timeline event',
      };
    }
  }

  /**
   * Create a system-generated timeline event (internal use)
   * This is used by the service to automatically track events
   */
  async createSystemTimelineEvent(
    disputeId: string,
    eventType: TimelineEventType,
    title: string,
    description?: string,
    metadata?: Record<string, any>,
    eventTimestamp?: string
  ): Promise<void> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const eventData = {
        dispute_id: disputeId,
        event_type: eventType,
        title,
        description: description || null,
        created_by_user_id: null, // System event
        is_system_event: true,
        metadata: metadata || null,
        event_timestamp: eventTimestamp || new Date().toISOString(),
      };

      await adminClient
        .from('dispute_timeline_events')
        .insert(eventData);
    } catch (error) {
      console.error('Error creating system timeline event:', error);
      // Don't throw - system events shouldn't break the main flow
    }
  }

  /**
   * Get timeline events for a dispute
   * GET /api/disputes/:disputeId/timeline
   */
  async getTimelineEvents(userId: string, disputeId: string): Promise<GetTimelineEventsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get all timeline events, ordered by timestamp (most recent first)
      const { data: events, error: eventsError } = await adminClient
        .from('dispute_timeline_events')
        .select('*')
        .eq('dispute_id', dispute.id)
        .order('event_timestamp', { ascending: false });

      if (eventsError) {
        console.error('Error fetching timeline events:', eventsError);
        return {
          success: false,
          message: 'Failed to fetch timeline events',
          error: 'Database error',
        };
      }

      // Get creator names for events that have creators
      const creatorIds = Array.from(
        new Set(
          (events || [])
            .filter((e: any) => e.created_by_user_id)
            .map((e: any) => e.created_by_user_id)
        )
      );
      const partyNames = await this.getPartyNames(creatorIds);

      const formattedEvents: TimelineEvent[] = (events || []).map((e: any) => ({
        id: e.id,
        disputeId: e.dispute_id,
        eventType: e.event_type as TimelineEventType,
        title: e.title,
        description: e.description || undefined,
        createdByUserId: e.created_by_user_id || undefined,
        createdByName: e.created_by_user_id ? (partyNames[e.created_by_user_id] || undefined) : undefined,
        isSystemEvent: e.is_system_event,
        metadata: e.metadata || undefined,
        eventTimestamp: e.event_timestamp,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      }));

      return {
        success: true,
        message: 'Timeline events retrieved successfully',
        data: {
          events: formattedEvents,
          total: formattedEvents.length,
        },
      };
    } catch (error) {
      console.error('Error getting timeline events:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get timeline events',
        error: error instanceof Error ? error.message : 'Failed to get timeline events',
      };
    }
  }

  /**
   * Delete a timeline event (only manual events can be deleted)
   * DELETE /api/disputes/:disputeId/timeline/:eventId
   */
  async deleteTimelineEvent(
    userId: string,
    disputeId: string,
    eventId: string
  ): Promise<DeleteTimelineEventResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Verify event exists and belongs to dispute
      const { data: event, error: eventError } = await adminClient
        .from('dispute_timeline_events')
        .select('*')
        .eq('id', eventId)
        .eq('dispute_id', dispute.id)
        .single();

      if (eventError || !event) {
        return {
          success: false,
          message: 'Timeline event not found',
          error: 'Timeline event not found',
        };
      }

      // Only allow deletion of manual events (not system events)
      if (event.is_system_event) {
        return {
          success: false,
          message: 'System events cannot be deleted',
          error: 'Cannot delete system event',
        };
      }

      // Verify user created the event (or is admin)
      if (event.created_by_user_id !== userId) {
        return {
          success: false,
          message: 'You can only delete timeline events you created',
          error: 'Access denied',
        };
      }

      // Delete event
      const { error: deleteError } = await adminClient
        .from('dispute_timeline_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        console.error('Error deleting timeline event:', deleteError);
        return {
          success: false,
          message: 'Failed to delete timeline event',
          error: 'Database error',
        };
      }

      return {
        success: true,
        message: 'Timeline event deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete timeline event',
        error: error instanceof Error ? error.message : 'Failed to delete timeline event',
      };
    }
  }

  /**
   * Get final verdict status for a dispute
   * GET /api/disputes/:disputeId/verdict
   */
  async getFinalVerdict(userId: string, disputeId: string): Promise<GetFinalVerdictResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists and user has access
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is a party to the dispute
      if (dispute.initiator_user_id !== userId && dispute.respondent_user_id !== userId) {
        return {
          success: false,
          message: 'You do not have access to this dispute',
          error: 'Access denied',
        };
      }

      // Get mediator name if assigned
      let mediatorName: string | undefined;
      if (dispute.mediator_user_id) {
        const userIds = [dispute.mediator_user_id];
        const partyNames = await this.getPartyNames(userIds);
        mediatorName = partyNames[dispute.mediator_user_id] || undefined;
      }

      // Calculate hours remaining and overdue status
      let hoursRemaining: number | undefined;
      let isOverdue = false;
      if (dispute.decision_deadline) {
        const deadline = new Date(dispute.decision_deadline);
        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();
        hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
        isOverdue = diffMs < 0;
      }

      const verdict: FinalVerdict = {
        disputeId: dispute.id,
        verdictStatus: (dispute.verdict_status as VerdictStatus) || 'pending',
        mediatorUserId: dispute.mediator_user_id || undefined,
        mediatorName,
        decisionDeadline: dispute.decision_deadline || undefined,
        finalVerdict: dispute.final_verdict || undefined,
        decisionDate: dispute.decision_date || undefined,
        decisionSummary: dispute.decision_summary || undefined,
        decisionOutcome: dispute.decision_outcome as DecisionOutcome | undefined,
        hoursRemaining,
        isOverdue,
      };

      return {
        success: true,
        message: 'Final verdict retrieved successfully',
        data: verdict,
      };
    } catch (error) {
      console.error('Error getting final verdict:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get final verdict',
        error: error instanceof Error ? error.message : 'Failed to get final verdict',
      };
    }
  }

  /**
   * Assign mediator to dispute and set decision pending status
   * POST /api/disputes/:disputeId/verdict/assign-mediator
   */
  async assignMediator(
    userId: string,
    disputeId: string,
    request: AssignMediatorRequest
  ): Promise<AssignMediatorResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // TODO: Verify user is admin/mediator (add admin check here)
      // For now, allow any authenticated user (should be restricted to admins)

      // Calculate decision deadline (default 24 hours)
      const deadlineHours = request.decisionDeadlineHours || 24;
      const decisionDeadline = new Date();
      decisionDeadline.setHours(decisionDeadline.getHours() + deadlineHours);

      // Update dispute with mediator and verdict status
      const updateData: any = {
        mediator_user_id: request.mediatorUserId,
        verdict_status: 'decision_pending',
        decision_deadline: decisionDeadline.toISOString(),
      };

      const { data: updatedDispute, error: updateError } = await adminClient
        .from('disputes')
        .update(updateData)
        .eq('id', dispute.id)
        .select()
        .single();

      if (updateError || !updatedDispute) {
        console.error('Error assigning mediator:', updateError);
        return {
          success: false,
          message: 'Failed to assign mediator',
          error: 'Database error',
        };
      }

      // Create timeline event: "Mediator Assigned"
      await this.createSystemTimelineEvent(
        dispute.id,
        'mediator_assigned',
        'Mediator Assigned',
        `Mediator has been assigned to review this dispute`,
        {
          mediatorUserId: request.mediatorUserId,
          decisionDeadline: decisionDeadline.toISOString(),
        }
      );

      // Get mediator name
      const userIds = [request.mediatorUserId];
      const partyNames = await this.getPartyNames(userIds);

      const verdict: FinalVerdict = {
        disputeId: updatedDispute.id,
        verdictStatus: 'decision_pending',
        mediatorUserId: updatedDispute.mediator_user_id || undefined,
        mediatorName: partyNames[request.mediatorUserId] || undefined,
        decisionDeadline: updatedDispute.decision_deadline || undefined,
        hoursRemaining: deadlineHours,
        isOverdue: false,
      };

      return {
        success: true,
        message: 'Mediator assigned successfully',
        data: verdict,
      };
    } catch (error) {
      console.error('Error assigning mediator:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign mediator',
        error: error instanceof Error ? error.message : 'Failed to assign mediator',
      };
    }
  }

  /**
   * Update verdict status (e.g., set to decision_pending)
   * PUT /api/disputes/:disputeId/verdict/status
   */
  async updateVerdictStatus(
    userId: string,
    disputeId: string,
    request: UpdateVerdictStatusRequest
  ): Promise<UpdateVerdictStatusResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // TODO: Verify user is admin/mediator or assigned mediator
      // For now, allow any authenticated user (should be restricted)

      const updateData: any = {
        verdict_status: request.verdictStatus,
      };

      // If setting to decision_pending, set deadline
      if (request.verdictStatus === 'decision_pending') {
        const deadlineHours = request.decisionDeadlineHours || 24;
        const decisionDeadline = new Date();
        decisionDeadline.setHours(decisionDeadline.getHours() + deadlineHours);
        updateData.decision_deadline = decisionDeadline.toISOString();
      }

      const { data: updatedDispute, error: updateError } = await adminClient
        .from('disputes')
        .update(updateData)
        .eq('id', dispute.id)
        .select()
        .single();

      if (updateError || !updatedDispute) {
        console.error('Error updating verdict status:', updateError);
        return {
          success: false,
          message: 'Failed to update verdict status',
          error: 'Database error',
        };
      }

      // Get mediator name if assigned
      let mediatorName: string | undefined;
      if (updatedDispute.mediator_user_id) {
        const userIds = [updatedDispute.mediator_user_id];
        const partyNames = await this.getPartyNames(userIds);
        mediatorName = partyNames[updatedDispute.mediator_user_id] || undefined;
      }

      // Calculate hours remaining
      let hoursRemaining: number | undefined;
      let isOverdue = false;
      if (updatedDispute.decision_deadline) {
        const deadline = new Date(updatedDispute.decision_deadline);
        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();
        hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
        isOverdue = diffMs < 0;
      }

      const verdict: FinalVerdict = {
        disputeId: updatedDispute.id,
        verdictStatus: updatedDispute.verdict_status as VerdictStatus,
        mediatorUserId: updatedDispute.mediator_user_id || undefined,
        mediatorName,
        decisionDeadline: updatedDispute.decision_deadline || undefined,
        finalVerdict: updatedDispute.final_verdict || undefined,
        decisionDate: updatedDispute.decision_date || undefined,
        decisionSummary: updatedDispute.decision_summary || undefined,
        decisionOutcome: updatedDispute.decision_outcome as DecisionOutcome | undefined,
        hoursRemaining,
        isOverdue,
      };

      return {
        success: true,
        message: 'Verdict status updated successfully',
        data: verdict,
      };
    } catch (error) {
      console.error('Error updating verdict status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update verdict status',
        error: error instanceof Error ? error.message : 'Failed to update verdict status',
      };
    }
  }

  /**
   * Submit final verdict/decision
   * POST /api/disputes/:disputeId/verdict/submit
   */
  async submitFinalVerdict(
    userId: string,
    disputeId: string,
    request: SubmitFinalVerdictRequest
  ): Promise<SubmitFinalVerdictResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Verify dispute exists
      const { data: dispute, error: disputeError } = await this.lookupDispute(disputeId);

      if (disputeError || !dispute) {
        return {
          success: false,
          message: 'Dispute not found or access denied',
          error: 'Dispute not found or access denied',
        };
      }

      // Verify user is the assigned mediator
      if (dispute.mediator_user_id !== userId) {
        return {
          success: false,
          message: 'Only the assigned mediator can submit the final verdict',
          error: 'Access denied',
        };
      }

      // Validate required fields
      if (!request.finalVerdict || !request.decisionOutcome) {
        return {
          success: false,
          message: 'Final verdict and decision outcome are required',
          error: 'Missing required fields',
        };
      }

      const now = new Date();

      // Update dispute with final verdict
      const updateData: any = {
        verdict_status: 'decision_made',
        final_verdict: request.finalVerdict,
        decision_summary: request.decisionSummary || null,
        decision_outcome: request.decisionOutcome,
        decision_date: now.toISOString(),
        resolved_at: now.toISOString(), // Also update resolved_at
        status: 'resolved' as DisputeStatus, // Update dispute status to resolved
      };

      const { data: updatedDispute, error: updateError } = await adminClient
        .from('disputes')
        .update(updateData)
        .eq('id', dispute.id)
        .select()
        .single();

      if (updateError || !updatedDispute) {
        console.error('Error submitting final verdict:', updateError);
        return {
          success: false,
          message: 'Failed to submit final verdict',
          error: 'Database error',
        };
      }

      // Create timeline event: "Dispute Resolved"
      await this.createSystemTimelineEvent(
        dispute.id,
        'dispute_resolved',
        'Dispute Resolved',
        `Final verdict has been provided`,
        {
          decisionOutcome: request.decisionOutcome,
        }
      );

      // Get mediator name
      const userIds = [userId];
      const partyNames = await this.getPartyNames(userIds);

      const verdict: FinalVerdict = {
        disputeId: updatedDispute.id,
        verdictStatus: 'decision_made',
        mediatorUserId: updatedDispute.mediator_user_id || undefined,
        mediatorName: partyNames[userId] || undefined,
        decisionDeadline: updatedDispute.decision_deadline || undefined,
        finalVerdict: updatedDispute.final_verdict || undefined,
        decisionDate: updatedDispute.decision_date || undefined,
        decisionSummary: updatedDispute.decision_summary || undefined,
        decisionOutcome: updatedDispute.decision_outcome as DecisionOutcome,
      };

      return {
        success: true,
        message: 'Final verdict submitted successfully',
        data: verdict,
      };
    } catch (error) {
      console.error('Error submitting final verdict:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit final verdict',
        error: error instanceof Error ? error.message : 'Failed to submit final verdict',
      };
    }
  }
}

export const disputeService = new DisputeService();


