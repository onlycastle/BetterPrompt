/**
 * Knowledge Item Models
 *
 * Zod schemas for structured AI engineering knowledge items.
 */

import { z } from 'zod';

/**
 * Topic categories for AI engineering knowledge
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
]);
export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;

/**
 * Knowledge item source information
 */
export const KnowledgeSourceSchema = z.object({
  platform: SourcePlatformSchema,
  url: z.string().url(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  fetchedAt: z.string().datetime(),
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
  title: z.string().min(10).max(200),
  summary: z.string().min(50).max(1000),
  content: z.string().min(100).max(10000),

  // Classification
  category: TopicCategorySchema,
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
