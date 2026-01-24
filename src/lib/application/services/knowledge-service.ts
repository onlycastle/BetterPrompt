/**
 * Knowledge Service
 *
 * Manages knowledge items: CRUD + learning pipeline.
 * Coordinates with LLM for content extraction and relevance scoring.
 *
 * @module application/services/knowledge-service
 */

import { randomUUID } from 'crypto';
import { ok, err, type Result } from '../../result';
import { SkillError, StorageError } from '../../domain/errors/index';
import type { IKnowledgeRepository, IInfluencerRepository, PaginatedResult } from '../ports/storage';
import type { ILLMPort } from '../ports/llm';
import type {
  KnowledgeItem,
  KnowledgeStats,
  KnowledgeFilters,
  TopicCategory,
  KnowledgeDimensionName,
  ContentType,
  SourcePlatform,
  KnowledgeStatus,
} from '../../domain/models/index';
import { TOPIC_TO_DIMENSION_MAP } from '../../domain/models/index';

/**
 * Knowledge service dependencies
 */
export interface KnowledgeServiceDeps {
  knowledgeRepo: IKnowledgeRepository;
  influencerRepo?: IInfluencerRepository;
  llm?: ILLMPort;
}

/**
 * Content extraction input
 */
export interface ContentInput {
  url: string;
  title?: string;
  content: string;
  platform?: SourcePlatform;
  author?: string;
}

/**
 * Create Knowledge Service
 */
export function createKnowledgeService(deps: KnowledgeServiceDeps) {
  const { knowledgeRepo, influencerRepo, llm } = deps;

  return {
    /**
     * Learn from content (full pipeline)
     */
    async learnFromContent(
      input: ContentInput
    ): Promise<Result<KnowledgeItem, SkillError | StorageError>> {
      // 1. Check if URL already exists
      const existsResult = await knowledgeRepo.existsByUrl(input.url);
      if (existsResult.success && existsResult.data) {
        return err(SkillError.executionFailed(
          'KnowledgeService',
          `Content already exists: ${input.url}`
        ));
      }

      // 2. Try to match influencer
      let influencerId: string | undefined;
      if (influencerRepo) {
        const matchResult = await influencerRepo.matchFromContent(input.url, input.author);
        if (matchResult.success && matchResult.data) {
          influencerId = matchResult.data.influencer.id;
          // Increment content count
          await influencerRepo.incrementContentCount(influencerId);
        }
      }

      // 3. Extract knowledge with LLM (if available)
      let extractedData: Partial<KnowledgeItem> = {};
      if (llm && llm.isAvailable()) {
        const extractResult = await llm.extractKnowledge(input.content, {
          url: input.url,
          platform: input.platform,
        });

        if (extractResult.success) {
          extractedData = extractResult.data.data;
        }
      }

      // 4. Score relevance
      let relevanceScore = 0.5; // Default score
      let relevanceConfidence = 0.5;
      let relevanceReasoning = 'Auto-scored based on content analysis';
      if (llm && llm.isAvailable()) {
        const scoreResult = await llm.scoreRelevance(input.content, [
          'Relevant to AI-assisted development or coding with AI',
          'Contains actionable insights or practical techniques',
          'Useful for improving developer-AI collaboration',
        ]);
        if (scoreResult.success) {
          relevanceScore = scoreResult.data.data.score;
          relevanceConfidence = scoreResult.data.data.confidence;
          relevanceReasoning = scoreResult.data.data.reasoning;
        }
      }

      // 5. Build knowledge item
      const now = new Date().toISOString();
      // Derive dimension from extracted category
      const category = (extractedData.category || 'other') as TopicCategory;
      const dimension = TOPIC_TO_DIMENSION_MAP[category];

      const item: KnowledgeItem = {
        id: randomUUID(),
        version: '1.0.0',
        title: extractedData.title || input.title || 'Untitled',
        summary: extractedData.summary || input.content.slice(0, 200) + '...',
        content: input.content,
        applicableDimensions: [dimension],
        category, // Legacy, kept for backward compatibility
        contentType: (extractedData.contentType as ContentType) || 'insight',
        tags: extractedData.tags || [],
        source: {
          url: input.url,
          platform: input.platform || 'web',
          author: input.author,
          influencerId,
          fetchedAt: now,
        },
        relevance: {
          score: relevanceScore,
          confidence: relevanceConfidence,
          reasoning: relevanceReasoning,
        },
        status: relevanceScore >= 0.7 ? 'approved' : 'draft',
        createdAt: now,
        updatedAt: now,
      };

      // 6. Save to repository
      const saveResult = await knowledgeRepo.save(item);
      if (!saveResult.success) {
        return err(saveResult.error);
      }

      return ok(saveResult.data);
    },

    /**
     * Search knowledge items
     */
    async search(
      filters: KnowledgeFilters,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      return knowledgeRepo.search(filters, {
        pagination: options,
        sort: { field: 'relevance', direction: 'desc' },
      });
    },

    /**
     * Full-text search
     */
    async textSearch(
      query: string,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      return knowledgeRepo.fullTextSearch(query, undefined, options);
    },

    /**
     * Get knowledge item by ID
     */
    async getById(id: string): Promise<Result<KnowledgeItem | null, StorageError>> {
      return knowledgeRepo.findById(id);
    },

    /**
     * Update knowledge item
     */
    async update(
      id: string,
      updates: Partial<KnowledgeItem>
    ): Promise<Result<KnowledgeItem, StorageError>> {
      return knowledgeRepo.update(id, updates);
    },

    /**
     * Update item status
     */
    async updateStatus(
      id: string,
      status: KnowledgeStatus
    ): Promise<Result<void, StorageError>> {
      return knowledgeRepo.updateStatus(id, status);
    },

    /**
     * Delete knowledge item
     */
    async delete(id: string): Promise<Result<void, StorageError>> {
      return knowledgeRepo.delete(id);
    },

    /**
     * Get knowledge base statistics
     */
    async getStats(): Promise<Result<KnowledgeStats, StorageError>> {
      return knowledgeRepo.getStats();
    },

    /**
     * Find items by category
     */
    async findByCategory(
      category: TopicCategory,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      return knowledgeRepo.search({ category }, { pagination: options });
    },

    /**
     * Find high-relevance items
     */
    async findHighRelevance(
      minScore: number = 0.8,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<PaginatedResult<KnowledgeItem>, StorageError>> {
      return knowledgeRepo.search(
        { minScore, status: 'approved' },
        { pagination: options, sort: { field: 'relevance', direction: 'desc' } }
      );
    },

    /**
     * Batch save items
     */
    async saveBatch(items: KnowledgeItem[]): Promise<Result<KnowledgeItem[], StorageError>> {
      return knowledgeRepo.saveBatch(items);
    },

    /**
     * Check if URL exists
     */
    async hasUrl(url: string): Promise<Result<boolean, StorageError>> {
      return knowledgeRepo.existsByUrl(url);
    },

    /**
     * Find similar items (for deduplication)
     */
    async findSimilar(title: string): Promise<Result<KnowledgeItem[], StorageError>> {
      return knowledgeRepo.findSimilar(title);
    },
  };
}

/**
 * Knowledge Service type
 */
export type KnowledgeService = ReturnType<typeof createKnowledgeService>;
