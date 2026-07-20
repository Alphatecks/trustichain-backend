import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPLIER_DISPLAY_ID_REGEX = /^SUPP-(\d{4})-(\d{3})$/i;
export const GLOBAL_SUPPLIER_ID_REGEX = /^BSUP-(\d{4})-(\d{5})$/i;
export const SUPPLY_CONTRACT_DISPLAY_ID_REGEX = /^SC-(\d{4})-(\d{3})$/i;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generate next SUPP-YYYY-NNN for a buyer's saved supplier contact list. */
export async function generateSupplierDisplayId(
  client: SupabaseClient,
  businessId: string
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = await client
      .from('business_suppliers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', start)
      .lt('created_at', end);

    const seq = (count ?? 0) + 1 + attempt;
    const candidate = `SUPP-${year}-${String(seq).padStart(3, '0')}`;

    const { data: existing } = await client
      .from('business_suppliers')
      .select('id')
      .eq('business_id', businessId)
      .eq('supplier_display_id', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Could not allocate a unique supplier display ID');
}

/** Generate next BSUP-YYYY-NNNNN — one per registered business, platform-wide. */
export async function generateGlobalSupplierId(client: SupabaseClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const { count } = await client
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .not('global_supplier_id', 'is', null)
      .gte('created_at', start)
      .lt('created_at', end);

    const seq = (count ?? 0) + 1 + attempt;
    const candidate = `BSUP-${year}-${String(seq).padStart(5, '0')}`;

    const { data: existing } = await client
      .from('businesses')
      .select('id')
      .eq('global_supplier_id', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Could not allocate a unique global supplier ID');
}

/** Assign global_supplier_id when business is Verified and missing. Idempotent. */
export async function ensureGlobalSupplierIdForBusiness(
  client: SupabaseClient,
  businessId: string
): Promise<string | null> {
  const { data: row, error } = await client
    .from('businesses')
    .select('id, status, global_supplier_id')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !row) return null;
  if (row.status !== 'Verified') return null;
  if (row.global_supplier_id) return row.global_supplier_id as string;

  const globalSupplierId = await generateGlobalSupplierId(client);
  const { data: updated, error: updErr } = await client
    .from('businesses')
    .update({ global_supplier_id: globalSupplierId, updated_at: new Date().toISOString() })
    .eq('id', businessId)
    .is('global_supplier_id', null)
    .select('global_supplier_id')
    .maybeSingle();

  if (updErr) {
    const { data: again } = await client
      .from('businesses')
      .select('global_supplier_id')
      .eq('id', businessId)
      .maybeSingle();
    return again?.global_supplier_id ?? null;
  }

  return (updated?.global_supplier_id as string | undefined) ?? globalSupplierId;
}

/** Generate next SC-YYYY-NNN for a creator's supply contracts in the current year. */
export async function generateSupplyContractDisplayId(
  client: SupabaseClient,
  creatorUserId: string
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;

  const { count } = await client
    .from('escrows')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', creatorUserId)
    .eq('transaction_type', 'supply')
    .eq('suite_context', 'business')
    .gte('created_at', start)
    .lt('created_at', end);

  const seq = (count ?? 0) + 1;
  return `SC-${year}-${String(seq).padStart(3, '0')}`;
}

export interface ResolvedBusinessSupplier {
  id: string;
  supplierDisplayId: string;
  name: string;
  walletAddress: string | null;
  country: string | null;
  supplierBusinessId?: string | null;
}

export interface ResolvedGlobalSupplierBusiness {
  businessId: string;
  globalSupplierId: string;
  companyName: string;
  ownerUserId: string;
  walletAddress: string | null;
  status: string;
}

/** Resolve a buyer's saved supplier contact by UUID or SUPP-YYYY-NNN. */
export async function resolveBusinessSupplier(
  client: SupabaseClient,
  businessId: string,
  reference: string
): Promise<ResolvedBusinessSupplier | null> {
  const ref = reference.trim();
  if (!ref) return null;

  let query = client
    .from('business_suppliers')
    .select('id, supplier_display_id, name, wallet_address, country, supplier_business_id')
    .eq('business_id', businessId);

  if (UUID_REGEX.test(ref)) {
    query = query.eq('id', ref);
  } else if (SUPPLIER_DISPLAY_ID_REGEX.test(ref)) {
    query = query.eq('supplier_display_id', ref.toUpperCase());
  } else {
    return null;
  }

  const { data: row } = await query.maybeSingle();
  if (!row?.id || !row.supplier_display_id) return null;

  return {
    id: row.id,
    supplierDisplayId: row.supplier_display_id,
    name: row.name,
    walletAddress: row.wallet_address ?? null,
    country: row.country ?? null,
    supplierBusinessId: row.supplier_business_id ?? null,
  };
}

/** Resolve a registered supplier business by BSUP-YYYY-NNNNN or businesses UUID. */
export async function resolveGlobalSupplierBusiness(
  client: SupabaseClient,
  reference: string
): Promise<ResolvedGlobalSupplierBusiness | null> {
  const ref = reference.trim();
  if (!ref) return null;

  let query = client
    .from('businesses')
    .select('id, global_supplier_id, company_name, owner_user_id, status')
    .eq('status', 'Verified');

  if (UUID_REGEX.test(ref)) {
    query = query.eq('id', ref);
  } else if (GLOBAL_SUPPLIER_ID_REGEX.test(ref)) {
    query = query.eq('global_supplier_id', ref.toUpperCase());
  } else {
    return null;
  }

  const { data: row } = await query.maybeSingle();
  if (!row?.id || !row.global_supplier_id || !row.owner_user_id) return null;

  const { data: wallet } = await client
    .from('wallets')
    .select('xrpl_address')
    .eq('user_id', row.owner_user_id)
    .eq('suite_context', 'business')
    .maybeSingle();

  return {
    businessId: row.id,
    globalSupplierId: row.global_supplier_id as string,
    companyName: (row.company_name as string | null)?.trim() || 'Supplier',
    ownerUserId: row.owner_user_id as string,
    walletAddress: wallet?.xrpl_address ?? null,
    status: row.status as string,
  };
}

/** Classify supplierId param for contract creation. */
export function classifySupplierReference(reference: string): 'global' | 'saved' | 'unknown' {
  const ref = reference.trim();
  if (GLOBAL_SUPPLIER_ID_REGEX.test(ref)) return 'global';
  if (UUID_REGEX.test(ref) || SUPPLIER_DISPLAY_ID_REGEX.test(ref)) return 'saved';
  return 'unknown';
}
