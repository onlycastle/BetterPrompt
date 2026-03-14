/**
 * Team Store - Data Access Layer
 *
 * CRUD operations for organizations, teams, and team members.
 * Follows the analysis-store.ts pattern with direct SQLite queries.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface TeamRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamMemberRow {
  id: string;
  user_id: string;
  team_id: string;
  organization_id: string;
  role: string;
  invited_by: string | null;
  joined_at: string;
}

interface TeamMemberWithUserRow extends TeamMemberRow {
  email: string;
  user_created_at: string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StoredOrganization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTeam {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

export interface StoredTeamMember {
  id: string;
  userId: string;
  teamId: string;
  organizationId: string;
  role: string;
  invitedBy: string | null;
  joinedAt: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapOrgRow(row: OrganizationRow): StoredOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTeamRow(row: TeamRow & { member_count?: number }): StoredTeam {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.member_count ?? 0,
  };
}

function mapMemberRow(row: TeamMemberWithUserRow): StoredTeamMember {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    organizationId: row.organization_id,
    role: row.role,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at,
    email: row.email,
  };
}

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

export function createOrganization(name: string, slug: string, ownerId: string): StoredOrganization {
  const db = getDatabase();
  const now = new Date().toISOString();
  const orgId = randomUUID();

  const txn = db.transaction(() => {
    // Create the organization
    db.prepare(`
      INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(orgId, name, slug, ownerId, now, now);

    // Set the owner's organization_id
    db.prepare(`UPDATE users SET organization_id = ? WHERE id = ?`).run(orgId, ownerId);
  });

  txn();

  return getOrganization(orgId)!;
}

export function getOrganization(orgId: string): StoredOrganization | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, name, slug, owner_id, created_at, updated_at
    FROM organizations WHERE id = ?
  `).get(orgId) as OrganizationRow | undefined;

  return row ? mapOrgRow(row) : null;
}

export function getOrganizationBySlug(slug: string): StoredOrganization | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, name, slug, owner_id, created_at, updated_at
    FROM organizations WHERE slug = ?
  `).get(slug) as OrganizationRow | undefined;

  return row ? mapOrgRow(row) : null;
}

export function updateOrganization(orgId: string, updates: { name?: string; slug?: string }): StoredOrganization | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  if (updates.name !== undefined) {
    db.prepare(`UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?`)
      .run(updates.name, now, orgId);
  }
  if (updates.slug !== undefined) {
    db.prepare(`UPDATE organizations SET slug = ?, updated_at = ? WHERE id = ?`)
      .run(updates.slug, now, orgId);
  }

  return getOrganization(orgId);
}

// ---------------------------------------------------------------------------
// Team CRUD
// ---------------------------------------------------------------------------

export function createTeam(orgId: string, name: string, description?: string): StoredTeam {
  const db = getDatabase();
  const now = new Date().toISOString();
  const teamId = randomUUID();

  db.prepare(`
    INSERT INTO teams (id, organization_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(teamId, orgId, name, description ?? null, now, now);

  return getTeam(teamId)!;
}

export function getTeam(teamId: string): StoredTeam | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
    FROM teams t WHERE t.id = ?
  `).get(teamId) as (TeamRow & { member_count: number }) | undefined;

  return row ? mapTeamRow(row) : null;
}

export function updateTeam(teamId: string, updates: { name?: string; description?: string }): StoredTeam | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  if (updates.name !== undefined) {
    db.prepare(`UPDATE teams SET name = ?, updated_at = ? WHERE id = ?`)
      .run(updates.name, now, teamId);
  }
  if (updates.description !== undefined) {
    db.prepare(`UPDATE teams SET description = ?, updated_at = ? WHERE id = ?`)
      .run(updates.description, now, teamId);
  }

  return getTeam(teamId);
}

export function deleteTeam(teamId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
  return result.changes > 0;
}

export function listTeamsForOrg(orgId: string): StoredTeam[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
    FROM teams t
    WHERE t.organization_id = ?
    ORDER BY t.created_at ASC
  `).all(orgId) as (TeamRow & { member_count: number })[];

  return rows.map(mapTeamRow);
}

// ---------------------------------------------------------------------------
// Team Member CRUD
// ---------------------------------------------------------------------------

export function addTeamMember(
  teamId: string,
  userId: string,
  orgId: string,
  role: string,
  invitedBy?: string,
): StoredTeamMember {
  const db = getDatabase();
  const now = new Date().toISOString();
  const memberId = randomUUID();

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO team_members (id, user_id, team_id, organization_id, role, invited_by, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(memberId, userId, teamId, orgId, role, invitedBy ?? null, now);

    // Also set the user's organization_id if not already set
    db.prepare(`UPDATE users SET organization_id = ? WHERE id = ? AND organization_id IS NULL`)
      .run(orgId, userId);
  });

  txn();

  return getTeamMember(teamId, userId)!;
}

export function removeTeamMember(teamId: string, userId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
    .run(teamId, userId);
  return result.changes > 0;
}

export function updateTeamMemberRole(teamId: string, userId: string, newRole: string): StoredTeamMember | null {
  const db = getDatabase();
  db.prepare(`UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?`)
    .run(newRole, teamId, userId);
  return getTeamMember(teamId, userId);
}

export function getTeamMember(teamId: string, userId: string): StoredTeamMember | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT tm.id, tm.user_id, tm.team_id, tm.organization_id, tm.role, tm.invited_by, tm.joined_at,
           u.email, u.created_at AS user_created_at
    FROM team_members tm
    INNER JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? AND tm.user_id = ?
  `).get(teamId, userId) as TeamMemberWithUserRow | undefined;

  return row ? mapMemberRow(row) : null;
}

export function listMembersForTeam(teamId: string): StoredTeamMember[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT tm.id, tm.user_id, tm.team_id, tm.organization_id, tm.role, tm.invited_by, tm.joined_at,
           u.email, u.created_at AS user_created_at
    FROM team_members tm
    INNER JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
    ORDER BY tm.joined_at ASC
  `).all(teamId) as TeamMemberWithUserRow[];

  return rows.map(mapMemberRow);
}

export function getOrgMembers(orgId: string): StoredTeamMember[] {
  const db = getDatabase();
  // Get distinct members across all teams in the org
  const rows = db.prepare(`
    SELECT DISTINCT tm.id, tm.user_id, tm.team_id, tm.organization_id, tm.role, tm.invited_by, tm.joined_at,
           u.email, u.created_at AS user_created_at
    FROM team_members tm
    INNER JOIN users u ON u.id = tm.user_id
    WHERE tm.organization_id = ?
    ORDER BY tm.joined_at ASC
  `).all(orgId) as TeamMemberWithUserRow[];

  return rows.map(mapMemberRow);
}

export function getUserOrganization(userId: string): StoredOrganization | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT o.id, o.name, o.slug, o.owner_id, o.created_at, o.updated_at
    FROM organizations o
    INNER JOIN users u ON u.organization_id = o.id
    WHERE u.id = ?
  `).get(userId) as OrganizationRow | undefined;

  return row ? mapOrgRow(row) : null;
}

export function getUserOrgRole(userId: string, orgId: string): string | null {
  const db = getDatabase();
  // Check if user is the org owner first
  const org = db.prepare('SELECT owner_id FROM organizations WHERE id = ?')
    .get(orgId) as { owner_id: string } | undefined;
  if (org?.owner_id === userId) return 'owner';

  // Otherwise check team membership for highest role
  const row = db.prepare(`
    SELECT role FROM team_members
    WHERE user_id = ? AND organization_id = ?
    ORDER BY CASE role
      WHEN 'admin' THEN 1
      WHEN 'member' THEN 2
      WHEN 'viewer' THEN 3
      ELSE 4
    END
    LIMIT 1
  `).get(userId, orgId) as { role: string } | undefined;

  return row?.role ?? null;
}

