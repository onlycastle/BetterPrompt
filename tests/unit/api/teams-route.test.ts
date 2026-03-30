import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/local/auth', () => ({
  getCurrentUserFromRequest: vi.fn(),
  findUserByEmail: vi.fn(),
}));

vi.mock('@/lib/local/team-store', () => ({
  createTeam: vi.fn(),
  getTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  listTeamsForOrg: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  updateTeamMemberRole: vi.fn(),
  listMembersForTeam: vi.fn(),
  getUserOrganization: vi.fn(),
  getUserOrgRole: vi.fn(),
}));

import { getCurrentUserFromRequest, findUserByEmail } from '@/lib/local/auth';
import * as teamStore from '@/lib/local/team-store';

// ---------------------------------------------------------------------------
// Route handler references (dynamically imported after mocks are installed)
// ---------------------------------------------------------------------------

let teamsGet: typeof import('../../../app/api/teams/route').GET;
let teamsPost: typeof import('../../../app/api/teams/route').POST;

let teamDetailGet: typeof import('../../../app/api/teams/[teamId]/route').GET;
let teamDetailPatch: typeof import('../../../app/api/teams/[teamId]/route').PATCH;
let teamDetailDelete: typeof import('../../../app/api/teams/[teamId]/route').DELETE;

let membersGet: typeof import('../../../app/api/teams/[teamId]/members/route').GET;
let membersPost: typeof import('../../../app/api/teams/[teamId]/members/route').POST;

let memberPatch: typeof import('../../../app/api/teams/[teamId]/members/[userId]/route').PATCH;
let memberDelete: typeof import('../../../app/api/teams/[teamId]/members/[userId]/route').DELETE;

