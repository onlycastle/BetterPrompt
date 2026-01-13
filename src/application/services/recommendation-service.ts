/**
 * Recommendation Service
 *
 * Connects analysis results to relevant knowledge items.
 * Provides personalized recommendations based on developer profile.
 *
 * @module application/services/recommendation-service
 */

import { ok, type Result } from '../../lib/result.js';
import { StorageError } from '../../domain/errors/index.js';
import type { IKnowledgeRepository } from '../ports/storage.js';
import type { ILLMPort } from '../ports/llm.js';
import type {
  KnowledgeItem,
  Dimensions,
  TopicCategory,
  CodingStyleType,
} from '../../domain/models/index.js';
import type { FullAnalysisResult } from './analysis-service.js';

/**
 * Recommendation with relevance context
 */
export interface Recommendation {
  item: KnowledgeItem;
  relevance: {
    score: number;
    reason: string;
    matchedDimensions: string[];
  };
}

/**
 * Recommendation service dependencies
 */
export interface RecommendationServiceDeps {
  knowledgeRepo: IKnowledgeRepository;
  llm?: ILLMPort;
}

/**
 * Map coding style to relevant topic categories
 * Uses actual TopicCategory enum values
 */
const STYLE_TOPIC_MAP: Record<CodingStyleType, TopicCategory[]> = {
  architect: ['context-engineering', 'prompt-engineering', 'tool-use'],
  scientist: ['context-engineering', 'prompt-engineering', 'best-practices'],
  collaborator: ['context-engineering', 'prompt-engineering', 'tool-use'],
  speedrunner: ['tool-use', 'prompt-engineering', 'workflow-automation'],
  craftsman: ['best-practices', 'tool-use', 'workflow-automation'],
};

/**
 * Map dimension weaknesses to topic categories
 * Uses actual TopicCategory enum values
 */
const DIMENSION_TOPIC_MAP: Record<string, TopicCategory[]> = {
  aiCollaboration: ['context-engineering', 'prompt-engineering'],
  promptEngineering: ['prompt-engineering', 'context-engineering'],
  toolMastery: ['tool-use', 'workflow-automation'],
  aiControl: ['context-engineering', 'best-practices'],
  skillResilience: ['best-practices', 'tool-use'],
  burnoutRisk: ['workflow-automation', 'best-practices'],
};

/**
 * Create Recommendation Service
 */
