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

/** Create API Key modal – request body. */
export type ApiKeyEnvironment = 'development' | 'staging' | 'production';
export type ApiKeyPermission = 'read' | 'write' | 'admin';
/** TrustiChain services: payroll, escrow, supplier, transfer (remittance). */
export type ApiKeyServiceScope = 'payroll' | 'escrow' | 'supplier' | 'transfer';

export interface CreateApiKeyRequest {
  /** Key Label – human-readable name (e.g. "Angelo Group"). */
  keyLabel: string;
  /** Environment: development | staging | production. */
  environment: ApiKeyEnvironment;
  /** Permissions: read | write | admin. */
  permission: ApiKeyPermission;
  /** Optional IP whitelist (single IP or CIDR, e.g. "192.168.1.1" or "10.0.0.0/24"). Comma-separated or array. */
  allowedIpAddresses?: string[] | string;
  /** Expiration date (ISO string or YYYY-MM-DD). Optional. */
  expirationDate?: string;
  /** Rotate key automatically. */
  rotateKeyAutomatically?: boolean;
  /** Restrict to specific TrustiChain services. Optional; omit or empty = all services. */
  restrictToServices?: ApiKeyServiceScope[];
}

/** Create API Key – response. keySecret is returned only once; store it securely. */
export interface CreateApiKeyResponse {
  success: boolean;
  message: string;
  data?: {
    keyId: string;
    keyLabel: string;
    /** Full secret – only returned on create. Copy and store securely. */
    keySecret: string;
    keyPrefix: string;
    environment: ApiKeyEnvironment;
    permission: ApiKeyPermission;
    allowedIps: string[] | null;
    expiresAt: string | null;
    rotateAutomatically: boolean;
    serviceScopes: ApiKeyServiceScope[] | null;
    createdAt: string;
  };
  error?: string;
}
