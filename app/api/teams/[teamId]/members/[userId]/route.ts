import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import {
  getTeam,
  getUserOrganization,
  getUserOrgRole,
  removeTeamMember,
  updateTeamMemberRole,
} from '@/lib/local/team-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> },
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

  const { teamId, userId } = await params;
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

  const body = (await request.json()) as { role?: string };

  if (!body.role) {
    return NextResponse.json(
      { error: 'bad_request', message: 'role is required' },
      { status: 400 },
    );
  }

  const updated = updateTeamMemberRole(teamId, userId, body.role);
  if (!updated) {
    return NextResponse.json(
      { error: 'not_found', message: 'Member not found in team' },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> },
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

  const { teamId, userId } = await params;
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

  const removed = removeTeamMember(teamId, userId);
  if (!removed) {
    return NextResponse.json(
      { error: 'not_found', message: 'Member not found in team' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
