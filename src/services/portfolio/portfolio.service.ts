/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export class PortfolioService {
  private async fetchEscrowsForRange(
    userId: string,
    startIso: string,
    endIso: string
  ): Promise<{
    data: Array<{ created_at: string; amount_usd: unknown }> | null;
    error: string | null;
  }> {
    const adminClient = supabaseAdmin || supabase;
    const personalScope = 'or(suite_context.is.null,suite_context.eq.personal)';
    const participantAndScopeFilter =
      `and(user_id.eq.${userId},${personalScope}),and(counterparty_id.eq.${userId},${personalScope})`;

    const pageSize = 1000;
    let from = 0;
    const allRows: Array<{ created_at: string; amount_usd: unknown }> = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await adminClient
        .from('escrows')
        .select('created_at, amount_usd')
        .or(participantAndScopeFilter)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) {
        return { data: null, error: error.message || 'Failed to fetch escrow totals' };
      }

      const rows = (data || []) as Array<{ created_at: string; amount_usd: unknown }>;
      allRows.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  }

  private parseAmountUsd(raw: unknown): number {
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;

    // Safeguard against formatted strings (e.g., "1,250.50") so valid months do not collapse to 0.
    const normalized = String(raw ?? '').replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  /**
   * Get portfolio performance data for a specific timeframe.
   * Optional year filters data to that year (e.g. 2024 => Jan 1 - Dec 31 of 2024).
   */
  async getPortfolioPerformance(
    userId: string,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    year?: number
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      timeframe: string;
      year?: number;
      data: Array<{
        period: string;
        value: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const now = new Date();
      const requestedTimeframe = timeframe;
      const currentYear = now.getUTCFullYear();
      const targetYear = year ?? currentYear;

      // Gross total escrowed per month for personal suite (escrows created by user).
      const startDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
      const endDate = targetYear === currentYear
        ? now
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

      const { data: escrows, error } = await this.fetchEscrowsForRange(
        userId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch escrow totals',
          error: 'Failed to fetch escrow totals',
        };
      }

      const monthTotals = new Map<number, number>();
      for (let month = 0; month < 12; month++) monthTotals.set(month, 0);

      for (const row of escrows || []) {
        const createdAt = new Date(row.created_at);
        const month = createdAt.getUTCMonth();
        const amount = this.parseAmountUsd(row.amount_usd);
        if (!Number.isFinite(amount)) continue;
        monthTotals.set(month, (monthTotals.get(month) || 0) + amount);
      }

      // Keep chart length aligned to current UTC month for current year.
      const maxMonth = targetYear === currentYear ? now.getUTCMonth() : 11;
      const formattedData = Array.from({ length: maxMonth + 1 }, (_, month) => {
        const date = new Date(Date.UTC(targetYear, month, 1, 0, 0, 0, 0));
        return {
          period: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          value: parseFloat((monthTotals.get(month) || 0).toFixed(2)),
        };
      });

      return {
        success: true,
        message: 'Portfolio performance retrieved successfully',
        data: {
          timeframe: requestedTimeframe === 'monthly' ? 'monthly' : 'monthly',
          ...(year != null && { year: targetYear }),
          data: formattedData,
        },
      };
    } catch (error) {
      console.error('Error getting portfolio performance:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get portfolio performance',
        error: error instanceof Error ? error.message : 'Failed to get portfolio performance',
      };
    }
  }

}

export const portfolioService = new PortfolioService();






