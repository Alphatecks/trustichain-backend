/**
 * Business Suite Payrolls Service
 * CRUD, release, summary, and transaction history for payrolls.
 * Payroll release creates real XRPL escrows: XRP is locked from business wallet and released to each team member.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import { exchangeService } from '../exchange/exchange.service';
import { encryptionService } from '../encryption/encryption.service';
import { xrplEscrowService } from '../../xrpl/escrow/xrpl-escrow.service';
import { xrplWalletService } from '../../xrpl/wallet/xrpl-wallet.service';
import { escrowService } from '../escrow/escrow.service';
import type {
  CreatePayrollRequest,
  UpdatePayrollRequest,
  BusinessPayrollListItem,
  BusinessPayrollListResponse,
  BusinessPayrollDetailResponse,
  BusinessPayrollDetailItem,
  BusinessPayrollSummaryResponse,
  PayrollTransactionListItem,
  BusinessPayrollTransactionsResponse,
  BusinessPayrollTransactionDetailResponse,
  DisbursementMode,
} from '../../types/api/businessSuitePayrolls.types';

function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.getUTCDate();
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day} ${month}`.toLowerCase();
}

function formatTransactionId(payrollId: string, itemId: string): string {
  const p = payrollId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const i = itemId.replace(/-/g, '').slice(-6);
  return `TC-PAY-${p}-${i}`;
}

function parseFrontendAmountToNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep only numeric/separator/sign characters from common formatted inputs (e.g. "$1,200.50")
  let normalized = trimmed.replace(/[^\d,.\-]/g, '');
  if (!normalized) return null;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    // If comma appears after dot, treat comma as decimal separator (EU format)
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (normalized.match(/,/g) || []).length;
    if (commaCount > 1) {
      normalized = normalized.replace(/,/g, '');
    } else {
      const [intPart, decPart = ''] = normalized.split(',');
      normalized = decPart.length > 0 && decPart.length <= 2
        ? `${intPart}.${decPart}`
        : normalized.replace(/,/g, '');
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export class BusinessSuitePayrollsService {
  /**
   * Deterministic XRPL permission check for payroll escrow destination.
   * Uses business wallet as source and receiver wallet as destination.
   */
  async checkPayrollEscrowPermission(
    userId: string,
    input: { receiverWalletAddress?: string; counterpartyId?: string }
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      network: string;
      fromAddress: string;
      toAddress: string;
      destinationFlags: {
        raw: number;
        depositAuthEnabled: boolean;
        requireDestTag: boolean;
        disallowXrp: boolean;
      };
      depositAuthorized: boolean | null;
      canCreateEscrow: boolean;
      reasonCode:
        | 'OK'
        | 'DESTINATION_DEPOSIT_AUTH_NOT_AUTHORIZED'
        | 'DESTINATION_ACCOUNT_NOT_FOUND'
        | 'UNDETERMINED';
      reason: string;
      checkedAt: string;
    };
    error?: string;
  }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;

    const { data: businessWallet } = await client
      .from('wallets')
      .select('xrpl_address')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .single();
    if (!businessWallet?.xrpl_address) {
      return { success: false, message: 'Business wallet not found. Connect a business wallet first.', error: 'Wallet not found' };
    }

    let receiverWalletAddress = (input.receiverWalletAddress || '').trim();
    if (!receiverWalletAddress && input.counterpartyId) {
      const { data: cpWallet } = await client
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', input.counterpartyId)
        .eq('suite_context', 'personal')
        .maybeSingle();
      receiverWalletAddress = (cpWallet?.xrpl_address || '').trim();
    }
    if (!receiverWalletAddress) {
      return {
        success: false,
        message: 'receiverWalletAddress is required (or provide counterpartyId with a connected personal wallet).',
        error: 'Missing receiver wallet',
      };
    }
    if (!receiverWalletAddress.startsWith('r')) {
      return { success: false, message: 'receiverWalletAddress must be a valid XRPL classic address.', error: 'Invalid receiver wallet' };
    }

    return xrplEscrowService.diagnoseEscrowCreatePermission({
      fromAddress: businessWallet.xrpl_address,
      toAddress: receiverWalletAddress,
    });
  }

  async createPayroll(userId: string, body: CreatePayrollRequest): Promise<{ success: boolean; message: string; data?: { id: string; escrowsCreated?: boolean; xrpHashes?: string[] }; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };
    const client = supabaseAdmin!;
    if (!body.name?.trim()) return { success: false, message: 'Payroll name is required', error: 'Validation' };

    const releaseDate = body.releaseDate ? new Date(body.releaseDate).toISOString().split('T')[0] : body.endDate ? new Date(body.endDate).toISOString().split('T')[0] : null;
    const freezeAutoRelease = body.freezeAutoRelease ?? (body.disbursementMode === 'manual_release');
    const cycleDate = body.cycleDate ? new Date(body.cycleDate).toISOString().split('T')[0] : null;
    const startDate = body.startDate ? new Date(body.startDate).toISOString().split('T')[0] : null;
    const endDate = body.endDate ? new Date(body.endDate).toISOString().split('T')[0] : null;

    const { data: payroll, error: payrollError } = await client
      .from('business_payrolls')
      .insert({
        business_id: businessId,
        user_id: userId,
        name: body.name.trim(),
        release_date: releaseDate,
        freeze_auto_release: freezeAutoRelease,
        status: releaseDate ? 'scheduled' : 'draft',
        team_name: body.teamName?.trim() || null,
        company_name: body.companyName?.trim() || null,
        company_email: body.companyEmail?.trim() || null,
        payroll_cycle: body.payrollCycle || null,
        cycle_date: cycleDate,
        start_date: startDate,
        end_date: endDate,
        company_description: body.companyDescription?.trim() || null,
        default_salary_type: body.defaultSalaryType?.trim() || null,
        currency: body.currency?.trim() || 'USD',
        enable_allowances: body.enableAllowances ?? false,
      })
      .select('id')
      .single();
    if (payrollError || !payroll) return { success: false, message: payrollError?.message || 'Failed to create payroll', error: payrollError?.message };

    const itemInputs = Array.isArray(body.items) ? body.items : [];
    if (itemInputs.length > 0) {
      const validItems = itemInputs.filter(
        (it: { counterpartyId?: string | null }) => it != null && typeof it.counterpartyId === 'string' && it.counterpartyId.trim().length > 0
      );
      if (validItems.length !== itemInputs.length) {
        await client.from('business_payrolls').delete().eq('id', payroll.id);
        return {
          success: false,
          message: 'Each payroll item must have a valid counterpartyId (team member user id).',
          error: 'Invalid items',
        };
      }
      const items: Array<{ payroll_id: string; counterparty_id: string; amount_usd: number; due_date: string | null }> = [];
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i] as { counterpartyId: string; amountUsd: unknown; dueDate?: string };
        const parsedAmountUsd = parseFrontendAmountToNumber(item.amountUsd);
        if (parsedAmountUsd == null || parsedAmountUsd <= 0) {
          await client.from('business_payrolls').delete().eq('id', payroll.id);
          return {
            success: false,
            message: `Invalid amountUsd for payroll item ${i + 1}. Send a positive amount (for example: 1200.50).`,
            error: 'Invalid amount',
          };
        }

        items.push({
          payroll_id: payroll.id,
          counterparty_id: item.counterpartyId.trim(),
          amount_usd: parseFloat(parsedAmountUsd.toFixed(2)),
          due_date: item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : null,
        });
      }

      const { error: itemsError } = await client.from('business_payroll_items').insert(items);
      if (itemsError) {
        await client.from('business_payrolls').delete().eq('id', payroll.id);
        return { success: false, message: itemsError.message, error: itemsError.message };
      }

      if (body.createEscrows === true) {
        const releaseDate = body.releaseDate ? new Date(body.releaseDate).toISOString().split('T')[0] : null;
        const created = await this.createEscrowsForPayroll(client, userId, payroll.id, body.name.trim(), releaseDate);
        if (!created.success) {
          await client.from('business_payrolls').delete().eq('id', payroll.id);
          return { success: false, message: created.message, error: created.error };
        }
        await client.from('business_payrolls').update({ status: 'released' }).eq('id', payroll.id);
        return {
          success: true,
          message: 'Payroll created and escrowed',
          data: {
            id: payroll.id,
            escrowsCreated: true,
            xrpHashes: created.data?.xrpHashes ?? [],
          },
        };
      }
    }
    return { success: true, message: 'Payroll created', data: { id: payroll.id } };
  }

  /** Create one XRPL escrow per payroll item: real XRP from business wallet to each team member. */
  private async createEscrowsForPayroll(
    client: SupabaseClient,
    userId: string,
    payrollId: string,
    payrollName: string,
    releaseDate: string | null
  ): Promise<{ success: boolean; message: string; data?: { xrpHashes: string[] }; error?: string }> {
    if (!client) return { success: false, message: 'Database unavailable', error: 'Database' };
    const { data: items } = await client
      .from('business_payroll_items')
      .select('*')
      .eq('payroll_id', payrollId)
      .is('escrow_id', null);
    if (!items?.length) return { success: true, message: 'No payroll items require escrow creation', data: { xrpHashes: [] } };

    const { data: businessWallet } = await client
      .from('wallets')
      .select('xrpl_address, encrypted_wallet_secret')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .single();
    if (!businessWallet?.xrpl_address) {
      return { success: false, message: 'Business wallet not found. Connect a business wallet first.', error: 'Wallet not found' };
    }
    if (!businessWallet.encrypted_wallet_secret) {
      return { success: false, message: 'Business wallet must be connected with signing capability to release XRP to team members.', error: 'Wallet signing required' };
    }

    const rates = await exchangeService.getLiveExchangeRates();
    if (!rates.success || !rates.data) {
      return { success: false, message: 'Failed to fetch exchange rates for USD to XRP conversion.', error: 'Exchange rate fetch failed' };
    }
    const usdRate = rates.data.rates.find((r) => r.currency === 'USD')?.rate;
    if (!usdRate || usdRate <= 0) {
      return { success: false, message: 'XRP/USD exchange rate not available.', error: 'Exchange rate not available' };
    }

    const counterpartyIds = [...new Set(items.map((i: any) => i.counterparty_id))];
    const { data: counterpartyWallets } = await client
      .from('wallets')
      .select('user_id, xrpl_address')
      .in('user_id', counterpartyIds)
      .eq('suite_context', 'personal');
    const walletByUser = (counterpartyWallets || []).reduce<Record<string, string>>((acc, w: any) => {
      if (w.xrpl_address) acc[w.user_id] = w.xrpl_address;
      return acc;
    }, {});
    const missing = counterpartyIds.filter((id) => !walletByUser[id]);
    if (missing.length > 0) {
      const { data: users } = await client.from('users').select('id, full_name, email').in('id', missing);
      const names = (users || []).map((u: any) => u.full_name || u.email || u.id).join(', ');
      return { success: false, message: `Team member(s) must connect a wallet to receive XRP: ${names}`, error: 'Counterparty wallet missing' };
    }

    const RIPPLE_EPOCH_OFFSET = 946684800;
    let finishAfter: number | undefined;
    if (releaseDate) {
      const [y, m, d] = releaseDate.split('-').map(Number);
      const release = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (release > new Date()) {
        finishAfter = Math.floor(release.getTime() / 1000) - RIPPLE_EPOCH_OFFSET;
      }
    }
    if (finishAfter == null) {
      // Align with personal escrow flow: use a near-future FinishAfter for immediate usability
      // while staying compatible with XRPL EscrowCreate validation rules.
      finishAfter = Math.floor(Date.now() / 1000) + 10 - RIPPLE_EPOCH_OFFSET;
    }

    const itemAmountsXrp: Array<{ item: any; amountUsd: number; amountXrp: number }> = [];
    for (const item of items as any[]) {
      const usd = Number(item.amount_usd);
      if (!Number.isFinite(usd) || usd <= 0) {
        return {
          success: false,
          message: `Invalid payroll amount for item ${item.id}. amount_usd must be a positive number.`,
          error: 'Invalid amount',
        };
      }

      const amountXrp = parseFloat((usd / usdRate).toFixed(6));
      if (!Number.isFinite(amountXrp) || amountXrp <= 0) {
        return {
          success: false,
          message: `Invalid XRP conversion for payroll item ${item.id}. Amount is too small after conversion.`,
          error: 'Invalid converted amount',
        };
      }

      itemAmountsXrp.push({ item, amountUsd: usd, amountXrp });
    }
    const totalXrp = itemAmountsXrp.reduce((s, x) => s + x.amountXrp, 0);
    const feePerTx = 0.000012;
    const requiredXrp = totalXrp + items.length * feePerTx;
    const balanceXrp = await xrplWalletService.getBalance(businessWallet.xrpl_address);
    if (balanceXrp < requiredXrp) {
      return {
        success: false,
        message: `Insufficient XRP in business wallet. Required ${requiredXrp.toFixed(6)} XRP (${totalXrp.toFixed(6)} for payroll + fees), have ${balanceXrp.toFixed(6)} XRP.`,
        error: 'Insufficient balance',
      };
    }

    let decryptedSecret: string;
    try {
      decryptedSecret = encryptionService.decrypt(businessWallet.encrypted_wallet_secret).trim();
    } catch {
      return { success: false, message: 'Could not use business wallet for signing. Reconnect the wallet if needed.', error: 'Decryption failed' };
    }

    const { data: payer } = await client.from('users').select('full_name, email').eq('id', userId).single();
    const currentYear = new Date().getFullYear();
    const { data: lastEscrow } = await client.from('escrows').select('escrow_sequence').gte('created_at', new Date(currentYear, 0, 1).toISOString()).order('escrow_sequence', { ascending: false }).limit(1).maybeSingle();
    let nextSeq = lastEscrow?.escrow_sequence ? lastEscrow.escrow_sequence + 1 : 1;
    const xrpHashes: string[] = [];

    for (const { item, amountUsd, amountXrp } of itemAmountsXrp) {
      const toAddress = walletByUser[item.counterparty_id];
      const { data: counterparty } = await client.from('users').select('full_name, email').eq('id', item.counterparty_id).single();
      let xrplTxHash: string;
      try {
        xrplTxHash = await xrplEscrowService.createEscrow({
          fromAddress: businessWallet.xrpl_address,
          toAddress,
          amountXrp,
          finishAfter,
          walletSecret: decryptedSecret,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const debugContext: Record<string, unknown> = {
          payrollId,
          payrollItemId: item.id,
          counterpartyId: item.counterparty_id,
          fromAddress: businessWallet.xrpl_address,
          toAddress,
          amountXrp,
        };
        try {
          const permissionCheck = await xrplEscrowService.diagnoseEscrowCreatePermission({
            fromAddress: businessWallet.xrpl_address,
            toAddress,
          });
          debugContext.permissionCheck = permissionCheck.data || null;
        } catch (diagErr) {
          debugContext.permissionCheckError = diagErr instanceof Error ? diagErr.message : String(diagErr);
        }
        console.error('[Payroll Escrow Create] XRPL escrow creation failed with runtime pair debug:', debugContext);
        return {
          success: false,
          message: `Failed to create XRPL escrow for team member wallet ${toAddress}: ${msg}. Debug from=${businessWallet.xrpl_address} to=${toAddress}`,
          error: 'XRPL escrow failed',
        };
      }
      const { data: escrow, error: escrowError } = await client
        .from('escrows')
        .insert({
          user_id: userId,
          counterparty_id: item.counterparty_id,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'active',
          xrpl_escrow_id: xrplTxHash,
          description: `Payroll: ${payrollName}`,
          transaction_type: 'payroll',
          suite_context: 'business',
          progress: 0,
          escrow_sequence: nextSeq,
          payer_name: payer?.full_name || null,
          counterparty_name: counterparty?.full_name || null,
        })
        .select('id')
        .single();
      if (escrowError || !escrow) {
        return { success: false, message: escrowError?.message || 'Failed to save escrow record', error: escrowError?.message };
      }
      await client.from('business_payroll_items').update({ escrow_id: escrow.id, amount_xrp: amountXrp, status: 'released' }).eq('id', item.id);
      xrpHashes.push(xrplTxHash);
      nextSeq += 1;
    }
    return { success: true, message: 'Escrows created', data: { xrpHashes } };
  }

  async listPayrolls(userId: string, page: number = 1, pageSize: number = 20): Promise<BusinessPayrollListResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: check.error };
    const client = supabaseAdmin!;
    const from = (page - 1) * pageSize;
    const { data: payrolls, error, count } = await client
      .from('business_payrolls')
      .select('id, name, release_date, freeze_auto_release, status, created_at', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { success: false, message: error.message, error: error.message };
    const list = payrolls || [];
    const payrollIds = list.map((p: { id: string }) => p.id);
    const { data: itemRows } = payrollIds.length > 0
      ? await client.from('business_payroll_items').select('payroll_id, amount_usd, status').in('payroll_id', payrollIds)
      : { data: [] };
    const byPayroll = (itemRows || []).reduce<Record<string, { total: number; count: number; released: number }>>((acc, r: any) => {
      if (!acc[r.payroll_id]) acc[r.payroll_id] = { total: 0, count: 0, released: 0 };
      acc[r.payroll_id].total += parseFloat(String(r.amount_usd)) || 0;
      acc[r.payroll_id].count += 1;
      if (r.status === 'released') acc[r.payroll_id].released += 1;
      return acc;
    }, {});
    const items: BusinessPayrollListItem[] = list.map((p: any) => {
      const agg = byPayroll[p.id] || { total: 0, count: 0, released: 0 };
      const progressPercent = agg.count > 0 ? Math.round((agg.released / agg.count) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        releaseDate: p.release_date ? formatReleaseDate(p.release_date) : null,
        freezeAutoRelease: !!p.freeze_auto_release,
        status: p.status,
        progressPercent,
        totalAmountUsd: parseFloat(agg.total.toFixed(2)),
        itemCount: agg.count,
        releasedCount: agg.released,
        createdAt: p.created_at,
      };
    });
    const total = count ?? 0;
    return {
      success: true,
      message: 'Payrolls list retrieved',
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    };
  }

  async getPayrollDetail(userId: string, payrollId: string): Promise<BusinessPayrollDetailResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };
    const client = supabaseAdmin!;
    const { data: payroll, error: payrollError } = await client
      .from('business_payrolls')
      .select('*')
      .eq('id', payrollId)
      .eq('business_id', businessId)
      .single();
    if (payrollError || !payroll) return { success: false, message: 'Payroll not found', error: 'Not found' };
    const { data: itemRows } = await client.from('business_payroll_items').select('*').eq('payroll_id', payrollId).order('created_at', { ascending: true });
    const counterpartyIds = (itemRows || []).map((r: any) => r.counterparty_id);
    const { data: users } = counterpartyIds.length > 0 ? await client.from('users').select('id, full_name, email').in('id', counterpartyIds) : { data: [] };
    const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: any) => {
      acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
      return acc;
    }, {});
    const totalAmountUsd = (itemRows || []).reduce((s: number, r: any) => s + parseFloat(String(r.amount_usd)), 0);
    const items: BusinessPayrollDetailItem[] = (itemRows || []).map((r: any) => ({
      id: r.id,
      counterpartyId: r.counterparty_id,
      counterpartyName: userMap[r.counterparty_id]?.full_name ?? '—',
      counterpartyEmail: userMap[r.counterparty_id]?.email ?? '',
      amountUsd: parseFloat(String(r.amount_usd)),
      amountXrp: r.amount_xrp != null ? parseFloat(String(r.amount_xrp)) : null,
      status: r.status,
      dueDate: r.due_date,
      escrowId: r.escrow_id,
      createdAt: r.created_at,
    }));
    const disbursementMode: DisbursementMode = payroll.freeze_auto_release ? 'manual_release' : 'auto_release';
    return {
      success: true,
      message: 'Payroll detail retrieved',
      data: {
        id: payroll.id,
        name: payroll.name,
        teamName: payroll.team_name ?? undefined,
        companyName: payroll.company_name ?? undefined,
        companyEmail: payroll.company_email ?? undefined,
        payrollCycle: payroll.payroll_cycle ?? undefined,
        cycleDate: payroll.cycle_date ?? undefined,
        startDate: payroll.start_date ?? undefined,
        endDate: payroll.end_date ?? undefined,
        companyDescription: payroll.company_description ?? undefined,
        defaultSalaryType: payroll.default_salary_type ?? undefined,
        currency: payroll.currency ?? undefined,
        enableAllowances: !!payroll.enable_allowances,
        releaseDate: payroll.release_date ? formatReleaseDate(payroll.release_date) : null,
        freezeAutoRelease: !!payroll.freeze_auto_release,
        disbursementMode,
        status: payroll.status,
        totalAmountUsd: parseFloat(totalAmountUsd.toFixed(2)),
        createdAt: payroll.created_at,
        updatedAt: payroll.updated_at,
        items,
      },
    };
  }

  async updatePayroll(userId: string, payrollId: string, body: UpdatePayrollRequest): Promise<{ success: boolean; message: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };
    const { data: existing } = await client.from('business_payrolls').select('id').eq('id', payrollId).eq('business_id', businessId).single();
    if (!existing) return { success: false, message: 'Payroll not found', error: 'Not found' };
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.teamName !== undefined) updates.team_name = body.teamName?.trim() || null;
    if (body.companyName !== undefined) updates.company_name = body.companyName?.trim() || null;
    if (body.companyEmail !== undefined) updates.company_email = body.companyEmail?.trim() || null;
    if (body.payrollCycle !== undefined) updates.payroll_cycle = body.payrollCycle || null;
    if (body.cycleDate !== undefined) updates.cycle_date = body.cycleDate ? new Date(body.cycleDate).toISOString().split('T')[0] : null;
    if (body.startDate !== undefined) updates.start_date = body.startDate ? new Date(body.startDate).toISOString().split('T')[0] : null;
    if (body.endDate !== undefined) updates.end_date = body.endDate ? new Date(body.endDate).toISOString().split('T')[0] : null;
    if (body.companyDescription !== undefined) updates.company_description = body.companyDescription?.trim() || null;
    if (body.releaseDate !== undefined) updates.release_date = body.releaseDate ? new Date(body.releaseDate).toISOString().split('T')[0] : null;
    if (body.freezeAutoRelease !== undefined) updates.freeze_auto_release = body.freezeAutoRelease;
    if (body.disbursementMode !== undefined) updates.freeze_auto_release = body.disbursementMode === 'manual_release';
    if (body.defaultSalaryType !== undefined) updates.default_salary_type = body.defaultSalaryType?.trim() || null;
    if (body.currency !== undefined) updates.currency = body.currency?.trim() || null;
    if (body.enableAllowances !== undefined) updates.enable_allowances = body.enableAllowances;
    if (Object.keys(updates).length === 0) return { success: true, message: 'No changes' };
    const { error } = await client.from('business_payrolls').update(updates).eq('id', payrollId).eq('business_id', businessId);
    if (error) return { success: false, message: error.message, error: error.message };
    return { success: true, message: 'Payroll updated' };
  }

  async deletePayroll(userId: string, payrollId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };

    const { data: payroll } = await client
      .from('business_payrolls')
      .select('id, status')
      .eq('id', payrollId)
      .eq('business_id', businessId)
      .single();

    if (!payroll) return { success: false, message: 'Payroll not found', error: 'Not found' };

    const { data: linkedItems } = await client
      .from('business_payroll_items')
      .select('escrow_id')
      .eq('payroll_id', payrollId)
      .not('escrow_id', 'is', null)
      .limit(200);

    if (linkedItems && linkedItems.length > 0) {
      const escrowIds = [...new Set(linkedItems.map((r: { escrow_id: string | null }) => r.escrow_id).filter(Boolean))] as string[];
      if (escrowIds.length > 0) {
        const { data: linkedEscrows } = await client
          .from('escrows')
          .select('id, status')
          .in('id', escrowIds);

        const blocking = (linkedEscrows || []).filter((e: { status: string }) => !['completed', 'cancelled'].includes(e.status));
        if (blocking.length > 0) {
          return {
            success: false,
            message: 'Cannot delete payroll while linked escrows are still active. Complete or cancel those escrows first.',
            error: 'Has active linked escrows',
          };
        }
      }
    }

    const { error } = await client
      .from('business_payrolls')
      .delete()
      .eq('id', payrollId)
      .eq('business_id', businessId);

    if (error) return { success: false, message: error.message, error: error.message };
    return { success: true, message: 'Payroll deleted' };
  }

  async releasePayroll(userId: string, payrollId: string): Promise<{ success: boolean; message: string; data?: { xrpHashesCreated?: string[] }; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };
    const client = supabaseAdmin!;
    const { data: payroll, error: payrollError } = await client.from('business_payrolls').select('*').eq('id', payrollId).eq('business_id', businessId).single();
    if (payrollError || !payroll) return { success: false, message: 'Payroll not found', error: 'Not found' };

    const releaseDate = payroll.release_date ? String(payroll.release_date).split('T')[0] : null;
    const alreadyReleased = payroll.status === 'released';
    let xrpHashesCreated: string[] = [];

    if (!alreadyReleased) {
      const created = await this.createEscrowsForPayroll(client, userId, payrollId, payroll.name, releaseDate);
      if (!created.success) return { success: false, message: created.message, error: created.error };
      xrpHashesCreated = created.data?.xrpHashes ?? [];
    }

    const { data: items } = await client.from('business_payroll_items').select('escrow_id').eq('payroll_id', payrollId).not('escrow_id', 'is', null);
    const escrowIds = [...new Set((items || []).map((r: { escrow_id: string }) => r.escrow_id).filter(Boolean))] as string[];
    let finishedCount = 0;
    for (const escrowId of escrowIds) {
      const { data: escrow } = await client.from('escrows').select('id, status').eq('id', escrowId).single();
      if (!escrow || escrow.status !== 'active') continue;
      const result = await escrowService.releaseEscrow(userId, escrowId);
      if (!result.success) {
        const recoverableErrors = new Set(['Escrow already finished', 'Escrow already cancelled']);
        if (result.error && recoverableErrors.has(result.error)) {
          continue;
        }
        return { success: false, message: result.message || 'Failed to release escrow', error: result.error };
      }
      finishedCount += 1;
    }

    if (alreadyReleased && finishedCount === 0) {
      return { success: true, message: 'Payroll was already released', data: xrpHashesCreated.length ? { xrpHashesCreated } : undefined };
    }
    if (!alreadyReleased) {
      await client.from('business_payrolls').update({ status: 'released' }).eq('id', payrollId);
    }
    return {
      success: true,
      message: alreadyReleased && finishedCount > 0
        ? `Released ${finishedCount} remaining escrow(s); payroll is now fully released.`
        : 'Payroll released',
      data: xrpHashesCreated.length ? { xrpHashesCreated } : undefined,
    };
  }

  async getSummary(userId: string): Promise<BusinessPayrollSummaryResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: check.error };
    const client = supabaseAdmin!;
    const [
      { count: totalPayroll },
      { data: teamIds },
      { data: escrowRows },
    ] = await Promise.all([
      client.from('business_payrolls').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
      client.from('business_teams').select('id').eq('business_id', businessId),
      client.from('escrows').select('amount_usd').eq('user_id', userId).eq('suite_context', 'business').eq('transaction_type', 'payroll').in('status', ['pending', 'active']),
    ]);
    let totalTeamMembers = 0;
    if (teamIds?.length) {
      const { count } = await client.from('business_team_members').select('*', { count: 'exact', head: true }).in('team_id', teamIds.map((t: { id: string }) => t.id));
      totalTeamMembers = count ?? 0;
    }
    const totalPayrollEscrowed = (escrowRows || []).reduce((s: number, r: { amount_usd: string | number }) => s + parseFloat(String(r.amount_usd)), 0);
    return {
      success: true,
      message: 'Payroll summary retrieved',
      data: {
        totalPayroll: totalPayroll ?? 0,
        totalTeamMembers,
        totalPayrollEscrowed: parseFloat(totalPayrollEscrowed.toFixed(2)),
      },
    };
  }

  async getTransactions(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    month?: string
  ): Promise<BusinessPayrollTransactionsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: check.error };
    const client = supabaseAdmin!;
    const { data: userPayrolls } = await client.from('business_payrolls').select('id').eq('business_id', businessId);
    const payrollIds = (userPayrolls || []).map((p: { id: string }) => p.id);
    if (payrollIds.length === 0) {
      return { success: true, message: 'Transaction history retrieved', data: { items: [], total: 0, page, pageSize, totalPages: 0 } };
    }
    let query = client
      .from('business_payroll_items')
      .select('id, payroll_id, amount_usd, amount_xrp, status, due_date, created_at, counterparty_id', { count: 'exact' })
      .in('payroll_id', payrollIds)
      .order('created_at', { ascending: false });
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }
    const from = (page - 1) * pageSize;
    const { data: itemRows, error, count } = await query.range(from, from + pageSize - 1);
    if (error) return { success: false, message: error.message, error: error.message };
    const list = itemRows || [];
    const pids = [...new Set(list.map((r: any) => r.payroll_id))];
    const counterpartyIds = [...new Set(list.map((r: any) => r.counterparty_id))];
    const { data: payrolls } = pids.length > 0 ? await client.from('business_payrolls').select('id, name').in('id', pids) : { data: [] };
    const { data: users } = counterpartyIds.length > 0 ? await client.from('users').select('id, full_name').in('id', counterpartyIds) : { data: [] };
    const payrollMap = (payrolls || []).reduce<Record<string, string>>((acc, p: any) => { acc[p.id] = p.name; return acc; }, {});
    const userMap = (users || []).reduce<Record<string, string>>((acc, u: any) => { acc[u.id] = u.full_name || '—'; return acc; }, {});
    const items: PayrollTransactionListItem[] = list.map((r: any) => ({
      id: r.id,
      transactionId: formatTransactionId(r.payroll_id, r.id),
      payrollId: r.payroll_id,
      payrollName: payrollMap[r.payroll_id] || '—',
      amountXrp: r.amount_xrp != null ? parseFloat(String(r.amount_xrp)) : null,
      amountUsd: parseFloat(String(r.amount_usd)),
      status: r.status,
      dueDate: r.due_date,
      counterpartyName: userMap[r.counterparty_id] || '—',
      createdAt: r.created_at,
    }));
    const total = count ?? 0;
    return {
      success: true,
      message: 'Transaction history retrieved',
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    };
  }

  async getTransactionDetail(userId: string, itemId: string): Promise<BusinessPayrollTransactionDetailResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const { data: item, error: itemError } = await client.from('business_payroll_items').select('*').eq('id', itemId).single();
    if (itemError || !item) return { success: false, message: 'Transaction not found', error: 'Not found' };
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) return { success: false, message: 'No registered business for this account', error: 'No business' };
    const { data: payroll } = await client.from('business_payrolls').select('id, name').eq('id', item.payroll_id).eq('business_id', businessId).single();
    if (!payroll) return { success: false, message: 'Transaction not found', error: 'Not found' };
    const { data: counterparty } = await client.from('users').select('full_name, email').eq('id', item.counterparty_id).single();
    const out = {
      id: item.id,
      transactionId: formatTransactionId(item.payroll_id, item.id),
      payrollId: item.payroll_id,
      payrollName: payroll.name,
      amountXrp: item.amount_xrp != null ? parseFloat(String(item.amount_xrp)) : null,
      amountUsd: parseFloat(String(item.amount_usd)),
      status: item.status,
      dueDate: item.due_date,
      counterpartyName: counterparty?.full_name || '—',
      counterpartyEmail: counterparty?.email || '',
      escrowId: item.escrow_id,
      createdAt: item.created_at,
    };
    return { success: true, message: 'Transaction detail retrieved', data: out };
  }
}

export const businessSuitePayrollsService = new BusinessSuitePayrollsService();
