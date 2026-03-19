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

export interface CreateSandboxKeyRequest {
  /** Human-readable label for the key. */
  name?: string;
}

export interface CreateSandboxKeyResponse {
  success: boolean;
  message: string;
  data?: {
    keyId: string;
    keySecret: string;
    keyPrefix: string;
    name: string;
    createdAt: string;
  };
  error?: string;
}
