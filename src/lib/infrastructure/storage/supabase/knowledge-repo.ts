/**
 * Supabase Knowledge Repository
 *
 * Implements IKnowledgeRepository using Supabase.
 * Replaces the file-based KnowledgeStore.
 *
 * @module infrastructure/storage/supabase/knowledge-repo
 */

import { getSupabaseClient } from './client';
import { ok, err, type Result } from '../../../result';
import { StorageError } from '../../../domain/errors/index';
import {
  getErrorMessage,
  isNotFoundError,
  hasMoreResults,
  getPaginationRange,
} from './helpers';
import type {
  IKnowledgeRepository,
  PaginatedResult,
  PaginationOptions,
  QueryOptions,
} from '../../../application/ports/storage';
import type {
  KnowledgeItem,
  KnowledgeStats,
  KnowledgeFilters,
  TopicCategory,
  SourcePlatform,
  KnowledgeStatus,
  KnowledgeDimensionName,
} from '../../../domain/models/index';
import { TOPIC_TO_DIMENSION_MAP } from '../../../domain/models/index';

function toKnowledgeItem(row: Record<string, unknown>): KnowledgeItem {
  // Get applicable_dimensions from DB, or derive from legacy category
  let applicableDimensions = row.applicable_dimensions as KnowledgeDimensionName[] | undefined;
  const category = row.category as TopicCategory | undefined;

  // If applicable_dimensions is empty/missing, derive from legacy category
  if ((!applicableDimensions || applicableDimensions.length === 0) && category) {
    applicableDimensions = [TOPIC_TO_DIMENSION_MAP[category]];
  }

  return {
    id: row.id as string,
    version: row.version as '1.0.0',
    title: row.title as string,
    summary: row.summary as string,
    content: row.content as string,
    applicableDimensions: applicableDimensions || ['skillResilience'],
    subCategories: row.sub_categories as Record<KnowledgeDimensionName, string[]> | undefined,
    category: category, // Keep for backward compatibility
    contentType: row.content_type as KnowledgeItem['contentType'],
    tags: row.tags as string[],
    source: row.source as KnowledgeItem['source'],
    relevance: row.relevance as KnowledgeItem['relevance'],
    status: row.status as KnowledgeStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    relatedItems: row.related_items as string[] | undefined,
    supersedes: row.supersedes as string | undefined,
  };
}

function toDbRow(item: KnowledgeItem): Record<string, unknown> {
  // Derive category from first applicable dimension if not provided (for legacy compatibility)
  let category = item.category;
  if (!category && item.applicableDimensions && item.applicableDimensions.length > 0) {
    // Reverse lookup: find a category that maps to the first dimension
    const firstDimension = item.applicableDimensions[0];
    const entries = Object.entries(TOPIC_TO_DIMENSION_MAP) as [TopicCategory, KnowledgeDimensionName][];
    const match = entries.find(([, dim]) => dim === firstDimension);
    category = match ? match[0] : 'other';
  }

  return {
    id: item.id,
    version: item.version,
    title: item.title,
    summary: item.summary,
    content: item.content,
    applicable_dimensions: item.applicableDimensions,
    sub_categories: item.subCategories || {},
    category: category || 'other', // Keep for legacy compatibility
    content_type: item.contentType,
    tags: item.tags,
    source: item.source,
    relevance: item.relevance,
    status: item.status,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    related_items: item.relatedItems || [],
    supersedes: item.supersedes,
  };
}

function getSortColumn(field?: 'relevance' | 'createdAt' | 'title'): string {
  switch (field) {
    case 'relevance':
      return 'relevance->>score';
    case 'title':
      return 'title';
    default:
      return 'created_at';
  }
}

