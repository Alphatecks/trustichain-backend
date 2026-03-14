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
  data?: { businessEmail: string | null };
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
   * Get business (owner) email for a registered business by company name.
   * Match is case-insensitive on company_name; returns the owner user's email.
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
        .select('id, owner_user_id, company_name')
        .not('company_name', 'is', null);
      const biz = (businesses || []).find(
        (b) => b.company_name && b.company_name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (!biz?.owner_user_id) {
        return {
          success: true,
          message: 'No business found with that name',
          data: { businessEmail: null },
        };
      }

      const { data: user, error: userError } = await client
        .from('users')
        .select('email')
        .eq('id', biz.owner_user_id)
        .maybeSingle();

      if (userError) {
        return {
          success: false,
          message: 'Failed to lookup user',
          error: userError.message,
        };
      }

      return {
        success: true,
        message: user?.email ? 'Business email retrieved' : 'No email for this business',
        data: { businessEmail: user?.email ?? null },
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
