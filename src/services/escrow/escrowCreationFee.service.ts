import { supabase, supabaseAdmin } from '../../config/supabase';

export interface EscrowCreationFeeSettings {
  personalFreelancerFeePercentage: number;
  supplierFeePercentage: number;
  payrollFeePercentage: number;
}

export type EscrowCreationFeeCategory = 'personal_freelancer' | 'supplier' | 'payroll';

export interface EscrowCreationFeeBreakdown {
  amountUsd: number;
  creationFeePercentage: number;
  creationFeeUsd: number;
  payableAmountUsd: number;
  feeCategory: EscrowCreationFeeCategory;
}

const ZERO_FEES: EscrowCreationFeeSettings = {
  personalFreelancerFeePercentage: 0,
  supplierFeePercentage: 0,
  payrollFeePercentage: 0,
};

export async function getEscrowCreationFeeSettings(): Promise<EscrowCreationFeeSettings> {
  try {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('[EscrowFee] SUPABASE_SERVICE_ROLE_KEY not set; fee settings read may fail under RLS');
    }

    const { data, error } = await client
      .from('platform_escrow_fee_settings')
      .select('personal_freelancer_fee_percentage, supplier_fee_percentage, payroll_fee_percentage')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.warn('[EscrowFee] Failed to load platform_escrow_fee_settings:', error.message);
      return ZERO_FEES;
    }

    if (!data) {
      console.warn('[EscrowFee] platform_escrow_fee_settings row missing; using 0% fees');
      return ZERO_FEES;
    }

    return {
      personalFreelancerFeePercentage: Number(data.personal_freelancer_fee_percentage) || 0,
      supplierFeePercentage: Number(data.supplier_fee_percentage) || 0,
      payrollFeePercentage: Number(data.payroll_fee_percentage) || 0,
    };
  } catch (error) {
    console.warn('[EscrowFee] Unexpected error loading fee settings:', error);
    return ZERO_FEES;
  }
}

function normalizeTransactionType(raw: string | undefined): string {
  return (raw || 'custom').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function resolveEscrowCreationFeeCategory(
  transactionType: string | undefined,
  suiteContext?: 'personal' | 'business' | null
): EscrowCreationFeeCategory {
  const type = normalizeTransactionType(transactionType);
  if (type === 'payroll') return 'payroll';
  if (type === 'supply' || type === 'supplier') return 'supplier';
  if (suiteContext === 'business' && type === 'supply') return 'supplier';
  return 'personal_freelancer';
}

export function resolveEscrowCreationFeePercentageByType(
  transactionType: string | undefined,
  settings: EscrowCreationFeeSettings,
  options?: { suiteContext?: 'personal' | 'business' | null }
): number {
  const category = resolveEscrowCreationFeeCategory(transactionType, options?.suiteContext);
  if (category === 'payroll') return settings.payrollFeePercentage;
  if (category === 'supplier') return settings.supplierFeePercentage;
  return settings.personalFreelancerFeePercentage;
}

export async function calculateEscrowCreationFeeBreakdown(
  amountUsd: number,
  transactionType?: string,
  options?: { suiteContext?: 'personal' | 'business' | null }
): Promise<EscrowCreationFeeBreakdown> {
  const settings = await getEscrowCreationFeeSettings();
  const feeCategory = resolveEscrowCreationFeeCategory(transactionType, options?.suiteContext);
  const creationFeePercentage = resolveEscrowCreationFeePercentageByType(
    transactionType,
    settings,
    options
  );
  const principal = Math.max(0, Number(amountUsd) || 0);
  const creationFeeUsd = parseFloat(
    (principal * (Math.max(0, creationFeePercentage) / 100)).toFixed(2)
  );
  const payableAmountUsd = parseFloat((principal + creationFeeUsd).toFixed(2));

  return {
    amountUsd: parseFloat(principal.toFixed(2)),
    creationFeePercentage: parseFloat(Number(creationFeePercentage).toFixed(4)),
    creationFeeUsd,
    payableAmountUsd,
    feeCategory,
  };
}
