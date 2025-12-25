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
} from '../../types/api/dispute.types';

export class DisputeService {
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
}

export const disputeService = new DisputeService();


