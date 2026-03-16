/**
 * File payroll dispute: validate payroll ownership, then insert into payroll_disputes.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type { FilePayrollDisputeRequest, FilePayrollDisputeResponse } from '../../types/api/businessSuitePayrolls.types';

export class BusinessSuitePayrollDisputesService {
  /**
   * File a dispute for a payroll. Payroll must belong to the user's business.
   */
  async filePayrollDispute(userId: string, body: FilePayrollDisputeRequest): Promise<FilePayrollDisputeResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const payrollId = (body.payrollId ?? '').trim();
    if (!payrollId) {
      return { success: false, message: 'Payroll ID is required', error: 'Missing payrollId' };
    }
    const reason = (body.reason ?? '').trim();
    if (!reason) {
      return { success: false, message: 'Reason is required', error: 'Missing reason' };
    }
    const description = (body.description ?? '').trim();
    if (!description) {
      return { success: false, message: 'Description is required', error: 'Missing description' };
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { success: false, message: 'Amount must be a valid number (0 or greater)', error: 'Invalid amount' };
    }
    const currency = (body.currency ?? 'USD').trim() || 'USD';

    const client = supabaseAdmin!;

    const { data: payroll, error: payrollErr } = await client
      .from('business_payrolls')
      .select('id, business_id')
      .eq('id', payrollId)
      .maybeSingle();
    if (payrollErr || !payroll) {
      return { success: false, message: 'Payroll not found', error: 'Payroll not found' };
    }

    const { data: biz } = await client
      .from('businesses')
      .select('id, owner_user_id')
      .eq('id', payroll.business_id)
      .maybeSingle();
    if (!biz || biz.owner_user_id !== userId) {
      return { success: false, message: 'Payroll not found or access denied', error: 'Access denied' };
    }

    const evidenceUrls: string[] = [];
    if (Array.isArray(body.evidence)) {
      for (const e of body.evidence) {
        if (e?.fileUrl && typeof e.fileUrl === 'string' && e.fileUrl.trim()) {
          evidenceUrls.push(e.fileUrl.trim());
        }
      }
    }

    const { data: row, error: insertErr } = await client
      .from('payroll_disputes')
      .insert({
        user_id: userId,
        payroll_id: payrollId,
        reason,
        amount,
        currency,
        description,
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !row) {
      return {
        success: false,
        message: insertErr?.message ?? 'Failed to file dispute',
        error: insertErr?.message ?? 'Insert failed',
      };
    }

    return {
      success: true,
      message: 'Payroll dispute filed successfully',
      data: { disputeId: (row as { id: string }).id },
    };
  }
}

export const businessSuitePayrollDisputesService = new BusinessSuitePayrollDisputesService();
