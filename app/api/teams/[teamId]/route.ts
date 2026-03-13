import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import {
  deleteTeam,
  getTeam,
  getUserOrganization,
  getUserOrgRole,
  listMembersForTeam,
  updateTeam,
} from '@/lib/local/team-store';

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

  return NextResponse.json({ team, members });
}

export async function PATCH(
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

  const body = (await request.json()) as { name?: string; description?: string };
  const updated = updateTeam(teamId, body);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
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

  deleteTeam(teamId);

  return NextResponse.json({ success: true });
}
