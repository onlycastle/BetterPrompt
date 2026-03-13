import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest, findUserByEmail } from '@/lib/local/auth';
import {
  addTeamMember,
  getTeam,
  getUserOrganization,
  getUserOrgRole,
  listMembersForTeam,
} from '@/lib/local/team-store';

const VALID_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = getCurrentUserFromRequest();

  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { error: 'not_found', message: 'Team not found' },
      { status: 404 },
    );
  }

  // Verify team belongs to user's organization
  const org = getUserOrganization(user.id);
  if (!org || team.organizationId !== org.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Team does not belong to your organization' },
      { status: 403 },
    );
  }

  const members = listMembersForTeam(teamId);
  return NextResponse.json(members);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = getCurrentUserFromRequest();

  const org = getUserOrganization(user.id);
  if (!org) {
    return NextResponse.json(
      { error: 'not_found', message: 'User does not belong to an organization' },
      { status: 404 },
    );
  }

  const role = getUserOrgRole(user.id, org.id);
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Admin or owner role required' },
      { status: 403 },
    );
  }

  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { error: 'not_found', message: 'Team not found' },
      { status: 404 },
    );
  }

  if (team.organizationId !== org.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Team does not belong to your organization' },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { email?: string; role?: string };

  if (!body.email) {
    return NextResponse.json(
      { error: 'bad_request', message: 'email is required' },
      { status: 400 },
    );
  }

  const targetUser = findUserByEmail(body.email);
  if (!targetUser) {
    return NextResponse.json(
      { error: 'not_found', message: 'No user found with that email' },
      { status: 404 },
    );
  }

  const memberRole = body.role ?? 'member';
  if (!VALID_ROLES.includes(memberRole as typeof VALID_ROLES[number])) {
    return NextResponse.json(
      { error: 'bad_request', message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  const member = addTeamMember(
    teamId,
    targetUser.id,
    org.id,
    memberRole,
    user.id,
  );

  return NextResponse.json(member, { status: 201 });
}