beforeAll(async () => {
  const teamsRoute = await import('../../../app/api/teams/route');
  teamsGet = teamsRoute.GET;
  teamsPost = teamsRoute.POST;

  const teamDetailRoute = await import('../../../app/api/teams/[teamId]/route');
  teamDetailGet = teamDetailRoute.GET;
  teamDetailPatch = teamDetailRoute.PATCH;
  teamDetailDelete = teamDetailRoute.DELETE;

  const membersRoute = await import(
    '../../../app/api/teams/[teamId]/members/route'
  );
  membersGet = membersRoute.GET;
  membersPost = membersRoute.POST;

  const memberRoute = await import(
    '../../../app/api/teams/[teamId]/members/[userId]/route'
  );
  memberPatch = memberRoute.PATCH;
  memberDelete = memberRoute.DELETE;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  role: 'admin',
  createdAt: '2026-01-01',
  organizationId: 'org-1',
};

const mockOrg = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  ownerId: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockTeam = {
  id: 'team-1',
  organizationId: 'org-1',
  name: 'Engineering',
  description: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  memberCount: 2,
};

const mockMember = {
  id: 'member-1',
  teamId: 'team-1',
  userId: 'user-2',
  organizationId: 'org-1',
  role: 'member',
  addedBy: 'user-1',
  createdAt: '2026-01-01',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function teamParams(teamId: string) {
  return { params: Promise.resolve({ teamId }) };
}

function memberParams(teamId: string, userId: string) {
  return { params: Promise.resolve({ teamId, userId }) };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Standard mock setup: authenticated user belonging to org-1 with admin role. */
function setupAuthenticatedAdmin() {
  vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
  vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
  vi.mocked(teamStore.getUserOrgRole).mockReturnValue('admin' as never);
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /api/teams
// ===========================================================================

describe('GET /api/teams', () => {
  it('returns 404 when user has no organization', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(null as never);

    const res = await teamsGet();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not_found');
  });

  it('returns teams list on success', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.listTeamsForOrg).mockReturnValue([mockTeam] as never);

    const res = await teamsGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([mockTeam]);
  });
});

// ===========================================================================
// POST /api/teams
// ===========================================================================

describe('POST /api/teams', () => {
  it('returns 404 when user has no organization', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(null as never);

    const req = jsonRequest('http://localhost/api/teams', 'POST', {
      name: 'Engineering',
    });
    const res = await teamsPost(req);

    expect(res.status).toBe(404);
  });

  it('returns 403 when user role is member', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = jsonRequest('http://localhost/api/teams', 'POST', {
      name: 'Engineering',
    });
    const res = await teamsPost(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  it('returns 400 when name is missing', async () => {
    setupAuthenticatedAdmin();

    const req = jsonRequest('http://localhost/api/teams', 'POST', {});
    const res = await teamsPost(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad_request');
  });

  it('returns 201 with created team on success', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.createTeam).mockReturnValue(mockTeam as never);

    const req = jsonRequest('http://localhost/api/teams', 'POST', {
      name: 'Engineering',
    });
    const res = await teamsPost(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(mockTeam);
    expect(teamStore.createTeam).toHaveBeenCalledWith(
      'org-1',
      'Engineering',
      undefined,
    );
  });
});

// ===========================================================================
// GET /api/teams/[teamId]
// ===========================================================================

describe('GET /api/teams/[teamId]', () => {
  it('returns 404 when team not found', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(null as never);

    const req = new NextRequest('http://localhost/api/teams/team-1');
    const res = await teamDetailGet(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not_found');
  });

  it('returns 403 when team belongs to different org', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue({
      ...mockTeam,
      organizationId: 'org-other',
    } as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);

    const req = new NextRequest('http://localhost/api/teams/team-1');
    const res = await teamDetailGet(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  it('returns team with members on success', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.listMembersForTeam).mockReturnValue([mockMember] as never);

    const req = new NextRequest('http://localhost/api/teams/team-1');
    const res = await teamDetailGet(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team).toEqual(mockTeam);
    expect(body.members).toEqual([mockMember]);
  });
});

// ===========================================================================
// PATCH /api/teams/[teamId]
// ===========================================================================

describe('PATCH /api/teams/[teamId]', () => {
  it('returns 404 when user has no org', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(null as never);

    const req = jsonRequest('http://localhost/api/teams/team-1', 'PATCH', {
      name: 'New Name',
    });
    const res = await teamDetailPatch(req, teamParams('team-1'));

    expect(res.status).toBe(404);
  });

  it('returns 403 when not admin/owner', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = jsonRequest('http://localhost/api/teams/team-1', 'PATCH', {
      name: 'New Name',
    });
    const res = await teamDetailPatch(req, teamParams('team-1'));

    expect(res.status).toBe(403);
  });

  it('returns 404 when team not found', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(null as never);

    const req = jsonRequest('http://localhost/api/teams/team-1', 'PATCH', {
      name: 'New Name',
    });
    const res = await teamDetailPatch(req, teamParams('team-1'));

    expect(res.status).toBe(404);
  });

  it('returns 403 when team org mismatch', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue({
      ...mockTeam,
      organizationId: 'org-other',
    } as never);

    const req = jsonRequest('http://localhost/api/teams/team-1', 'PATCH', {
      name: 'New Name',
    });
    const res = await teamDetailPatch(req, teamParams('team-1'));

    expect(res.status).toBe(403);
  });

  it('returns updated team on success', async () => {
    setupAuthenticatedAdmin();
    const updatedTeam = { ...mockTeam, name: 'New Name' };
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.updateTeam).mockReturnValue(updatedTeam as never);

    const req = jsonRequest('http://localhost/api/teams/team-1', 'PATCH', {
      name: 'New Name',
    });
    const res = await teamDetailPatch(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('New Name');
  });
});

// ===========================================================================
// DELETE /api/teams/[teamId]
// ===========================================================================

describe('DELETE /api/teams/[teamId]', () => {
  it('returns 403 when not admin/owner', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = new NextRequest('http://localhost/api/teams/team-1', {
      method: 'DELETE',
    });
    const res = await teamDetailDelete(req, teamParams('team-1'));

    expect(res.status).toBe(403);
  });

  it('returns 404 when team not found', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(null as never);

    const req = new NextRequest('http://localhost/api/teams/team-1', {
      method: 'DELETE',
    });
    const res = await teamDetailDelete(req, teamParams('team-1'));

    expect(res.status).toBe(404);
  });

  it('returns success on delete', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);

    const req = new NextRequest('http://localhost/api/teams/team-1', {
      method: 'DELETE',
    });
    const res = await teamDetailDelete(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(teamStore.deleteTeam).toHaveBeenCalledWith('team-1');
  });
});

// ===========================================================================
// GET /api/teams/[teamId]/members
// ===========================================================================

describe('GET /api/teams/[teamId]/members', () => {
  it('returns 404 when team not found', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(null as never);

    const req = new NextRequest('http://localhost/api/teams/team-1/members');
    const res = await membersGet(req, teamParams('team-1'));

    expect(res.status).toBe(404);
  });

  it('returns 403 when org mismatch', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue({
      ...mockTeam,
      organizationId: 'org-other',
    } as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);

    const req = new NextRequest('http://localhost/api/teams/team-1/members');
    const res = await membersGet(req, teamParams('team-1'));

    expect(res.status).toBe(403);
  });

  it('returns member list on success', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.listMembersForTeam).mockReturnValue([mockMember] as never);

    const req = new NextRequest('http://localhost/api/teams/team-1/members');
    const res = await membersGet(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([mockMember]);
  });
});

