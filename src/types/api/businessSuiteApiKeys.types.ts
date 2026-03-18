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
  /** Key type for dashboard tabs: main | mobile | backend. Default main. */
  keyType?: ApiKeyType;
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

/** Key type for dashboard tabs: Main Key, Mobile Key, Backend Key. */
export type ApiKeyType = 'main' | 'mobile' | 'backend';

/** List API Keys – query params. */
export interface ListApiKeysQuery {
  /** all | main | mobile | backend. Default all. */
  type?: 'all' | ApiKeyType;
  /** Filter by month (YYYY-MM). Keys created in this month. Optional. */
  month?: string;
  page?: number;
  pageSize?: number;
}

/** Single row for API Keys table (NAME, PUBLIC KEY, PERMISSION, STATUS, LAST USED, CREATED). */
export interface ApiKeyListItem {
  id: string;
  name: string;
  /** Display prefix e.g. pk_live_87GH2KD9... or tch_live_abc... */
  publicKey: string;
  permission: ApiKeyPermission;
  /** UI label: Full Access | Read / Write | Read only */
  permissionDisplay: string;
  status: 'active' | 'inactive';
  lastUsedAt: string | null;
  createdAt: string;
  keyType: ApiKeyType;
}

export interface ListApiKeysResponse {
  success: boolean;
  message: string;
  data?: {
    keys: ApiKeyListItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

/** Single API key detail (for detail view – no secret). */
export interface ApiKeyDetailItem {
  id: string;
  name: string;
  publicKey: string;
  permission: ApiKeyPermission;
  permissionDisplay: string;
  status: 'active' | 'inactive';
  keyType: ApiKeyType;
  environment: ApiKeyEnvironment;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  allowedIps: string[] | null;
  expiresAt: string | null;
  rotateAutomatically: boolean;
  serviceScopes: ApiKeyServiceScope[] | null;
}

export interface GetApiKeyDetailResponse {
  success: boolean;
  message: string;
  data?: ApiKeyDetailItem;
  error?: string;
}

/** Details modal – update key (partial). All fields optional. */
export interface UpdateApiKeyRequest {
  /** Key label / name. */
  name?: string;
  /** Permission: read | write | admin. */
  permission?: ApiKeyPermission;
  /** Custom scopes (when permission implies custom). Null or empty = all services. */
  serviceScopes?: ApiKeyServiceScope[] | null;
  /** Allowed IPs. Array or comma-separated. Null = no restriction. */
  allowedIps?: string[] | string | null;
  /** Rotate key automatically. */
  rotateAutomatically?: boolean;
  /** Set key active or disabled. */
  isActive?: boolean;
}

export interface UpdateApiKeyResponse {
  success: boolean;
  message: string;
  data?: ApiKeyDetailItem;
  error?: string;
}

/** Regenerate key – new secret returned once; old key invalidated. */
export interface RegenerateApiKeyResponse {
  success: boolean;
  message: string;
  data?: {
    keyId: string;
    keySecret: string;
    keyPrefix: string;
  };
  error?: string;
}

export interface DeleteApiKeyResponse {
  success: boolean;
  message: string;
  error?: string;
}
