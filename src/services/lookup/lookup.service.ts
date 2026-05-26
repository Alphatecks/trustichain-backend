/**
 * Lookup Service
 * Fetches minimal data by identifier (e.g. business name by email)
 */

import { supabaseAdmin } from '../../config/supabase';

export interface BusinessNameByEmailResult {
  success: boolean;
  message: string;
  data?: { businessName: string | null };
  error?: string;
}

export interface BusinessEmailByNameResult {
  success: boolean;
  message: string;
  data?: {
    matchedBusinessName?: string | null;
    businessEmail: string | null;
    hasBusinessEmail: boolean;
    businessXrpAddress: string | null;
    hasBusinessXrpAddress: boolean;
  };
  error?: string;
}

export class LookupService {
  private normalizeBusinessName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Get business (company) name for the user account associated with the given email.
   * Uses businesses.company_name, with fallback to business_suite_kyc.company_name.
   */
  async getBusinessNameByEmail(email: string): Promise<BusinessNameByEmailResult> {
    const client = supabaseAdmin;
    if (!client) {
      return {
        success: false,
        message: 'Lookup unavailable',
        error: 'Server configuration error',
      };
    }

    const trimmed = (email ?? '').trim().toLowerCase();
    if (!trimmed) {
      return {
        success: false,
        message: 'Email is required',
        error: 'Missing email',
      };
    }

    try {
      const { data: user, error: userError } = await client
        .from('users')
        .select('id')
        .ilike('email', trimmed)
        .maybeSingle();

      if (userError) {
        console.error('[Lookup] getBusinessNameByEmail: user lookup error', { email: trimmed, error: userError.message });
        return {
          success: false,
          message: 'Failed to lookup user',
          error: userError.message,
        };
      }

      if (!user) {
        return {
          success: true,
          message: 'No user found for this email',
          data: { businessName: null },
        };
      }

      const { data: business, error: bizError } = await client
        .from('businesses')
        .select('company_name')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (bizError) {
        console.error('[Lookup] getBusinessNameByEmail: business lookup error', { userId: user.id, error: bizError.message });
        return {
          success: false,
          message: 'Failed to lookup business',
          error: bizError.message,
        };
      }

      if (business?.company_name) {
        return {
          success: true,
          message: 'Business name retrieved',
          data: { businessName: business.company_name },
        };
      }

      const { data: kyc } = await client
        .from('business_suite_kyc')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const name = kyc?.company_name ?? null;
      return {
        success: true,
        message: name ? 'Business name retrieved' : 'No business name for this email',
        data: { businessName: name },
      };
    } catch (err) {
      console.error('[Lookup] getBusinessNameByEmail: unexpected error', { email: trimmed, err });
      return {
        success: false,
        message: 'An unexpected error occurred',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get business email and business XRP wallet address for a registered business by company name.
   * Returns businesses.business_email when set. If business exists but business_email is not set,
   * returns businessEmail: null and message that this business email is not set.
   */
  async getBusinessEmailByName(businessName: string): Promise<BusinessEmailByNameResult> {
    const client = supabaseAdmin;
    if (!client) {
      return {
        success: false,
        message: 'Lookup unavailable',
        error: 'Server configuration error',
      };
    }

    const trimmed = (businessName ?? '').trim();
    if (!trimmed) {
      return {
        success: false,
        message: 'Business name is required',
        error: 'Missing business name',
      };
    }

    try {
      const normalizedInput = this.normalizeBusinessName(trimmed);
      const { data: businesses } = await client
        .from('businesses')
        .select('id, owner_user_id, company_name, business_email')
        .not('company_name', 'is', null)
        .ilike('company_name', `%${trimmed}%`)
        .limit(50);

      const ranked = (businesses || [])
        .filter((b) => b.company_name && String(b.company_name).trim().length > 0)
        .map((b) => {
          const companyName = String(b.company_name).trim();
          const normalizedName = this.normalizeBusinessName(companyName);
          const isExact = normalizedName === normalizedInput;
          const startsWith = normalizedName.startsWith(normalizedInput);
          const includes = normalizedName.includes(normalizedInput);
          const score = isExact ? 0 : startsWith ? 1 : includes ? 2 : 3;
          return { ...b, companyName, normalizedName, score };
        })
        .filter((b) => b.score < 3)
        .sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;
          if (a.companyName.length !== b.companyName.length) return a.companyName.length - b.companyName.length;
          return a.companyName.localeCompare(b.companyName);
        });

      const biz = ranked[0];
      if (!biz) {
        return {
          success: true,
          message: 'No business found with that name',
          data: {
            matchedBusinessName: null,
            businessEmail: null,
            hasBusinessEmail: false,
            businessXrpAddress: null,
            hasBusinessXrpAddress: false,
          },
        };
      }

      const businessEmailSet = biz.business_email != null && String(biz.business_email).trim().length > 0;
      const businessEmail = businessEmailSet ? String(biz.business_email).trim() : null;
      const ownerUserId = biz.owner_user_id ? String(biz.owner_user_id) : null;

      let businessXrpAddress: string | null = null;
      if (ownerUserId) {
        const { data: wallet } = await client
          .from('wallets')
          .select('xrpl_address')
          .eq('user_id', ownerUserId)
          .eq('suite_context', 'business')
          .maybeSingle();
        if (wallet?.xrpl_address && String(wallet.xrpl_address).trim().length > 0) {
          businessXrpAddress = String(wallet.xrpl_address).trim();
        } else {
          // Fallback for older rows that may not have suite_context populated.
          const { data: fallbackWallet } = await client
            .from('wallets')
            .select('xrpl_address')
            .eq('user_id', ownerUserId)
            .not('xrpl_address', 'is', null)
            .limit(1)
            .maybeSingle();
          businessXrpAddress =
            fallbackWallet?.xrpl_address && String(fallbackWallet.xrpl_address).trim().length > 0
              ? String(fallbackWallet.xrpl_address).trim()
              : null;
        }
      }
      const hasBusinessXrpAddress = businessXrpAddress != null;

      if (!businessEmailSet) {
        return {
          success: true,
          message: 'This business email is not set',
          data: {
            matchedBusinessName: biz.companyName,
            businessEmail: null,
            hasBusinessEmail: false,
            businessXrpAddress,
            hasBusinessXrpAddress,
          },
        };
      }

      return {
        success: true,
        message: 'Business email and XRP address retrieved',
        data: {
          matchedBusinessName: biz.companyName,
          businessEmail,
          hasBusinessEmail: true,
          businessXrpAddress,
          hasBusinessXrpAddress,
        },
      };
    } catch (err) {
      console.error('[Lookup] getBusinessEmailByName: unexpected error', { businessName: trimmed, err });
      return {
        success: false,
        message: 'An unexpected error occurred',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const lookupService = new LookupService();
