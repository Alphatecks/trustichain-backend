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
  AdminDisputeDetailScreenResponse,
  AdminDisputeStatus,
  AdminAssignMediatorResponse,
  AdminDisputeEvidenceListResponse,
  AdminDisputeTimelineListResponse,
  AdminDisputeVerdictResponse,
  AdminDisputeAssessmentResponse,
  AdminDisputeMessagesResponse,
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

  /** Resolve idOrCaseId to dispute UUID and full row. Returns null if not found. */
  private async resolveDispute(client: SupabaseClient, idOrCaseId: string): Promise<{ id: string; row: any } | null> {
    const input = (idOrCaseId || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
    if (isUuid) {
      const { data, error } = await client.from('disputes').select('*').eq('id', input).single();
      if (error || !data) return null;
      return { id: data.id, row: data };
    }
    const { data, error } = await client.from('disputes').select('*').eq('case_id', input).maybeSingle();
    if (error || !data) return null;
    return { id: data.id, row: data };
  }

  /**
   * Full detail screen payload: dispute, parties (with claims), mediator, evidence, timeline, verdict, preliminary assessment, messages
   */
  async getDisputeDetailScreen(idOrCaseId: string): Promise<AdminDisputeDetailScreenResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) {
        return { success: false, message: 'Dispute not found', error: 'Not found' };
      }
      const { id: disputeId, row: d } = resolved;

      const userIds = [d.initiator_user_id, d.respondent_user_id].concat(d.mediator_user_id ? [d.mediator_user_id] : []);
      const { data: users } = await client.from('users').select('id, full_name, email').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: any) => {
        acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
        return acc;
      }, {});

      const party1Name = d.payer_name || userMap[d.initiator_user_id]?.full_name || '—';
      const party2Name = d.respondent_name || userMap[d.respondent_user_id]?.full_name || '—';
      const claims = d.reason || d.description || '—';

      const disputeDetail = {
        id: d.id,
        caseId: d.case_id,
        party1: { id: d.initiator_user_id, name: party1Name, email: d.payer_email || userMap[d.initiator_user_id]?.email },
        party2: { id: d.respondent_user_id, name: party2Name, email: d.respondent_email || userMap[d.respondent_user_id]?.email },
        amountUsd: Number(d.amount_usd || 0),
        amountXrp: Number(d.amount_xrp || 0),
        status: d.status as AdminDisputeStatus,
        statusLabel: STATUS_LABELS[d.status] || d.status,
        reason: d.reason || '',
        description: d.description,
        escrowId: d.escrow_id,
        openedAt: d.opened_at,
        resolvedAt: d.resolved_at,
        cancelledAt: d.cancelled_at,
        cancelReason: d.cancel_reason,
        mediatorUserId: d.mediator_user_id,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        party1Claims: claims,
        party2Claims: claims,
      };

      const party1: import('../../types/api/adminDisputeResolution.types').AdminDisputePartyCard = {
        id: d.initiator_user_id,
        name: party1Name,
        email: d.payer_email || userMap[d.initiator_user_id]?.email,
        role: 'buyer',
        claims,
      };
      const party2: import('../../types/api/adminDisputeResolution.types').AdminDisputePartyCard = {
        id: d.respondent_user_id,
        name: party2Name,
        email: d.respondent_email || userMap[d.respondent_user_id]?.email,
        role: 'seller',
        claims,
      };

      let mediator: import('../../types/api/adminDisputeResolution.types').AdminDisputeMediatorInfo = {
        userId: null,
        name: null,
        email: null,
        status: 'inactive',
      };
      if (d.mediator_user_id) {
        const mName = userMap[d.mediator_user_id]?.full_name || null;
        const mEmail = userMap[d.mediator_user_id]?.email || null;
        mediator = { userId: d.mediator_user_id, name: mName, email: mEmail, status: d.status === 'active' ? 'active' : 'inactive' };
      }

      const { data: evidenceRows } = await client.from('dispute_evidence').select('*').eq('dispute_id', disputeId).order('uploaded_at', { ascending: false });
      const evidence: import('../../types/api/adminDisputeResolution.types').AdminDisputeEvidenceItem[] = (evidenceRows || []).map((e: any) => ({
        id: e.id,
        title: e.title || '—',
        description: e.description || '',
        evidenceType: e.evidence_type || '',
        fileUrl: e.file_url,
        fileName: e.file_name,
        fileType: e.file_type || '',
        fileSize: e.file_size || 0,
        verified: !!e.verified,
        uploadedAt: e.uploaded_at,
        uploadedByUserId: e.uploaded_by_user_id,
      }));

      const { data: timelineRows } = await client.from('dispute_timeline_events').select('*').eq('dispute_id', disputeId).order('event_timestamp', { ascending: false });
      const creatorIds = [...new Set((timelineRows || []).filter((e: any) => e.created_by_user_id).map((e: any) => e.created_by_user_id))];
      const { data: creatorUsers } = creatorIds.length ? await client.from('users').select('id, full_name').in('id', creatorIds) : { data: [] };
      const creatorMap = (creatorUsers || []).reduce<Record<string, string>>((acc, u: any) => { acc[u.id] = u.full_name || '—'; return acc; }, {});
      const timeline: import('../../types/api/adminDisputeResolution.types').AdminDisputeTimelineEvent[] = (timelineRows || []).map((e: any) => ({
        id: e.id,
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventTimestamp: e.event_timestamp,
        createdAt: e.created_at,
        createdByName: e.created_by_user_id ? creatorMap[e.created_by_user_id] : undefined,
      }));

      const verdict: import('../../types/api/adminDisputeResolution.types').AdminDisputeVerdictInfo = {
        status: d.verdict_status || 'pending',
        finalVerdict: d.final_verdict,
        decisionSummary: d.decision_summary,
        decisionOutcome: d.decision_outcome,
        decisionDate: d.decision_date,
      };

      const { data: assessmentRows } = await client.from('dispute_assessments').select('id').eq('dispute_id', disputeId).eq('assessment_type', 'preliminary').order('created_at', { ascending: false }).limit(1);
      let preliminaryAssessment: import('../../types/api/adminDisputeResolution.types').AdminDisputePreliminaryAssessment | null = null;
      if (assessmentRows && assessmentRows.length > 0) {
        const aId = assessmentRows[0].id;
        const { data: ass } = await client.from('dispute_assessments').select('*').eq('id', aId).single();
        if (ass) {
          const { data: findRows } = await client.from('dispute_assessment_findings').select('*').eq('assessment_id', aId).order('order_index');
          const findings = (findRows || []).map((f: any) => ({ id: f.id, findingText: f.finding_text, findingType: f.finding_type, orderIndex: f.order_index }));
          preliminaryAssessment = {
            id: ass.id,
            title: ass.title || 'Preliminary Assessment',
            summary: ass.summary,
            status: ass.status,
            findings,
            createdAt: ass.created_at,
            updatedAt: ass.updated_at,
          };
        }
      }

      const { data: msgRows } = await client.from('dispute_messages').select('*').eq('dispute_id', disputeId).order('created_at', { ascending: true }).limit(100);
      const msgUserIds = [...new Set((msgRows || []).map((m: any) => m.sender_user_id).filter(Boolean))];
      const { data: msgUsers } = msgUserIds.length ? await client.from('users').select('id, full_name').in('id', msgUserIds) : { data: [] };
      const msgUserMap = (msgUsers || []).reduce<Record<string, string>>((acc, u: any) => { acc[u.id] = u.full_name || '—'; return acc; }, {});
      const messages: import('../../types/api/adminDisputeResolution.types').AdminDisputeChatMessage[] = (msgRows || []).map((m: any) => ({
        id: m.id,
        senderUserId: m.sender_user_id,
        senderName: m.sender_user_id == null ? (m.sender_role === 'mediator' ? 'Mediator' : 'Admin') : (msgUserMap[m.sender_user_id] || '—'),
        senderRole: m.sender_role || '—',
        messageText: m.message_text,
        createdAt: m.created_at,
      }));

      return {
        success: true,
        message: 'Dispute detail screen retrieved',
        data: {
          dispute: disputeDetail,
          party1,
          party2,
          mediator,
          evidence,
          timeline,
          verdict,
          preliminaryAssessment,
          messages,
        },
      };
    } catch (e) {
      console.error('Admin getDisputeDetailScreen error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get detail screen',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Assign mediator to dispute
   */
  async assignMediator(idOrCaseId: string, mediatorUserId: string): Promise<AdminAssignMediatorResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { error } = await client.from('disputes').update({
        mediator_user_id: mediatorUserId,
        verdict_status: 'decision_pending',
        updated_at: new Date().toISOString(),
      }).eq('id', resolved.id);
      if (error) return { success: false, message: error.message, error: error.message };
      return { success: true, message: 'Mediator assigned', data: { mediatorUserId } };
    } catch (e) {
      console.error('Admin assignMediator error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to assign mediator', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * List evidence for a dispute
   */
  async getEvidence(idOrCaseId: string): Promise<AdminDisputeEvidenceListResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { data: rows } = await client.from('dispute_evidence').select('*').eq('dispute_id', resolved.id).order('uploaded_at', { ascending: false });
      const evidence = (rows || []).map((e: any) => ({
        id: e.id,
        title: e.title || '—',
        description: e.description || '',
        evidenceType: e.evidence_type || '',
        fileUrl: e.file_url,
        fileName: e.file_name,
        fileType: e.file_type || '',
        fileSize: e.file_size || 0,
        verified: !!e.verified,
        uploadedAt: e.uploaded_at,
        uploadedByUserId: e.uploaded_by_user_id,
      }));
      return { success: true, message: 'Evidence retrieved', data: { evidence } };
    } catch (e) {
      console.error('Admin getEvidence error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to get evidence', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Add evidence (metadata; file must be uploaded separately to get fileUrl)
   */
  async addEvidence(idOrCaseId: string, body: { title: string; description?: string; evidenceType?: string; fileUrl: string; fileName: string; fileType: string; fileSize: number }, _uploadedByUserId?: string): Promise<AdminDisputeEvidenceListResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { error } = await client.from('dispute_evidence').insert({
        dispute_id: resolved.id,
        title: body.title || 'Evidence',
        description: body.description || null,
        evidence_type: body.evidenceType || null,
        file_url: body.fileUrl,
        file_name: body.fileName,
        file_type: body.fileType,
        file_size: body.fileSize,
        uploaded_by_user_id: _uploadedByUserId || null,
        verified: false,
      });
      if (error) return { success: false, message: error.message, error: error.message };
      const listResult = await this.getEvidence(idOrCaseId);
      return listResult;
    } catch (e) {
      console.error('Admin addEvidence error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to add evidence', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Update evidence (e.g. verified flag)
   */
  async updateEvidence(idOrCaseId: string, evidenceId: string, updates: { verified?: boolean; title?: string; description?: string }): Promise<AdminDisputeEvidenceListResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const payload: any = { };
      if (updates.verified !== undefined) payload.verified = updates.verified;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (Object.keys(payload).length === 0) return this.getEvidence(idOrCaseId);
      const { error } = await client.from('dispute_evidence').update(payload).eq('id', evidenceId).eq('dispute_id', resolved.id);
      if (error) return { success: false, message: error.message, error: error.message };
      return this.getEvidence(idOrCaseId);
    } catch (e) {
      console.error('Admin updateEvidence error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to update evidence', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * List timeline events
   */
  async getTimeline(idOrCaseId: string): Promise<AdminDisputeTimelineListResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { data: rows } = await client.from('dispute_timeline_events').select('*').eq('dispute_id', resolved.id).order('event_timestamp', { ascending: false });
      const creatorIds = [...new Set((rows || []).filter((e: any) => e.created_by_user_id).map((e: any) => e.created_by_user_id))];
      const { data: users } = creatorIds.length ? await client.from('users').select('id, full_name').in('id', creatorIds) : { data: [] };
      const creatorMap = (users || []).reduce<Record<string, string>>((acc, u: any) => { acc[u.id] = u.full_name || '—'; return acc; }, {});
      const events = (rows || []).map((e: any) => ({
        id: e.id,
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventTimestamp: e.event_timestamp,
        createdAt: e.created_at,
        createdByName: e.created_by_user_id ? creatorMap[e.created_by_user_id] : undefined,
      }));
      return { success: true, message: 'Timeline retrieved', data: { events } };
    } catch (e) {
      console.error('Admin getTimeline error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to get timeline', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Create timeline event
   */
  async createTimelineEvent(idOrCaseId: string, body: { eventType: string; title: string; description?: string }, createdByUserId?: string): Promise<AdminDisputeTimelineListResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { error } = await client.from('dispute_timeline_events').insert({
        dispute_id: resolved.id,
        event_type: body.eventType,
        title: body.title,
        description: body.description || null,
        created_by_user_id: createdByUserId || null,
        is_system_event: false,
        event_timestamp: new Date().toISOString(),
      });
      if (error) return { success: false, message: error.message, error: error.message };
      return this.getTimeline(idOrCaseId);
    } catch (e) {
      console.error('Admin createTimelineEvent error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to create timeline event', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Get verdict info
   */
  async getVerdict(idOrCaseId: string): Promise<AdminDisputeVerdictResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const d = resolved.row;
      const verdict = {
        status: d.verdict_status || 'pending',
        finalVerdict: d.final_verdict,
        decisionSummary: d.decision_summary,
        decisionOutcome: d.decision_outcome,
        decisionDate: d.decision_date,
      };
      return { success: true, message: 'Verdict retrieved', data: verdict };
    } catch (e) {
      console.error('Admin getVerdict error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to get verdict', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Submit final verdict
   */
  async submitVerdict(idOrCaseId: string, body: { finalVerdict: string; decisionSummary?: string; decisionOutcome?: string }): Promise<AdminDisputeVerdictResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const now = new Date().toISOString();
      const { error } = await client.from('disputes').update({
        verdict_status: 'decision_made',
        final_verdict: body.finalVerdict,
        decision_summary: body.decisionSummary || null,
        decision_outcome: body.decisionOutcome || null,
        decision_date: now,
        resolved_at: now,
        status: 'resolved',
        updated_at: now,
      }).eq('id', resolved.id);
      if (error) return { success: false, message: error.message, error: error.message };
      return this.getVerdict(idOrCaseId);
    } catch (e) {
      console.error('Admin submitVerdict error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to submit verdict', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Get preliminary assessment with findings
   */
  async getPreliminaryAssessment(idOrCaseId: string): Promise<AdminDisputeAssessmentResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { data: assRows } = await client.from('dispute_assessments').select('*').eq('dispute_id', resolved.id).eq('assessment_type', 'preliminary').order('created_at', { ascending: false }).limit(1);
      if (!assRows || assRows.length === 0) return { success: true, message: 'Assessment retrieved', data: null };
      const ass = assRows[0];
      const { data: findRows } = await client.from('dispute_assessment_findings').select('*').eq('assessment_id', ass.id).order('order_index');
      const findings = (findRows || []).map((f: any) => ({ id: f.id, findingText: f.finding_text, findingType: f.finding_type, orderIndex: f.order_index }));
      return {
        success: true,
        message: 'Assessment retrieved',
        data: {
          id: ass.id,
          title: ass.title || 'Preliminary Assessment',
          summary: ass.summary,
          status: ass.status,
          findings,
          createdAt: ass.created_at,
          updatedAt: ass.updated_at,
        },
      };
    } catch (e) {
      console.error('Admin getPreliminaryAssessment error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to get assessment', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Create or update preliminary assessment and findings
   */
  async upsertPreliminaryAssessment(idOrCaseId: string, body: { title?: string; summary?: string; findings: Array<{ findingText: string; findingType?: string; orderIndex?: number }> }, adminUserId: string): Promise<AdminDisputeAssessmentResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { data: existing } = await client.from('dispute_assessments').select('id').eq('dispute_id', resolved.id).eq('assessment_type', 'preliminary').limit(1).maybeSingle();
      const now = new Date().toISOString();
      let assessmentId: string;
      if (existing?.id) {
        await client.from('dispute_assessments').update({
          title: body.title ?? 'Preliminary Assessment',
          summary: body.summary ?? null,
          updated_at: now,
        }).eq('id', existing.id);
        assessmentId = existing.id;
        await client.from('dispute_assessment_findings').delete().eq('assessment_id', existing.id);
      } else {
        const { data: inserted, error } = await client.from('dispute_assessments').insert({
          dispute_id: resolved.id,
          created_by_user_id: adminUserId,
          assessment_type: 'preliminary',
          title: body.title || 'Preliminary Assessment',
          summary: body.summary || null,
          status: 'draft',
        }).select('id').single();
        if (error || !inserted) return { success: false, message: error?.message || 'Failed to create assessment', error: error?.message };
        assessmentId = inserted.id;
      }
      for (let i = 0; i < (body.findings || []).length; i++) {
        const f = body.findings[i];
        await client.from('dispute_assessment_findings').insert({
          assessment_id: assessmentId,
          finding_text: f.findingText,
          finding_type: f.findingType || null,
          order_index: f.orderIndex ?? i,
        });
      }
      return this.getPreliminaryAssessment(idOrCaseId);
    } catch (e) {
      console.error('Admin upsertPreliminaryAssessment error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to upsert assessment', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Get chat messages
   */
  async getMessages(idOrCaseId: string, limit?: number): Promise<AdminDisputeMessagesResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const lim = Math.min(limit ?? 100, 200);
      const { data: rows } = await client.from('dispute_messages').select('*').eq('dispute_id', resolved.id).order('created_at', { ascending: true }).limit(lim);
      const userIds = [...new Set((rows || []).map((m: any) => m.sender_user_id).filter(Boolean))];
      const { data: users } = userIds.length ? await client.from('users').select('id, full_name').in('id', userIds) : { data: [] };
      const userMap = (users || []).reduce<Record<string, string>>((acc, u: any) => { acc[u.id] = u.full_name || '—'; return acc; }, {});
      const messages = (rows || []).map((m: any) => ({
        id: m.id,
        senderUserId: m.sender_user_id,
        senderName: m.sender_user_id == null ? (m.sender_role === 'mediator' ? 'Mediator' : 'Admin') : (userMap[m.sender_user_id] || '—'),
        senderRole: m.sender_role || '—',
        messageText: m.message_text,
        createdAt: m.created_at,
      }));
      return { success: true, message: 'Messages retrieved', data: { messages, total: messages.length } };
    } catch (e) {
      console.error('Admin getMessages error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to get messages', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Send message as admin/mediator
   */
  async sendMessage(idOrCaseId: string, body: { messageText: string; senderRole?: 'admin' | 'mediator' }, adminUserId: string): Promise<AdminDisputeMessagesResponse> {
    try {
      const client = this.getAdminClient();
      const resolved = await this.resolveDispute(client, idOrCaseId);
      if (!resolved) return { success: false, message: 'Dispute not found', error: 'Not found' };
      const { error } = await client.from('dispute_messages').insert({
        dispute_id: resolved.id,
        sender_user_id: null,
        message_text: body.messageText,
        sender_role: body.senderRole || 'admin',
      });
      if (error) return { success: false, message: error.message, error: error.message };
      return this.getMessages(idOrCaseId);
    } catch (e) {
      console.error('Admin sendMessage error:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to send message', error: e instanceof Error ? e.message : 'Unknown error' };
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
