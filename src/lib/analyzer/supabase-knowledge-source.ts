/**
 * Supabase Knowledge Source Adapter
 *
 * Implements KnowledgeSource interface using IKnowledgeRepository.
 * Bridges the gap between Supabase storage and the KnowledgeLinker.
 *
 * @module analyzer/supabase-knowledge-source
 */

import type { IKnowledgeRepository } from '../application/ports/storage';
import type { KnowledgeItem as DomainKnowledgeItem } from '../domain/models/index';

// Re-use types from knowledge-linker (avoid circular import)
import type { TopicCategory } from './dimension-keywords';

// ============================================
// Types
// ============================================

/**
 * Simplified KB item interface (matches knowledge-linker's internal type)
 */
export interface KnowledgeItem {
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
export interface ProfessionalInsight {
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
 * KnowledgeSource interface (matches knowledge-linker)
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
 * Configuration for SupabaseKnowledgeSource
 */
export interface SupabaseKnowledgeSourceConfig {
  repository: IKnowledgeRepository;
  cacheTTL?: number; // milliseconds, default 5 minutes
  fallbackToHardcoded?: boolean; // use hardcoded insights if Supabase fails
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// ============================================
// Default Professional Insights (Fallback)
// ============================================

const FALLBACK_PROFESSIONAL_INSIGHTS: ProfessionalInsight[] = [
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
  // Claude Code Best Practices (from ykdojo/claude-code-tips, Anthropic Engineering)
  {
    id: 'pi-011',
    title: 'Fresh Sessions Outperform Continued Context',
    keyTakeaway:
      'Starting new sessions often yields better results than continuing degraded context. Use /compact or restart when AI responses become incoherent.',
    actionableAdvice: [
      'Start fresh sessions for new distinct tasks',
      'Use /compact to summarize and clear when context degrades',
      'Recognize context exhaustion: repetitive errors, ignoring instructions',
    ],
    source: {
      type: 'blog',
      author: 'Claude Code Tips',
      url: 'https://github.com/ykdojo/claude-code-tips',
    },
    applicableDimensions: ['contextEngineering', 'iterationEfficiency'],
    maxScore: 60,
    priority: 9,
    enabled: true,
  },
  {
    id: 'pi-012',
    title: 'Task Decomposition: The A→A1→A2→A3→B Pattern',
    keyTakeaway:
      'Break complex tasks into numbered subtasks. Complete each subtask before moving to the next. This prevents scope creep and improves AI focus.',
    actionableAdvice: [
      'Decompose tasks: "First do A1, then A2, then A3, then B"',
      'Verify each subtask completion before proceeding',
      'Keep subtasks small enough to complete in 1-2 AI turns',
    ],
    source: {
      type: 'blog',
      author: 'Claude Code Tips',
      url: 'https://github.com/ykdojo/claude-code-tips',
    },
    applicableDimensions: ['scopeManagement', 'aiCollaboration'],
    priority: 8,
    enabled: true,
  },
  {
    id: 'pi-013',
    title: 'The Write-Test-Verify Cycle',
    keyTakeaway:
      'After AI generates code, always run tests before accepting. This catches hallucinations and ensures the code actually works.',
    actionableAdvice: [
      'Run "npm test" or equivalent after each significant change',
      'Ask AI to write tests first, then implement',
      'Never merge AI code without running the full test suite',
    ],
    source: {
      type: 'official',
      author: 'Anthropic Engineering',
      url: 'https://www.anthropic.com/engineering/claude-code-best-practices',
    },
    applicableDimensions: ['aiControl', 'skillResilience'],
    priority: 9,
    enabled: true,
  },
  {
    id: 'pi-014',
    title: 'Simple Agents Beat Complex Ones',
    keyTakeaway:
      'Research from Anthropic shows simple, well-prompted agents outperform complex multi-step frameworks. Invest in prompts, not orchestration complexity.',
    actionableAdvice: [
      'Start with the simplest agent architecture that works',
      'Add complexity only when simple approaches fail',
      'Prefer explicit instructions over implicit inference',
    ],
    source: {
      type: 'official',
      author: 'Anthropic Engineering',
      url: 'https://www.anthropic.com/engineering/building-effective-agents',
    },
    applicableDimensions: ['aiCollaboration', 'toolMastery'],
    minScore: 60,
    priority: 8,
    enabled: true,
  },
  {
    id: 'pi-015',
    title: 'Treat Context Like Memory Allocation',
    keyTakeaway:
      'Context window is like RAM - finite and precious. Loading unnecessary files or long chat history causes "context OOM". Be deliberate about what you load.',
    actionableAdvice: [
      'Only read files you actually need',
      'Use /compact before context becomes bloated',
      'Clear context when switching tasks',
    ],
    source: {
      type: 'official',
      author: 'Anthropic',
      url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
    },
    applicableDimensions: ['contextEngineering'],
    maxScore: 70,
    priority: 9,
    enabled: true,
  },
  {
    id: 'pi-016',
    title: 'Reduce System Prompt to Recover 10k+ Tokens',
    keyTakeaway:
      'Heavy system prompts (CLAUDE.md, MCP tools) can consume 10k+ tokens before you even start. Audit and trim for meaningful context gains.',
    actionableAdvice: [
      'Use /cost command to check token usage',
      'Remove redundant MCP servers from configuration',
      'Keep CLAUDE.md under 500 lines',
    ],
    source: {
      type: 'blog',
      author: 'Claude Code Tips',
      url: 'https://github.com/ykdojo/claude-code-tips',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery'],
    minScore: 70,
    priority: 8,
    enabled: true,
  },
];

// ============================================
// SupabaseKnowledgeSource Implementation
// ============================================

/**
 * Supabase-backed implementation of KnowledgeSource
 *
 * Features:
 * - In-memory caching with TTL
 * - Graceful fallback to hardcoded insights on error
 * - Type mapping from domain models to linker types
 */
export class SupabaseKnowledgeSource implements KnowledgeSource {
  private repository: IKnowledgeRepository;
  private cache: Map<string, CacheEntry<unknown>>;
  private cacheTTL: number;
  private fallbackToHardcoded: boolean;

  constructor(config: SupabaseKnowledgeSourceConfig) {
    this.repository = config.repository;
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL ?? 5 * 60 * 1000; // 5 minutes default
    this.fallbackToHardcoded = config.fallbackToHardcoded ?? true;
  }

  /**
   * Search knowledge items with advanced filtering
   */
  async searchAdvanced(options: {
    query?: string;
    category?: string;
    minScore?: number;
    limit?: number;
    sortBy?: 'relevance' | 'date' | 'score';
  }): Promise<KnowledgeItem[]> {
    const cacheKey = this.getCacheKey('search', options);
    const cached = this.getCached<KnowledgeItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use fullTextSearch if query provided, otherwise use search with filters
      const result = options.query
        ? await this.repository.fullTextSearch(
            options.query,
            {
              category: options.category as TopicCategory | undefined,
              minScore: options.minScore,
            },
            { limit: options.limit ?? 10 }
          )
        : await this.repository.search(
            {
              category: options.category as TopicCategory | undefined,
              minScore: options.minScore,
            },
            {
              pagination: { limit: options.limit ?? 10 },
              sort: this.mapSortOption(options.sortBy),
            }
          );

      if (!result.success) {
        console.warn('[SupabaseKnowledgeSource] Search failed:', result.error);
        return [];
      }

      const items = result.data.items.map(this.mapDomainToLinkerItem);
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.warn('[SupabaseKnowledgeSource] Search error:', error);
      return [];
    }
  }

  /**
   * Get professional insights
   * Falls back to hardcoded insights if Supabase fails
   */
  async getProfessionalInsights(): Promise<ProfessionalInsight[]> {
    const cacheKey = 'professional_insights';
    const cached = this.getCached<ProfessionalInsight[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // For now, return fallback insights
    // TODO: When professional_insights table is added to Supabase,
    // query from there instead
    if (this.fallbackToHardcoded) {
      this.setCache(cacheKey, FALLBACK_PROFESSIONAL_INSIGHTS);
      return FALLBACK_PROFESSIONAL_INSIGHTS;
    }

    return [];
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Map domain KnowledgeItem to linker's simplified format
   */
  private mapDomainToLinkerItem(item: DomainKnowledgeItem): KnowledgeItem {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      category: item.category,
      source: item.source
        ? {
            url: item.source.url,
            platform: item.source.platform,
            author: item.source.author,
          }
        : undefined,
      relevance: item.relevance
        ? {
            score: item.relevance.score,
          }
        : undefined,
    };
  }

  /**
   * Map sortBy option to QueryOptions sort format
   */
  private mapSortOption(
    sortBy?: 'relevance' | 'date' | 'score'
  ): { field: 'relevance' | 'createdAt' | 'title'; direction: 'asc' | 'desc' } | undefined {
    if (!sortBy) return undefined;

    switch (sortBy) {
      case 'relevance':
      case 'score':
        return { field: 'relevance', direction: 'desc' };
      case 'date':
        return { field: 'createdAt', direction: 'desc' };
      default:
        return undefined;
    }
  }

  /**
   * Generate cache key from search options
   */
  private getCacheKey(prefix: string, options: Record<string, unknown>): string {
    const sortedKeys = Object.keys(options).sort();
    const keyParts = sortedKeys.map((k) => `${k}:${options[k]}`);
    return `${prefix}:${keyParts.join(',')}`;
  }

  /**
   * Get cached value if not expired
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    // Clean up expired entry
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set cache with TTL
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTTL,
    });
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a SupabaseKnowledgeSource instance
 */
export function createSupabaseKnowledgeSource(
  repository: IKnowledgeRepository,
  options?: Partial<Omit<SupabaseKnowledgeSourceConfig, 'repository'>>
): SupabaseKnowledgeSource {
  return new SupabaseKnowledgeSource({
    repository,
    ...options,
  });
}
