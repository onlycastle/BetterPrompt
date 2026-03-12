/**
 * Knowledge Item Models
 *
 * Zod schemas for structured AI engineering knowledge items.
 */

import { z } from 'zod';

// ============================================================================
// Dimension Names (unified with domain/models/knowledge.ts)
// ============================================================================

/**
 * 6 Analysis Dimensions - shared between Professional Insights and Knowledge Items
 */
export const DimensionNameSchema = z.enum([
  'aiCollaboration',
  'contextEngineering',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
]);
export type DimensionName = z.infer<typeof DimensionNameSchema>;

/**
 * Topic categories for AI engineering knowledge
 * @deprecated Use DimensionName instead for new code
 */
export const TopicCategorySchema = z.enum([
  'context-engineering',
  'claude-code-skills',
  'subagents',
  'memory-management',
  'prompt-engineering',
  'tool-use',
  'workflow-automation',
  'best-practices',
  'other',
]);
export type TopicCategory = z.infer<typeof TopicCategorySchema>;

/**
 * Mapping from legacy TopicCategory to DimensionName
 */
export const TOPIC_TO_DIMENSION_MAP: Record<TopicCategory, DimensionName> = {
  'context-engineering': 'contextEngineering',
  'memory-management': 'contextEngineering',
  'prompt-engineering': 'aiCollaboration',
  'tool-use': 'aiCollaboration',
  subagents: 'aiCollaboration',
  'claude-code-skills': 'aiCollaboration',
  'workflow-automation': 'aiCollaboration',
  'best-practices': 'skillResilience',
  other: 'skillResilience',
};

/**
 * Content type classification
 */