// ===========================================================================
// POST /api/teams/[teamId]/members
// ===========================================================================

describe('POST /api/teams/[teamId]/members', () => {
  it('returns 403 when not admin/owner', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = jsonRequest('http://localhost/api/teams/team-1/members', 'POST', {
      email: 'dev@test.com',
    });
    const res = await membersPost(req, teamParams('team-1'));

    expect(res.status).toBe(403);
  });

  it('returns 400 when email missing', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);

    const req = jsonRequest('http://localhost/api/teams/team-1/members', 'POST', {});
    const res = await membersPost(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad_request');
  });

  it('returns 404 when target user not found by email', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(findUserByEmail).mockReturnValue(null as never);

    const req = jsonRequest('http://localhost/api/teams/team-1/members', 'POST', {
      email: 'unknown@test.com',
    });
    const res = await membersPost(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain('No user found');
  });

  it('returns 400 for invalid role', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(findUserByEmail).mockReturnValue({ id: 'user-2', email: 'dev@test.com' } as never);

    const req = jsonRequest('http://localhost/api/teams/team-1/members', 'POST', {
      email: 'dev@test.com',
      role: 'superadmin',
    });
    const res = await membersPost(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain('Invalid role');
  });

  it('returns 201 with new member on success', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(findUserByEmail).mockReturnValue({ id: 'user-2', email: 'dev@test.com' } as never);
    vi.mocked(teamStore.addTeamMember).mockReturnValue(mockMember as never);

    const req = jsonRequest('http://localhost/api/teams/team-1/members', 'POST', {
      email: 'dev@test.com',
      role: 'member',
    });
    const res = await membersPost(req, teamParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(mockMember);
    expect(teamStore.addTeamMember).toHaveBeenCalledWith(
      'team-1',
      'user-2',
      'org-1',
      'member',
      'user-1',
    );
  });
});

// ===========================================================================
// PATCH /api/teams/[teamId]/members/[userId]
// ===========================================================================

describe('PATCH /api/teams/[teamId]/members/[userId]', () => {
  it('returns 403 when not admin/owner', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = jsonRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      'PATCH',
      { role: 'admin' },
    );
    const res = await memberPatch(req, memberParams('team-1', 'user-2'));

    expect(res.status).toBe(403);
  });

  it('returns 400 when role missing', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);

    const req = jsonRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      'PATCH',
      {},
    );
    const res = await memberPatch(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('bad_request');
  });

  it('returns 400 for invalid role', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);

    const req = jsonRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      'PATCH',
      { role: 'superadmin' },
    );
    const res = await memberPatch(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain('Invalid role');
  });

  it('returns 404 when member not found', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.updateTeamMemberRole).mockReturnValue(null as never);

    const req = jsonRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      'PATCH',
      { role: 'admin' },
    );
    const res = await memberPatch(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain('Member not found');
  });

  it('returns updated member on success', async () => {
    setupAuthenticatedAdmin();
    const updatedMember = { ...mockMember, role: 'admin' };
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.updateTeamMemberRole).mockReturnValue(updatedMember as never);

    const req = jsonRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      'PATCH',
      { role: 'admin' },
    );
    const res = await memberPatch(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.role).toBe('admin');
  });
});

// ===========================================================================
// DELETE /api/teams/[teamId]/members/[userId]
// ===========================================================================

describe('DELETE /api/teams/[teamId]/members/[userId]', () => {
  it('returns 403 when not admin/owner', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getUserOrgRole).mockReturnValue('member' as never);

    const req = new NextRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      { method: 'DELETE' },
    );
    const res = await memberDelete(req, memberParams('team-1', 'user-2'));

    expect(res.status).toBe(403);
  });

  it('returns 404 when member not found', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.removeTeamMember).mockReturnValue(false as never);

    const req = new NextRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      { method: 'DELETE' },
    );
    const res = await memberDelete(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain('Member not found');
  });

  it('returns success on member removal', async () => {
    setupAuthenticatedAdmin();
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.removeTeamMember).mockReturnValue(true as never);

    const req = new NextRequest(
      'http://localhost/api/teams/team-1/members/user-2',
      { method: 'DELETE' },
    );
    const res = await memberDelete(req, memberParams('team-1', 'user-2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(teamStore.removeTeamMember).toHaveBeenCalledWith('team-1', 'user-2');
  });
});
