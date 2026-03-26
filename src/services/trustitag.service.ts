import * as crypto from 'crypto';
import { supabase, supabaseAdmin } from '../config/supabase';

const admin = () => supabaseAdmin || supabase;

/** Prefix for server-generated tags (collision-resistant suffix). */
const TAG_PREFIX = 'tc_';

export class TrustitagService {
  /**
   * Normalize user input: trim, strip leading @, lowercase, validate pattern.
   */
  normalizeTrustitag(raw: string): string | null {
    if (typeof raw !== 'string') return null;
    let s = raw.trim().toLowerCase();
    if (s.startsWith('@')) s = s.slice(1).trim();
    if (!s) return null;
    if (!/^[a-z0-9_]{3,32}$/.test(s)) return null;
    return s;
  }

  private generateCandidate(): string {
    return TAG_PREFIX + crypto.randomBytes(5).toString('hex');
  }

  /**
   * Ensure the user has a trustitag; create one if missing. Idempotent.
   */
  async ensureTrustitagForUser(userId: string): Promise<string> {
    const c = admin();
    const { data: row } = await c.from('users').select('trustitag').eq('id', userId).maybeSingle();
    if (row?.trustitag) return row.trustitag;

    for (let attempt = 0; attempt < 16; attempt++) {
      const candidate = this.generateCandidate();
      const { error: updErr } = await c
        .from('users')
        .update({ trustitag: candidate, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .is('trustitag', null);

      if (!updErr) {
        const { data: check } = await c.from('users').select('trustitag').eq('id', userId).maybeSingle();
        if (check?.trustitag) return check.trustitag;
      }

      const { data: again } = await c.from('users').select('trustitag').eq('id', userId).maybeSingle();
      if (again?.trustitag) return again.trustitag;
    }

    throw new Error('Could not assign a Trustitag. Please try again.');
  }

  /**
   * Resolve recipient personal wallet XRPL address by normalized trustitag.
   */
  async resolveRecipientWallet(trustitagNormalized: string): Promise<{
    recipientUserId: string;
    destinationAddress: string;
  } | null> {
    const c = admin();
    const { data: u, error: uErr } = await c.from('users').select('id').eq('trustitag', trustitagNormalized).maybeSingle();
    if (uErr || !u) return null;

    const { data: w } = await c
      .from('wallets')
      .select('xrpl_address')
      .eq('user_id', u.id)
      .eq('suite_context', 'personal')
      .maybeSingle();

    if (!w?.xrpl_address) return null;
    return { recipientUserId: u.id, destinationAddress: w.xrpl_address };
  }
}

export const trustitagService = new TrustitagService();
