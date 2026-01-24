/**
 * Knowledge Linker - Connects analysis dimensions to Knowledge Base items
 *
 * SIMPLIFIED: Now that Knowledge Items use applicableDimensions directly,
 * we can search by dimension without intermediate category mapping.
 *
 * Retrieves relevant KB items for each dimension based on:
 * - Score (strength vs growth area)
 * - Direct dimension matching (applicableDimensions)
 * - Keyword matching (subCategories)
 * - Professional Insights applicability
 */

import type { DimensionName, DimensionResult } from '../models/unified-report';
import {
  type InsightMode,
  type ResourceLevel,
  getKeywordConfig,
  getModeFromScore,
  getResourceLevel,
} from './dimension-keywords';

export type { InsightMode, ResourceLevel };

/**
 * @deprecated Category strings are no longer used for matching.
 * Kept for backwards compatibility with LinkedKnowledge interface.
 */
type TopicCategory = string;

// ============================================
// Constants
// ============================================

const MAX_INSIGHTS_PER_DIMENSION = 3;
const MAX_KNOWLEDGE_ITEMS = 5;
const MIN_RELEVANCE_SCORE = 0.5;
const DEFAULT_RELEVANCE_SCORE = 0.5;

/**
 * Represents a linked knowledge item for a dimension
 */
export interface LinkedKnowledge {
  id: string;
  title: string;
  summary: string;
  url?: string;
  category: TopicCategory;
  level: ResourceLevel;
  relevanceScore: number;
  source?: {
    platform: string;
    author?: string;
  };
}

/**
 * Represents a professional insight applicable to a dimension
 */
export interface LinkedInsight {
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  source: {
    type: string;
    author: string;
    url?: string;
  };
  priority: number;
}

/**
 * Result of knowledge retrieval for a dimension
 */
export interface DimensionKnowledge {
  dimension: DimensionName;
  mode: InsightMode;
  level: ResourceLevel;
  knowledgeItems: LinkedKnowledge[];
  professionalInsights: LinkedInsight[];
}

/**
 * Aggregated knowledge context for all dimensions
 */
export interface KnowledgeContext {
  reinforcements: DimensionKnowledge[];
  improvements: DimensionKnowledge[];
}

/**
 * Knowledge source interface for dependency injection
 */
export interface KnowledgeSource {
  searchAdvanced(options: {
    query?: string;
    category?: string;
    minScore?: number;
    limit?: number;
    sortBy?: 'relevance' | 'date' | 'score';
  }): Promise<KnowledgeItem[]>;

  getProfessionalInsights(): Promise<ProfessionalInsight[]>;
}

/**
 * Simplified KB item interface
 */
interface KnowledgeItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  source?: {
    url?: string;
    platform?: string;
    author?: string;
  };
  relevance?: {
    score: number;
  };
}

/**
 * Simplified Professional Insight interface
 */
interface ProfessionalInsight {
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  source: {
    type: string;
    author: string;
    url?: string;
  };
  applicableDimensions?: string[];
  minScore?: number;
  maxScore?: number;
  priority: number;
  enabled: boolean;
}

/**
 * Mock knowledge source for development/testing
 *
 * Returns empty arrays for all methods. For integration testing with real data,
 * use SupabaseKnowledgeSource with a test database.
 */
export class MockKnowledgeSource implements KnowledgeSource {
  async searchAdvanced(): Promise<KnowledgeItem[]> {
    return [];
  }

  async getProfessionalInsights(): Promise<ProfessionalInsight[]> {
    // Professional insights are now stored in the database.
    // For testing, inject a mock or use SupabaseKnowledgeSource with fallback.
    return [];
  }
}

/**
 * Professional Insights are now stored in the database
 *
 * @deprecated INITIAL_PROFESSIONAL_INSIGHTS has been removed.
 * Professional insights are now managed in the `professional_insights` database table.
 *
 * For the canonical seed data, see:
 * - supabase/migrations/018_seed_professional_insights.sql
 *
 * For fallback insights when database is unavailable, see:
 * - src/lib/analyzer/supabase-knowledge-source.ts (FALLBACK_PROFESSIONAL_INSIGHTS)
 */
// REMOVED: INITIAL_PROFESSIONAL_INSIGHTS constant - now in database

/**
 * KnowledgeLinker - Main class for dimension-KB integration
 */
export class KnowledgeLinker {
  private source: KnowledgeSource;

  constructor(source?: KnowledgeSource) {
    this.source = source ?? new MockKnowledgeSource();
  }

