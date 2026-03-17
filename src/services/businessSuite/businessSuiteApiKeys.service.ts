/**
 * Business Suite API Keys – overview stats and key CRUD (create with modal fields).
 */

import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  ApiKeysOverviewData,
  ApiKeysOverviewResponse,
  ApiKeysOverviewStatWithTrend,
  ApiKeysOverviewFailedStat,
  ApiKeysOverviewLatencyStat,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyEnvironment,
  ApiKeyPermission,
  ApiKeyServiceScope,
} from '../../types/api/businessSuiteApiKeys.types';

const ENVIRONMENTS: ApiKeyEnvironment[] = ['development', 'staging', 'production'];
const PERMISSIONS: ApiKeyPermission[] = ['read', 'write', 'admin'];
const SERVICE_SCOPES: ApiKeyServiceScope[] = ['payroll', 'escrow', 'supplier', 'transfer'];

/** IPv4 or IPv4/CIDR (e.g. 192.168.1.1 or 10.0.0.0/24). */
const IP_OR_CIDR_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

function normalizeAllowedIps(input: string[] | string | undefined): string[] | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(input)) {
    const list = input.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    return list.length ? list : null;
  }
  return null;
}

function validateIpOrCidr(entry: string): boolean {
  return IP_OR_CIDR_REGEX.test(entry);
}

function normalizeServiceScopes(input: ApiKeyServiceScope[] | undefined): ApiKeyServiceScope[] | null {
  if (!input || !Array.isArray(input) || input.length === 0) return null;
  const valid = input.filter((s) => SERVICE_SCOPES.includes(s));
  return valid.length ? valid : null;
}

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

  /**
   * Create a new API key (Create New API Key modal).
   * POST /api/business-suite/api-keys
   * Returns keySecret only in this response; caller must store it securely.
   */
  async createApiKey(userId: string, body: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const keyLabel = typeof body.keyLabel === 'string' ? body.keyLabel.trim() : '';
    if (!keyLabel || keyLabel.length > 200) {
      return { success: false, message: 'Key label is required and must be at most 200 characters', error: 'Validation' };
    }

    const environment = body.environment;
    if (!environment || !ENVIRONMENTS.includes(environment)) {
      return { success: false, message: 'Environment must be one of: development, staging, production', error: 'Validation' };
    }

    const permission = body.permission;
    if (!permission || !PERMISSIONS.includes(permission)) {
      return { success: false, message: 'Permission must be one of: read, write, admin', error: 'Validation' };
    }

    const allowedIps = normalizeAllowedIps(body.allowedIpAddresses);
    if (allowedIps != null) {
      const invalid = allowedIps.find((ip) => !validateIpOrCidr(ip));
      if (invalid) {
        return { success: false, message: `Invalid IP or CIDR: ${invalid}. Use e.g. 192.168.1.1 or 10.0.0.0/24`, error: 'Validation' };
      }
    }

    let expiresAt: string | null = null;
    if (body.expirationDate) {
      const parsed = new Date(body.expirationDate);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, message: 'Expiration date must be a valid date (e.g. YYYY-MM-DD or ISO string)', error: 'Validation' };
      }
      if (parsed <= new Date()) {
        return { success: false, message: 'Expiration date must be in the future', error: 'Validation' };
      }
      expiresAt = parsed.toISOString();
    }

    const rotateAutomatically = Boolean(body.rotateKeyAutomatically);
    const serviceScopes = normalizeServiceScopes(body.restrictToServices);

    const envPrefix = environment === 'production' ? 'live' : environment === 'staging' ? 'staging' : 'dev';
    const secretPart = crypto.randomBytes(32).toString('hex');
    const keySecret = `tch_${envPrefix}_${secretPart}`;
    const keyPrefix = keySecret.slice(0, 12) + '...';
    const keyHash = crypto.createHash('sha256').update(keySecret).digest('hex');

    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('api_keys')
      .insert({
        business_id: businessId,
        name: keyLabel,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        is_active: true,
        environment,
        permission,
        allowed_ips: allowedIps,
        expires_at: expiresAt,
        rotate_automatically: rotateAutomatically,
        service_scopes: serviceScopes,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to create API key', error: error.message };
    }
    if (!row) {
      return { success: false, message: 'Failed to create API key', error: 'No row returned' };
    }

    const created = row as { id: string; created_at: string };
    return {
      success: true,
      message: 'API key created. Store the key secret securely; it will not be shown again.',
      data: {
        keyId: created.id,
        keyLabel,
        keySecret,
        keyPrefix,
        environment,
        permission,
        allowedIps,
        expiresAt,
        rotateAutomatically,
        serviceScopes,
        createdAt: created.created_at,
      },
    };
  }
}

export const businessSuiteApiKeysService = new BusinessSuiteApiKeysService();
