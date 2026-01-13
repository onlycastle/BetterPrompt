/**
 * Supabase Team Repository
 *
 * Implements ITeamRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/team-repo
 */

import { getSupabaseClient } from './client.js';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import { getErrorMessage, isNotFoundError } from './helpers.js';
import type { ITeamRepository } from '../../../application/ports/storage.js';
import type { Team, TeamMember, Organization } from '../../../domain/models/index.js';

// ============================================================================
// Database Row Interfaces
// ============================================================================

interface TeamRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  updated_at: string | null;
}

interface TeamMemberRow {
  team_id: string;
  user_id: string;
  role: TeamMember['role'];
  joined_at: string;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  tier: 'enterprise';
  max_seats: number;
  used_seats: number;
  settings: {
    allowedDomains?: string[];
    ssoEnabled?: boolean;
    customKnowledgeBaseEnabled?: boolean;
  };
  created_at: string;
  updated_at: string | null;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description || undefined,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    userId: row.user_id,
    teamId: row.team_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    tier: 'enterprise',
    maxSeats: row.max_seats,
    usedSeats: row.used_seats,
    settings: {
      allowedDomains: row.settings?.allowedDomains ?? [],
      ssoEnabled: row.settings?.ssoEnabled ?? false,
      customKnowledgeBaseEnabled: row.settings?.customKnowledgeBaseEnabled ?? false,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

export function createSupabaseTeamRepository(): ITeamRepository {
  return {
    async createTeam(
      orgId: string,
      name: string,
      description?: string
    ): Promise<Result<Team, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('teams')
          .insert({
            organization_id: orgId,
            name,
            description: description || null,
            member_count: 0,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return err(StorageError.duplicateKey('teams', 'name', name));
          }
          if (error.code === '23503') {
            return err(StorageError.notFound('organizations', orgId));
          }
          return err(StorageError.writeFailed('teams', orgId, error.message));
        }

        return ok(toTeam(data as TeamRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findTeamById(id: string): Promise<Result<Team | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('teams', id, error.message));
        }

        return ok(toTeam(data as TeamRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findTeamsByOrg(orgId: string): Promise<Result<Team[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });

        if (error) {
          return err(StorageError.readFailed('teams', orgId, error.message));
        }

        return ok((data as TeamRow[]).map(toTeam));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async addMember(
      teamId: string,
      userId: string,
      role: TeamMember['role']
    ): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { error } = await supabase.from('team_members').insert({
          team_id: teamId,
          user_id: userId,
          role,
          joined_at: now,
        });

        if (error) {
          if (error.code === '23505') {
            return err(
              StorageError.duplicateKey('team_members', 'team_id,user_id', `${teamId},${userId}`)
            );
          }
          if (error.code === '23503') {
            return err(StorageError.notFound('teams or users', `${teamId} or ${userId}`));
          }
          return err(StorageError.writeFailed('team_members', teamId, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async removeMember(teamId: string, userId: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', userId);

        if (error) {
          return err(StorageError.deleteFailed('team_members', `${teamId},${userId}`, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getMembers(teamId: string): Promise<Result<TeamMember[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId)
          .order('joined_at', { ascending: true });

        if (error) {
          return err(StorageError.readFailed('team_members', teamId, error.message));
        }

        return ok((data as TeamMemberRow[]).map(toTeamMember));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getUserTeams(userId: string): Promise<Result<Team[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        // Join team_members with teams to get all teams for a user
        const { data, error } = await supabase
          .from('team_members')
          .select(
            `
            teams (
              id,
              organization_id,
              name,
              description,
              member_count,
              created_at,
              updated_at
            )
          `
          )
          .eq('user_id', userId);

        if (error) {
          return err(StorageError.readFailed('team_members', userId, error.message));
        }

        // Extract teams from the joined result
        // Supabase join returns nested objects that need proper type handling
        const teams = (data as unknown as Array<{ teams: TeamRow | null }>)
          .map((item) => item.teams)
          .filter((team): team is TeamRow => team !== null)
          .map(toTeam);

        return ok(teams);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async deleteTeam(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('teams').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('teams', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async createOrganization(
      name: string,
      slug: string,
      ownerId: string,
      maxSeats: number
    ): Promise<Result<Organization, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('organizations')
          .insert({
            name,
            slug,
            owner_id: ownerId,
            tier: 'enterprise',
            max_seats: maxSeats,
            used_seats: 0,
            settings: {
              allowedDomains: [],
              ssoEnabled: false,
              customKnowledgeBaseEnabled: false,
            },
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return err(StorageError.duplicateKey('organizations', 'slug', slug));
          }
          if (error.code === '23503') {
            return err(StorageError.notFound('users', ownerId));
          }
          return err(StorageError.writeFailed('organizations', slug, error.message));
        }

        return ok(toOrganization(data as OrganizationRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findOrganizationById(id: string): Promise<Result<Organization | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('organizations', id, error.message));
        }

        return ok(toOrganization(data as OrganizationRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findOrganizationBySlug(slug: string): Promise<Result<Organization | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('organizations', slug, error.message));
        }

        return ok(toOrganization(data as OrganizationRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async updateOrganization(
      id: string,
      updates: Partial<Organization>
    ): Promise<Result<Organization, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
        if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
        if (updates.maxSeats !== undefined) dbUpdates.max_seats = updates.maxSeats;
        if (updates.usedSeats !== undefined) dbUpdates.used_seats = updates.usedSeats;
        if (updates.settings !== undefined) dbUpdates.settings = updates.settings;

        const { data, error } = await supabase
          .from('organizations')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return err(
              StorageError.duplicateKey('organizations', 'slug', updates.slug || 'unknown')
            );
          }
          return err(StorageError.writeFailed('organizations', id, error.message));
        }

        return ok(toOrganization(data as OrganizationRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
