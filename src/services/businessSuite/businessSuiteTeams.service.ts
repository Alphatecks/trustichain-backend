/**
 * Business Suite Teams Service (My Teams)
 * List teams and team detail for the business suite user.
 */

import { supabaseAdmin } from '../../config/supabase';
import type {
  BusinessSuiteTeamListItem,
  BusinessSuiteTeamListResponse,
  BusinessSuiteTeamDetailResponse,
} from '../../types/api/businessSuiteTeams.types';

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];

function isBusinessSuite(accountType: string | null): boolean {
  return accountType != null && BUSINESS_SUITE_TYPES.includes(accountType);
}

function formatNextDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day}${suffix} ${month}`;
}

export class BusinessSuiteTeamsService {
  private async ensureBusinessSuite(userId: string): Promise<{ allowed: boolean; error?: string }> {
    const client = supabaseAdmin;
    if (!client) return { allowed: false, error: 'No admin client' };
    const { data: user, error } = await client
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();
    if (error || !user) return { allowed: false, error: 'User not found' };
    if (!isBusinessSuite(user.account_type)) return { allowed: false, error: 'Not business suite' };
    return { allowed: true };
  }

  /**
   * List teams for the business user (My Teams). Paginated.
   */
  async getTeamList(
    userId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BusinessSuiteTeamListResponse> {
    const check = await this.ensureBusinessSuite(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const client = supabaseAdmin!;
    const from = (page - 1) * pageSize;

    const { data: teams, error: teamsError, count } = await client
      .from('business_teams')
      .select('id, name, next_date, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (teamsError) {
      return { success: false, message: teamsError.message, error: teamsError.message };
    }

    const list = teams || [];
    const teamIds = list.map((t: { id: string }) => t.id);
    const { data: memberCounts } = teamIds.length > 0
      ? await client.from('business_team_members').select('team_id').in('team_id', teamIds)
      : { data: [] };
    const countByTeamId = (memberCounts || []).reduce<Record<string, number>>((acc, r: { team_id: string }) => {
      acc[r.team_id] = (acc[r.team_id] || 0) + 1;
      return acc;
    }, {});

    const items: BusinessSuiteTeamListItem[] = list.map((t: { id: string; name: string; next_date: string | null; created_at: string }) => ({
      id: t.id,
      name: t.name,
      memberCount: countByTeamId[t.id] ?? 0,
      nextDate: formatNextDate(t.next_date),
      createdAt: t.created_at,
    }));

    const total = count ?? 0;
    return {
      success: true,
      message: 'Teams list retrieved',
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Get single team detail with members (for View).
   */
  async getTeamDetail(userId: string, teamId: string): Promise<BusinessSuiteTeamDetailResponse> {
    const check = await this.ensureBusinessSuite(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const client = supabaseAdmin!;
    const { data: team, error: teamError } = await client
      .from('business_teams')
      .select('id, name, next_date, created_at, updated_at')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: 'Team not found' };
    }

    const { data: memberRows } = await client
      .from('business_team_members')
      .select('id, user_id, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    const memberUserIds = (memberRows || []).map((m: { user_id: string }) => m.user_id);
    const { data: users } = memberUserIds.length > 0
      ? await client.from('users').select('id, full_name, email').in('id', memberUserIds)
      : { data: [] };
    const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: { id: string; full_name: string | null; email: string }) => {
      acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
      return acc;
    }, {});

    const members = (memberRows || []).map((m: { id: string; user_id: string; created_at: string }) => ({
      id: m.id,
      userId: m.user_id,
      fullName: userMap[m.user_id]?.full_name ?? '—',
      email: userMap[m.user_id]?.email ?? '',
      addedAt: m.created_at,
    }));

    return {
      success: true,
      message: 'Team detail retrieved',
      data: {
        id: team.id,
        name: team.name,
        nextDate: formatNextDate(team.next_date),
        createdAt: team.created_at,
        updatedAt: team.updated_at,
        members,
      },
    };
  }
}

export const businessSuiteTeamsService = new BusinessSuiteTeamsService();
