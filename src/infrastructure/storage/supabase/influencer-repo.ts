/**
 * Supabase Influencer Repository
 *
 * Implements IInfluencerRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/influencer-repo
 */

import { getSupabaseClient } from './client.js';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import {
  getErrorMessage,
  isNotFoundError,
  hasMoreResults,
  getPaginationRange,
} from './helpers.js';
import type {
  IInfluencerRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../application/ports/storage.js';
import type {
  Influencer,
  InfluencerMatch,
  CredibilityTier,
  PlatformIdentifier,
  InfluencerPlatform,
} from '../../../domain/models/index.js';

const INFLUENCER_SELECT = `
  *,
  identifiers:influencer_identifiers(*)
`;

interface IdentifierRow {
  platform: InfluencerPlatform;
  handle: string;
  profile_url?: string;
}

function toInfluencer(row: Record<string, unknown>): Influencer {
  const identifiers = row.identifiers as IdentifierRow[] | undefined;

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    credibilityTier: row.credibility_tier as CredibilityTier,
    identifiers:
      identifiers?.map((id) => ({
        platform: id.platform,
        handle: id.handle,
        profileUrl: id.profile_url,
      })) || [],
    expertiseTopics: row.expertise_topics as string[],
    affiliation: row.affiliation as string | undefined,
    contentCount: row.content_count as number,
    isActive: row.is_active as boolean,
    addedAt: row.added_at as string,
    updatedAt: row.updated_at as string | undefined,
    lastContentAt: row.last_content_at as string | undefined,
  };
}

function getSortColumn(field?: 'name' | 'credibilityTier' | 'contentCount'): string {
  switch (field) {
    case 'credibilityTier':
      return 'credibility_tier';
    case 'contentCount':
      return 'content_count';
    default:
      return 'name';
  }
}

const URL_PATTERNS: Array<{ platform: InfluencerPlatform; regex: RegExp }> = [
  { platform: 'youtube', regex: /youtube\.com\/@([^/?]+)/i },
  { platform: 'youtube', regex: /youtube\.com\/channel\/([^/?]+)/i },
  { platform: 'twitter', regex: /(?:twitter|x)\.com\/([^/?]+)/i },
  { platform: 'github', regex: /github\.com\/([^/?]+)/i },
  { platform: 'linkedin', regex: /linkedin\.com\/in\/([^/?]+)/i },
];

