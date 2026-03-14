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
  data?: { businessEmail: string | null; hasBusinessEmail: boolean };
  error?: string;
}

export class LookupService {
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
   * Get business email for a registered business by company name.
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
      const { data: businesses } = await client
        .from('businesses')
        .select('id, owner_user_id, company_name, business_email')
        .not('company_name', 'is', null);
      const biz = (businesses || []).find(
        (b) => b.company_name && b.company_name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (!biz) {
        return {
          success: true,
          message: 'No business found with that name',
          data: { businessEmail: null, hasBusinessEmail: false },
        };
      }

      const businessEmailSet = biz.business_email != null && String(biz.business_email).trim().length > 0;
      const businessEmail = businessEmailSet ? String(biz.business_email).trim() : null;

      if (!businessEmailSet) {
        return {
          success: true,
          message: 'This business email is not set',
          data: { businessEmail: null, hasBusinessEmail: false },
        };
      }

      return {
        success: true,
        message: 'Business email retrieved',
        data: { businessEmail, hasBusinessEmail: true },
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
