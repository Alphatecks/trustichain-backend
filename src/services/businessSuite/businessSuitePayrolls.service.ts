/**
 * Business Suite Payrolls Service
 * CRUD, release, summary, and transaction history for payrolls.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
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

export class BusinessSuitePayrollsService {
  async createPayroll(userId: string, body: CreatePayrollRequest): Promise<{ success: boolean; message: string; data?: { id: string }; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
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
        user_id: userId,
        name: body.name.trim(),
        release_date: releaseDate,
        freeze_auto_release: freezeAutoRelease,
        status: releaseDate ? 'scheduled' : 'draft',
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
      const items = itemInputs.map((it: { counterpartyId: string; amountUsd: number; dueDate?: string }) => ({
        payroll_id: payroll.id,
        counterparty_id: it.counterpartyId,
        amount_usd: Number(it.amountUsd) || 0,
        due_date: it.dueDate ? new Date(it.dueDate).toISOString().split('T')[0] : null,
      }));
      const { error: itemsError } = await client.from('business_payroll_items').insert(items);
      if (itemsError) {
        await client.from('business_payrolls').delete().eq('id', payroll.id);
        return { success: false, message: itemsError.message, error: itemsError.message };
      }
    }
    return { success: true, message: 'Payroll created', data: { id: payroll.id } };
  }

  async listPayrolls(userId: string, page: number = 1, pageSize: number = 20): Promise<BusinessPayrollListResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const from = (page - 1) * pageSize;
    const { data: payrolls, error, count } = await client
      .from('business_payrolls')
      .select('id, name, release_date, freeze_auto_release, status, created_at', { count: 'exact' })
      .eq('user_id', userId)
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
    const client = supabaseAdmin!;
    const { data: payroll, error: payrollError } = await client
      .from('business_payrolls')
      .select('*')
      .eq('id', payrollId)
      .eq('user_id', userId)
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
    const { data: existing } = await client.from('business_payrolls').select('id').eq('id', payrollId).eq('user_id', userId).single();
    if (!existing) return { success: false, message: 'Payroll not found', error: 'Not found' };
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
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
    const { error } = await client.from('business_payrolls').update(updates).eq('id', payrollId).eq('user_id', userId);
    if (error) return { success: false, message: error.message, error: error.message };
    return { success: true, message: 'Payroll updated' };
  }

  async releasePayroll(userId: string, payrollId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const { data: payroll, error: payrollError } = await client.from('business_payrolls').select('*').eq('id', payrollId).eq('user_id', userId).single();
    if (payrollError || !payroll) return { success: false, message: 'Payroll not found', error: 'Not found' };
    if (payroll.status === 'released') return { success: false, message: 'Payroll already released', error: 'Already released' };
    const { data: items } = await client.from('business_payroll_items').select('*').eq('payroll_id', payrollId).eq('status', 'pending');
    if (!items?.length) return { success: false, message: 'No pending items to release', error: 'No items' };
    const currentYear = new Date().getFullYear();
    const { data: lastEscrow } = await client.from('escrows').select('escrow_sequence').gte('created_at', new Date(currentYear, 0, 1).toISOString()).order('escrow_sequence', { ascending: false }).limit(1).maybeSingle();
    let nextSeq = lastEscrow?.escrow_sequence ? lastEscrow.escrow_sequence + 1 : 1;
    const { data: payer } = await client.from('users').select('full_name, email').eq('id', userId).single();
    for (const item of items) {
      const { data: counterparty } = await client.from('users').select('full_name, email').eq('id', item.counterparty_id).single();
      const amountUsd = parseFloat(String(item.amount_usd));
      const amountXrp = 0;
      const { data: escrow, error: escrowError } = await client
        .from('escrows')
        .insert({
          user_id: userId,
          counterparty_id: item.counterparty_id,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          description: `Payroll: ${payroll.name}`,
          transaction_type: 'payroll',
          suite_context: 'business',
          progress: 0,
          escrow_sequence: nextSeq,
          payer_name: payer?.full_name || null,
          counterparty_name: counterparty?.full_name || null,
        })
        .select('id')
        .single();
      if (escrowError || !escrow) return { success: false, message: escrowError?.message || 'Failed to create escrow', error: escrowError?.message };
      await client.from('business_payroll_items').update({ escrow_id: escrow.id, status: 'released' }).eq('id', item.id);
      nextSeq += 1;
    }
    await client.from('business_payrolls').update({ status: 'released' }).eq('id', payrollId);
    return { success: true, message: 'Payroll released' };
  }

  async getSummary(userId: string): Promise<BusinessPayrollSummaryResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    const client = supabaseAdmin!;
    const [
      { count: totalPayroll },
      { data: teamIds },
      { data: escrowRows },
    ] = await Promise.all([
      client.from('business_payrolls').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('business_teams').select('id').eq('user_id', userId),
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
    const client = supabaseAdmin!;
    const { data: userPayrolls } = await client.from('business_payrolls').select('id').eq('user_id', userId);
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
    const { data: payroll } = await client.from('business_payrolls').select('id, name').eq('id', item.payroll_id).eq('user_id', userId).single();
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
