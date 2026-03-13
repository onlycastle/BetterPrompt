/**
 * Organization Members API
 * Returns TeamMemberAnalysis[] by fetching each member's analysis results
 * and transforming them via the evaluation-to-team mapper.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import { getUserOrganization, getOrgMembers, listTeamsForOrg } from '@/lib/local/team-store';
import { listAnalysesForUser } from '@/lib/local/analysis-store';
import { mapUserToTeamMember } from '@/lib/local/evaluation-to-team';
import { findUserById } from '@/lib/local/auth';
import type { TeamMemberAnalysis } from '@/types/enterprise';

export async function GET(_request: NextRequest) {
  const user = getCurrentUserFromRequest();

  const org = getUserOrganization(user.id);
  if (!org) {
    return NextResponse.json(
      { error: 'not_found', message: 'User does not belong to an organization' },
      { status: 404 },
    );
  }

  const members = getOrgMembers(org.id);
  const teams = listTeamsForOrg(org.id);

  // Build a teamId -> teamName lookup for the department field
  const teamNameMap = new Map(teams.map(t => [t.id, t.name]));

  // Deduplicate by userId (a user may appear in multiple teams)
  const uniqueUserIds = [...new Set(members.map(m => m.userId))];

  const result: TeamMemberAnalysis[] = [];

  for (const userId of uniqueUserIds) {
    const memberRecord = members.find(m => m.userId === userId);
    if (!memberRecord) continue;

    const memberUser = findUserById(userId);
    if (!memberUser) continue;

    const analyses = listAnalysesForUser(userId);
    const teamName = teamNameMap.get(memberRecord.teamId) ?? 'Unassigned';

    const teamMember = mapUserToTeamMember(
      memberUser,
      analyses,
      memberRecord.teamId,
      memberRecord.role,
      teamName,
    );

    result.push(teamMember);
  }

  return NextResponse.json(result);
}