export function createRecommendationService(deps: RecommendationServiceDeps) {
  const { knowledgeRepo, llm } = deps;

  return {
    /**
     * Get recommendations for an analysis result
     */
    async getForAnalysis(
      analysis: FullAnalysisResult,
      options?: { limit?: number }
    ): Promise<Recommendation[]> {
      const limit = options?.limit ?? 5;
      const recommendations: Recommendation[] = [];

      // 1. Identify weak dimensions (score < 70)
      const weakDimensions = this.identifyWeakDimensions(analysis.dimensions);

      // 2. Get relevant topic categories
      const relevantTopics = this.getRelevantTopics(
        analysis.typeResult.primaryType,
        weakDimensions
      );

      // 3. Search knowledge base for each topic
      const seenIds = new Set<string>();

      for (const topic of relevantTopics) {
        if (recommendations.length >= limit) break;

        const searchResult = await knowledgeRepo.search(
          { category: topic, status: 'approved', minScore: 0.7 },
          {
            pagination: { limit: 3 },
            sort: { field: 'relevance', direction: 'desc' },
          }
        );

        if (searchResult.success) {
          for (const item of searchResult.data.items) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);

            recommendations.push({
              item,
              relevance: {
                score: item.relevance.score,
                reason: this.generateReason(topic, analysis.typeResult.primaryType, weakDimensions),
                matchedDimensions: weakDimensions.filter(
                  (d) => DIMENSION_TOPIC_MAP[d]?.includes(topic)
                ),
              },
            });

            if (recommendations.length >= limit) break;
          }
        }
      }

      // 4. Sort by relevance score
      recommendations.sort((a, b) => b.relevance.score - a.relevance.score);

      return recommendations.slice(0, limit);
    },

    /**
     * Get recommendations as simple string list
     * (Compatible with analysis service)
     */
    async getForAnalysisSimple(analysis: FullAnalysisResult): Promise<string[]> {
      const recommendations = await this.getForAnalysis(analysis);
      return recommendations.map(
        (r) => `${r.item.title}: ${r.item.summary} (${r.relevance.reason})`
      );
    },

    /**
     * Get recommendations for a specific coding style
     */
    async getForStyle(
      style: CodingStyleType,
      options?: { limit?: number }
    ): Promise<Result<KnowledgeItem[], StorageError>> {
      const topics = STYLE_TOPIC_MAP[style] || [];
      const limit = options?.limit ?? 5;
      const items: KnowledgeItem[] = [];
      const seenIds = new Set<string>();

      for (const topic of topics) {
        if (items.length >= limit) break;

        const result = await knowledgeRepo.search(
          { category: topic, status: 'approved', minScore: 0.7 },
          { pagination: { limit: 3 }, sort: { field: 'relevance', direction: 'desc' } }
        );

        if (result.success) {
          for (const item of result.data.items) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              items.push(item);
              if (items.length >= limit) break;
            }
          }
        }
      }

      return ok(items);
    },

    /**
     * Get recommendations for weak dimensions
     */
    async getForWeakDimensions(
      dimensions: Dimensions,
      options?: { limit?: number }
    ): Promise<Result<Recommendation[], StorageError>> {
      const weakDimensions = this.identifyWeakDimensions(dimensions);
      const limit = options?.limit ?? 5;
      const recommendations: Recommendation[] = [];
      const seenIds = new Set<string>();

      for (const dimension of weakDimensions) {
        const topics = DIMENSION_TOPIC_MAP[dimension] || [];

        for (const topic of topics) {
          if (recommendations.length >= limit) break;

          const result = await knowledgeRepo.search(
            { category: topic, status: 'approved', minScore: 0.7 },
            { pagination: { limit: 2 } }
          );

          if (result.success) {
            for (const item of result.data.items) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                recommendations.push({
                  item,
                  relevance: {
                    score: item.relevance.score,
                    reason: `Helps improve ${dimension}`,
                    matchedDimensions: [dimension],
                  },
                });
              }
            }
          }
        }
      }

      return ok(recommendations.slice(0, limit));
    },

    /**
     * Generate personalized recommendations using LLM
     */
    async getPersonalized(
      analysis: FullAnalysisResult,
      knowledgeItems: KnowledgeItem[],
      options?: { limit?: number }
    ): Promise<Result<string[], StorageError>> {
      if (!llm || !llm.isAvailable()) {
        // Fallback to simple string recommendations
        return ok(await this.getForAnalysisSimple(analysis));
      }

      const result = await llm.generateRecommendations(
        {
          typeResult: analysis.typeResult,
          dimensions: analysis.dimensions,
        },
        knowledgeItems,
        { maxTokens: 1000 }
      );

      if (!result.success) {
        // Fallback to simple recommendations
        return ok(await this.getForAnalysisSimple(analysis));
      }

      return ok(result.data.data.slice(0, options?.limit ?? 5));
    },

    /**
     * Identify weak dimensions (score < 70)
     * Dimensions now have DimensionResult objects with score, level, reasoning
     */
    identifyWeakDimensions(dimensions: Dimensions): string[] {
      const weak: string[] = [];

      if (dimensions.aiCollaboration.score < 70) weak.push('aiCollaboration');
      if (dimensions.promptEngineering.score < 70) weak.push('promptEngineering');
      if (dimensions.toolMastery.score < 70) weak.push('toolMastery');
      if (dimensions.aiControl.score < 70) weak.push('aiControl');
      if (dimensions.skillResilience.score < 70) weak.push('skillResilience');
      if (dimensions.burnoutRisk.score > 60) weak.push('burnoutRisk'); // Higher = worse

      return weak;
    },

    /**
     * Get relevant topic categories based on style and weak dimensions
     */
    getRelevantTopics(
      style: CodingStyleType,
      weakDimensions: string[]
    ): TopicCategory[] {
      const topics = new Set<TopicCategory>();

      // Add topics for style
      for (const topic of STYLE_TOPIC_MAP[style] || []) {
        topics.add(topic);
      }

      // Add topics for weak dimensions
      for (const dim of weakDimensions) {
        for (const topic of DIMENSION_TOPIC_MAP[dim] || []) {
          topics.add(topic);
        }
      }

      return Array.from(topics);
    },

    /**
     * Generate recommendation reason
     */
    generateReason(
      topic: TopicCategory,
      style: CodingStyleType,
      weakDimensions: string[]
    ): string {
      const matchedDims = weakDimensions.filter((d) =>
        DIMENSION_TOPIC_MAP[d]?.includes(topic)
      );

      if (matchedDims.length > 0) {
        return `Addresses your ${matchedDims.join(', ')} improvement areas`;
      }

      if (STYLE_TOPIC_MAP[style]?.includes(topic)) {
        return `Relevant for ${style} coding style`;
      }

      return `Recommended for ${topic}`;
    },
  };
}

/**
 * Recommendation Service type
 */
export type RecommendationService = ReturnType<typeof createRecommendationService>;
