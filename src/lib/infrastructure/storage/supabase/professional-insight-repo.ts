/**
 * Supabase Professional Insight Repository
 *
 * Implements IProfessionalInsightRepository using Supabase.
 * Manages curated professional insights for developer recommendations.
 *
 * @module infrastructure/storage/supabase/professional-insight-repo
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
  IProfessionalInsightRepository,
  ProfessionalInsightFilters,
  PaginatedResult,
  QueryOptions,
} from '../../../application/ports/storage';
import type {
  ProfessionalInsight,
  InsightCategory,
  InsightSourceType,
  KnowledgeDimensionName,
} from '../../../domain/models/index';

// ============================================================================
// Type Mappers
// ============================================================================

/**
 * Database row type for professional_insights table
 */
interface ProfessionalInsightRow {
  id: string;
  version: string;
  category: InsightCategory;
  title: string;
  key_takeaway: string;
  actionable_advice: string[];
  source: {
    type: InsightSourceType;
    url: string;
    author: string;
    engagement?: {
      likes?: number;
      bookmarks?: number;
      retweets?: number;
    };
    verifiedAt?: string;
  };
  applicable_styles: string[];
  applicable_control_levels: string[];
  applicable_dimensions: string[];
  min_score: number | null;
  max_score: number | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to domain ProfessionalInsight
 */
function toProfessionalInsight(row: ProfessionalInsightRow): ProfessionalInsight {
  return {
    id: row.id,
    version: row.version as '1.0.0',
    category: row.category,
    title: row.title,
    keyTakeaway: row.key_takeaway,
    actionableAdvice: row.actionable_advice,
    source: row.source,
    applicableStyles: row.applicable_styles.length > 0 ? row.applicable_styles : undefined,
    applicableControlLevels:
      row.applicable_control_levels.length > 0 ? row.applicable_control_levels : undefined,
    applicableDimensions:
      row.applicable_dimensions.length > 0 ? row.applicable_dimensions : undefined,
    minScore: row.min_score ?? undefined,
    maxScore: row.max_score ?? undefined,
    priority: row.priority,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert domain ProfessionalInsight to database row
 */
function toDbRow(insight: ProfessionalInsight): Record<string, unknown> {
  return {
    id: insight.id,
    version: insight.version,
    category: insight.category,
    title: insight.title,
    key_takeaway: insight.keyTakeaway,
    actionable_advice: insight.actionableAdvice,
    source: insight.source,
    applicable_styles: insight.applicableStyles || [],
    applicable_control_levels: insight.applicableControlLevels || [],
    applicable_dimensions: insight.applicableDimensions || [],
    min_score: insight.minScore ?? null,
    max_score: insight.maxScore ?? null,
    priority: insight.priority,
    enabled: insight.enabled,
    created_at: insight.createdAt,
    updated_at: insight.updatedAt,
  };
}

/**
 * Map sort field to database column
 */
function getSortColumn(field?: 'priority' | 'createdAt' | 'title'): string {
  switch (field) {
    case 'priority':
      return 'priority';
    case 'title':
      return 'title';
    default:
      return 'created_at';
  }
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Create a Supabase-backed professional insight repository
 */
export function createSupabaseProfessionalInsightRepository(): IProfessionalInsightRepository {
  return {
    async findEnabled(): Promise<Result<ProfessionalInsight[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('professional_insights')
          .select('*')
          .eq('enabled', true)
          .order('priority', { ascending: false });

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((data || []).map((row) => toProfessionalInsight(row as ProfessionalInsightRow)));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findApplicable(
      dimension: KnowledgeDimensionName,
      score: number
    ): Promise<Result<ProfessionalInsight[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        // Build query to find applicable insights:
        // 1. Must be enabled
        // 2. Either no applicable_dimensions, or includes this dimension
        // 3. Score must be within min/max range if specified
        const { data, error } = await supabase
          .from('professional_insights')
          .select('*')
          .eq('enabled', true)
          .or(`applicable_dimensions.cs.{},applicable_dimensions.cs.{${dimension}}`)
          .order('priority', { ascending: false });

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        // Filter by score range in memory (more complex logic than SQL can handle)
        const filtered = (data || [])
          .map((row) => toProfessionalInsight(row as ProfessionalInsightRow))
          .filter((insight) => {
            const meetsMinScore = insight.minScore === undefined || score >= insight.minScore;
            const meetsMaxScore = insight.maxScore === undefined || score <= insight.maxScore;
            return meetsMinScore && meetsMaxScore;
          });

        return ok(filtered);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findWithFilters(
      filters: ProfessionalInsightFilters,
      options?: QueryOptions<'priority' | 'createdAt' | 'title'>
    ): Promise<Result<PaginatedResult<ProfessionalInsight>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options?.pagination);

        let query = supabase.from('professional_insights').select('*', { count: 'exact' });

        // Apply filters
        if (filters.enabledOnly !== false) {
          query = query.eq('enabled', true);
        }
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        if (filters.dimension) {
          query = query.contains('applicable_dimensions', [filters.dimension]);
        }
        if (filters.dimensions && filters.dimensions.length > 0) {
          query = query.overlaps('applicable_dimensions', filters.dimensions);
        }
        if (filters.style) {
          query = query.contains('applicable_styles', [filters.style]);
        }
        if (filters.controlLevel) {
          query = query.contains('applicable_control_levels', [filters.controlLevel]);
        }

        // Apply sorting and pagination
        const sortField = getSortColumn(options?.sort?.field);
        const ascending = options?.sort?.direction === 'asc';
        query = query.order(sortField, { ascending }).range(offset, end);

        const { data, error, count } = await query;

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        // Filter by score range in memory if needed
        let items = (data || []).map((row) =>
          toProfessionalInsight(row as ProfessionalInsightRow)
        );

        if (filters.minScore !== undefined || filters.maxScore !== undefined) {
          items = items.filter((insight) => {
            const score = filters.minScore ?? filters.maxScore ?? 50;
            const meetsMinScore = insight.minScore === undefined || score >= insight.minScore;
            const meetsMaxScore = insight.maxScore === undefined || score <= insight.maxScore;
            return meetsMinScore && meetsMaxScore;
          });
        }

        return ok({
          items,
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findById(id: string): Promise<Result<ProfessionalInsight | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('professional_insights')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('professional_insights', id, error.message));
        }

        return ok(toProfessionalInsight(data as ProfessionalInsightRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async save(insight: ProfessionalInsight): Promise<Result<ProfessionalInsight, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('professional_insights')
          .upsert(toDbRow(insight))
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('professional_insights', insight.id, error.message));
        }

        return ok(toProfessionalInsight(data as ProfessionalInsightRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async saveBatch(
      insights: ProfessionalInsight[]
    ): Promise<Result<ProfessionalInsight[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('professional_insights')
          .upsert(insights.map(toDbRow))
          .select();

        if (error) {
          return err(StorageError.writeFailed('professional_insights', 'batch', error.message));
        }

        return ok(
          (data || []).map((row) => toProfessionalInsight(row as ProfessionalInsightRow))
        );
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async update(
      id: string,
      updates: Partial<ProfessionalInsight>
    ): Promise<Result<ProfessionalInsight, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.keyTakeaway !== undefined) dbUpdates.key_takeaway = updates.keyTakeaway;
        if (updates.actionableAdvice !== undefined)
          dbUpdates.actionable_advice = updates.actionableAdvice;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.source !== undefined) dbUpdates.source = updates.source;
        if (updates.applicableStyles !== undefined)
          dbUpdates.applicable_styles = updates.applicableStyles || [];
        if (updates.applicableControlLevels !== undefined)
          dbUpdates.applicable_control_levels = updates.applicableControlLevels || [];
        if (updates.applicableDimensions !== undefined)
          dbUpdates.applicable_dimensions = updates.applicableDimensions || [];
        if (updates.minScore !== undefined) dbUpdates.min_score = updates.minScore ?? null;
        if (updates.maxScore !== undefined) dbUpdates.max_score = updates.maxScore ?? null;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;

        const { data, error } = await supabase
          .from('professional_insights')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('professional_insights', id, error.message));
        }

        return ok(toProfessionalInsight(data as ProfessionalInsightRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async setEnabled(id: string, enabled: boolean): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('professional_insights')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          return err(StorageError.writeFailed('professional_insights', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('professional_insights').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('professional_insights', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async countByCategory(): Promise<Result<Record<string, number>, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('professional_insights')
          .select('category')
          .eq('enabled', true);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        const counts: Record<string, number> = {};
        for (const row of data || []) {
          const category = row.category as string;
          counts[category] = (counts[category] || 0) + 1;
        }

        return ok(counts);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
