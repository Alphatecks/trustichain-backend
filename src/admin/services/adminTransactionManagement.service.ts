/**
 * Admin Transaction Management Service
 * Overview stats, transaction list, and detail. Uses supabaseAdmin to bypass RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  AdminTransactionOverviewResponse,
  AdminTransactionListParams,
  AdminTransactionListResponse,
  AdminTransactionDetailResponse,
  AdminTransactionStatus,
  AdminTransactionType,
} from '../../types/api/adminTransactionManagement.types';

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal Request',
  escrow_create: 'Escrow Create',
  escrow_release: 'Escrow Release',
  escrow_cancel: 'Escrow Cancel',
  transfer: 'Funds Transfer',
  swap: 'Swap',
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Successful',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} weeks ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

function shortTransactionId(id: string): string {
  if (!id || id.length < 18) return id;
  return id.replace(/-/g, '').slice(0, 18).toUpperCase();
}

export class AdminTransactionManagementService {
  private getAdminClient(): SupabaseClient {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin transaction management using anon client; RLS may restrict data.');
    }
    return client;
  }

  /**
   * Overview: total transaction count, total amount, escrowed amount, payroll amount + change %
   */
  async getOverview(): Promise<AdminTransactionOverviewResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const [
        { data: allTx },
        { data: txBeforeThisMonth },
        { data: escrowsActive },
        { data: escrowsActiveBeforeMonth },
      ] = await Promise.all([
        client.from('transactions').select('id, amount_usd, created_at'),
        client.from('transactions').select('id, amount_usd').lt('created_at', thisMonthStart.toISOString()),
        client.from('escrows').select('amount_usd').in('status', ['pending', 'active']),
        client.from('escrows').select('amount_usd').in('status', ['pending', 'active']).lt('updated_at', thisMonthStart.toISOString()),
      ]);

      const list = allTx || [];
      const beforeList = txBeforeThisMonth || [];
      const totalCount = list.length;
      const countBefore = beforeList.length;
      const totalAmountUsd = list.reduce((s: number, t: { amount_usd: number }) => s + Number(t.amount_usd || 0), 0);
      const amountBefore = beforeList.reduce((s: number, t: { amount_usd: number }) => s + Number(t.amount_usd || 0), 0);

      const escrowedList = escrowsActive || [];
      const escrowedBefore = escrowsActiveBeforeMonth || [];
      const escrowedAmountUsd = escrowedList.reduce((s: number, e: { amount_usd: number }) => s + Number(e.amount_usd || 0), 0);
      const escrowedAmountBefore = escrowedBefore.reduce((s: number, e: { amount_usd: number }) => s + Number(e.amount_usd || 0), 0);

      // Payroll: no dedicated type; use sum of 'transfer' as proxy or 0
      const { data: payrollTx } = await client.from('transactions').select('amount_usd').eq('type', 'transfer');
      const { data: payrollTxBefore } = await client.from('transactions').select('amount_usd').eq('type', 'transfer').lt('created_at', thisMonthStart.toISOString());
      const payrollAmountUsd = (payrollTx || []).reduce((s: number, t: { amount_usd: number }) => s + Number(t.amount_usd || 0), 0);
      const payrollAmountBefore = (payrollTxBefore || []).reduce((s: number, t: { amount_usd: number }) => s + Number(t.amount_usd || 0), 0);

      const percent = (current: number, previous: number) =>
        previous === 0 ? undefined : Math.round(((current - previous) / previous) * 100);

      return {
        success: true,
        message: 'Transaction overview retrieved',
        data: {
          totalTransactionCount: totalCount,
          totalTransactionCountChangePercent: percent(totalCount, countBefore),
          totalAmountUsd: Math.round(totalAmountUsd * 100) / 100,
          totalAmountUsdChangePercent: percent(totalAmountUsd, amountBefore),
          escrowedAmountUsd: Math.round(escrowedAmountUsd * 100) / 100,
          escrowedAmountUsdChangePercent: percent(escrowedAmountUsd, escrowedAmountBefore),
          payrollAmountUsd: Math.round(payrollAmountUsd * 100) / 100,
          payrollAmountUsdChangePercent: percent(payrollAmountUsd, payrollAmountBefore),
        },
      };
    } catch (e) {
      console.error('Admin transaction management getOverview error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get transaction overview',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Paginated transaction list with search, accountType (personal/business_suite), status, type
   */
  async getTransactionList(params: AdminTransactionListParams): Promise<AdminTransactionListResponse> {
    try {
      const client = this.getAdminClient();
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const sortBy = params.sortBy ?? 'created_at';
      const sortOrder = params.sortOrder ?? 'desc';
      const accountType = params.accountType;
      const status = params.status;
      const type = params.type;
      const search = (params.search || '').trim();
      const from = (page - 1) * pageSize;

      let userIdsFilter: string[] | null = null;
      if (accountType) {
        const atValue = accountType === 'business_suite' ? 'business_suite' : null;
        const { data: usersWithType } = atValue
          ? await client.from('users').select('id').eq('account_type', atValue)
          : await client.from('users').select('id').or('account_type.is.null,account_type.neq.business_suite');
        userIdsFilter = (usersWithType || []).map((u: { id: string }) => u.id);
        if (userIdsFilter.length === 0) {
          return {
            success: true,
            message: 'Transaction list retrieved',
            data: { items: [], total: 0, page, pageSize, totalPages: 0 },
          };
        }
      }

      let searchUserIds: string[] = [];
      if (search) {
        const { data: usersByName } = await client.from('users').select('id').ilike('full_name', `%${search}%`);
        searchUserIds = (usersByName || []).map((u: { id: string }) => u.id);
        if (userIdsFilter && userIdsFilter.length > 0) {
          searchUserIds = searchUserIds.filter((id) => userIdsFilter!.includes(id));
        }
      }

      let query = client
        .from('transactions')
        .select('id, user_id, type, amount_usd, amount_xrp, status, escrow_id, created_at', { count: 'exact' });

      if (userIdsFilter && userIdsFilter.length > 0) {
        query = query.in('user_id', userIdsFilter);
      }
      if (search) {
        if (searchUserIds.length > 0) {
          query = query.or(`user_id.in.(${searchUserIds.join(',')}),description.ilike.%${search}%`);
        } else {
          query = query.ilike('description', `%${search}%`);
        }
      }
      if (status) query = query.eq('status', status);
      if (type) query = query.eq('type', type);

      const orderCol = sortBy === 'amount_usd' ? 'amount_usd' : sortBy === 'type' ? 'type' : sortBy === 'status' ? 'status' : 'created_at';
      query = query.order(orderCol, { ascending: sortOrder === 'asc' });

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
          message: 'Transaction list retrieved',
          data: { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
        };
      }

      const userIds = [...new Set(list.map((t: { user_id: string }) => t.user_id))];
      const { data: users } = await client.from('users').select('id, full_name').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, string>>((acc, u: any) => {
        acc[u.id] = u.full_name || '—';
        return acc;
      }, {});

      const items = list.map((t: any) => {
        const createdAt = t.created_at ? new Date(t.created_at) : null;
        return {
          id: t.id,
          transactionId: shortTransactionId(t.id),
          type: t.type as AdminTransactionType,
          typeLabel: TRANSACTION_TYPE_LABELS[t.type] || t.type,
          userId: t.user_id,
          userName: userMap[t.user_id] || '—',
          amountUsd: Number(t.amount_usd || 0),
          amountXrp: Number(t.amount_xrp || 0),
          status: t.status as AdminTransactionStatus,
          statusLabel: TRANSACTION_STATUS_LABELS[t.status] || t.status,
          currency: 'USD',
          createdAt: t.created_at,
          createdAtAgo: createdAt ? timeAgo(createdAt) : undefined,
          escrowId: t.escrow_id || null,
        };
      });

      const total = count ?? 0;
      return {
        success: true,
        message: 'Transaction list retrieved',
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (e) {
      console.error('Admin transaction management getTransactionList error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get transaction list',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Get single transaction detail by id (UUID)
   */
  async getTransactionDetail(transactionId: string): Promise<AdminTransactionDetailResponse> {
    try {
      const client = this.getAdminClient();
      const id = (transactionId || '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) {
        return {
          success: false,
          message: 'Transaction not found',
          error: 'Invalid transaction id',
        };
      }

      const { data: tx, error } = await client
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !tx) {
        return {
          success: false,
          message: error?.message || 'Transaction not found',
          error: error?.message || 'Not found',
        };
      }

      const { data: user } = await client.from('users').select('id, full_name, email').eq('id', tx.user_id).single();
      const userName = (user as any)?.full_name || '—';
      const userEmail = (user as any)?.email;
      const createdAt = tx.created_at ? new Date(tx.created_at) : null;

      return {
        success: true,
        message: 'Transaction detail retrieved',
        data: {
          id: tx.id,
          transactionId: shortTransactionId(tx.id),
          type: tx.type as AdminTransactionType,
          typeLabel: TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
          userId: tx.user_id,
          userName,
          userEmail,
          amountUsd: Number(tx.amount_usd || 0),
          amountXrp: Number(tx.amount_xrp || 0),
          status: tx.status as AdminTransactionStatus,
          statusLabel: TRANSACTION_STATUS_LABELS[tx.status] || tx.status,
          currency: 'USD',
          description: tx.description,
          xrplTxHash: tx.xrpl_tx_hash,
          escrowId: tx.escrow_id,
          createdAt: tx.created_at,
          createdAtAgo: createdAt ? timeAgo(createdAt) : undefined,
        },
      };
    } catch (e) {
      console.error('Admin transaction management getTransactionDetail error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get transaction detail',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminTransactionManagementService = new AdminTransactionManagementService();
