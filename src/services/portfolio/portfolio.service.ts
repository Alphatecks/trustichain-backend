/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export class PortfolioService {
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
      const adminClient = supabaseAdmin || supabase;
      const now = new Date();
      const requestedTimeframe = timeframe;
      const currentYear = now.getFullYear();
      const targetYear = year ?? currentYear;

      // Gross total escrowed per month for personal suite (escrows created by user).
      const startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const endDate = targetYear === currentYear
        ? now
        : new Date(targetYear, 11, 31, 23, 59, 59, 999);

      const { data: escrows, error } = await adminClient
        .from('escrows')
        .select('created_at, amount_usd')
        .eq('user_id', userId)
        .or('suite_context.is.null,suite_context.eq.personal')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

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
        const month = createdAt.getMonth();
        const amount = parseFloat(String(row.amount_usd));
        if (!Number.isFinite(amount)) continue;
        monthTotals.set(month, (monthTotals.get(month) || 0) + amount);
      }

      const maxMonth = targetYear === currentYear ? now.getMonth() : 11;
      const formattedData = Array.from({ length: maxMonth + 1 }, (_, month) => {
        const date = new Date(targetYear, month, 1);
        return {
          period: date.toLocaleDateString('en-US', { month: 'short' }),
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