export function createSupabaseInfluencerRepository(): IInfluencerRepository {
  async function saveIdentifiers(
    supabase: ReturnType<typeof getSupabaseClient>,
    influencerId: string,
    identifiers: PlatformIdentifier[]
  ): Promise<void> {
    await supabase.from('influencer_identifiers').delete().eq('influencer_id', influencerId);

    if (identifiers.length > 0) {
      await supabase.from('influencer_identifiers').insert(
        identifiers.map((id) => ({
          influencer_id: influencerId,
          platform: id.platform,
          handle: id.handle,
          profile_url: id.profileUrl,
        }))
      );
    }
  }

  const repo: IInfluencerRepository = {
    async save(influencer: Influencer): Promise<Result<Influencer, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { identifiers, ...rest } = influencer;

        const { data: infData, error: infError } = await supabase
          .from('influencers')
          .upsert({
            id: rest.id,
            name: rest.name,
            description: rest.description,
            credibility_tier: rest.credibilityTier,
            expertise_topics: rest.expertiseTopics,
            affiliation: rest.affiliation,
            content_count: rest.contentCount,
            is_active: rest.isActive ?? true,
            added_at: rest.addedAt,
            updated_at: new Date().toISOString(),
            last_content_at: rest.lastContentAt,
          })
          .select()
          .single();

        if (infError) {
          return err(StorageError.writeFailed('influencers', influencer.id, infError.message));
        }

        if (identifiers && identifiers.length > 0) {
          await saveIdentifiers(supabase, infData.id, identifiers);
        }

        const result = await repo.findById(infData.id);
        if (!result.success || !result.data) {
          return err(StorageError.readFailed('influencers', infData.id, 'Failed to fetch saved influencer'));
        }

        return ok(result.data);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findById(id: string): Promise<Result<Influencer | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('influencers')
          .select(INFLUENCER_SELECT)
          .eq('id', id)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('influencers', id, error.message));
        }

        return ok(toInfluencer(data));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByHandle(
      platform: InfluencerPlatform,
      handle: string
    ): Promise<Result<Influencer | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data: idData, error: idError } = await supabase
          .from('influencer_identifiers')
          .select('influencer_id')
          .eq('platform', platform)
          .ilike('handle', handle.replace(/^@/, ''))
          .single();

        if (idError || !idData) {
          return ok(null);
        }

        return repo.findById(idData.influencer_id);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findAll(
      options?: QueryOptions<'name' | 'credibilityTier' | 'contentCount'>
    ): Promise<Result<PaginatedResult<Influencer>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options?.pagination);
        const sortField = getSortColumn(options?.sort?.field);
        const ascending = options?.sort?.direction === 'asc';

        const { data, error, count } = await supabase
          .from('influencers')
          .select(INFLUENCER_SELECT, { count: 'exact' })
          .order(sortField, { ascending })
          .range(offset, end);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok({
          items: (data || []).map(toInfluencer),
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findActive(): Promise<Result<Influencer[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('influencers')
          .select(INFLUENCER_SELECT)
          .eq('is_active', true)
          .order('name');

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((data || []).map(toInfluencer));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByTier(tier: CredibilityTier): Promise<Result<Influencer[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('influencers')
          .select(INFLUENCER_SELECT)
          .eq('credibility_tier', tier)
          .order('name');

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((data || []).map(toInfluencer));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async update(id: string, updates: Partial<Influencer>): Promise<Result<Influencer, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.credibilityTier !== undefined) dbUpdates.credibility_tier = updates.credibilityTier;
        if (updates.expertiseTopics !== undefined) dbUpdates.expertise_topics = updates.expertiseTopics;
        if (updates.affiliation !== undefined) dbUpdates.affiliation = updates.affiliation;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
        if (updates.contentCount !== undefined) dbUpdates.content_count = updates.contentCount;
        if (updates.lastContentAt !== undefined) dbUpdates.last_content_at = updates.lastContentAt;

        const { error } = await supabase.from('influencers').update(dbUpdates).eq('id', id);

        if (error) {
          return err(StorageError.writeFailed('influencers', id, error.message));
        }

        if (updates.identifiers) {
          await saveIdentifiers(supabase, id, updates.identifiers);
        }

        const result = await repo.findById(id);
        if (!result.success || !result.data) {
          return err(StorageError.readFailed('influencers', id, 'Failed to fetch updated influencer'));
        }

        return ok(result.data);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async incrementContentCount(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { error: rpcError } = await supabase.rpc('increment_influencer_content', {
          influencer_uuid: id,
        });

        if (rpcError) {
          const result = await repo.findById(id);
          if (!result.success || !result.data) {
            return err(StorageError.notFound('influencers', id));
          }

          const { error } = await supabase
            .from('influencers')
            .update({
              content_count: result.data.contentCount + 1,
              last_content_at: now,
              updated_at: now,
            })
            .eq('id', id);

          if (error) {
            return err(StorageError.writeFailed('influencers', id, error.message));
          }
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('influencers').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('influencers', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async matchFromContent(url: string, author?: string): Promise<Result<InfluencerMatch | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        for (const { platform, regex } of URL_PATTERNS) {
          const match = url.match(regex);
          if (match) {
            const handle = match[1];
            const result = await repo.findByHandle(platform, handle);

            if (result.success && result.data) {
              const matchedIdentifier =
                result.data.identifiers.find(
                  (id) => id.platform === platform && id.handle.toLowerCase() === handle.toLowerCase()
                ) || result.data.identifiers[0];

              return ok({
                influencer: result.data,
                matchedOn: matchedIdentifier,
                confidence: 0.9,
              });
            }
          }
        }

        if (author) {
          const { data, error } = await supabase
            .from('influencers')
            .select(INFLUENCER_SELECT)
            .ilike('name', `%${author}%`)
            .limit(1)
            .single();

          if (!error && data) {
            const influencer = toInfluencer(data);
            return ok({
              influencer,
              matchedOn: influencer.identifiers[0],
              confidence: 0.7,
            });
          }
        }

        return ok(null);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };

  return repo;
}
