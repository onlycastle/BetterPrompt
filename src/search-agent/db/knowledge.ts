/**
 * Knowledge Database Layer
 *
 * Supabase-based persistence for knowledge items.
 * Replaces the file-based KnowledgeStore.
 */

import { getSupabase } from '../../lib/supabase.js';
import type {
  KnowledgeItem,
  TopicCategory,
  SourcePlatform,
  KnowledgeStatus,
} from '../models/index.js';
import type { KnowledgeStats, QualityMetrics } from '../storage/knowledge-store.js';

/**
 * Query options for pagination and sorting
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'relevance_score' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filters for knowledge search
 */
export interface KnowledgeFilters {
  platform?: SourcePlatform;
  category?: TopicCategory;
  author?: string;
  influencerId?: string;
  minScore?: number;
  status?: KnowledgeStatus;
  query?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Transform database row to domain model
 */
function toKnowledgeItem(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: row.id as string,
    version: row.version as '1.0.0',
    title: row.title as string,
    summary: row.summary as string,
    content: row.content as string,
    category: row.category as TopicCategory,
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

/**
 * Transform domain model to database row
 */
function toDbRow(item: KnowledgeItem): Record<string, unknown> {
  return {
    id: item.id,
    version: item.version,
    title: item.title,
    summary: item.summary,
    content: item.content,
    category: item.category,
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

/**
 * Knowledge Database Operations
 */
export const knowledgeDb = {
  /**
   * Find a knowledge item by ID
   */
  async findById(id: string): Promise<KnowledgeItem | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toKnowledgeItem(data);
  },

  /**
   * Find a knowledge item by source URL
   */
  async findByUrl(url: string): Promise<KnowledgeItem | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('source->>url', url)
      .single();

    if (error || !data) return null;
    return toKnowledgeItem(data);
  },

  /**
   * Check if an item exists by URL
   */
  async hasItemByUrl(url: string): Promise<boolean> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('knowledge_items')
      .select('*', { count: 'exact', head: true })
      .eq('source->>url', url);

    if (error) return false;
    return (count ?? 0) > 0;
  },

  /**
   * Get all knowledge items (paginated)
   */
  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<KnowledgeItem>> {
    return this.search({}, options);
  },

  /**
   * Search knowledge items with filters
   */
  async search(
    filters: KnowledgeFilters,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<KnowledgeItem>> {
    const supabase = getSupabase();
    const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = options;

    let query = supabase.from('knowledge_items').select('*', { count: 'exact' });

    // Apply filters
    if (filters.platform) {
      query = query.eq('source->>platform', filters.platform);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.influencerId) {
      query = query.eq('source->>influencerId', filters.influencerId);
    }
    if (filters.minScore !== undefined) {
      query = query.gte('relevance->>score', filters.minScore.toString());
    }
    if (filters.author) {
      query = query.or(
        `source->>author.ilike.%${filters.author}%,source->>authorHandle.ilike.%${filters.author}%`
      );
    }
    if (filters.query) {
      // Use full-text search for query
      query = query.or(
        `title.ilike.%${filters.query}%,summary.ilike.%${filters.query}%,content.ilike.%${filters.query}%`
      );
    }

    // Sorting
    let orderColumn: string;
    switch (sortBy) {
      case 'relevance_score':
        orderColumn = 'relevance->>score';
        break;
      case 'title':
        orderColumn = 'title';
        break;
      default:
        orderColumn = 'created_at';
    }
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Knowledge search error:', error);
      throw new Error(`Failed to search knowledge items: ${error.message}`);
    }

    return {
      items: (data || []).map(toKnowledgeItem),
      total: count ?? 0,
      limit,
      offset,
    };
  },

  /**
   * Get items by category
   */
  async findByCategory(
    category: TopicCategory,
    options: QueryOptions = {}
  ): Promise<KnowledgeItem[]> {
    const result = await this.search({ category }, options);
    return result.items;
  },

  /**
   * Get items by platform
   */
  async findByPlatform(
    platform: SourcePlatform,
    options: QueryOptions = {}
  ): Promise<KnowledgeItem[]> {
    const result = await this.search({ platform }, options);
    return result.items;
  },

  /**
   * Get items by influencer
   */
  async findByInfluencer(
    influencerId: string,
    options: QueryOptions = {}
  ): Promise<KnowledgeItem[]> {
    const result = await this.search({ influencerId }, options);
    return result.items;
  },

  /**
   * Save a knowledge item (insert or update)
   */
  async save(item: KnowledgeItem): Promise<KnowledgeItem> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_items')
      .upsert(toDbRow(item))
      .select()
      .single();

    if (error) {
      console.error('Knowledge save error:', error);
      throw new Error(`Failed to save knowledge item: ${error.message}`);
    }

    return toKnowledgeItem(data);
  },

