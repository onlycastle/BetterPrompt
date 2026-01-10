/**
 * Relevance Assessment Models
 *
 * Zod schemas for multi-dimension relevance scoring.
 */

import { z } from 'zod';
import { TopicCategorySchema } from './knowledge.js';

/**
 * Single relevance dimension score
 */
export const RelevanceDimensionSchema = z.object({
  score: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  reasoning: z.string().max(300),
});
export type RelevanceDimension = z.infer<typeof RelevanceDimensionSchema>;

/**
 * Recommendation action
 */
export const RecommendationSchema = z.enum(['accept', 'review', 'reject']);
export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Full relevance assessment with multi-dimension scoring
 */
export const RelevanceAssessmentSchema = z.object({
  // Core dimensions
  topicRelevance: RelevanceDimensionSchema.describe(
    'How relevant is this to AI engineering topics?'
  ),
  projectFit: RelevanceDimensionSchema.describe(
    'How applicable is this to NoMoreAISlop goals?'
  ),
  actionability: RelevanceDimensionSchema.describe(
    'Can this be turned into practical guidance?'
  ),
  novelty: RelevanceDimensionSchema.describe(
    'Does this provide new insights not already in our knowledge base?'
  ),
  credibility: RelevanceDimensionSchema.describe(
    'Is this from a credible source with demonstrated expertise?'
  ),

  // Aggregate score
  overallScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),

  // Decision
  recommendation: RecommendationSchema,
  reasoning: z.string().min(50).max(500),
});
export type RelevanceAssessment = z.infer<typeof RelevanceAssessmentSchema>;

/**
 * Judgment result for a search result
 */
export const JudgmentResultSchema = z.object({
  sourceUrl: z.string().url(),
  assessment: RelevanceAssessmentSchema,
  suggestedCategory: TopicCategorySchema,
  suggestedTags: z.array(z.string()),
  extractedInsights: z.array(z.string()).max(5),
  judgedAt: z.string().datetime(),
});
export type JudgmentResult = z.infer<typeof JudgmentResultSchema>;

/**
 * Batch judgment statistics
 */
export const JudgmentStatsSchema = z.object({
  totalJudged: z.number(),
  acceptRate: z.number().min(0).max(1),
  avgScore: z.number().min(0).max(1),
  categoryDistribution: z.record(TopicCategorySchema, z.number()),
});
export type JudgmentStats = z.infer<typeof JudgmentStatsSchema>;

/**
 * Default dimension weights for scoring
 */
export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  topicRelevance: 0.25,
  projectFit: 0.25,
  actionability: 0.2,
  novelty: 0.15,
  credibility: 0.15,
};

/**
 * Relevance thresholds for recommendations
 */
export const RELEVANCE_THRESHOLDS = {
  accept: 0.7, // Score >= 0.7 -> accept
  review: 0.4, // 0.4 <= score < 0.7 -> review
  reject: 0.0, // score < 0.4 -> reject
} as const;
