/**
 * Admin Escrow Management Service
 * Stats, list, detail, and status update for escrows. Uses supabaseAdmin to bypass RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  AdminEscrowManagementStatsResponse,
  AdminEscrowListParams,
  AdminEscrowListResponse,
  AdminEscrowDetailResponse,
  AdminEscrowUpdateStatusResponse,
  AdminEscrowStatus,
  AdminEscrowFeesBalanceResponse,
  AdminEscrowFeesWithdrawResponse,
} from '../../types/api/adminEscrowManagement.types';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { Wallet } from 'xrpl/dist/npm/Wallet';
import { exchangeService } from '../../services/exchange/exchange.service';

function formatEscrowId(year: number, sequence: number): string {
  return `ESC-${year}-${sequence.toString().padStart(3, '0')}`;
}

export class AdminEscrowManagementService {
  private getAdminClient() {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin escrow management using anon client; RLS may restrict data.');
    }
    return client;
  }

  /**
   * Dashboard stats: total amount, total escrows, completed, disputed + change % vs last month
   */
  async getStats(): Promise<AdminEscrowManagementStatsResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

      const [
        { data: allEscrows },
        { data: escrowsBeforeThisMonth },
        { data: completedEscrows },
        { data: completedThisMonth },
        { data: completedLastMonth },
        { data: disputedEscrows },
        { data: disputedThisMonth },
        { data: disputedLastMonth },
        { data: feeBalanceRow },
      ] = await Promise.all([
        client.from('escrows').select('amount_usd, status, created_at'),
        client.from('escrows').select('amount_usd, created_at').lt('created_at', thisMonthStart.toISOString()),
        client.from('escrows').select('id').eq('status', 'completed'),
        client.from('escrows').select('id').eq('status', 'completed').gte('completed_at', thisMonthStart.toISOString()),
        client.from('escrows').select('id').eq('status', 'completed').gte('completed_at', lastMonthStart.toISOString()).lt('completed_at', thisMonthStart.toISOString()),
        client.from('escrows').select('id').eq('status', 'disputed'),
        client.from('escrows').select('id').eq('status', 'disputed').gte('updated_at', thisMonthStart.toISOString()),
        client.from('escrows').select('id').eq('status', 'disputed').gte('updated_at', lastMonthStart.toISOString()).lt('updated_at', thisMonthStart.toISOString()),
        client.from('platform_escrow_fee_balance').select('balance_xrp').eq('id', 'default').maybeSingle(),
      ]);

      const list = allEscrows || [];
      const beforeThisMonthList = escrowsBeforeThisMonth || [];
      const totalAmountUsd = list.reduce((sum: number, e: { amount_usd: number }) => sum + Number(e.amount_usd || 0), 0);
      const amountBeforeThisMonth = beforeThisMonthList.reduce((sum: number, e: { amount_usd: number }) => sum + Number(e.amount_usd || 0), 0);
      const totalCount = list.length;

      const completedCount = (completedEscrows || []).length;
      const completedThisMonthCount = (completedThisMonth || []).length;
      const completedLastMonthCount = (completedLastMonth || []).length;
      const disputedCount = (disputedEscrows || []).length;
      const disputedThisMonthCount = (disputedThisMonth || []).length;
      const disputedLastMonthCount = (disputedLastMonth || []).length;

      const percent = (current: number, previous: number) =>
        previous === 0 ? undefined : Math.round(((current - previous) / previous) * 100);
      const countBeforeThisMonth = beforeThisMonthList.length;

      const escrowFeesBalanceXrp = feeBalanceRow ? Number(feeBalanceRow.balance_xrp || 0) : 0;

      return {
        success: true,
        message: 'Escrow management stats retrieved',
        data: {
          totalAmountUsd: Math.round(totalAmountUsd * 100) / 100,
          totalAmountUsdChangePercent: percent(totalAmountUsd, amountBeforeThisMonth),
          totalEscrowCount: totalCount,
          totalEscrowCountChangePercent: percent(totalCount, countBeforeThisMonth),
          completedCount,
          completedCountChangePercent: percent(completedThisMonthCount, completedLastMonthCount),
          disputedCount,
          disputedCountChangePercent: percent(disputedThisMonthCount, disputedLastMonthCount),
          escrowFeesBalanceXrp: Math.round(escrowFeesBalanceXrp * 1000000) / 1000000,
        },
      };
    } catch (e) {
      console.error('Admin escrow management getStats error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get escrow stats',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Paginated, filterable, sortable list of escrows with party names
   */
  async getEscrowList(params: AdminEscrowListParams): Promise<AdminEscrowListResponse> {
    try {
      const client = this.getAdminClient();
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const sortBy = params.sortBy ?? 'created_at';
      const sortOrder = params.sortOrder ?? 'desc';
      const status = params.status;
      const search = (params.search || '').trim().toLowerCase();

      let query = client
        .from('escrows')
        .select('id, user_id, counterparty_id, amount_usd, amount_xrp, status, created_at, updated_at, escrow_sequence, payer_name, counterparty_name', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`description.ilike.%${search}%,payer_name.ilike.%${search}%,counterparty_name.ilike.%${search}%`);
      }

      const orderCol = sortBy === 'amount_usd' ? 'amount_usd' : sortBy === 'updated_at' ? 'updated_at' : 'created_at';
      query = query.order(orderCol, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const { data: rows, error, count } = await query.range(from, from + pageSize - 1);

      if (error) {
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
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
        const escrowId = formatEscrowId(year, seq);
        const party1Name = e.payer_name || nameByUserId[e.user_id] || '—';
        const party2Name = e.counterparty_name || (e.counterparty_id ? nameByUserId[e.counterparty_id] : null) || '—';
        return {
          id: e.id,
          escrowId,
          party1Name,
          party2Name,
          party1Id: e.user_id,
          party2Id: e.counterparty_id,
          amountUsd: Number(e.amount_usd || 0),
          amountXrp: Number(e.amount_xrp || 0),
          status: e.status as AdminEscrowStatus,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        };
      });

      return {
        success: true,
        message: 'Escrow list retrieved',
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    } catch (e) {
      console.error('Admin escrow management getEscrowList error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get escrow list',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve escrow identifier to UUID (supports UUID or ESC-YYYY-XXX)
   */
  private async resolveEscrowId(client: SupabaseClient, idOrRef: string): Promise<string | null> {
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
   * Get full escrow detail by id (UUID or ESC-YYYY-XXX)
   */
  async getEscrowDetail(idOrRef: string): Promise<AdminEscrowDetailResponse> {
    try {
      const client = this.getAdminClient();
      const escrowUuid = await this.resolveEscrowId(client, idOrRef);
      if (!escrowUuid) {
        return {
          success: false,
          message: 'Escrow not found',
          error: 'Not found',
        };
      }

      const { data: escrow, error } = await client
        .from('escrows')
        .select('*')
        .eq('id', escrowUuid)
        .single();

      if (error || !escrow) {
        return {
          success: false,
          message: error?.message || 'Escrow not found',
          error: error?.message || 'Not found',
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
      const escrowId = formatEscrowId(year, seq);
      const party1Name = escrow.payer_name || userMap[escrow.user_id]?.full_name || '—';
      const party2Name = escrow.counterparty_name || (escrow.counterparty_id ? userMap[escrow.counterparty_id]?.full_name : null) || '—';

      return {
        success: true,
        message: 'Escrow detail retrieved',
        data: {
          id: escrow.id,
          escrowId,
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
          status: escrow.status as AdminEscrowStatus,
          description: escrow.description,
          transactionType: escrow.transaction_type,
          industry: escrow.industry,
          progress: escrow.progress != null ? Number(escrow.progress) : undefined,
          createdAt: escrow.created_at,
          updatedAt: escrow.updated_at,
          completedAt: escrow.completed_at,
          xrplEscrowId: escrow.xrpl_escrow_id,
          releaseType: escrow.release_type,
          expectedCompletionDate: escrow.expected_completion_date,
          expectedReleaseDate: escrow.expected_release_date,
        },
      };
    } catch (e) {
      console.error('Admin escrow management getEscrowDetail error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get escrow detail',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Update escrow status (admin override)
   */
  async updateEscrowStatus(idOrRef: string, status: AdminEscrowStatus): Promise<AdminEscrowUpdateStatusResponse> {
    try {
      const client = this.getAdminClient();
      const validStatuses: AdminEscrowStatus[] = ['pending', 'active', 'completed', 'cancelled', 'disputed'];
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          error: 'Bad request',
        };
      }

      const escrowUuid = await this.resolveEscrowId(client, idOrRef);
      if (!escrowUuid) {
        return {
          success: false,
          message: 'Escrow not found',
          error: 'Not found',
        };
      }

      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await client.from('escrows').update(updates).eq('id', escrowUuid);

      if (error) {
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
      }

      return {
        success: true,
        message: 'Escrow status updated',
        data: { status },
      };
    } catch (e) {
      console.error('Admin escrow management updateEscrowStatus error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update status',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Get platform escrow fee balance (XRP)
   */
  async getEscrowFeesBalance(): Promise<AdminEscrowFeesBalanceResponse> {
    try {
      const client = this.getAdminClient();
      const { data: row, error } = await client
        .from('platform_escrow_fee_balance')
        .select('balance_xrp')
        .eq('id', 'default')
        .maybeSingle();
      if (error) {
        return { success: false, message: error.message, error: error.message };
      }
      const balance_xrp = row ? Number(row.balance_xrp || 0) : 0;
      return {
        success: true,
        message: 'Escrow fees balance retrieved',
        data: { balance_xrp },
      };
    } catch (e) {
      console.error('Admin escrow fees getBalance error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get escrow fees balance',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Withdraw escrow fees to an XRPL address. Accepts amount in USD; converts to XRP using live rate.
   * Deducts from balance and optionally sends from platform wallet.
   */
  async withdrawEscrowFees(
    amountUsd: number,
    destinationXrplAddress: string,
    adminId?: string
  ): Promise<AdminEscrowFeesWithdrawResponse> {
    try {
      if (!amountUsd || amountUsd <= 0 || !Number.isFinite(amountUsd)) {
        return {
          success: false,
          message: 'amountUsd must be greater than 0',
          error: 'Bad request',
        };
      }
      const exchangeRates = await exchangeService.getLiveExchangeRates();
      if (!exchangeRates.success || !exchangeRates.data) {
        return {
          success: false,
          message: 'Failed to fetch exchange rate for USD conversion',
          error: 'Exchange rate fetch failed',
        };
      }
      const usdRate = exchangeRates.data.rates.find((r: { currency: string }) => r.currency === 'USD')?.rate;
      if (!usdRate || usdRate <= 0) {
        return {
          success: false,
          message: 'XRP/USD exchange rate not available',
          error: 'Exchange rate not available',
        };
      }
      const amountXrp = amountUsd / usdRate;

      const addr = (destinationXrplAddress || '').trim();
      if (!addr || !/^r[0-9a-zA-Z]{24,34}$/.test(addr)) {
        return {
          success: false,
          message: 'Valid XRPL destination address required (starts with r, 25-35 characters)',
          error: 'Bad request',
        };
      }

      const client = this.getAdminClient();
      const { data: balanceRow, error: balanceError } = await client
        .from('platform_escrow_fee_balance')
        .select('balance_xrp')
        .eq('id', 'default')
        .single();
      if (balanceError || !balanceRow) {
        return {
          success: false,
          message: balanceError?.message || 'Fee balance not found',
          error: balanceError?.message || 'Not found',
        };
      }
      const currentBalance = Number(balanceRow.balance_xrp || 0);
      if (amountXrp > currentBalance) {
        return {
          success: false,
          message: `Insufficient balance. Available: ${currentBalance.toFixed(6)} XRP`,
          error: 'Insufficient balance',
        };
      }

      const newBalance = currentBalance - amountXrp;
      const { error: updateError } = await client
        .from('platform_escrow_fee_balance')
        .update({ balance_xrp: newBalance, updated_at: new Date().toISOString() })
        .eq('id', 'default');
      if (updateError) {
        return {
          success: false,
          message: updateError.message,
          error: updateError.message,
        };
      }

      const { data: withdrawal, error: insertError } = await client
        .from('escrow_fee_withdrawals')
        .insert({
          amount_xrp: amountXrp,
          destination_xrpl_address: addr,
          status: 'pending',
          withdrawn_by: adminId || null,
        })
        .select('id, status')
        .single();
      if (insertError || !withdrawal) {
        return {
          success: false,
          message: insertError?.message || 'Failed to record withdrawal',
          error: insertError?.message || 'Database error',
        };
      }

      const platformSecret = process.env.PLATFORM_ESCROW_FEE_WALLET_SECRET;
      let xrplTxHash: string | undefined;
      let status = withdrawal.status;

      if (platformSecret && platformSecret.trim()) {
        try {
          const wallet = Wallet.fromSeed(platformSecret.trim());
          const fromAddress = wallet.classicAddress;
          xrplTxHash = await xrplWalletService.createWithdrawalTransaction(
            fromAddress,
            addr,
            amountXrp,
            platformSecret.trim()
          );
          status = 'completed';
          await client
            .from('escrow_fee_withdrawals')
            .update({ xrpl_tx_hash: xrplTxHash, status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', withdrawal.id);
        } catch (txErr) {
          console.error('Escrow fee withdrawal XRPL error:', txErr);
          status = 'failed';
          await client
            .from('escrow_fee_withdrawals')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', withdrawal.id);
          await client
            .from('platform_escrow_fee_balance')
            .update({ balance_xrp: currentBalance, updated_at: new Date().toISOString() })
            .eq('id', 'default');
          return {
            success: false,
            message: txErr instanceof Error ? txErr.message : 'XRPL payout failed',
            error: txErr instanceof Error ? txErr.message : 'Withdrawal failed',
          };
        }
      }

      return {
        success: true,
        message: status === 'completed' ? 'Withdrawal completed' : 'Withdrawal recorded; payout pending (no platform wallet configured)',
        data: {
          withdrawalId: withdrawal.id,
          amountUsd,
          amountXrp,
          status,
          xrplTxHash,
        },
      };
    } catch (e) {
      console.error('Admin escrow fees withdraw error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to withdraw escrow fees',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminEscrowManagementService = new AdminEscrowManagementService();