  /**
   * Delete a knowledge item
   */
  async delete(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const { error } = await supabase.from('knowledge_items').delete().eq('id', id);

    if (error) {
      console.error('Knowledge delete error:', error);
      return false;
    }
    return true;
  },

  /**
   * Count items with optional filters
   */
  async count(filters: KnowledgeFilters = {}): Promise<number> {
    const supabase = getSupabase();
    let query = supabase.from('knowledge_items').select('*', { count: 'exact', head: true });

    if (filters.platform) {
      query = query.eq('source->>platform', filters.platform);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Knowledge count error:', error);
      return 0;
    }
    return count ?? 0;
  },

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<KnowledgeStats> {
    const supabase = getSupabase();

    // Get all items for aggregation
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('category, status, source');

    if (error || !data) {
      return {
        totalItems: 0,
        byCategory: {},
        byStatus: {},
        byPlatform: {},
      };
    }

    const byCategory: Partial<Record<TopicCategory, number>> = {};
    const byStatus: Record<string, number> = {};
    const byPlatform: Partial<Record<SourcePlatform, number>> = {};

    for (const row of data) {
      // Category counts
      const category = row.category as TopicCategory;
      byCategory[category] = (byCategory[category] || 0) + 1;

      // Status counts
      const status = row.status as string;
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Platform counts
      const source = row.source as { platform?: SourcePlatform };
      if (source?.platform) {
        byPlatform[source.platform] = (byPlatform[source.platform] || 0) + 1;
      }
    }

    return {
      totalItems: data.length,
      byCategory,
      byStatus,
      byPlatform,
    };
  },

  /**
   * Get quality metrics for the knowledge base
   */
  async getQualityMetrics(): Promise<QualityMetrics> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('knowledge_items')
      .select('relevance, source, category, created_at');

    if (error || !data) {
      return {
        totalItems: 0,
        averageRelevanceScore: 0,
        highQualityCount: 0,
        influencerContentCount: 0,
        platformDistribution: {},
        categoryDistribution: {},
        recentItemsCount: 0,
      };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalScore = 0;
    let highQualityCount = 0;
    let influencerContentCount = 0;
    let recentItemsCount = 0;
    const platformDistribution: Partial<Record<SourcePlatform, number>> = {};
    const categoryDistribution: Partial<Record<TopicCategory, number>> = {};

    for (const row of data) {
      const relevance = row.relevance as { score?: number };
      const source = row.source as { platform?: SourcePlatform; influencerId?: string };
      const category = row.category as TopicCategory;
      const createdAt = new Date(row.created_at as string);

      // Score metrics
      const score = relevance?.score ?? 0;
      totalScore += score;
      if (score >= 0.7) highQualityCount++;

      // Influencer content
      if (source?.influencerId) influencerContentCount++;

      // Recent items
      if (createdAt >= sevenDaysAgo) recentItemsCount++;

      // Platform distribution
      if (source?.platform) {
        platformDistribution[source.platform] =
          (platformDistribution[source.platform] || 0) + 1;
      }

      // Category distribution
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
    }

    return {
      totalItems: data.length,
      averageRelevanceScore: data.length > 0 ? totalScore / data.length : 0,
      highQualityCount,
      influencerContentCount,
      platformDistribution,
      categoryDistribution,
      recentItemsCount,
    };
  },

  /**
   * List all items (compatibility method)
   * @deprecated Use findAll() instead
   */
  async listItems(): Promise<KnowledgeItem[]> {
    const result = await this.findAll({ limit: 10000 });
    return result.items;
  },

  /**
   * Search with legacy interface (compatibility method)
   * @deprecated Use search() instead
   */
  async searchAdvanced(options: {
    query?: string;
    platform?: SourcePlatform;
    category?: TopicCategory;
    author?: string;
    influencerId?: string;
    minScore?: number;
    status?: string;
    limit?: number;
    sortBy?: 'relevance' | 'date' | 'score';
  }): Promise<KnowledgeItem[]> {
    const sortBy =
      options.sortBy === 'date'
        ? 'created_at'
        : options.sortBy === 'score'
          ? 'relevance_score'
          : 'created_at';

    const result = await this.search(
      {
        query: options.query,
        platform: options.platform,
        category: options.category,
        author: options.author,
        influencerId: options.influencerId,
        minScore: options.minScore,
        status: options.status as KnowledgeStatus,
      },
      {
        limit: options.limit,
        sortBy,
        sortOrder: 'desc',
      }
    );

    return result.items;
  },
};

// Default export for convenience
export default knowledgeDb;
