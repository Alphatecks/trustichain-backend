/**
 * Sandbox Environment (Developers Tool) – stats, reset, create sandbox key.
 */

import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  SandboxStatsData,
  SandboxStatsResponse,
  SandboxResetResponse,
  CreateSandboxKeyRequest,
  CreateSandboxKeyResponse,
  SandboxStatsCard,
  SandboxPermission,
  ListSandboxKeysQuery,
  ListSandboxKeysResponse,
  SandboxKeyListItem,
  SandboxKeyDetailResponse,
  SandboxTestWalletResponse,
  SandboxTestEscrowResponse,
  ListSandboxLogsQuery,
  ListSandboxLogsResponse,
  SandboxWebhookStatsResponse,
  SandboxWebhookStatsData,
  ListSandboxWebhookLogsQuery,
  ListSandboxWebhookLogsResponse,
  SandboxWebhookLogDetailResponse,
  SandboxWebhookLogStatus,
  SandboxSimulateResponse,
} from '../../types/api/sandbox.types';

const SANDBOX_PERMISSIONS: SandboxPermission[] = [
  'cancel_escrow',
  'create_escrow',
  'release_escrow',
  'create_wallet',
  'read_wallet',
  'transaction_logs',
  'webhook_test_events',
];

const IP_OR_CIDR_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

function normalizeIpAllowlist(input: string[] | string | undefined): string[] | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(input)) {
    const list = input.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    return list.length ? list : null;
  }
  return null;
}

function validateIpOrCidr(entry: string): boolean {
  return IP_OR_CIDR_REGEX.test(entry);
}

