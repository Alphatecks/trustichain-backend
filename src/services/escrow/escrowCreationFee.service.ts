import { supabase, supabaseAdmin } from '../../config/supabase';

export interface EscrowCreationFeeSettings {
  personalFreelancerFeePercentage: number;
  supplierFeePercentage: number;
  payrollFeePercentage: number;
}

const ZERO_FEES: EscrowCreationFeeSettings = {
  personalFreelancerFeePercentage: 0,
  supplierFeePercentage: 0,
  payrollFeePercentage: 0,
};

export async function getEscrowCreationFeeSettings(): Promise<EscrowCreationFeeSettings> {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('platform_escrow_fee_settings')
      .select('personal_freelancer_fee_percentage, supplier_fee_percentage, payroll_fee_percentage')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) return ZERO_FEES;

    return {
      personalFreelancerFeePercentage: Number(data.personal_freelancer_fee_percentage) || 0,
      supplierFeePercentage: Number(data.supplier_fee_percentage) || 0,
      payrollFeePercentage: Number(data.payroll_fee_percentage) || 0,
    };
  } catch {
    // Keep escrow creation non-blocking if fee settings are unavailable.
    return ZERO_FEES;
  }
}

export function resolveEscrowCreationFeePercentageByType(
  transactionType: string | undefined,
  settings: EscrowCreationFeeSettings
): number {
  const type = (transactionType || '').trim().toLowerCase();
  if (type === 'payroll') return settings.payrollFeePercentage;
  if (type === 'supply') return settings.supplierFeePercentage;
  return settings.personalFreelancerFeePercentage;
}
