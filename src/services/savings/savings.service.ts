/**
 * Savings Service
 * Aggregates savings allocation, cashflow, wallets, and transaction history
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { exchangeService } from '../exchange/exchange.service';

import {
  SavingsSummaryResponse,
  SavingsCashflowResponse,
  SavingsWalletsResponse,
  SavingsTransactionsResponse,
  SavingsTransactionDirection,
  SavingsTransferResponse,
  SavingsWithdrawResponse,
  SavingsDeleteWalletResponse,
} from '../../types/api/savings.types';
import type { TransactionType } from '../../types/api/transaction.types';

export class SavingsService {
  /**
   * Determine current period range and label based on filter
   * range: this_month | last_month | this_year
   */
  private getPeriodRange(range?: string): {
    start: Date;
    end: Date;
    label: string;
  } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth();

    if (range === 'last_month') {
      const lastMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
      const lastMonthYear = monthIndex - 1 >= 0 ? year : year - 1;
      const start = new Date(Date.UTC(lastMonthYear, lastMonthIndex, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(lastMonthYear, lastMonthIndex + 1, 0, 23, 59, 59, 999));
      return { start, end, label: 'Last Month' };
    }

    if (range === 'this_year') {
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = now;
      return { start, end, label: 'This Year' };
    }

    // Default: this_month
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = now;
    return { start, end, label: 'This Month' };
  }

  /**
   * Get previous period range given a current range
   */
  private getPreviousPeriodRange(range?: string): { start: Date; end: Date } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth();

    if (range === 'last_month') {
      // Previous of last_month = month before last
      let m = monthIndex - 2;
      let y = year;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      return { start, end };
    }

    if (range === 'this_year') {
      const prevYear = year - 1;
      const start = new Date(Date.UTC(prevYear, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(prevYear, 11, 31, 23, 59, 59, 999));
      return { start, end };
    }

    // Default: previous month of this_month
    const prevMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
    const prevYear = monthIndex - 1 >= 0 ? year : year - 1;
    const start = new Date(Date.UTC(prevYear, prevMonthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Get a simple date range based on range filter for transactions
   * range: daily | weekly | monthly
   */
  private getDateRange(range?: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end);

    if (range === 'daily') {
      start.setUTCDate(end.getUTCDate() - 1);
    } else if (range === 'weekly') {
      start.setUTCDate(end.getUTCDate() - 7);
    } else {
      // monthly or default: last 30 days
      start.setUTCDate(end.getUTCDate() - 30);
    }

    return { start, end };
  }

  /**
   * Determine direction (received/spent) from transaction type
   */
  private getDirection(type: TransactionType): SavingsTransactionDirection {
    const receivedTypes: TransactionType[] = ['deposit', 'escrow_release', 'transfer'];
    return receivedTypes.includes(type) ? 'received' : 'spent';
  }

  /**
   * Net USD impact on savings bucket: transfers/deposits add; withdrawals subtract.
   */
  private netSavingsUsdDelta(row: { type: string; amount_usd: unknown }): number {
    const amt = parseFloat(String(row.amount_usd ?? 0));
    const abs = Math.abs(amt);
    if (row.type === 'withdrawal') return -abs;
    return abs;
  }

  /**
   * Get savings allocation summary
   * GET /api/savings/summary
   */
  async getSummary(userId: string, range?: string): Promise<SavingsSummaryResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end, label } = this.getPeriodRange(range);
      const prevRange = this.getPreviousPeriodRange(range);

      // Current period transactions linked to savings wallets
      const { data: currentTx, error: currentError } = await adminClient
        .from('transactions')
        .select('savings_wallet_id, amount_usd, type')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Previous period for trend
      const { data: prevTx, error: prevError } = await adminClient
        .from('transactions')
        .select('savings_wallet_id, amount_usd, type')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', prevRange.start.toISOString())
        .lte('created_at', prevRange.end.toISOString());

      if (currentError || prevError) {
        return {
          success: false,
          message: 'Failed to fetch savings summary',
          error: 'Failed to fetch savings summary',
        };
      }

      const currentRows = currentTx || [];
      const prevRows = prevTx || [];

      const sumByWallet = (rows: any[]) => {
        const totals = new Map<string, number>();
        for (const row of rows) {
          if (!row.savings_wallet_id) continue;
          const key = row.savings_wallet_id as string;
          const current = totals.get(key) || 0;
          totals.set(key, current + this.netSavingsUsdDelta(row));
        }
        return totals;
      };

      const currentTotals = sumByWallet(currentRows);
      const prevTotals = sumByWallet(prevRows);

      const totalUsd = Array.from(currentTotals.values()).reduce((sum, v) => sum + v, 0);
      const prevTotalUsd = Array.from(prevTotals.values()).reduce((sum, v) => sum + v, 0);

      const walletIds = Array.from(
        new Set<string>([
          ...Array.from(currentTotals.keys()),
          ...Array.from(prevTotals.keys()),
        ])
      );

      let categoryMap: Record<string, { name: string }> = {};
      if (walletIds.length > 0) {
        const { data: wallets } = await adminClient
          .from('savings_wallets')
          .select('id, name')
          .in('id', walletIds);
        categoryMap = (wallets || []).reduce((acc: Record<string, { name: string }>, w: { id: string; name: string }) => {
          acc[w.id] = { name: w.name };
          return acc;
        }, {} as Record<string, { name: string }>);
      }

      const categories = Array.from(currentTotals.entries()).map(([walletId, amount]) => {
        const percentage = totalUsd > 0 ? (amount / totalUsd) * 100 : 0;
        return {
          walletId,
          name: categoryMap[walletId]?.name || 'Unnamed',
          amountUsd: amount,
          percentage: parseFloat(percentage.toFixed(2)),
        };
      });

      let changePercent: number | undefined = undefined;
      if (prevTotalUsd > 0) {
        changePercent = ((totalUsd - prevTotalUsd) / prevTotalUsd) * 100;
      }

      return {
        success: true,
        message: 'Savings summary retrieved successfully',
        data: {
          totalUsd,
          changePercent,
          periodLabel: label,
          categories,
        },
      };
    } catch (error) {
      console.error('Error getting savings summary:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings summary',
        error: error instanceof Error ? error.message : 'Failed to get savings summary',
      };
    }
  }

  /**
   * Get savings cashflow data
   * GET /api/savings/cashflow
   * @param range - When `from`/`to` omitted: same as summary — this_month | last_month | this_year (default this_month)
   */
  async getCashflow(params: {
    userId: string;
    interval?: 'monthly' | 'weekly';
    from?: string;
    to?: string;
    range?: string;
  }): Promise<SavingsCashflowResponse> {
    const { userId, interval = 'monthly', from, to, range } = params;

    try {
      const adminClient = supabaseAdmin || supabase;

      // Align with GET /api/savings/summary default (calendar period), not rolling 30 days
      const start = from
        ? new Date(from)
        : (() => {
            const { start: s } = this.getPeriodRange(range || 'this_month');
            return s;
          })();
      const end = to ? new Date(to) : new Date();

      const { data: rows, error } = await adminClient
        .from('transactions')
        .select('type, amount_usd, created_at')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch savings cashflow',
          error: 'Failed to fetch savings cashflow',
        };
      }

      const buckets = new Map<string, { receivedUsd: number; spentUsd: number }>();

      const formatPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        if (interval === 'weekly') {
          // Simple weekly label: YYYY-Www
          const firstJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const days = Math.floor(
            (d.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24)
          );
          const week = Math.floor(days / 7) + 1;
          return `${d.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
        }

        // Monthly: YYYY-MM (sortable, unique per year — avoids "Mar" collapsing multiple years)
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      };

      for (const row of rows || []) {
        const period = formatPeriod(row.created_at);
        const bucket = buckets.get(period) || { receivedUsd: 0, spentUsd: 0 };
        const direction = this.getDirection(row.type as TransactionType);
        const amount = parseFloat(row.amount_usd);

        if (direction === 'received') {
          bucket.receivedUsd += amount;
        } else {
          bucket.spentUsd += amount;
        }

        buckets.set(period, bucket);
      }

      const points = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({
          period,
          receivedUsd: data.receivedUsd,
          spentUsd: data.spentUsd,
        }));

      return {
        success: true,
        message: 'Savings cashflow retrieved successfully',
        data: {
          interval,
          points,
        },
      };
    } catch (error) {
      console.error('Error getting savings cashflow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings cashflow',
        error: error instanceof Error ? error.message : 'Failed to get savings cashflow',
      };
    }
  }

  /**
   * Get list of savings wallets and their balances
   * GET /api/savings/wallets
   */
  async getWallets(userId: string): Promise<SavingsWalletsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { data: wallets, error: walletsError } = await adminClient
        .from('savings_wallets')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (walletsError) {
        return {
          success: false,
          message: 'Failed to fetch savings wallets',
          error: 'Failed to fetch savings wallets',
        };
      }

      const walletIds = (wallets || []).map((w: { id: string }) => w.id);

      let totalsByWallet = new Map<string, number>();
      if (walletIds.length > 0) {
        const { data: txRows } = await adminClient
          .from('transactions')
          .select('savings_wallet_id, amount_usd, type')
          .eq('user_id', userId)
          .in('savings_wallet_id', walletIds);

        totalsByWallet = new Map<string, number>();
        for (const row of txRows || []) {
          if (!row.savings_wallet_id) continue;
          const key = row.savings_wallet_id as string;
          const current = totalsByWallet.get(key) || 0;
          totalsByWallet.set(key, current + this.netSavingsUsdDelta(row as { type: string; amount_usd: unknown }));
        }
      }

      const totalUsd = Array.from(totalsByWallet.values()).reduce((sum, v) => sum + v, 0);

      const items = (wallets || []).map((w: { id: string; name: string; created_at: string; target_amount_usd?: string | number | null }) => {
        const amountUsd = totalsByWallet.get(w.id) || 0;
        const percentage = totalUsd > 0 ? (amountUsd / totalUsd) * 100 : 0;

        return {
          id: w.id,
          name: w.name,
          amountUsd,
          percentage: parseFloat(percentage.toFixed(2)),
          targetAmountUsd: w.target_amount_usd ? parseFloat(String(w.target_amount_usd)) : undefined,
        };
      });

      return {
        success: true,
        message: 'Savings wallets retrieved successfully',
        data: {
          totalUsd,
          wallets: items,
        },
      };
    } catch (error) {
      console.error('Error getting savings wallets:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings wallets',
        error: error instanceof Error ? error.message : 'Failed to get savings wallets',
      };
    }
  }

  /**
   * Create a new savings wallet
   * POST /api/savings/wallets
   */
  /**
   * Move XRP from the user's custodial wallet (DB balance) into a savings wallet.
   * Records a completed `transfer` transaction with `savings_wallet_id` for dashboard aggregation.
   */
  async transferFromWallet(
    userId: string,
    body: { savingsWalletId: string; sourceWalletId?: string; amountXrp: number }
  ): Promise<SavingsTransferResponse> {
    try {
      const adminClient = supabaseAdmin;
      if (!adminClient) {
        return {
          success: false,
          message: 'Savings transfer requires server configuration (service role)',
          error: 'Service unavailable',
        };
      }

      const savingsWalletId = String(body.savingsWalletId || '').trim();
      const amountRaw = Number(body.amountXrp);
      if (!savingsWalletId) {
        return { success: false, message: 'savingsWalletId is required', error: 'Validation failed' };
      }
      if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
        return { success: false, message: 'amountXrp must be a positive number', error: 'Validation failed' };
      }

      const amountXrp = parseFloat(amountRaw.toFixed(6));
      if (amountXrp <= 0) {
        return { success: false, message: 'amountXrp must be a positive number', error: 'Validation failed' };
      }

      const { data: savingsRow, error: savingsErr } = await adminClient
        .from('savings_wallets')
        .select('id, name')
        .eq('id', savingsWalletId)
        .eq('user_id', userId)
        .maybeSingle();

      if (savingsErr || !savingsRow) {
        return {
          success: false,
          message: 'Savings account not found',
          error: 'Not found',
        };
      }

      let walletQuery = adminClient
        .from('wallets')
        .select('id, balance_xrp')
        .eq('user_id', userId)
        .eq('suite_context', 'personal');

      if (body.sourceWalletId) {
        walletQuery = walletQuery.eq('id', String(body.sourceWalletId).trim());
      }

      const { data: wallet, error: walletErr } = await walletQuery.maybeSingle();

      if (walletErr || !wallet) {
        return {
          success: false,
          message: body.sourceWalletId
            ? 'Source wallet not found'
            : 'No personal XRP wallet found. Connect or create a wallet first.',
          error: 'Not found',
        };
      }

      const currentXrp = parseFloat(String(wallet.balance_xrp ?? 0));
      if (currentXrp + 1e-9 < amountXrp) {
        return {
          success: false,
          message: `Insufficient XRP balance. Available: ${currentXrp.toFixed(6)} XRP`,
          error: 'Insufficient balance',
        };
      }

      const rates = await exchangeService.getLiveExchangeRates();
      const xrpUsd = rates.data?.rates.find((r) => r.currency === 'USD')?.rate;
      if (!xrpUsd || xrpUsd <= 0) {
        return {
          success: false,
          message: 'Could not load XRP/USD rate. Try again shortly.',
          error: 'Rate unavailable',
        };
      }

      const amountUsd = parseFloat((amountXrp * xrpUsd).toFixed(2));
      const newBalanceXrp = parseFloat((currentXrp - amountXrp).toFixed(6));

      const { error: updErr } = await adminClient
        .from('wallets')
        .update({
          balance_xrp: newBalanceXrp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)
        .eq('user_id', userId);

      if (updErr) {
        console.error('[SavingsTransfer] wallet update failed:', updErr);
        return {
          success: false,
          message: 'Failed to update wallet balance',
          error: updErr.message,
        };
      }

      const { data: txRow, error: txErr } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'transfer',
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'completed',
          savings_wallet_id: savingsWalletId,
          description: `Transfer to savings: ${savingsRow.name} (${amountXrp} XRP)`,
        })
        .select('id')
        .single();

      if (txErr || !txRow) {
        console.error('[SavingsTransfer] transaction insert failed, reverting wallet:', txErr);
        await adminClient
          .from('wallets')
          .update({
            balance_xrp: currentXrp,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)
          .eq('user_id', userId);

        return {
          success: false,
          message: 'Failed to record transfer',
          error: txErr?.message || 'Database error',
        };
      }

      return {
        success: true,
        message: 'Transfer to savings completed',
        data: {
          transactionId: txRow.id,
          savingsWalletId,
          amountXrp,
          amountUsd,
          newWalletBalanceXrp: newBalanceXrp,
        },
      };
    } catch (error) {
      console.error('Error in transferFromWallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Transfer failed',
        error: error instanceof Error ? error.message : 'Transfer failed',
      };
    }
  }

  /**
   * Withdraw value from a savings bucket back to the user's custodial XRP balance.
   * Supports full withdraw (UI: tap Withdraw on plan with US$ balance) or partial USD/XRP.
   */
  async withdrawToWallet(
    userId: string,
    body: {
      savingsWalletId: string;
      targetWalletId?: string;
      withdrawAll?: boolean;
      amountUsd?: number;
      amountXrp?: number;
    }
  ): Promise<SavingsWithdrawResponse> {
    try {
      const adminClient = supabaseAdmin;
      if (!adminClient) {
        return {
          success: false,
          message: 'Savings withdrawal requires server configuration (service role)',
          error: 'Service unavailable',
        };
      }

      const savingsWalletId = String(body.savingsWalletId || '').trim();
      if (!savingsWalletId) {
        return { success: false, message: 'savingsWalletId is required', error: 'Validation failed' };
      }

      const hasAll = body.withdrawAll === true;
      const usdRaw = body.amountUsd != null ? Number(body.amountUsd) : NaN;
      const xrpRaw = body.amountXrp != null ? Number(body.amountXrp) : NaN;
      const hasUsd = Number.isFinite(usdRaw) && usdRaw > 0;
      const hasXrp = Number.isFinite(xrpRaw) && xrpRaw > 0;
      const modeCount = [hasAll, hasUsd, hasXrp].filter(Boolean).length;
      if (modeCount !== 1) {
        return {
          success: false,
          message: 'Provide exactly one of: withdrawAll (true), amountUsd, or amountXrp',
          error: 'Validation failed',
        };
      }

      const { data: savingsRow, error: savingsErr } = await adminClient
        .from('savings_wallets')
        .select('id, name')
        .eq('id', savingsWalletId)
        .eq('user_id', userId)
        .maybeSingle();

      if (savingsErr || !savingsRow) {
        return {
          success: false,
          message: 'Savings account not found',
          error: 'Not found',
        };
      }

      const { data: txRows } = await adminClient
        .from('transactions')
        .select('type, amount_usd')
        .eq('user_id', userId)
        .eq('savings_wallet_id', savingsWalletId);

      let availableUsd = 0;
      for (const row of txRows || []) {
        availableUsd += this.netSavingsUsdDelta(row as { type: string; amount_usd: unknown });
      }

      if (availableUsd <= 0) {
        return {
          success: false,
          message: 'No funds available to withdraw from this savings account',
          error: 'Insufficient balance',
        };
      }

      const rates = await exchangeService.getLiveExchangeRates();
      const xrpUsd = rates.data?.rates.find((r) => r.currency === 'USD')?.rate;
      if (!xrpUsd || xrpUsd <= 0) {
        return {
          success: false,
          message: 'Could not load XRP/USD rate. Try again shortly.',
          error: 'Rate unavailable',
        };
      }

      let amountUsd: number;
      let amountXrp: number;

      if (hasAll) {
        amountUsd = parseFloat(availableUsd.toFixed(2));
        amountXrp = parseFloat((amountUsd / xrpUsd).toFixed(6));
      } else if (hasUsd) {
        amountUsd = parseFloat(usdRaw.toFixed(2));
        if (amountUsd > availableUsd + 0.01) {
          return {
            success: false,
            message: `Insufficient savings balance. Saved: US$${availableUsd.toFixed(2)}`,
            error: 'Insufficient balance',
          };
        }
        amountXrp = parseFloat((amountUsd / xrpUsd).toFixed(6));
      } else {
        amountXrp = parseFloat(xrpRaw.toFixed(6));
        amountUsd = parseFloat((amountXrp * xrpUsd).toFixed(2));
        if (amountUsd > availableUsd + 0.01) {
          const maxXrp = parseFloat((availableUsd / xrpUsd).toFixed(6));
          return {
            success: false,
            message: `Insufficient savings balance. Available ≈ ${maxXrp.toFixed(6)} XRP (${availableUsd.toFixed(2)} USD).`,
            error: 'Insufficient balance',
          };
        }
      }

      if (amountXrp <= 0 || amountUsd <= 0) {
        return {
          success: false,
          message: 'Withdrawal amount is too small after conversion',
          error: 'Validation failed',
        };
      }

      let walletQuery = adminClient
        .from('wallets')
        .select('id, balance_xrp')
        .eq('user_id', userId)
        .eq('suite_context', 'personal');

      if (body.targetWalletId) {
        walletQuery = walletQuery.eq('id', String(body.targetWalletId).trim());
      }

      const { data: wallet, error: walletErr } = await walletQuery.maybeSingle();

      if (walletErr || !wallet) {
        return {
          success: false,
          message: body.targetWalletId
            ? 'Target wallet not found'
            : 'No personal XRP wallet found. Connect or create a wallet first.',
          error: 'Not found',
        };
      }

      const currentXrp = parseFloat(String(wallet.balance_xrp ?? 0));
      const newBalanceXrp = parseFloat((currentXrp + amountXrp).toFixed(6));

      const { error: updErr } = await adminClient
        .from('wallets')
        .update({
          balance_xrp: newBalanceXrp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)
        .eq('user_id', userId);

      if (updErr) {
        console.error('[SavingsWithdraw] wallet update failed:', updErr);
        return {
          success: false,
          message: 'Failed to update wallet balance',
          error: updErr.message,
        };
      }

      const { data: txRow, error: txErr } = await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'withdrawal',
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'completed',
          savings_wallet_id: savingsWalletId,
          description: `Withdraw from savings: ${savingsRow.name} (${amountXrp} XRP)`,
        })
        .select('id')
        .single();

      if (txErr || !txRow) {
        console.error('[SavingsWithdraw] transaction insert failed, reverting wallet:', txErr);
        await adminClient
          .from('wallets')
          .update({
            balance_xrp: currentXrp,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)
          .eq('user_id', userId);

        return {
          success: false,
          message: 'Failed to record withdrawal',
          error: txErr?.message || 'Database error',
        };
      }

      const remainingSavingsUsd = parseFloat((availableUsd - amountUsd).toFixed(2));

      return {
        success: true,
        message: 'Withdrawal to wallet completed',
        data: {
          transactionId: txRow.id,
          savingsWalletId,
          amountXrp,
          amountUsd,
          newWalletBalanceXrp: newBalanceXrp,
          remainingSavingsUsd: Math.max(0, remainingSavingsUsd),
        },
      };
    } catch (error) {
      console.error('Error in withdrawToWallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Withdrawal failed',
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      };
    }
  }

  /**
   * Delete a savings plan. Any remaining saved balance is auto-released to the custodial wallet
   * (same as withdrawAll), then the plan row is removed.
   */
  async deleteWallet(
    userId: string,
    savingsWalletId: string,
    targetWalletId?: string
  ): Promise<SavingsDeleteWalletResponse> {
    try {
      const adminClient = supabaseAdmin;
      if (!adminClient) {
        return {
          success: false,
          message: 'Deleting a savings plan requires server configuration (service role)',
          error: 'Service unavailable',
        };
      }

      const id = String(savingsWalletId || '').trim();
      if (!id) {
        return { success: false, message: 'savingsWalletId is required', error: 'Validation failed' };
      }

      const { data: row, error: fetchErr } = await adminClient
        .from('savings_wallets')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr || !row) {
        return {
          success: false,
          message: 'Savings plan not found',
          error: 'Not found',
        };
      }

      const { data: txRows } = await adminClient
        .from('transactions')
        .select('type, amount_usd')
        .eq('user_id', userId)
        .eq('savings_wallet_id', id);

      let availableUsd = 0;
      for (const r of txRows || []) {
        availableUsd += this.netSavingsUsdDelta(r as { type: string; amount_usd: unknown });
      }

      let released:
        | {
            transactionId: string;
            amountXrp: number;
            amountUsd: number;
            newWalletBalanceXrp: number;
          }
        | undefined;

      if (availableUsd > 0.01) {
        const release = await this.withdrawToWallet(userId, {
          savingsWalletId: id,
          withdrawAll: true,
          targetWalletId,
        });
        if (!release.success || !release.data) {
          return {
            success: false,
            message: release.message,
            error: release.error || 'Release failed',
          };
        }
        released = {
          transactionId: release.data.transactionId,
          amountXrp: release.data.amountXrp,
          amountUsd: release.data.amountUsd,
          newWalletBalanceXrp: release.data.newWalletBalanceXrp,
        };
      }

      const { error: delErr } = await adminClient
        .from('savings_wallets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (delErr) {
        console.error('[SavingsDeleteWallet]', delErr);
        return {
          success: false,
          message: 'Failed to delete savings plan',
          error: delErr.message,
        };
      }

      return {
        success: true,
        message: released
          ? 'Balance returned to your wallet and savings plan removed'
          : 'Savings plan removed',
        data: {
          id,
          released,
        },
      };
    } catch (error) {
      console.error('Error in deleteWallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete savings plan',
        error: error instanceof Error ? error.message : 'Failed to delete savings plan',
      };
    }
  }

  async createWallet(userId: string, body: { name: string; targetAmountUsd?: number }): Promise<SavingsWalletsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { name, targetAmountUsd } = body;

      const { data: wallet, error } = await adminClient
        .from('savings_wallets')
        .insert({
          user_id: userId,
          name,
          target_amount_usd: typeof targetAmountUsd === 'number' ? targetAmountUsd : null,
        })
        .select()
        .single();

      if (error || !wallet) {
        return {
          success: false,
          message: 'Failed to create savings wallet',
          error: 'Failed to create savings wallet',
        };
      }

      return {
        success: true,
        message: 'Savings wallet created successfully',
        data: {
          totalUsd: 0,
          wallets: [
            {
              id: wallet.id,
              name: wallet.name,
              amountUsd: 0,
              percentage: 0,
              targetAmountUsd: wallet.target_amount_usd
                ? parseFloat(wallet.target_amount_usd)
                : undefined,
            },
          ],
        },
      };
    } catch (error) {
      console.error('Error creating savings wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create savings wallet',
        error: error instanceof Error ? error.message : 'Failed to create savings wallet',
      };
    }
  }

  /**
   * Get savings transaction history
   * GET /api/savings/transactions
   */
  async getTransactions(params: {
    userId: string;
    walletId?: string;
    direction?: SavingsTransactionDirection | 'all';
    range?: string; // daily | weekly | monthly
    page?: number;
    pageSize?: number;
  }): Promise<SavingsTransactionsResponse> {
    const { userId, walletId, direction = 'all', range, page = 1, pageSize = 10 } = params;

    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end } = this.getDateRange(range);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = adminClient
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (walletId) {
        query = query.eq('savings_wallet_id', walletId);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: rows, error: listError } = await query;

      if (listError) {
        return {
          success: false,
          message: 'Failed to fetch savings transactions',
          error: 'Failed to fetch savings transactions',
        };
      }

      // Count query (without pagination)
      let countQuery = adminClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (walletId) {
        countQuery = countQuery.eq('savings_wallet_id', walletId);
      }

      const { count } = await countQuery;

      const txRows = rows || [];

      // Filter by direction in-memory (simpler than complex DB filters)
      const filtered = txRows.filter((row: any) => {
        const dir = this.getDirection(row.type as TransactionType);
        if (direction === 'all') return true;
        return dir === direction;
      });

      // Get wallet names
      const walletIds = Array.from(
        new Set<string>(filtered.map((r: any) => r.savings_wallet_id).filter(Boolean))
      );

      let walletNameMap: Record<string, string> = {};
      if (walletIds.length > 0) {
        const { data: wallets } = await adminClient
          .from('savings_wallets')
          .select('id, name')
          .in('id', walletIds);
        walletNameMap = (wallets || []).reduce((acc: Record<string, string>, w: { id: string; name: string }) => {
          acc[w.id] = w.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const items = filtered.map((row: any) => {
        const dir = this.getDirection(row.type as TransactionType);
        const label = dir === 'received' ? 'Received' : 'Spent';
        const createdDate = row.created_at
          ? new Date(row.created_at).toISOString().split('T')[0]
          : '';

        return {
          id: row.id,
          walletId: row.savings_wallet_id,
          walletName: walletNameMap[row.savings_wallet_id] || undefined,
          direction: dir,
          txLabel: label,
          txHash: row.xrpl_tx_hash || undefined,
          amountUsd: parseFloat(row.amount_usd),
          status: row.status,
          date: createdDate,
        };
      });

      return {
        success: true,
        message: 'Savings transactions retrieved successfully',
        data: {
          transactions: items,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting savings transactions:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings transactions',
        error: error instanceof Error ? error.message : 'Failed to get savings transactions',
      };
    }
  }
}

export const savingsService = new SavingsService();


