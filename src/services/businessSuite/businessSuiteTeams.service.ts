/**
 * Business Suite Teams Service (My Teams)
 * List teams and team detail for the business suite user.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  BusinessSuiteTeamListItem,
  BusinessSuiteTeamListResponse,
  BusinessSuiteTeamDetailResponse,
  CreateTeamRequest,
  AddTeamMemberRequest,
} from '../../types/api/businessSuiteTeams.types';

function formatNextDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day}${suffix} ${month}`;
}

export class BusinessSuiteTeamsService {
  /**
   * List teams for the business user (My Teams). Paginated.
   */
  async getTeamList(
    userId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BusinessSuiteTeamListResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
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
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
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

  /**
   * Create a new team. POST /api/business-suite/teams
   */
  async createTeam(userId: string, body: CreateTeamRequest): Promise<{
    success: boolean;
    message: string;
    data?: { id: string; name: string; nextDate: string | null };
    error?: string;
  }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return { success: false, message: 'Team name is required', error: 'Missing name' };
    }
    const client = supabaseAdmin!;
    const nextDate = body.nextDate && /^\d{4}-\d{2}-\d{2}$/.test(body.nextDate) ? body.nextDate : null;
    const { data: team, error } = await client
      .from('business_teams')
      .insert({ user_id: userId, name, next_date: nextDate })
      .select('id, name, next_date')
      .single();
    if (error) {
      return { success: false, message: error.message || 'Failed to create team', error: error.message };
    }
    return {
      success: true,
      message: 'Team created successfully',
      data: {
        id: team.id,
        name: team.name,
        nextDate: formatNextDate(team.next_date),
      },
    };
  }

  /**
   * Add a team member (full modal: personal, job, payment). POST /api/business-suite/teams/:teamId/members
   * Looks up user by email; adds them to the team and saves profile.
   */
  async addTeamMember(userId: string, teamId: string, body: AddTeamMemberRequest): Promise<{
    success: boolean;
    message: string;
    data?: { teamMemberId: string; userId: string; email: string };
    error?: string;
  }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return { success: false, message: 'Email is required to add a team member', error: 'Missing email' };
    }
    const client = supabaseAdmin!;

    const { data: team, error: teamError } = await client
      .from('business_teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();
    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: 'Team not found' };
    }

    const { data: memberUser, error: userError } = await client
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (userError || !memberUser) {
      return { success: false, message: 'No user found with this email. They must have an account to be added.', error: 'User not found' };
    }

    const { data: existing } = await client
      .from('business_team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', memberUser.id)
      .maybeSingle();
    if (existing) {
      return { success: false, message: 'This user is already a member of the team', error: 'Already a member' };
    }

    const { data: teamMember, error: insertMemberError } = await client
      .from('business_team_members')
      .insert({ team_id: teamId, user_id: memberUser.id })
      .select('id')
      .single();
    if (insertMemberError || !teamMember) {
      return { success: false, message: insertMemberError?.message || 'Failed to add team member', error: insertMemberError?.message };
    }

    const dateJoined = body.dateJoined && /^\d{4}-\d{2}-\d{2}$/.test(body.dateJoined) ? body.dateJoined : null;
    const { error: profileError } = await client
      .from('business_team_member_profiles')
      .insert({
        team_member_id: teamMember.id,
        phone_number: body.phoneNumber ?? null,
        country: body.country ?? null,
        address: body.address ?? null,
        gender: body.gender ?? null,
        job_title: body.jobTitle ?? null,
        employment_type: body.employmentType ?? null,
        status: body.status ?? null,
        date_joined: dateJoined,
        currency: body.currency ?? null,
        default_salary_type: body.defaultSalaryType ?? null,
        salary_amount: body.salaryAmount ?? null,
        disbursement_mode: body.disbursementMode ?? null,
        account_type: body.accountType ?? null,
        wallet_type: body.walletType ?? null,
        wallet_address: body.walletAddress ?? null,
        network: body.network ?? null,
      });
    if (profileError) {
      return { success: false, message: profileError.message || 'Failed to save member profile', error: profileError.message };
    }

    return {
      success: true,
      message: 'Team member added successfully',
      data: { teamMemberId: teamMember.id, userId: memberUser.id, email },
    };
  }
}

export const businessSuiteTeamsService = new BusinessSuiteTeamsService();