export function createSupabaseKnowledgeRepository(): IKnowledgeRepository {
  return {
    async save(item: KnowledgeItem): Promise<Result<KnowledgeItem, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('knowledge_items')
          .upsert(toDbRow(item))
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('knowledge_items', item.id, error.message));
        }

        return ok(toKnowledgeItem(data));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async saveBatch(items: KnowledgeItem[]): Promise<Result<KnowledgeItem[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('knowledge_items')
          .upsert(items.map(toDbRow))
          .select();

        if (error) {
          return err(StorageError.writeFailed('knowledge_items', 'batch', error.message));
        }

        return ok((data || []).map(toKnowledgeItem));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findById(id: string): Promise<Result<KnowledgeItem | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('knowledge_items')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('knowledge_items', id, error.message));
        }

        return ok(toKnowledgeItem(data));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async search(
      filters: KnowledgeFilters,
      options?: QueryOptions<'relevance' | 'createdAt' | 'title'>
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options?.pagination);

        let query = supabase.from('knowledge_items').select('*', { count: 'exact' });

        if (filters.platform) {
          query = query.eq('source->>platform', filters.platform);
        }
        // New: dimension-based filtering (primary)
        if (filters.dimension) {
          query = query.contains('applicable_dimensions', [filters.dimension]);
        }
        // New: multi-dimension filtering
        if (filters.dimensions && filters.dimensions.length > 0) {
          query = query.overlaps('applicable_dimensions', filters.dimensions);
        }
        // Legacy: category-based filtering (fallback)
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.minScore !== undefined) {
          query = query.gte('relevance->>score', filters.minScore.toString());
        }
        if (filters.tags && filters.tags.length > 0) {
          query = query.overlaps('tags', filters.tags);
        }

        const sortField = getSortColumn(options?.sort?.field);
        const ascending = options?.sort?.direction === 'asc';

        query = query.order(sortField, { ascending }).range(offset, end);

        const { data, error, count } = await query;

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok({
          items: (data || []).map(toKnowledgeItem),
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async fullTextSearch(
      query: string,
      filters?: Partial<KnowledgeFilters>,
      options?: PaginationOptions
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options);

        let dbQuery = supabase
          .from('knowledge_items')
          .select('*', { count: 'exact' })
          .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`);

        // New: dimension-based filtering
        if (filters?.dimension) {
          dbQuery = dbQuery.contains('applicable_dimensions', [filters.dimension]);
        }
        if (filters?.dimensions && filters.dimensions.length > 0) {
          dbQuery = dbQuery.overlaps('applicable_dimensions', filters.dimensions);
        }
        // Legacy: category-based filtering
        if (filters?.category) {
          dbQuery = dbQuery.eq('category', filters.category);
        }
        if (filters?.status) {
          dbQuery = dbQuery.eq('status', filters.status);
        }
        if (filters?.platform) {
          dbQuery = dbQuery.eq('source->>platform', filters.platform);
        }

        dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, end);

        const { data, error, count } = await dbQuery;

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok({
          items: (data || []).map(toKnowledgeItem),
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getStats(): Promise<Result<KnowledgeStats, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('knowledge_items')
          .select('category, applicable_dimensions, status, source, relevance');

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        // New: dimension-based stats
        const byDimension: Partial<Record<KnowledgeDimensionName, number>> = {};

        // Legacy: category-based stats (kept for backward compatibility)
        const byCategory: Partial<Record<TopicCategory, number>> = {};

        const byStatus: Partial<Record<KnowledgeStatus, number>> = {};
        const byPlatform: Partial<Record<SourcePlatform, number>> = {};

        let totalRelevanceScore = 0;
        let highQualityCount = 0;

        for (const row of data || []) {
          // Count by dimension (new)
          const dimensions = row.applicable_dimensions as KnowledgeDimensionName[] | undefined;
          if (dimensions && dimensions.length > 0) {
            for (const dim of dimensions) {
              byDimension[dim] = (byDimension[dim] || 0) + 1;
            }
          }

          // Count by category (legacy)
          const category = row.category as TopicCategory | undefined;
          if (category) {
            byCategory[category] = (byCategory[category] || 0) + 1;
          }

          const status = row.status as KnowledgeStatus;
          byStatus[status] = (byStatus[status] || 0) + 1;

          const source = row.source as { platform?: SourcePlatform };
          if (source?.platform) {
            byPlatform[source.platform] = (byPlatform[source.platform] || 0) + 1;
          }

          const relevance = row.relevance as { score?: number };
          if (relevance?.score !== undefined) {
            totalRelevanceScore += relevance.score;
            if (relevance.score >= 0.7) {
              highQualityCount++;
            }
          }
        }

        const totalItems = data?.length ?? 0;

        return ok({
          totalItems,
          byDimension,
          byCategory, // Legacy
          byStatus,
          byPlatform,
          avgRelevanceScore: totalItems > 0 ? totalRelevanceScore / totalItems : 0,
          highQualityCount,
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async update(
      id: string,
      updates: Partial<KnowledgeItem>
    ): Promise<Result<KnowledgeItem, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
        if (updates.content !== undefined) dbUpdates.content = updates.content;
        // New: dimension-based fields
        if (updates.applicableDimensions !== undefined) {
          dbUpdates.applicable_dimensions = updates.applicableDimensions;
        }
        if (updates.subCategories !== undefined) {
          dbUpdates.sub_categories = updates.subCategories;
        }
        // Legacy: category (kept for backward compatibility)
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.contentType !== undefined) dbUpdates.content_type = updates.contentType;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
        if (updates.source !== undefined) dbUpdates.source = updates.source;
        if (updates.relevance !== undefined) dbUpdates.relevance = updates.relevance;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.relatedItems !== undefined) dbUpdates.related_items = updates.relatedItems;
        if (updates.supersedes !== undefined) dbUpdates.supersedes = updates.supersedes;

        const { data, error } = await supabase
          .from('knowledge_items')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('knowledge_items', id, error.message));
        }

        return ok(toKnowledgeItem(data));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async updateStatus(
      id: string,
      status: KnowledgeItem['status']
    ): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('knowledge_items')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          return err(StorageError.writeFailed('knowledge_items', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('knowledge_items').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('knowledge_items', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async existsByUrl(url: string): Promise<Result<boolean, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { count, error } = await supabase
          .from('knowledge_items')
          .select('*', { count: 'exact', head: true })
          .eq('source->>url', url);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((count ?? 0) > 0);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findSimilar(
      title: string,
      _threshold: number = 0.7
    ): Promise<Result<KnowledgeItem[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('knowledge_items')
          .select('*')
          .ilike('title', `%${title}%`)
          .limit(10);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((data || []).map(toKnowledgeItem));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
