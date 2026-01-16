/**
 * Knowledge Linker - Connects analysis dimensions to Knowledge Base items
 *
 * Retrieves relevant KB items for each dimension based on:
 * - Score (strength vs growth area)
 * - Keyword matching
 * - Category filtering
 * - Professional Insights applicability
 */

import type { DimensionName, DimensionResult } from '../models/unified-report';
import {
  type InsightMode,
  type TopicCategory,
  type ResourceLevel,
  getKeywordConfig,
  getModeFromScore,
  getResourceLevel,
} from './dimension-keywords';

export type { InsightMode, ResourceLevel };

// ============================================
// Constants
// ============================================

const MAX_INSIGHTS_PER_DIMENSION = 3;
const MAX_KNOWLEDGE_ITEMS = 5;
const MIN_RELEVANCE_SCORE = 0.5;
const DEFAULT_RELEVANCE_SCORE = 0.5;
const ITEMS_PER_CATEGORY = 3;

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
 */
export class MockKnowledgeSource implements KnowledgeSource {
  async searchAdvanced(): Promise<KnowledgeItem[]> {
    return [];
  }

  async getProfessionalInsights(): Promise<ProfessionalInsight[]> {
    return INITIAL_PROFESSIONAL_INSIGHTS;
  }
}

/**
 * Initial professional insights (hardcoded from KB documentation)
 */