  /**
   * Find relevant knowledge for a specific dimension
   */
  async findRelevant(
    dimension: DimensionName,
    score: number
  ): Promise<DimensionKnowledge> {
    const mode = getModeFromScore(score);
    const level = getResourceLevel(score);
    const config = getKeywordConfig(dimension, mode);

    const [knowledgeItems, allInsights] = await Promise.all([
      this.searchKnowledge(config.searchQuery, config.level),
      this.source.getProfessionalInsights(),
    ]);

    const professionalInsights = this.filterInsights(allInsights, dimension, score);

    return {
      dimension,
      mode,
      level,
      knowledgeItems,
      professionalInsights,
    };
  }

  /**
   * Get knowledge context for all dimensions
   */
  async getKnowledgeForDimensions(
    dimensions: DimensionResult[]
  ): Promise<KnowledgeContext> {
    const results = await Promise.all(
      dimensions.map((dim) => this.findRelevant(dim.name, dim.score))
    );

    return {
      reinforcements: results.filter((r) => r.mode === 'reinforcement'),
      improvements: results.filter((r) => r.mode === 'improvement'),
    };
  }

  /**
   * Search KB for relevant items using query string
   */
  private async searchKnowledge(
    query: string,
    targetLevel: ResourceLevel
  ): Promise<LinkedKnowledge[]> {
    const items = await this.source.searchAdvanced({
      query,
      minScore: MIN_RELEVANCE_SCORE,
      limit: MAX_KNOWLEDGE_ITEMS,
      sortBy: 'relevance',
    });

    const linkedItems = items.map((item) =>
      this.toLinkedKnowledge(item, targetLevel)
    );

    return this.sortByRelevanceAndLimit(linkedItems, MAX_KNOWLEDGE_ITEMS);
  }

  /**
   * Convert a raw KB item to LinkedKnowledge format
   */
  private toLinkedKnowledge(
    item: KnowledgeItem,
    level: ResourceLevel
  ): LinkedKnowledge {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      url: item.source?.url,
      category: item.category as TopicCategory,
      level,
      relevanceScore: item.relevance?.score ?? DEFAULT_RELEVANCE_SCORE,
      source: item.source
        ? { platform: item.source.platform ?? 'unknown', author: item.source.author }
        : undefined,
    };
  }

  /**
   * Sort items by relevance score (descending) and limit results
   */
  private sortByRelevanceAndLimit<T extends { relevanceScore: number }>(
    items: T[],
    limit: number
  ): T[] {
    return items
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Filter professional insights for a dimension
   *
   * Matching is now purely database-driven:
   * - applicableDimensions: which dimensions the insight applies to
   * - minScore/maxScore: score range for applicability
   * - priority: higher priority insights are shown first
   */
  private filterInsights(
    insights: ProfessionalInsight[],
    dimension: DimensionName,
    score: number
  ): LinkedInsight[] {
    const applicableInsights = insights.filter((insight) =>
      this.isInsightApplicable(insight, dimension, score)
    );

    // Sort by priority (descending) and take top N
    const sortedInsights = [...applicableInsights].sort(
      (a, b) => b.priority - a.priority
    );

    return sortedInsights
      .slice(0, MAX_INSIGHTS_PER_DIMENSION)
      .map((insight) => this.toLinkedInsight(insight));
  }

  /**
   * Check if an insight is applicable to the given dimension and score
   *
   * Uses database fields only:
   * - enabled: must be true
   * - applicableDimensions: must include dimension (or be empty for "all")
   * - minScore/maxScore: score must be within range
   */
  private isInsightApplicable(
    insight: ProfessionalInsight,
    dimension: DimensionName,
    score: number
  ): boolean {
    if (!insight.enabled) return false;

    const matchesDimension =
      !insight.applicableDimensions ||
      insight.applicableDimensions.length === 0 ||
      insight.applicableDimensions.includes(dimension);

    const withinMinScore = insight.minScore === undefined || score >= insight.minScore;
    const withinMaxScore = insight.maxScore === undefined || score <= insight.maxScore;
    const withinScoreRange = withinMinScore && withinMaxScore;

    return matchesDimension && withinScoreRange;
  }

  /**
   * Convert a ProfessionalInsight to LinkedInsight format
   */
  private toLinkedInsight(insight: ProfessionalInsight): LinkedInsight {
    return {
      id: insight.id,
      title: insight.title,
      keyTakeaway: insight.keyTakeaway,
      actionableAdvice: insight.actionableAdvice,
      source: insight.source,
      priority: insight.priority,
    };
  }
}

/**
 * Create a KnowledgeLinker with optional custom source
 */
export function createKnowledgeLinker(source?: KnowledgeSource): KnowledgeLinker {
  return new KnowledgeLinker(source);
}

// Re-export SupabaseKnowledgeSource for convenience
export {
  SupabaseKnowledgeSource,
  createSupabaseKnowledgeSource,
  type SupabaseKnowledgeSourceConfig,
} from './supabase-knowledge-source';
