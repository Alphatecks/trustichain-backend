/**
 * Sandbox Environment (Developers Tool) – stats, reset, create sandbox key.
 */

export interface SandboxStatsCard {
  value: number | string;
  secondary?: string;
  trendPercent?: number;
  period?: string;
}

export interface SandboxStatsData {
  totalSandboxKeys: SandboxStatsCard;
  sandboxTransactions: SandboxStatsCard;
  errors24h: SandboxStatsCard;
  testWallets: SandboxStatsCard;
}

export interface SandboxStatsResponse {
  success: boolean;
  message: string;
  data?: SandboxStatsData;
  error?: string;
}

export interface SandboxResetResponse {
  success: boolean;
  message: string;
  error?: string;
}

/** Allowed permission scopes for sandbox key (modal checkboxes). */
export type SandboxPermission =
  | 'cancel_escrow'
  | 'create_escrow'
  | 'release_escrow'
  | 'create_wallet'
  | 'read_wallet'
  | 'transaction_logs'
  | 'webhook_test_events';

export interface CreateSandboxKeyRequest {
  /** Environment name (e.g. "Angelo Group"). */
  environmentName?: string;
  /** Environment purpose – dropdown value. */
  environmentPurpose?: string;
  /** Auto-generate sandbox API keys toggle. Default true. */
  autoGenerateKeys?: boolean;
  /** IP allowlist: comma-separated or array. Optional. */
  ipAllowlist?: string[] | string;
  /** Selected permissions. Optional; empty = all. */
  permissions?: SandboxPermission[];
  /** Legacy: human-readable label (used as environment name if environmentName not set). */
  name?: string;
}

export interface CreateSandboxKeyResponse {
  success: boolean;
  message: string;
  data?: {
    keyId: string;
    /** Full secret – only returned on create. */
    keySecret: string;
    /** Masked display (e.g. sk_live_••••••••). */
    secretKey: string;
    keyPrefix: string;
    name: string;
    environmentName: string | null;
    environmentPurpose: string | null;
    autoGenerateKeys: boolean;
    ipAllowlist: string[] | null;
    permissions: SandboxPermission[] | null;
    status: 'active' | 'inactive';
    createdAt: string;
  };
  error?: string;
}

/** List sandbox keys – query params. */
export interface ListSandboxKeysQuery {
  status?: 'Successful' | 'Inactive' | 'all';
  dateRange?: 'monthly' | 'yearly' | 'all';
  page?: number;
  pageSize?: number;
}

export interface SandboxKeyListItem {
  id: string;
  name: string;
  publicKey: string;
  status: 'Successful' | 'Inactive';
  dateCreated: string;
}

export interface ListSandboxKeysResponse {
  success: boolean;
  message: string;
  data?: {
    keys: SandboxKeyListItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export interface SandboxKeyDetailResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    name: string;
    publicKey: string;
    status: 'Successful' | 'Inactive';
    dateCreated: string;
    environmentName: string | null;
    environmentPurpose: string | null;
    permissions: SandboxPermission[] | null;
    createdAt: string;
  };
  error?: string;
}

/** Testing tools – response includes copyValue for Copy button. */
export interface SandboxTestWalletResponse {
  success: boolean;
  message: string;
  data?: { address: string; copyValue: string };
  error?: string;
}

export interface SandboxTestEscrowResponse {
  success: boolean;
  message: string;
  data?: { escrowId: string; reference: string; copyValue: string };
  error?: string;
}

export interface SandboxSimulateResponse {
  success: boolean;
  message: string;
  data?: { eventId: string; copyValue: string };
  error?: string;
}
