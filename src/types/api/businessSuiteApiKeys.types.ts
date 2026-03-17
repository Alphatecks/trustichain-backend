/**
 * API Keys (Business Suite) – overview stats and key management types.
 */

/** Single stat card with value and optional trend (e.g. Total Active Keys, API Requests). */
export interface ApiKeysOverviewStatWithTrend {
  value: number;
  trendPercent: number;
  period: string;
}

/** Failed requests: value + percent of total calls. */
export interface ApiKeysOverviewFailedStat {
  value: number;
  percentOfTotalCalls: number;
  period: string;
}

/** Avg latency: value in ms + period. */
export interface ApiKeysOverviewLatencyStat {
  value: number;
  period: string;
}

export interface ApiKeysOverviewData {
  totalActiveKeys: ApiKeysOverviewStatWithTrend;
  apiRequests: ApiKeysOverviewStatWithTrend;
  failedRequests: ApiKeysOverviewFailedStat;
  avgLatencyMs: ApiKeysOverviewLatencyStat;
}

export interface ApiKeysOverviewResponse {
  success: boolean;
  message: string;
  data?: ApiKeysOverviewData;
  error?: string;
}
