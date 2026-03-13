import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import {
  createOrganization,
  getUserOrganization,
  listTeamsForOrg,
  getOrgMembers,
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
  const members = getOrgMembers(org.id);

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerId: org.ownerId,
    },
    teams,
    memberCount: members.length,
  });
}

export async function POST(request: NextRequest) {
  const user = getCurrentUserFromRequest();

  const body = (await request.json()) as { name?: string; slug?: string };

  if (!body.name || !body.slug) {
    return NextResponse.json(
      { error: 'bad_request', message: 'name and slug are required' },
      { status: 400 },
    );
  }

  // Check if user already belongs to an organization
  const existingOrg = getUserOrganization(user.id);
  if (existingOrg) {
    return NextResponse.json(
      { error: 'conflict', message: 'User already belongs to an organization' },
      { status: 409 },
    );
  }

  const org = createOrganization(body.name, body.slug, user.id);

  return NextResponse.json(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerId: org.ownerId,
    },
    { status: 201 },
  );
}
