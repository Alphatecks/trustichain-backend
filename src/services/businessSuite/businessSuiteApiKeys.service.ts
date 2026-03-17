/**
 * Business Suite API Keys – overview stats and (later) key CRUD.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  ApiKeysOverviewData,
  ApiKeysOverviewResponse,
  ApiKeysOverviewStatWithTrend,
  ApiKeysOverviewFailedStat,
  ApiKeysOverviewLatencyStat,
} from '../../types/api/businessSuiteApiKeys.types';

const PERIOD_LABEL = 'This month';

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export class BusinessSuiteApiKeysService {
  /**
   * Overview stats for the API Keys page: Total Active Keys, API Requests, Failed Requests, Avg Latency.
   * GET /api/business-suite/api-keys/overview
   */
  async getApiKeysOverview(userId: string): Promise<ApiKeysOverviewResponse> {
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

    const thisMonthStartIso = thisMonthStart.toISOString();
    const lastMonthStartIso = lastMonthStart.toISOString();

    // Total active keys: count where business_id = X and is_active = true
    const { count: activeKeysCount } = await client
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true);

    // Keys that existed at start of this month (for trend)
    const { count: keysAtStartOfMonth } = await client
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .lt('created_at', thisMonthStartIso);

    const totalActiveKeys = activeKeysCount ?? 0;
    const prevKeys = keysAtStartOfMonth ?? 0;
    const totalActiveKeysTrend: ApiKeysOverviewStatWithTrend = {
      value: totalActiveKeys,
      trendPercent: trendPercent(totalActiveKeys, prevKeys),
      period: PERIOD_LABEL,
    };

    // API request logs: need to join api_keys to filter by business_id
    const { data: keysRows } = await client
      .from('api_keys')
      .select('id')
      .eq('business_id', businessId);
    const keyIds = (keysRows ?? []).map((r: { id: string }) => r.id);

    let apiRequestsThisMonth = 0;
    let apiRequestsLastMonth = 0;
    let failedRequestsThisMonth = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;

    if (keyIds.length > 0) {
      const { data: logsThisMonth } = await client
        .from('api_request_logs')
        .select('id, status_code, latency_ms')
        .in('api_key_id', keyIds)
        .gte('created_at', thisMonthStartIso);

      const { data: logsLastMonth } = await client
        .from('api_request_logs')
        .select('id')
        .in('api_key_id', keyIds)
        .gte('created_at', lastMonthStartIso)
        .lt('created_at', thisMonthStartIso);

      const thisMonthLogs = logsThisMonth ?? [];
      apiRequestsThisMonth = thisMonthLogs.length;
      apiRequestsLastMonth = (logsLastMonth ?? []).length;
      failedRequestsThisMonth = thisMonthLogs.filter((l: { status_code: number }) => l.status_code >= 400).length;
      for (const l of thisMonthLogs as { latency_ms: number | null }[]) {
        if (l.latency_ms != null && !Number.isNaN(l.latency_ms)) {
          totalLatencyMs += l.latency_ms;
          latencyCount += 1;
        }
      }
    }

    const apiRequestsTrend: ApiKeysOverviewStatWithTrend = {
      value: apiRequestsThisMonth,
      trendPercent: trendPercent(apiRequestsThisMonth, apiRequestsLastMonth),
      period: PERIOD_LABEL,
    };

    const percentOfTotalCalls =
      apiRequestsThisMonth > 0
        ? Math.round((failedRequestsThisMonth / apiRequestsThisMonth) * 1000) / 10
        : 0;
    const failedRequests: ApiKeysOverviewFailedStat = {
      value: failedRequestsThisMonth,
      percentOfTotalCalls,
      period: PERIOD_LABEL,
    };

    const avgLatencyMs: ApiKeysOverviewLatencyStat = {
      value: latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0,
      period: PERIOD_LABEL,
    };

    const data: ApiKeysOverviewData = {
      totalActiveKeys: totalActiveKeysTrend,
      apiRequests: apiRequestsTrend,
      failedRequests,
      avgLatencyMs,
    };

    return {
      success: true,
      message: 'API Keys overview retrieved',
      data,
    };
  }
}

export const businessSuiteApiKeysService = new BusinessSuiteApiKeysService();