export const ContentTypeSchema = z.enum([
  'technique', // A specific method or approach
  'pattern', // A reusable design pattern
  'tool', // A tool or utility
  'configuration', // Settings or config examples
  'insight', // Observation or learning
  'example', // Code or usage example
  'reference', // Documentation or spec
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Source platform for knowledge
 */
export const SourcePlatformSchema = z.enum([
  'reddit',
  'twitter',
  'threads',
  'web',
  'manual',
  'youtube',
  'linkedin',
]);
export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;

/**
 * Knowledge item source information
 */
export const KnowledgeSourceSchema = z.object({
  platform: SourcePlatformSchema,
  url: z.string().url(),
  author: z.string().optional(),
  authorHandle: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  fetchedAt: z.string().datetime(),
  influencerId: z.string().uuid().optional(),
  credibilityTier: z.enum(['high', 'medium', 'standard']).optional(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

/**
 * Relevance metadata for a knowledge item
 */
export const KnowledgeRelevanceSchema = z.object({
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
});
export type KnowledgeRelevance = z.infer<typeof KnowledgeRelevanceSchema>;

/**
 * Knowledge item status
 */
export const KnowledgeStatusSchema = z.enum([
  'draft',
  'reviewed',
  'approved',
  'archived',
]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

/**
 * Knowledge item - a single piece of curated knowledge
 */
export const KnowledgeItemSchema = z.object({
  id: z.string().uuid(),
  version: z.literal('1.0.0'),

  // Content
  title: z.string().min(10).max(3000),
  summary: z.string().min(50).max(1000),
  content: z.string().min(100).max(10000),

  // Classification (dimension-based)
  applicableDimensions: z.array(DimensionNameSchema).min(1).optional(),
  subCategories: z.record(DimensionNameSchema, z.array(z.string())).optional(),

  // Legacy classification (kept for DB compatibility)
  /** @deprecated Use applicableDimensions instead */
  category: TopicCategorySchema.optional(),

  contentType: ContentTypeSchema,
  tags: z.array(z.string()).min(1).max(10),

  // Source tracking
  source: KnowledgeSourceSchema,

  // Quality metrics
  relevance: KnowledgeRelevanceSchema,

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: KnowledgeStatusSchema,

  // Relationships
  relatedItems: z.array(z.string().uuid()).optional(),
  supersedes: z.string().uuid().optional(),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

/**
 * Knowledge collection - grouped items by category
 */
export const KnowledgeCollectionSchema = z.object({
  version: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  categories: z.record(TopicCategorySchema, z.array(z.string().uuid())),
  totalItems: z.number(),
});
export type KnowledgeCollection = z.infer<typeof KnowledgeCollectionSchema>;

/**
 * Default topic categories for searches
 */
export const DEFAULT_SEARCH_TOPICS: TopicCategory[] = [
  'context-engineering',
  'claude-code-skills',
  'subagents',
  'memory-management',
  'prompt-engineering',
  'tool-use',
  'workflow-automation',
  'best-practices',
];

/**
 * Topic display names for UI
 */
export const TOPIC_DISPLAY_NAMES: Record<TopicCategory, string> = {
  'context-engineering': 'Context Engineering',
  'claude-code-skills': 'Claude Code Skills',
  subagents: 'Subagents',
  'memory-management': 'Memory Management',
  'prompt-engineering': 'Prompt Engineering',
  'tool-use': 'Tool Use',
  'workflow-automation': 'Workflow Automation',
  'best-practices': 'Best Practices',
  other: 'Other',
};

// ============================================================================
// Professional Insights - Curated tips for developers based on their type
// ============================================================================

/**
 * Professional Insight category
 *
 * Note: applicableStyles uses CodingStyleType values ('architect', 'analyst', etc.)
 * Note: applicableControlLevels uses AIControlLevel values ('explorer', 'navigator', 'cartographer')
 */
export const InsightCategorySchema = z.enum([
  'diagnosis', // Help users understand their current state
  'trend', // Latest industry best practices
  'type-specific', // Advice for specific coding styles
  'tool', // Tool and workflow tips
]);
export type InsightCategory = z.infer<typeof InsightCategorySchema>;

/**
 * Professional Insight source type
 */
export const InsightSourceTypeSchema = z.enum([
  'x-post', // Twitter/X post
  'arxiv', // Academic paper
  'blog', // Blog post
  'research', // Research study
  'official', // Official documentation
]);
export type InsightSourceType = z.infer<typeof InsightSourceTypeSchema>;

/**
 * Professional Insight - A curated tip or recommendation for developers
 *
 * These are displayed to users based on their analysis results
 * to provide actionable improvement guidance.
 */
export const ProfessionalInsightSchema = z.object({
  id: z.string().uuid(),
  version: z.literal('1.0.0'),

  // Classification
  category: InsightCategorySchema,

  // Content
  title: z.string().min(10).max(3000),
  keyTakeaway: z.string().min(20).max(3000),
  actionableAdvice: z.array(z.string().max(3000)).min(1).max(5),

  // Source attribution
  source: z.object({
    type: InsightSourceTypeSchema,
    url: z.string().url(),
    author: z.string(),
    engagement: z
      .object({
        likes: z.number().optional(),
        bookmarks: z.number().optional(),
        retweets: z.number().optional(),
      })
      .optional(),
    verifiedAt: z.string().datetime().optional(),
  }),

  // Applicability - which users should see this insight
  applicableStyles: z.array(z.string()).optional(), // CodingStyleType[]
  applicableControlLevels: z.array(z.string()).optional(), // AIControlLevel[]
  applicableDimensions: z.array(z.string()).optional(), // Which dimension scores trigger this

  // Display conditions
  minScore: z.number().min(0).max(100).optional(), // Show only if dimension score >= this
  maxScore: z.number().min(0).max(100).optional(), // Show only if dimension score <= this

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  priority: z.number().min(1).max(10).default(5), // Higher = show first
  enabled: z.boolean().default(true),
});
export type ProfessionalInsight = z.infer<typeof ProfessionalInsightSchema>;

/**
 * Professional Insights are now stored in the database
 *
 * @deprecated This constant has been removed. Professional insights are now
 * managed by the local repository layer.
 *
 * To fetch insights programmatically, use the active repository layer.
 * ```typescript
 * import { createProfessionalInsightRepository } from '../application/...';
 * const repo = createProfessionalInsightRepository();
 * const result = await repo.findEnabled();
 * ```
 */
