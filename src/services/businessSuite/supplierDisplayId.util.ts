import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPLIER_DISPLAY_ID_REGEX = /^SUPP-(\d{4})-(\d{3})$/i;
export const SUPPLY_CONTRACT_DISPLAY_ID_REGEX = /^SC-(\d{4})-(\d{3})$/i;

/** Generate next SUPP-YYYY-NNN for a business (scoped per calendar year). */
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
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve a saved supplier by UUID or SUPP-YYYY-NNN within the caller's business. */
export async function resolveBusinessSupplier(
  client: SupabaseClient,
  businessId: string,
  reference: string
): Promise<ResolvedBusinessSupplier | null> {
  const ref = reference.trim();
  if (!ref) return null;

  let query = client
    .from('business_suppliers')
    .select('id, supplier_display_id, name, wallet_address, country')
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
  };
}
