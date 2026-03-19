/**
 * Sandbox Environment (Developers Tool) – stats, reset, create sandbox key.
 */

import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  SandboxStatsData,
  SandboxStatsResponse,
  SandboxResetResponse,
  CreateSandboxKeyRequest,
  CreateSandboxKeyResponse,
  SandboxStatsCard,
  SandboxPermission,
} from '../../types/api/sandbox.types';

const SANDBOX_PERMISSIONS: SandboxPermission[] = [
  'cancel_escrow',
  'create_escrow',
  'release_escrow',
  'create_wallet',
  'read_wallet',
  'transaction_logs',
  'webhook_test_events',
];

const IP_OR_CIDR_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

function normalizeIpAllowlist(input: string[] | string | undefined): string[] | null {
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

function normalizePermissions(input: SandboxPermission[] | undefined): SandboxPermission[] | null {
  if (!input || !Array.isArray(input) || input.length === 0) return null;
  const valid = input.filter((p): p is SandboxPermission => SANDBOX_PERMISSIONS.includes(p));
  return valid.length ? valid : null;
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export class SandboxService {
  /**
   * GET /api/business-suite/sandbox/stats – dashboard cards: Total Sandbox Keys, Sandbox Transactions, Errors (24h), Test Wallets.
   */
  async getSandboxStats(userId: string): Promise<SandboxStatsResponse> {
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
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const thisMonthStartIso = thisMonthStart.toISOString();
    const lastMonthStartIso = lastMonthStart.toISOString();
    const twentyFourHoursAgoIso = twentyFourHoursAgo.toISOString();

    // Total Sandbox Keys (count) + locked USD
    const { count: totalKeysCount } = await client
      .from('sandbox_keys')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    const { data: balanceRow } = await client
      .from('sandbox_balances')
      .select('locked_usd')
      .eq('business_id', businessId)
      .single();

    const lockedUsd = balanceRow?.locked_usd != null ? Number(balanceRow.locked_usd) : 0;
    const totalSandboxKeys: SandboxStatsCard = {
      value: totalKeysCount ?? 0,
      secondary: lockedUsd > 0 ? `$${lockedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} locked` : undefined,
      trendPercent: 0,
      period: 'This month',
    };

    // Sandbox Transactions this month + last month (for trend)
    const { count: transactionsThisMonth } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const { count: transactionsLastMonth } = await client
      .from('sandbox_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', lastMonthStartIso)
      .lt('created_at', thisMonthStartIso);

    const txThis = transactionsThisMonth ?? 0;
    const txLast = transactionsLastMonth ?? 0;
    const sandboxTransactions: SandboxStatsCard = {
      value: txThis,
      period: 'This month',
      trendPercent: trendPercent(txThis, txLast),
    };

    // Errors (24h)
    const { count: errors24hCount } = await client
      .from('sandbox_errors')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', twentyFourHoursAgoIso);

    const errors24h: SandboxStatsCard = {
      value: errors24hCount ?? 0,
      period: 'This month',
    };

    // Test Wallets this month
    const { count: testWalletsCount } = await client
      .from('test_wallets')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', thisMonthStartIso);

    const testWallets: SandboxStatsCard = {
      value: testWalletsCount ?? 0,
      period: 'This month',
    };

    const data: SandboxStatsData = {
      totalSandboxKeys,
      sandboxTransactions,
      errors24h,
      testWallets,
    };

    return {
      success: true,
      message: 'Sandbox stats retrieved',
      data,
    };
  }

  /**
   * POST /api/business-suite/sandbox/reset – reset sandbox data for this business.
   */
  async resetSandboxData(userId: string): Promise<SandboxResetResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;

    await client.from('sandbox_errors').delete().eq('business_id', businessId);
    await client.from('sandbox_transactions').delete().eq('business_id', businessId);
    await client.from('test_wallets').delete().eq('business_id', businessId);
    await client.from('sandbox_keys').delete().eq('business_id', businessId);
    await client.from('sandbox_balances').delete().eq('business_id', businessId);

    return {
      success: true,
      message: 'Sandbox data reset successfully',
    };
  }

  /**
   * POST /api/business-suite/sandbox/keys – create sandbox key (Create New Sandbox Key modal). keySecret returned once.
   */
  async createSandboxKey(userId: string, body: CreateSandboxKeyRequest): Promise<CreateSandboxKeyResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No business registered for this account', error: 'No business' };
    }

    const environmentName =
      typeof body?.environmentName === 'string' && body.environmentName.trim()
        ? body.environmentName.trim()
        : typeof body?.name === 'string' && body.name.trim()
          ? body.name.trim()
          : 'Sandbox Key';
    const environmentPurpose =
      typeof body?.environmentPurpose === 'string' && body.environmentPurpose.trim()
        ? body.environmentPurpose.trim()
        : null;
    const autoGenerateKeys = body?.autoGenerateKeys !== false;

    const allowedIps = normalizeIpAllowlist(body?.ipAllowlist);
    if (allowedIps != null) {
      const invalid = allowedIps.find((ip) => !validateIpOrCidr(ip));
      if (invalid) {
        return {
          success: false,
          message: `Invalid IP or CIDR: ${invalid}. Use e.g. 192.168.1.1 or 10.0.0.0/24`,
          error: 'Validation',
        };
      }
    }

    const permissions = normalizePermissions(body?.permissions);

    const secretPart = crypto.randomBytes(32).toString('hex');
    const keySecret = `tch_sandbox_${secretPart}`;
    const keyPrefix = keySecret.slice(0, 14) + '...';
    const keyHash = crypto.createHash('sha256').update(keySecret).digest('hex');

    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('sandbox_keys')
      .insert({
        business_id: businessId,
        name: environmentName,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        environment_name: environmentName,
        environment_purpose: environmentPurpose,
        auto_generate_keys: autoGenerateKeys,
        allowed_ips: allowedIps,
        permissions: permissions,
        is_active: true,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to create sandbox key', error: error.message };
    }
    if (!row) {
      return { success: false, message: 'Failed to create sandbox key', error: 'No row returned' };
    }

    const created = row as { id: string; created_at: string };
    return {
      success: true,
      message: 'Sandbox key created. Store the key secret securely; it will not be shown again.',
      data: {
        keyId: created.id,
        keySecret,
        secretKey: keyPrefix,
        keyPrefix,
        name: environmentName,
        environmentName: environmentName,
        environmentPurpose,
        autoGenerateKeys,
        ipAllowlist: allowedIps,
        permissions,
        status: 'active',
        createdAt: created.created_at,
      },
    };
  }
}

export const sandboxService = new SandboxService();