const INITIAL_PROFESSIONAL_INSIGHTS: ProfessionalInsight[] = [
  {
    id: 'pi-001',
    title: 'Skill Atrophy Self-Diagnosis',
    keyTakeaway:
      'Monitor your ability to code without AI assistance. Regular "cold starts" help maintain fundamental skills.',
    actionableAdvice: [
      'Try coding a small feature without AI once a week',
      'Time yourself on basic tasks to track skill maintenance',
      'Review AI suggestions critically before accepting',
    ],
    source: {
      type: 'research',
      author: 'VCP Research Team',
      url: 'https://arxiv.org/abs/example',
    },
    applicableDimensions: ['skillResilience'],
    maxScore: 60,
    priority: 9,
    enabled: true,
  },
  {
    id: 'pi-002',
    title: 'The 50% Modification Test',
    keyTakeaway:
      'Professional developers typically modify about 50% of AI-generated code. Low modification rates may indicate over-reliance.',
    actionableAdvice: [
      'Track how much AI code you modify vs accept as-is',
      'Aim to understand every line before accepting',
      'Use AI output as a starting point, not final answer',
    ],
    source: {
      type: 'research',
      author: 'Industry Survey 2024',
    },
    applicableDimensions: ['aiControl'],
    maxScore: 50,
    priority: 8,
    enabled: true,
  },
  {
    id: 'pi-003',
    title: 'The 80% Planning Rule',
    keyTakeaway:
      'Spending 80% of time on planning and 20% on execution leads to better AI collaboration outcomes.',
    actionableAdvice: [
      'Write detailed specifications before starting',
      'Break complex tasks into small, testable pieces',
      'Plan validation criteria upfront',
    ],
    source: {
      type: 'blog',
      author: 'Simon Willison',
      url: 'https://simonwillison.net/',
    },
    applicableDimensions: ['aiCollaboration', 'contextEngineering'],
    priority: 7,
    enabled: true,
  },
  {
    id: 'pi-006',
    title: 'Anthropic Context Engineering Techniques',
    keyTakeaway:
      'Master compaction, sub-agents, and JIT context loading for optimal Claude interactions.',
    actionableAdvice: [
      'Use /compact to summarize long conversations',
      'Delegate specialized tasks to sub-agents',
      'Load context just-in-time, not all upfront',
    ],
    source: {
      type: 'official',
      author: 'Anthropic',
      url: 'https://docs.anthropic.com/',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery'],
    priority: 9,
    enabled: true,
  },
  {
    id: 'pi-007',
    title: 'For Architects: Validate Against Your Plans',
    keyTakeaway:
      'Always verify AI output against your original architectural vision and constraints.',
    actionableAdvice: [
      'Create verification checkpoints in your workflow',
      'Document architectural decisions before coding',
      'Review AI code for pattern consistency',
    ],
    source: {
      type: 'blog',
      author: 'Software Architecture Weekly',
    },
    applicableDimensions: ['aiControl'],
    priority: 6,
    enabled: true,
  },
  {
    id: 'pi-009',
    title: 'AI Dependency Checklist',
    keyTakeaway:
      'Regularly assess your AI dependency level to prevent learned helplessness.',
    actionableAdvice: [
      'Can you explain the code without re-reading it?',
      'Could you write this from scratch if needed?',
      'Do you understand WHY this solution works?',
    ],
    source: {
      type: 'research',
      author: 'Developer Productivity Research',
    },
    applicableDimensions: ['skillResilience', 'burnoutRisk'],
    maxScore: 50,
    priority: 8,
    enabled: true,
  },
  {
    id: 'pi-010',
    title: 'From Vibe Coding to Context Engineering',
    keyTakeaway:
      'Move beyond casual prompting to structured context engineering for professional results.',
    actionableAdvice: [
      'Learn the WRITE framework for context',
      'Structure prompts with clear sections',
      'Provide examples of desired output format',
    ],
    source: {
      type: 'blog',
      author: 'MIT Technology Review',
      url: 'https://www.technologyreview.com/',
    },
    applicableDimensions: ['contextEngineering'],
    maxScore: 70,
    priority: 7,
    enabled: true,
  },
];

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
      this.searchKnowledge(config.searchQuery, config.categories, config.level),
      this.source.getProfessionalInsights(),
    ]);

    const professionalInsights = this.filterInsights(
      allInsights,
      dimension,
      score,
      config.professionalInsightIds
    );

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
   * Search KB for relevant items across all specified categories
   */
  private async searchKnowledge(
    query: string,
    categories: TopicCategory[],
    targetLevel: ResourceLevel
  ): Promise<LinkedKnowledge[]> {
    const searchPromises = categories.map((category) =>
      this.source.searchAdvanced({
        query,
        category,
        minScore: MIN_RELEVANCE_SCORE,
        limit: ITEMS_PER_CATEGORY,
        sortBy: 'relevance',
      })
    );

    const itemsByCategory = await Promise.all(searchPromises);
    const allItems = itemsByCategory.flat();

    const linkedItems = allItems.map((item) =>
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
   */
  private filterInsights(
    insights: ProfessionalInsight[],
    dimension: DimensionName,
    score: number,
    preferredIds: string[]
  ): LinkedInsight[] {
    const applicableInsights = insights.filter((insight) =>
      this.isInsightApplicable(insight, dimension, score, preferredIds)
    );

    const sortedInsights = this.sortInsightsByPreferenceAndPriority(
      applicableInsights,
      preferredIds
    );

    return sortedInsights.slice(0, MAX_INSIGHTS_PER_DIMENSION).map((insight) => this.toLinkedInsight(insight));
  }

  /**
   * Check if an insight is applicable to the given dimension and score
   */
  private isInsightApplicable(
    insight: ProfessionalInsight,
    dimension: DimensionName,
    score: number,
    preferredIds: string[]
  ): boolean {
    if (!insight.enabled) return false;

    const matchesDimension =
      !insight.applicableDimensions ||
      insight.applicableDimensions.includes(dimension);

    const withinMinScore = insight.minScore === undefined || score >= insight.minScore;
    const withinMaxScore = insight.maxScore === undefined || score <= insight.maxScore;
    const withinScoreRange = withinMinScore && withinMaxScore;

    const isPreferred = preferredIds.includes(insight.id);

    return matchesDimension && (withinScoreRange || isPreferred);
  }

  /**
   * Sort insights: preferred first, then by priority (descending)
   */
  private sortInsightsByPreferenceAndPriority(
    insights: ProfessionalInsight[],
    preferredIds: string[]
  ): ProfessionalInsight[] {
    const preferredSet = new Set(preferredIds);
    return [...insights].sort((a, b) => {
      const aPreferred = preferredSet.has(a.id);
      const bPreferred = preferredSet.has(b.id);

      // Preferred items come first
      if (aPreferred !== bPreferred) return bPreferred ? 1 : -1;

      // Then sort by priority (descending)
      return b.priority - a.priority;
    });
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
