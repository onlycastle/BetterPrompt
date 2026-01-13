/**
 * Supabase User Repository
 *
 * Implements IUserRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/user-repo
 */

import { getSupabaseClient } from './client.js';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import { getErrorMessage, isNotFoundError, getFirstOfNextMonth } from './helpers.js';
import type { IUserRepository } from '../../../application/ports/storage.js';
import type { User, UserTier } from '../../../domain/models/index.js';

interface UserRow {
  id: string;
  email: string;
  tier: UserTier;
  analyses_this_month: number;
  analyses_reset_at: string;
  created_at: string;
  updated_at: string | null;
  last_active_at: string | null;
  organization_id: string | null;
  team_ids: string[];
  settings: {
    emailNotifications?: boolean;
    weeklyDigest?: boolean;
    publicProfile?: boolean;
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    tier: row.tier,
    analysesThisMonth: row.analyses_this_month,
    analysesResetAt: row.analyses_reset_at,
    teamIds: row.team_ids || [],
    settings: {
      emailNotifications: row.settings?.emailNotifications ?? true,
      weeklyDigest: row.settings?.weeklyDigest ?? false,
      publicProfile: row.settings?.publicProfile ?? false,
    },
    organizationId: row.organization_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    lastActiveAt: row.last_active_at || undefined,
  };
}

export function createSupabaseUserRepository(): IUserRepository {
  return {
    async create(email: string, tier: UserTier = 'free'): Promise<Result<User, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();
        const resetAt = getFirstOfNextMonth();

        const { data, error } = await supabase
          .from('users')
          .insert({
            email,
            tier,
            analyses_this_month: 0,
            analyses_reset_at: resetAt,
            team_ids: [],
            settings: {},
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return err(StorageError.duplicateKey('users', 'email', email));
          }
          return err(StorageError.writeFailed('users', email, error.message));
        }

        return ok(toUser(data as UserRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findById(id: string): Promise<Result<User | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('users', id, error.message));
        }

        return ok(toUser(data as UserRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByEmail(email: string): Promise<Result<User | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.from('users').select('*').eq('email', email).single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('users', email, error.message));
        }

        return ok(toUser(data as UserRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async update(id: string, updates: Partial<User>): Promise<Result<User, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
        if (updates.analysesThisMonth !== undefined) {
          dbUpdates.analyses_this_month = updates.analysesThisMonth;
        }
        if (updates.analysesResetAt !== undefined) {
          dbUpdates.analyses_reset_at = updates.analysesResetAt;
        }
        if (updates.teamIds !== undefined) dbUpdates.team_ids = updates.teamIds;
        if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;
        if (updates.lastActiveAt !== undefined) dbUpdates.last_active_at = updates.lastActiveAt;
        if (updates.settings !== undefined) dbUpdates.settings = updates.settings;

        const { data, error } = await supabase
          .from('users')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('users', id, error.message));
        }

        return ok(toUser(data as UserRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async updateTier(id: string, tier: UserTier): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('users')
          .update({ tier, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          return err(StorageError.writeFailed('users', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async incrementAnalysisCount(id: string): Promise<Result<number, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { data: current, error: readError } = await supabase
          .from('users')
          .select('analyses_this_month')
          .eq('id', id)
          .single();

        if (readError) {
          return err(StorageError.readFailed('users', id, readError.message));
        }

        const newCount = ((current?.analyses_this_month as number) || 0) + 1;

        const { error: updateError } = await supabase
          .from('users')
          .update({
            analyses_this_month: newCount,
            last_active_at: now,
            updated_at: now,
          })
          .eq('id', id);

        if (updateError) {
          return err(StorageError.writeFailed('users', id, updateError.message));
        }

        return ok(newCount);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async resetAnalysisCount(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const resetAt = getFirstOfNextMonth();

        const { error } = await supabase
          .from('users')
          .update({
            analyses_this_month: 0,
            analyses_reset_at: resetAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          return err(StorageError.writeFailed('users', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('users').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('users', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
