import { supabase, supabaseAdmin } from '../../config/supabase';

export interface EscrowCreationFeeSettings {
  personalFreelancerFeeUsd: number;
  supplierFeeUsd: number;
  payrollFeeUsd: number;
}

const ZERO_FEES: EscrowCreationFeeSettings = {
  personalFreelancerFeeUsd: 0,
  supplierFeeUsd: 0,
  payrollFeeUsd: 0,
};

export async function getEscrowCreationFeeSettings(): Promise<EscrowCreationFeeSettings> {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('platform_escrow_fee_settings')
      .select('personal_freelancer_fee_usd, supplier_fee_usd, payroll_fee_usd')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) return ZERO_FEES;

    return {
      personalFreelancerFeeUsd: Number(data.personal_freelancer_fee_usd) || 0,
      supplierFeeUsd: Number(data.supplier_fee_usd) || 0,
      payrollFeeUsd: Number(data.payroll_fee_usd) || 0,
    };
  } catch {
    // Keep escrow creation non-blocking if fee settings are unavailable.
    return ZERO_FEES;
  }
}

export function resolveEscrowCreationFeeUsdByType(
  transactionType: string | undefined,
  settings: EscrowCreationFeeSettings
): number {
  const type = (transactionType || '').trim().toLowerCase();
  if (type === 'payroll') return settings.payrollFeeUsd;
  if (type === 'supply') return settings.supplierFeeUsd;
  return settings.personalFreelancerFeeUsd;
}
