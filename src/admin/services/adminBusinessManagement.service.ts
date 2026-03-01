/**
 * Admin Business Management Service
 * Overview stats and business activities (escrows) for the Business Management dashboard.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  AdminBusinessManagementOverviewResponse,
  AdminBusinessActivityListParams,
  AdminBusinessActivityListResponse,
  AdminBusinessActivityDetailResponse,
  AdminBusinessActivityStatus,
} from '../../types/api/adminBusinessManagement.types';

function formatEscrowId(year: number, sequence: number): string {
  return `ESC-${year}-${sequence.toString().padStart(3, '0')}`;
}

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];

const ESCROW_STATUS_TO_ACTIVITY: Record<string, AdminBusinessActivityStatus> = {
  pending: 'Pending',
  active: 'In progress',
  completed: 'Completed',
  cancelled: 'Pending',
  disputed: 'In progress',
};

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${day}${suffix} ${month} ${year}`;
}

export class AdminBusinessManagementService {
  private getAdminClient(): SupabaseClient {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin business management using anon client; RLS may restrict data.');
    }
    return client;
  }

  /** Get user IDs that own a business (from businesses table). */
  private async getBusinessSuiteUserIds(client: SupabaseClient): Promise<string[]> {
    const { data: rows } = await client.from('businesses').select('owner_user_id');
    return (rows || []).map((r: { owner_user_id: string }) => r.owner_user_id);
  }

  /**
   * Overview: payrolls created, suppliers, API integrated, average resolution time + change %
   * All counts are restricted to escrows created by business suite users (user_id in businessIds).
   */
  async getOverview(): Promise<AdminBusinessManagementOverviewResponse> {
    try {
      const client = this.getAdminClient();
      const businessIds = await this.getBusinessSuiteUserIds(client);
      if (businessIds.length === 0) {
        return {
          success: true,
          message: 'Business management overview retrieved',
          data: {
            payrollsCreated: 0,
            suppliers: 0,
            apiIntegrated: 0,
            averageResTimeHours: 0,
            averageResTimeLabel: '0hr',
          },
        };
      }

      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

      const [
        { count: totalEscrows },
        { count: escrowsThisMonth },
        { count: escrowsLastMonth },
        { data: supplierRows },
        { data: supplierRowsLastMonth },
        { data: resolvedDisputes },
      ] = await Promise.all([
        client.from('escrows').select('*', { count: 'exact', head: true }).in('user_id', businessIds),
        client.from('escrows').select('*', { count: 'exact', head: true }).in('user_id', businessIds).gte('created_at', thisMonthStart.toISOString()),
        client.from('escrows').select('*', { count: 'exact', head: true }).in('user_id', businessIds).gte('created_at', lastMonthStart.toISOString()).lt('created_at', thisMonthStart.toISOString()),
        client.from('escrows').select('user_id, counterparty_id').in('user_id', businessIds).not('counterparty_id', 'is', null),
        client.from('escrows').select('user_id, counterparty_id').in('user_id', businessIds).not('counterparty_id', 'is', null).lt('created_at', thisMonthStart.toISOString()),
        client.from('disputes').select('id, opened_at, resolved_at').eq('status', 'resolved').not('resolved_at', 'is', null),
      ]);

      const payrollsCreated = totalEscrows ?? 0;
      const payrollsThisMonth = escrowsThisMonth ?? 0;
      const payrollsLastMonth = escrowsLastMonth ?? 0;

      const supplierIds = new Set<string>();
      (supplierRows || []).forEach((r: { user_id: string; counterparty_id: string | null }) => {
        supplierIds.add(r.user_id);
        if (r.counterparty_id) supplierIds.add(r.counterparty_id);
      });
      const suppliers = supplierIds.size;

      const supplierIdsLastMonth = new Set<string>();
      (supplierRowsLastMonth || []).forEach((r: { user_id: string; counterparty_id: string | null }) => {
        supplierIdsLastMonth.add(r.user_id);
        if (r.counterparty_id) supplierIdsLastMonth.add(r.counterparty_id);
      });
      const suppliersLastMonth = supplierIdsLastMonth.size;

      let averageResTimeHours = 0;
      const resolvedList = resolvedDisputes || [];
      if (resolvedList.length > 0) {
        const totalSeconds = resolvedList.reduce((sum: number, d: { opened_at: string; resolved_at: string }) => {
          const opened = new Date(d.opened_at).getTime();
          const resolved = new Date(d.resolved_at).getTime();
          return sum + (resolved - opened) / 1000;
        }, 0);
        averageResTimeHours = totalSeconds / resolvedList.length / 3600;
      }
      const averageResTimeLabel = averageResTimeHours < 1
        ? `${Math.round(averageResTimeHours * 60)}min`
        : averageResTimeHours < 24
          ? `${Math.round(averageResTimeHours)}hr`
          : `${Math.round(averageResTimeHours / 24)} days`;

      const percent = (current: number, previous: number) =>
        previous === 0 ? undefined : Math.round(((current - previous) / previous) * 100);

      return {
        success: true,
        message: 'Business management overview retrieved',
        data: {
          payrollsCreated,
          payrollsCreatedChangePercent: percent(payrollsThisMonth, payrollsLastMonth),
          suppliers,
          suppliersChangePercent: percent(suppliers, suppliersLastMonth),
          apiIntegrated: payrollsCreated,
          averageResTimeHours: Math.round(averageResTimeHours * 100) / 100,
          averageResTimeLabel,
        },
      };
    } catch (e) {
      console.error('Admin business management getOverview error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get overview',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Paginated list of business activities (escrows) with search and status filter.
   * Only escrows created by business suite users (user_id in businessIds). Personal-suite escrows are excluded.
   */
  async getActivities(params: AdminBusinessActivityListParams): Promise<AdminBusinessActivityListResponse> {
    try {
      const client = this.getAdminClient();
      const businessIds = await this.getBusinessSuiteUserIds(client);
      if (businessIds.length === 0) {
        return {
          success: true,
          message: 'Business activities retrieved',
          data: { items: [], total: 0, page: Math.max(1, params.page ?? 1), pageSize: Math.min(100, Math.max(1, params.pageSize ?? 10)), totalPages: 0 },
        };
      }

      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const sortBy = params.sortBy ?? 'created_at';
      const sortOrder = params.sortOrder ?? 'desc';
      const search = (params.search || '').trim();
      const statusFilter = params.status;

      const selectCols = 'id, user_id, counterparty_id, status, created_at, updated_at, escrow_sequence, description, payer_name, counterparty_name';
      let query = client
        .from('escrows')
        .select(selectCols, { count: 'exact' })
        .in('user_id', businessIds);

      if (statusFilter) {
        const escrowStatuses = statusFilter === 'Pending' ? ['pending', 'cancelled'] : statusFilter === 'In progress' ? ['active', 'disputed'] : ['completed'];
        query = query.in('status', escrowStatuses);
      }

      if (search) {
        query = query.or(`description.ilike.%${search}%,payer_name.ilike.%${search}%,counterparty_name.ilike.%${search}%`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      const from = (page - 1) * pageSize;
      const { data: rows, error, count } = await query.range(from, from + pageSize - 1);

      if (error) {
        return { success: false, message: error.message, error: error.message };
      }

      const list = rows || [];
      const userIds = new Set<string>();
      list.forEach((e: { user_id: string; counterparty_id: string | null }) => {
        userIds.add(e.user_id);
        if (e.counterparty_id) userIds.add(e.counterparty_id);
      });
      const userIdsArr = Array.from(userIds);
      const { data: users } = userIdsArr.length > 0
        ? await client.from('users').select('id, full_name').in('id', userIdsArr)
        : { data: [] };
      const nameByUserId = (users || []).reduce<Record<string, string>>((acc, u: { id: string; full_name: string | null }) => {
        acc[u.id] = u.full_name || '—';
        return acc;
      }, {});

      const total = count ?? 0;
      const items = list.map((e: any) => {
        const year = e.created_at ? new Date(e.created_at).getUTCFullYear() : new Date().getFullYear();
        const seq = e.escrow_sequence ?? 0;
        const activityId = formatEscrowId(year, seq);
        const party1Name = e.payer_name || nameByUserId[e.user_id] || '—';
        const party2Name = e.counterparty_name || (e.counterparty_id ? nameByUserId[e.counterparty_id] : null) || '—';
        const name = `${party1Name}, ${party2Name}`.trim();
        const address = (e.description || '').trim() || '—';
        const status = ESCROW_STATUS_TO_ACTIVITY[e.status] ?? 'Pending';

        return {
          id: e.id,
          activityId,
          description: { name, address },
          status,
          date: formatActivityDate(e.updated_at || e.created_at),
          createdAt: e.created_at,
        };
      });

      return {
        success: true,
        message: 'Business activities retrieved',
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (e) {
      console.error('Admin business management getActivities error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get activities',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  private async resolveActivityId(client: SupabaseClient, idOrRef: string): Promise<string | null> {
    const trimmed = (idOrRef || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) {
      const { data } = await client.from('escrows').select('id').eq('id', trimmed).maybeSingle();
      return data?.id ?? null;
    }
    const match = trimmed.match(/^#?ESC-(\d{4})-(\d{3})$/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const sequence = parseInt(match[2], 10);
      const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();
      const yearEnd = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
      const { data } = await client
        .from('escrows')
        .select('id')
        .eq('escrow_sequence', sequence)
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd)
        .maybeSingle();
      return data?.id ?? null;
    }
    return null;
  }

  /**
   * Single activity detail by id (UUID or ESC-YYYY-XXXX)
   */
  async getActivityDetail(idOrRef: string): Promise<AdminBusinessActivityDetailResponse> {
    try {
      const client = this.getAdminClient();
      const escrowUuid = await this.resolveActivityId(client, idOrRef);
      if (!escrowUuid) {
        return { success: false, message: 'Activity not found', error: 'Not found' };
      }

      const { data: escrow, error } = await client
        .from('escrows')
        .select('*')
        .eq('id', escrowUuid)
        .single();

      if (error || !escrow) {
        return {
          success: false,
          message: error?.message || 'Activity not found',
          error: error?.message || 'Not found',
        };
      }

      const businessIds = await this.getBusinessSuiteUserIds(client);
      const isBusinessEscrow = businessIds.length > 0 && businessIds.includes(escrow.user_id);
      if (!isBusinessEscrow) {
        return {
          success: false,
          message: 'Activity not found',
          error: 'Not found',
        };
      }

      const userIds = [escrow.user_id].concat(escrow.counterparty_id ? [escrow.counterparty_id] : []);
      const { data: users } = await client.from('users').select('id, full_name, email').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: any) => {
        acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
        return acc;
      }, {});

      const year = escrow.created_at ? new Date(escrow.created_at).getUTCFullYear() : new Date().getFullYear();
      const seq = escrow.escrow_sequence ?? 0;
      const activityId = formatEscrowId(year, seq);
      const party1Name = escrow.payer_name || userMap[escrow.user_id]?.full_name || '—';
      const party2Name = escrow.counterparty_name || (escrow.counterparty_id ? userMap[escrow.counterparty_id]?.full_name : null) || '—';
      const name = `${party1Name}, ${party2Name}`.trim();
      const address = (escrow.description || '').trim() || '—';
      const status = ESCROW_STATUS_TO_ACTIVITY[escrow.status] ?? 'Pending';

      return {
        success: true,
        message: 'Activity detail retrieved',
        data: {
          id: escrow.id,
          activityId,
          description: { name, address },
          status,
          date: formatActivityDate(escrow.updated_at || escrow.created_at),
          party1: {
            id: escrow.user_id,
            name: party1Name,
            email: userMap[escrow.user_id]?.email,
          },
          party2: escrow.counterparty_id
            ? { id: escrow.counterparty_id, name: party2Name, email: userMap[escrow.counterparty_id]?.email }
            : { id: null, name: party2Name, email: undefined },
          amountUsd: Number(escrow.amount_usd || 0),
          amountXrp: Number(escrow.amount_xrp || 0),
          createdAt: escrow.created_at,
          updatedAt: escrow.updated_at,
          completedAt: escrow.completed_at,
          transactionType: escrow.transaction_type,
          industry: escrow.industry,
        },
      };
    } catch (e) {
      console.error('Admin business management getActivityDetail error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get activity detail',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminBusinessManagementService = new AdminBusinessManagementService();