function normalizePermissions(input: SandboxPermission[] | undefined): SandboxPermission[] | null {
  if (!input || !Array.isArray(input) || input.length === 0) return null;
  const valid = input.filter((p): p is SandboxPermission => SANDBOX_PERMISSIONS.includes(p));
  return valid.length ? valid : null;
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatSandboxLogTime(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export class SandboxService {
  /**
   * GET /api/business-suite/sandbox/stats – dashboard cards: Total Sandbox Keys, Sandbox Transactions, Errors (24h), Test Wallets.
   */
  async getSandboxStats(userId: string): Promise<SandboxStatsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const thisMonthStartIso = thisMonthStart.toISOString();
    const lastMonthStartIso = lastMonthStart.toISOString();
    const twentyFourHoursAgoIso = twentyFourHoursAgo.toISOString();

    // Total Sandbox Keys (count) + locked USD
    const { count: totalKeysCount } = await client
      .from('sandbox_keys')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    const { data: balanceRow } = await client
      .from('sandbox_balances')
      .select('locked_usd')
      .eq('business_id', businessId)
      .single();

    const lockedUsd = balanceRow?.locked_usd != null ? Number(balanceRow.locked_usd) : 0;
    const totalSandboxKeys: SandboxStatsCard = {
      value: totalKeysCount ?? 0,
      secondary: lockedUsd > 0 ? `$${lockedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} locked` : undefined,
      trendPercent: 0,
      period: 'This month',
    };

    // Sandbox Transactions this month + last month (for trend)
    const { count: transactionsThisMonth } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const { count: transactionsLastMonth } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', lastMonthStartIso)
      .lt('created_at', thisMonthStartIso);

    const txThis = transactionsThisMonth ?? 0;
    const txLast = transactionsLastMonth ?? 0;
    const sandboxTransactions: SandboxStatsCard = {
      value: txThis,
      period: 'This month',
      trendPercent: trendPercent(txThis, txLast),
    };

    // Errors (24h)
    const { count: errors24hCount } = await client
      .from('sandbox_errors')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', twentyFourHoursAgoIso);

    const errors24h: SandboxStatsCard = {
      value: errors24hCount ?? 0,
      period: 'This month',
    };

    // Test Wallets this month
    const { count: testWalletsCount } = await client
      .from('test_wallets')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const testWallets: SandboxStatsCard = {
      value: testWalletsCount ?? 0,
      period: 'This month',
    };

    const data: SandboxStatsData = {
      totalSandboxKeys,
      sandboxTransactions,
      errors24h,
      testWallets,
    };

    return {
      success: true,
      message: 'Sandbox stats retrieved',
      data,
    };
  }

  /**
   * GET /api/business-suite/sandbox/logs – Unified logs for "Sandbox Logs" table.
   * Sources:
   * - OK: sandbox_transactions.transaction_type (used as event text)
   * - ERROR: sandbox_errors.message
   */
  async listSandboxLogs(userId: string, query: ListSandboxLogsQuery): Promise<ListSandboxLogsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const status = query.status ?? 'all';

    const client = supabaseAdmin!;
    const offset = (page - 1) * pageSize;
    const to = offset + pageSize - 1;

    const mapTxRow = (r: Record<string, unknown>) => ({
      id: r.id as string,
      event: (r.transaction_type as string) ?? 'Sandbox Transaction',
      status: 'OK' as const,
      createdAt: (r.created_at as string) ?? '',
      time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
    });

    const mapErrRow = (r: Record<string, unknown>) => ({
      id: r.id as string,
      event: (r.message as string) ?? 'Sandbox Error',
      status: 'ERROR' as const,
      createdAt: (r.created_at as string) ?? '',
      time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
    });

    if (status === 'OK') {
      const from = offset;
      const { data: rows, error, count } = await client
        .from('sandbox_transactions')
        .select('id, transaction_type, created_at', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        return { success: false, message: error.message || 'Failed to list sandbox logs', error: error.message };
      }

      const logs = (rows ?? []).map(mapTxRow);
      return {
        success: true,
        message: 'Sandbox logs retrieved',
        data: { logs, total: count ?? logs.length, page, pageSize },
      };
    }

    if (status === 'ERROR') {
      const from = offset;
      const { data: rows, error, count } = await client
        .from('sandbox_errors')
        .select('id, message, created_at', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        return { success: false, message: error.message || 'Failed to list sandbox logs', error: error.message };
      }

      const logs = (rows ?? []).map(mapErrRow);
      return {
        success: true,
        message: 'Sandbox logs retrieved',
        data: { logs, total: count ?? logs.length, page, pageSize },
      };
    }

    // status === 'all': merge two ordered lists (OK tx + ERROR err).
    const [{ count: totalTx }, { count: totalErr }] = await Promise.all([
      client.from('sandbox_transactions').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
      client.from('sandbox_errors').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
    ]);

    const fetchCount = page * pageSize; // enough to build the requested page after merge+sort

    const [{ data: txRows, error: txError }, { data: errRows, error: errError }] = await Promise.all([
      client
        .from('sandbox_transactions')
        .select('id, transaction_type, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(0, fetchCount - 1),
      client
        .from('sandbox_errors')
        .select('id, message, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(0, fetchCount - 1),
    ]);

    if (txError || errError) {
      return {
        success: false,
        message: txError?.message || errError?.message || 'Failed to list sandbox logs',
        error: txError?.message || errError?.message,
      };
    }

    const merged = [
      ...(txRows ?? []).map(mapTxRow),
      ...(errRows ?? []).map(mapErrRow),
    ].filter((l) => !!l.createdAt);

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const logs = merged.slice(offset, to + 1);

    return {
      success: true,
      message: 'Sandbox logs retrieved',
      data: {
        logs,
        total: (totalTx ?? 0) + (totalErr ?? 0),
        page,
        pageSize,
      },
    };
  }

  /**
   * Webhook Logs (Sandbox) – list unified deliveries.
   *
   * Source tables:
   * - sandbox_transactions => status = Sent, event = transaction_type
   * - sandbox_errors => status = Failed, event = message
   */
  async listSandboxWebhookLogs(
    userId: string,
    query: ListSandboxWebhookLogsQuery
  ): Promise<ListSandboxWebhookLogsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const status = query.status ?? 'all';
    const dateRange = query.dateRange ?? 'monthly';

    let startIso: string | null = null;
    if (dateRange === 'monthly') {
      const now = new Date();
      startIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    } else if (dateRange === 'yearly') {
      const now = new Date();
      startIso = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    }

    const client = supabaseAdmin!;
    const offset = (page - 1) * pageSize;
    const to = offset + pageSize - 1;

    const mapTxRow = (r: Record<string, unknown>): { id: string; event: string; status: SandboxWebhookLogStatus; createdAt: string; time?: string } => ({
      id: r.id as string,
      event: (r.transaction_type as string) ?? 'Payment Received',
      status: 'Sent',
      createdAt: (r.created_at as string) ?? '',
      time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
    });

    const mapErrRow = (r: Record<string, unknown>): { id: string; event: string; status: SandboxWebhookLogStatus; createdAt: string; time?: string } => ({
      id: r.id as string,
      event: (r.message as string) ?? 'Delivery Failed',
      status: 'Failed',
      createdAt: (r.created_at as string) ?? '',
      time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
    });

    const fromFetchCount = page * pageSize;

    // Sent only
    if (status === 'Sent') {
      let q = client
        .from('sandbox_transactions')
        .select('id, transaction_type, created_at', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      if (startIso) q = q.gte('created_at', startIso);
      const { data: rows, error, count } = await q.range(offset, to);

      if (error) {
        return { success: false, message: error.message || 'Failed to list webhook logs', error: error.message };
      }

      const logs = (rows ?? []).map(mapTxRow);
      return { success: true, message: 'Webhook logs retrieved', data: { logs, total: count ?? logs.length, page, pageSize } };
    }

    // Failed only
    if (status === 'Failed') {
      let q = client
        .from('sandbox_errors')
        .select('id, message, created_at', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      if (startIso) q = q.gte('created_at', startIso);
      const { data: rows, error, count } = await q.range(offset, to);

      if (error) {
        return { success: false, message: error.message || 'Failed to list webhook logs', error: error.message };
      }

      const logs = (rows ?? []).map(mapErrRow);
      return { success: true, message: 'Webhook logs retrieved', data: { logs, total: count ?? logs.length, page, pageSize } };
    }

    // all: merge OK + ERROR with pagination
    const [{ count: totalSent }, { count: totalFailed }] = await Promise.all([
      (async () => {
        let q = client.from('sandbox_transactions').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
        if (startIso) q = q.gte('created_at', startIso);
        const { count } = await q;
        return { count };
      })(),
      (async () => {
        let q = client.from('sandbox_errors').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
        if (startIso) q = q.gte('created_at', startIso);
        const { count } = await q;
        return { count };
      })(),
    ]);

    const [{ data: txRows, error: txError }, { data: errRows, error: errError }] = await Promise.all([
      (async () => {
        let q = client
          .from('sandbox_transactions')
          .select('id, transaction_type, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });
        if (startIso) q = q.gte('created_at', startIso);
        return q.range(0, fromFetchCount - 1);
      })(),
      (async () => {
        let q = client
          .from('sandbox_errors')
          .select('id, message, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });
        if (startIso) q = q.gte('created_at', startIso);
        return q.range(0, fromFetchCount - 1);
      })(),
    ]);

    if (txError || errError) {
      return {
        success: false,
        message: txError?.message || errError?.message || 'Failed to list webhook logs',
        error: txError?.message || errError?.message,
      };
    }

    const merged = [
      ...(txRows ?? []).map(mapTxRow),
      ...(errRows ?? []).map(mapErrRow),
    ].filter((l) => !!l.createdAt);

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const logs = merged.slice(offset, to + 1);

    return {
      success: true,
      message: 'Webhook logs retrieved',
      data: {
        logs,
        total: (totalSent ?? 0) + (totalFailed ?? 0),
        page,
        pageSize,
      },
    };
  }

  /**
   * GET /api/business-suite/sandbox/webhook/logs/:id – row action.
   */
  async getSandboxWebhookLogDetail(userId: string, logId: string): Promise<SandboxWebhookLogDetailResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;

    const { data: txRow, error: txError } = await client
      .from('sandbox_transactions')
      .select('id, transaction_type, amount_usd, created_at')
      .eq('business_id', businessId)
      .eq('id', logId)
      .single();

    if (!txError && txRow) {
      const r = txRow as Record<string, unknown>;
      return {
        success: true,
        message: 'Webhook log detail retrieved',
        data: {
          id: r.id as string,
          event: (r.transaction_type as string) ?? 'Payment Received',
          status: 'Sent',
          createdAt: (r.created_at as string) ?? '',
          time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
          amountUsd: r.amount_usd != null ? Number(r.amount_usd) : null,
          errorMessage: null,
        },
      };
    }

    const { data: errRow, error: errError } = await client
      .from('sandbox_errors')
      .select('id, message, created_at')
      .eq('business_id', businessId)
      .eq('id', logId)
      .single();

    if (!errError && errRow) {
      const r = errRow as Record<string, unknown>;
      return {
        success: true,
        message: 'Webhook log detail retrieved',
        data: {
          id: r.id as string,
          event: (r.message as string) ?? 'Delivery Failed',
          status: 'Failed',
          createdAt: (r.created_at as string) ?? '',
          time: r.created_at ? formatSandboxLogTime(r.created_at as string) : undefined,
          amountUsd: null,
          errorMessage: (r.message as string) ?? null,
        },
      };
    }

    if (txError?.message || errError?.message) {
      // Prefer a consistent "not found" response for UI.
    }

    return { success: false, message: 'Webhook log not found', error: 'Not found' };
  }

  /**
   * POST /api/business-suite/sandbox/webhook/logs/reset
   * Clears webhook logs for the current business for the selected date range.
   */
  async resetSandboxWebhookLogs(
    userId: string,
    dateRange: 'monthly' | 'yearly' | 'all'
  ): Promise<SandboxResetResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    let startIso: string | null = null;
    if (dateRange === 'monthly') {
      const now = new Date();
      startIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    } else if (dateRange === 'yearly') {
      const now = new Date();
      startIso = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    }

    if (startIso) {
      await Promise.all([
        client.from('sandbox_transactions').delete().eq('business_id', businessId).gte('created_at', startIso),
        client.from('sandbox_errors').delete().eq('business_id', businessId).gte('created_at', startIso),
      ]);
    } else {
      await Promise.all([
        client.from('sandbox_transactions').delete().eq('business_id', businessId),
        client.from('sandbox_errors').delete().eq('business_id', businessId),
      ]);
    }

    return { success: true, message: 'Webhook logs reset successfully' };
  }

  /**
   * GET /api/business-suite/sandbox/webhook/stats
   * GET /api/business-suite/sandbox/webhooks/stats (alias)
   *
   * Stats source (sandbox tables):
   * - Total/locked: sandbox_balances.locked_usd + sandbox_transactions.amount_usd (month)
   * - Events sent: sandbox_transactions count (month)
   * - Failed deliveries: sandbox_errors count (month)
   * - Last event received: sandbox_transactions count (last 7 days)
   */
  async getSandboxWebhookStats(userId: string): Promise<SandboxWebhookStatsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const thisMonthStartIso = thisMonthStart.toISOString();
    const last7DaysIso = last7DaysAgo.toISOString();

    // Locked USD (secondary)
    const { data: balanceRow } = await client
      .from('sandbox_balances')
      .select('locked_usd')
      .eq('business_id', businessId)
      .single();
    const lockedUsd = balanceRow?.locked_usd != null ? Number(balanceRow.locked_usd) : 0;

    // Events sent + total USD for the month
    const { count: eventsSentMonth } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const { data: txAmountRows } = await client
      .from('sandbox_transactions')
      .select('amount_usd')
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const monthTxUsd = (txAmountRows ?? []).reduce((acc, r: Record<string, unknown>) => {
      const amt = r.amount_usd != null ? Number(r.amount_usd) : 0;
      return acc + (Number.isFinite(amt) ? amt : 0);
    }, 0);

    // Failed deliveries (month)
    const { count: failedDeliveriesMonth } = await client
      .from('sandbox_errors')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    // Last event received: last 7 days count (value card)
    const { count: last7DaysReceived } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', last7DaysIso);

    const totalWebhooksUsd = monthTxUsd + lockedUsd;

    const data: SandboxWebhookStatsData = {
      totalWebhooks: {
        value: totalWebhooksUsd,
        secondary: lockedUsd > 0 ? `$${lockedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} locked` : undefined,
      },
      eventsSent: {
        value: eventsSentMonth ?? 0,
        secondary: 'This month',
      },
      failedDeliveries: {
        value: failedDeliveriesMonth ?? 0,
        secondary: 'This month',
      },
      lastEventReceived: {
        value: last7DaysReceived ?? 0,
        secondary: 'Last 7 days',
      },
    };

    return {
      success: true,
      message: 'Webhook stats retrieved',
      data,
    };
  }

  /**
   * POST /api/business-suite/sandbox/reset – reset sandbox data for this business.
   */
  async resetSandboxData(userId: string): Promise<SandboxResetResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;

    await client.from('sandbox_errors').delete().eq('business_id', businessId);
    await client.from('sandbox_transactions').delete().eq('business_id', businessId);
    await client.from('sandbox_test_escrows').delete().eq('business_id', businessId);
    await client.from('test_wallets').delete().eq('business_id', businessId);
    await client.from('sandbox_keys').delete().eq('business_id', businessId);
    await client.from('sandbox_balances').delete().eq('business_id', businessId);

    return {
      success: true,
      message: 'Sandbox data reset successfully',
    };
  }

  /**
   * POST /api/business-suite/sandbox/keys – create sandbox key (Create New Sandbox Key modal). keySecret returned once.
   */
  async createSandboxKey(userId: string, body: CreateSandboxKeyRequest): Promise<CreateSandboxKeyResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const environmentName =
      typeof body?.environmentName === 'string' && body.environmentName.trim()
        ? body.environmentName.trim()
        : typeof body?.name === 'string' && body.name.trim()
          ? body.name.trim()
          : 'Sandbox Key';
    const environmentPurpose =
      typeof body?.environmentPurpose === 'string' && body.environmentPurpose.trim()
        ? body.environmentPurpose.trim()
        : null;
    const autoGenerateKeys = body?.autoGenerateKeys !== false;

    const allowedIps = normalizeIpAllowlist(body?.ipAllowlist);
    if (allowedIps != null) {
      const invalid = allowedIps.find((ip) => !validateIpOrCidr(ip));
      if (invalid) {
        return {
          success: false,
          message: `Invalid IP or CIDR: ${invalid}. Use e.g. 192.168.1.1 or 10.0.0.0/24`,
          error: 'Validation',
        };
      }
    }

    const permissions = normalizePermissions(body?.permissions);

    const secretPart = crypto.randomBytes(32).toString('hex');
    const keySecret = `tch_sandbox_${secretPart}`;
    const keyPrefix = keySecret.slice(0, 14) + '...';
    const keyHash = crypto.createHash('sha256').update(keySecret).digest('hex');

    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('sandbox_keys')
      .insert({
        business_id: businessId,
        name: environmentName,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        environment_name: environmentName,
        environment_purpose: environmentPurpose,
        auto_generate_keys: autoGenerateKeys,
        allowed_ips: allowedIps,
        permissions: permissions,
        is_active: true,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to create sandbox key', error: error.message };
    }
    if (!row) {
      return { success: false, message: 'Failed to create sandbox key', error: 'No row returned' };
    }

    const created = row as { id: string; created_at: string };
    return {
      success: true,
      message: 'Sandbox key created. Store the key secret securely; it will not be shown again.',
      data: {
        keyId: created.id,
        keySecret,
        secretKey: keyPrefix,
        keyPrefix,
        name: environmentName,
        environmentName: environmentName,
        environmentPurpose,
        autoGenerateKeys,
        ipAllowlist: allowedIps,
        permissions,
        status: 'active',
        createdAt: created.created_at,
      },
    };
  }

  /**
   * GET /api/business-suite/sandbox/keys – list sandbox keys for table (filter, date range).
   */
  async listSandboxKeys(userId: string, query: ListSandboxKeysQuery): Promise<ListSandboxKeysResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const dateRange = query.dateRange || 'all';

    let monthStart: string | null = null;
    let monthEnd: string | null = null;
    if (dateRange === 'monthly' || dateRange === 'yearly') {
      const now = new Date();
      if (dateRange === 'monthly') {
        monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        monthEnd = new Date().toISOString();
      } else {
        monthStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
        monthEnd = new Date().toISOString();
      }
    }

    const client = supabaseAdmin!;
    let q = client
      .from('sandbox_keys')
      .select('id, name, key_prefix, is_active, created_at', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (query.status && query.status !== 'all') {
      q = q.eq('is_active', query.status === 'Successful');
    }
    if (monthStart) {
      q = q.gte('created_at', monthStart);
    }
    if (monthEnd && dateRange === 'monthly') {
      q = q.lte('created_at', monthEnd);
    }

    const from = (page - 1) * pageSize;
    const { data: rows, error, count } = await q.range(from, from + pageSize - 1);

    if (error) {
      return { success: false, message: error.message || 'Failed to list sandbox keys', error: error.message };
    }

    const keys: SandboxKeyListItem[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.name as string) ?? '',
      publicKey: (r.key_prefix as string) ?? '',
      status: (r.is_active as boolean) === true ? 'Successful' : 'Inactive',
      dateCreated: (r.created_at as string) ? (r.created_at as string).slice(0, 10) : '',
    }));

    return {
      success: true,
      message: 'Sandbox keys list retrieved',
      data: { keys, total: count ?? keys.length, page, pageSize },
    };
  }

  /**
   * GET /api/business-suite/sandbox/keys/:id – sandbox key detail (row action).
   */
  async getSandboxKeyDetail(userId: string, keyId: string): Promise<SandboxKeyDetailResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('sandbox_keys')
      .select('id, name, key_prefix, is_active, created_at, environment_name, environment_purpose, permissions')
      .eq('id', keyId)
      .eq('business_id', businessId)
      .single();

    if (error || !row) {
      return { success: false, message: error?.message ?? 'Sandbox key not found', error: 'Not found' };
    }

    const r = row as Record<string, unknown>;
    return {
      success: true,
      message: 'Sandbox key detail retrieved',
      data: {
        id: r.id as string,
        name: (r.name as string) ?? '',
        publicKey: (r.key_prefix as string) ?? '',
        status: (r.is_active as boolean) === true ? 'Successful' : 'Inactive',
        dateCreated: (r.created_at as string) ? (r.created_at as string).slice(0, 10) : '',
        environmentName: (r.environment_name as string) ?? null,
        environmentPurpose: (r.environment_purpose as string) ?? null,
        permissions: (r.permissions as SandboxPermission[] | null) ?? null,
        createdAt: (r.created_at as string) ?? '',
      },
    };
  }

  /**
   * POST /api/business-suite/sandbox/test-wallet/generate – Testing Tools: Generate test wallet. Returns address for Copy.
   */
  async generateTestWallet(userId: string): Promise<SandboxTestWalletResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const address = 'r' + crypto.randomBytes(20).toString('hex');
    const client = supabaseAdmin!;
    await client.from('test_wallets').insert({ business_id: businessId, address });

    return {
      success: true,
      message: 'Test wallet generated',
      data: { address, copyValue: address },
    };
  }

  /**
   * POST /api/business-suite/sandbox/test-escrow/create – Testing Tools: Create test escrow. Returns reference for Copy.
   */
  async createTestEscrow(userId: string): Promise<SandboxTestEscrowResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const year = new Date().getUTCFullYear();
    const refNum = Math.floor(Math.random() * 999) + 1;
    const reference = `SBX-ESC-${year}-${String(refNum).padStart(3, '0')}`;

    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('sandbox_test_escrows')
      .insert({ business_id: businessId, reference, amount_usd: 0, status: 'active' })
      .select('id')
      .single();

    if (error || !row) {
      return { success: false, message: error?.message ?? 'Failed to create test escrow', error: error.message };
    }

    const escrowId = (row as { id: string }).id;

    // Write a log row so the "Sandbox Logs" table can show escrow creation events.
    const logMessage = `Escrow#${refNum} Created`;
    const logInsert = await client.from('sandbox_transactions').insert({
      business_id: businessId,
      amount_usd: 0,
      transaction_type: logMessage,
    });
    if (logInsert.error) {
      return { success: false, message: logInsert.error.message || 'Failed to write sandbox log', error: logInsert.error.message };
    }

    return {
      success: true,
      message: 'Test escrow created',
      data: { escrowId, reference, copyValue: reference },
    };
  }

  /**
   * POST /api/business-suite/sandbox/subscription-renewal/simulate – Testing Tools: Simulate subscription renewal.
   */
  async simulateSubscriptionRenewal(userId: string): Promise<SandboxSimulateResponse> {
    return this.simulateEvent(userId, 'subscription_renewal');
  }

  /**
   * POST /api/business-suite/sandbox/dispute/simulate – Testing Tools: Simulate dispute.
   */
  async simulateDispute(userId: string): Promise<SandboxSimulateResponse> {
    return this.simulateEvent(userId, 'dispute');
  }

  /**
   * POST /api/business-suite/sandbox/payment-success/simulate – Testing Tools: Simulate payment success.
   */
  async simulatePaymentSuccess(userId: string): Promise<SandboxSimulateResponse> {
    return this.simulateEvent(userId, 'payment_success');
  }

  /**
   * POST /api/business-suite/sandbox/payment-failed/simulate – Testing Tools: Simulate failed payment.
   */
  async simulatePaymentFailed(userId: string): Promise<SandboxSimulateResponse> {
    return this.simulateEvent(userId, 'payment_failed');
  }

  private async simulateEvent(
    userId: string,
    eventType: string
  ): Promise<SandboxSimulateResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const eventId = `evt_${eventType}_${crypto.randomBytes(8).toString('hex')}`;

    const logMessageByEventType: Record<string, string> = {
      subscription_renewal: 'Subscription Renewal Simulated',
      dispute: 'Dispute Simulated',
      payment_success: 'Payment Successful (Test Card)',
      payment_failed: 'Payment Failed (Test Card)',
    };
    const logMessage = logMessageByEventType[eventType] ?? `Simulated ${eventType.replace(/_/g, ' ')}`;
    const client = supabaseAdmin!;

    // payment_failed is stored as an ERROR row; others are OK (transactions).
    if (eventType === 'payment_failed') {
      const ins = await client.from('sandbox_errors').insert({
        business_id: businessId,
        message: logMessage,
      });
      if (ins.error) {
        return { success: false, message: ins.error.message || 'Failed to write sandbox error log', error: ins.error.message };
      }
    } else {
      const ins = await client.from('sandbox_transactions').insert({
        business_id: businessId,
        amount_usd: 0,
        transaction_type: logMessage,
      });
      if (ins.error) {
        return { success: false, message: ins.error.message || 'Failed to write sandbox transaction log', error: ins.error.message };
      }
    }

    return {
      success: true,
      message: `Simulated ${eventType.replace(/_/g, ' ')}`,
      data: { eventId, copyValue: eventId },
    };
  }
}

export const sandboxService = new SandboxService();
