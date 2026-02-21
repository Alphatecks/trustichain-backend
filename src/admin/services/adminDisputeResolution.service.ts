/**
 * Admin Dispute Resolution Service
 * Metrics, alerts, list, and detail for disputes. Uses supabaseAdmin to bypass RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  AdminDisputeMetricsResponse,
  AdminDisputeAlertsResponse,
  AdminDisputeListParams,
  AdminDisputeListResponse,
  AdminDisputeDetailResponse,
  AdminDisputeStatus,
} from '../../types/api/adminDisputeResolution.types';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'In progress',
  resolved: 'Completed',
  cancelled: 'Cancelled',
};

const EVENT_TYPE_TO_ALERT: Record<string, { type: string; title: string }> = {
  evidence_submitted: { type: 'new_evidence', title: 'New Evidence Provided' },
  dispute_filed: { type: 'dispute_created', title: 'Dispute Created' },
  dispute_resolved: { type: 'dispute_resolved', title: 'Dispute Resolved' },
  dispute_cancelled: { type: 'dispute_cancelled', title: 'Dispute Cancelled' },
  comment_added: { type: 'new_comment', title: 'New Comment Added' },
  evidence_rejected: { type: 'evidence_rejected', title: 'Evidence Rejected' },
  mediator_assigned: { type: 'mediator_assigned', title: 'Mediator Assigned' },
  custom: { type: 'custom', title: 'Activity' },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 2592000)} weeks ago`;
}

function formatOpenedAt(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${day}${suffix} ${month} ${year}`;
}

export class AdminDisputeResolutionService {
  private getAdminClient(): SupabaseClient {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin dispute resolution using anon client; RLS may restrict data.');
    }
    return client;
  }

  /**
   * Dashboard metrics: total, active, resolved disputes + average resolution time + change %
   */
  async getMetrics(): Promise<AdminDisputeMetricsResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const [
        { count: totalCount },
        { count: totalBeforeMonth },
        { data: activeRows },
        { data: activeBeforeMonth },
        { data: resolvedRows },
        { data: resolvedBeforeMonth },
      ] = await Promise.all([
        client.from('disputes').select('*', { count: 'exact', head: true }),
        client.from('disputes').select('*', { count: 'exact', head: true }).lt('opened_at', thisMonthStart.toISOString()),
        client.from('disputes').select('id').eq('status', 'active'),
        client.from('disputes').select('id').eq('status', 'active').lt('updated_at', thisMonthStart.toISOString()),
        client.from('disputes').select('id, opened_at, resolved_at').eq('status', 'resolved').not('resolved_at', 'is', null),
        client.from('disputes').select('id').eq('status', 'resolved').lt('resolved_at', thisMonthStart.toISOString()),
      ]);

      const total = totalCount ?? 0;
      const totalBefore = totalBeforeMonth ?? 0;
      const activeCount = (activeRows || []).length;
      const activeBeforeCount = (activeBeforeMonth || []).length;
      const resolvedList = resolvedRows || [];
      const resolvedCount = resolvedList.length;
      const resolvedBeforeCount = (resolvedBeforeMonth || []).length;

      let avgResolutionHours = 0;
      if (resolvedList.length > 0) {
        const totalSeconds = resolvedList.reduce((sum: number, d: { opened_at: string; resolved_at: string }) => {
          const opened = new Date(d.opened_at).getTime();
          const resolved = new Date(d.resolved_at).getTime();
          return sum + (resolved - opened) / 1000;
        }, 0);
        avgResolutionHours = totalSeconds / resolvedList.length / 3600;
      }
      const avgLabel = avgResolutionHours < 1
        ? `${Math.round(avgResolutionHours * 60)}min`
        : avgResolutionHours < 24
          ? `${Math.round(avgResolutionHours)}hr`
          : `${Math.round(avgResolutionHours / 24)} days`;

      const percent = (current: number, previous: number) =>
        previous === 0 ? undefined : Math.round(((current - previous) / previous) * 100);

      return {
        success: true,
        message: 'Dispute metrics retrieved',
        data: {
          totalDisputes: total,
          totalDisputesChangePercent: percent(total, totalBefore),
          activeDisputes: activeCount,
          activeDisputesChangePercent: percent(activeCount, activeBeforeCount),
          resolvedDisputes: resolvedCount,
          resolvedDisputesChangePercent: percent(resolvedCount, resolvedBeforeCount),
          averageResolutionTimeHours: Math.round(avgResolutionHours * 100) / 100,
          averageResolutionTimeLabel: avgLabel,
        },
      };
    } catch (e) {
      console.error('Admin dispute resolution getMetrics error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get dispute metrics',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Recent dispute alerts from timeline events (and optionally recent evidence/messages)
   */
  async getAlerts(limit: number = 10): Promise<AdminDisputeAlertsResponse> {
    try {
      const client = this.getAdminClient();
      const lim = Math.min(limit, 50);

      const { data: events } = await client
        .from('dispute_timeline_events')
        .select('id, dispute_id, event_type, title, description, event_timestamp, created_at')
        .order('event_timestamp', { ascending: false })
        .limit(lim);

      const list = events || [];
      if (list.length === 0) {
        return {
          success: true,
          message: 'Dispute alerts retrieved',
          data: { alerts: [] },
        };
      }

      const disputeIds = [...new Set(list.map((e: { dispute_id: string }) => e.dispute_id))];
      const { data: disputes } = await client.from('disputes').select('id, case_id').in('id', disputeIds);
      const caseIdByDisputeId = (disputes || []).reduce<Record<string, string>>((acc, d: { id: string; case_id: string }) => {
        acc[d.id] = d.case_id;
        return acc;
      }, {});

      const alerts = list.map((e: any) => {
        const meta = EVENT_TYPE_TO_ALERT[e.event_type] || { type: e.event_type, title: e.title || 'Activity' };
        const caseId = caseIdByDisputeId[e.dispute_id] || e.dispute_id;
        let description = e.description || e.title || meta.title;
        if (meta.type === 'new_evidence') description = `A new evidence was provided for ${caseId}`;
        else if (meta.type === 'dispute_created') description = 'A new dispute was created';
        else if (meta.type === 'dispute_resolved') description = `Dispute ${caseId} has been resolved`;
        else if (meta.type === 'new_comment') description = `A new comment was added to ${caseId}`;
        else if (meta.type === 'evidence_rejected') description = `Evidence for ${caseId} was rejected`;
        const createdAt = e.event_timestamp || e.created_at;
        const date = createdAt ? new Date(createdAt) : new Date();
        return {
          id: e.id,
          type: meta.type,
          title: meta.title,
          description,
          disputeId: e.dispute_id,
          caseId,
          createdAt,
          createdAtAgo: timeAgo(date),
        };
      });

      return {
        success: true,
        message: 'Dispute alerts retrieved',
        data: { alerts },
      };
    } catch (e) {
      console.error('Admin dispute resolution getAlerts error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get dispute alerts',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Paginated dispute list with search and status filter
   */
  async getDisputeList(params: AdminDisputeListParams): Promise<AdminDisputeListResponse> {
    try {
      const client = this.getAdminClient();
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const sortBy = params.sortBy ?? 'opened_at';
      const sortOrder = params.sortOrder ?? 'desc';
      const status = params.status;
      const search = (params.search || '').trim().toLowerCase();
      const from = (page - 1) * pageSize;

      let query = client
        .from('disputes')
        .select('id, case_id, initiator_user_id, respondent_user_id, amount_usd, amount_xrp, status, opened_at, resolved_at, escrow_id', { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (search) {
        query = query.or(`case_id.ilike.%${search}%,reason.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const orderCol = sortBy === 'resolved_at' ? 'resolved_at' : sortBy === 'amount_usd' ? 'amount_usd' : sortBy === 'status' ? 'status' : 'opened_at';
      query = query.order(orderCol, { ascending: sortOrder === 'asc', nullsFirst: false });

      const { data: rows, error, count } = await query.range(from, from + pageSize - 1);

      if (error) {
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
      }

      const list = rows || [];
      if (list.length === 0) {
        const total = count ?? 0;
        return {
          success: true,
          message: 'Dispute list retrieved',
          data: { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
        };
      }

      const userIds = new Set<string>();
      list.forEach((d: { initiator_user_id: string; respondent_user_id: string }) => {
        userIds.add(d.initiator_user_id);
        userIds.add(d.respondent_user_id);
      });
      const { data: users } = await client.from('users').select('id, full_name').in('id', Array.from(userIds));
      const userMap = (users || []).reduce<Record<string, string>>((acc, u: any) => {
        acc[u.id] = u.full_name || '—';
        return acc;
      }, {});

      const items = list.map((d: any) => ({
        id: d.id,
        caseId: d.case_id,
        party1Name: userMap[d.initiator_user_id] || '—',
        party2Name: userMap[d.respondent_user_id] || '—',
        party1Id: d.initiator_user_id,
        party2Id: d.respondent_user_id,
        amountUsd: Number(d.amount_usd || 0),
        amountXrp: Number(d.amount_xrp || 0),
        status: d.status as AdminDisputeStatus,
        statusLabel: STATUS_LABELS[d.status] || d.status,
        openedAt: d.opened_at,
        openedAtFormatted: formatOpenedAt(d.opened_at),
        resolvedAt: d.resolved_at || null,
        escrowId: d.escrow_id || null,
      }));

      const total = count ?? 0;
      return {
        success: true,
        message: 'Dispute list retrieved',
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (e) {
      console.error('Admin dispute resolution getDisputeList error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get dispute list',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Single dispute detail by id (UUID) or case_id
   */
  async getDisputeDetail(idOrCaseId: string): Promise<AdminDisputeDetailResponse> {
    try {
      const client = this.getAdminClient();
      const input = (idOrCaseId || '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);

      let dispute: any;
      if (isUuid) {
        const { data, error } = await client.from('disputes').select('*').eq('id', input).single();
        if (error || !data) {
          return { success: false, message: 'Dispute not found', error: error?.message || 'Not found' };
        }
        dispute = data;
      } else {
        const { data, error } = await client.from('disputes').select('*').eq('case_id', input).maybeSingle();
        if (error || !data) {
          return { success: false, message: 'Dispute not found', error: error?.message || 'Not found' };
        }
        dispute = data;
      }

      const userIds = [dispute.initiator_user_id, dispute.respondent_user_id];
      const { data: users } = await client.from('users').select('id, full_name, email').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: any) => {
        acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
        return acc;
      }, {});

      return {
        success: true,
        message: 'Dispute detail retrieved',
        data: {
          id: dispute.id,
          caseId: dispute.case_id,
          party1: {
            id: dispute.initiator_user_id,
            name: dispute.payer_name || userMap[dispute.initiator_user_id]?.full_name || '—',
            email: dispute.payer_email || userMap[dispute.initiator_user_id]?.email,
          },
          party2: {
            id: dispute.respondent_user_id,
            name: dispute.respondent_name || userMap[dispute.respondent_user_id]?.full_name || '—',
            email: dispute.respondent_email || userMap[dispute.respondent_user_id]?.email,
          },
          amountUsd: Number(dispute.amount_usd || 0),
          amountXrp: Number(dispute.amount_xrp || 0),
          status: dispute.status as AdminDisputeStatus,
          statusLabel: STATUS_LABELS[dispute.status] || dispute.status,
          reason: dispute.reason || '',
          description: dispute.description,
          escrowId: dispute.escrow_id,
          openedAt: dispute.opened_at,
          resolvedAt: dispute.resolved_at,
          cancelledAt: dispute.cancelled_at,
          cancelReason: dispute.cancel_reason,
          mediatorUserId: dispute.mediator_user_id,
          createdAt: dispute.created_at,
          updatedAt: dispute.updated_at,
        },
      };
    } catch (e) {
      console.error('Admin dispute resolution getDisputeDetail error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get dispute detail',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminDisputeResolutionService = new AdminDisputeResolutionService();
