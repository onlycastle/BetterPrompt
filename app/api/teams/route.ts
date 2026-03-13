import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import {
  createTeam,
  getUserOrganization,
  getUserOrgRole,
  listTeamsForOrg,
} from '@/lib/local/team-store';

export async function GET(_request: NextRequest) {
  const user = getCurrentUserFromRequest();

  const org = getUserOrganization(user.id);
  if (!org) {
    return NextResponse.json(
      { error: 'not_found', message: 'User does not belong to an organization' },
      { status: 404 },
    );
  }

  const teams = listTeamsForOrg(org.id);
  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as { name?: string; description?: string };

  if (!body.name) {
    return NextResponse.json(
      { error: 'bad_request', message: 'name is required' },
      { status: 400 },
    );
  }

  const team = createTeam(org.id, body.name, body.description);

  return NextResponse.json(team, { status: 201 });
}
