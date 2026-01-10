/**
 * Search Query Models
 *
 * Zod schemas for search queries and raw results.
 */

import { z } from 'zod';
import { TopicCategorySchema, SourcePlatformSchema } from './knowledge.js';

/**
 * Search query definition
 */
export const SearchQuerySchema = z.object({
  id: z.string().uuid(),

  // Query parameters
  terms: z.array(z.string()).min(1).max(10),
  category: TopicCategorySchema.optional(),
  platforms: z.array(SourcePlatformSchema).min(1),

  // Filters
  timeRange: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .optional(),
  minEngagement: z.number().min(0).optional(),
  language: z.string().default('en'),

  // Limits
  maxResults: z.number().min(1).max(100).default(20),

  // Metadata
  createdAt: z.string().datetime(),
  description: z.string().max(500).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Engagement metrics for a search result
 */
export const EngagementSchema = z.object({
  upvotes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  likes: z.number().optional(),
});
export type Engagement = z.infer<typeof EngagementSchema>;

/**
 * Raw search result before processing
 */
export const RawSearchResultSchema = z.object({
  platform: SourcePlatformSchema,
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  engagement: EngagementSchema.optional(),
  fetchedAt: z.string().datetime(),
});
export type RawSearchResult = z.infer<typeof RawSearchResultSchema>;

/**
 * Extracted metadata from content
 */
export const ExtractedMetadataSchema = z.object({
  mainTopic: z.string(),
  keyInsights: z.array(z.string()),
  codeSnippets: z.array(z.string()),
  referencedTools: z.array(z.string()),
});
export type ExtractedMetadata = z.infer<typeof ExtractedMetadataSchema>;

/**
 * Enhanced search result with LLM-extracted metadata
 */
export const EnhancedSearchResultSchema = RawSearchResultSchema.extend({
  extracted: ExtractedMetadataSchema,
});
export type EnhancedSearchResult = z.infer<typeof EnhancedSearchResultSchema>;

/**
 * Platform breakdown statistics
 */
export const PlatformBreakdownSchema = z.record(
  SourcePlatformSchema,
  z.number()
);
export type PlatformBreakdown = z.infer<typeof PlatformBreakdownSchema>;

/**
 * Search execution result
 */
export const SearchExecutionSchema = z.object({
  queryId: z.string().uuid(),
  executedAt: z.string().datetime(),
  results: z.array(RawSearchResultSchema),
  stats: z.object({
    totalFound: z.number(),
    platformBreakdown: PlatformBreakdownSchema,
    executionTimeMs: z.number(),
  }),
});
export type SearchExecution = z.infer<typeof SearchExecutionSchema>;

/**
 * Default search terms for AI engineering topics
 */
export const DEFAULT_SEARCH_TERMS: Record<string, string[]> = {
  'context-engineering': [
    'context engineering',
    'CLAUDE.md',
    'context window management',
    'context compaction',
  ],
  'claude-code-skills': [
    'Claude Code skills',
    'Claude Code hooks',
    'slash commands Claude',
    'Claude Code workflow',
  ],
  subagents: [
    'Claude subagent',
    'subagent orchestration',
    'multi-agent AI',
    'agent delegation',
  ],
  'memory-management': [
    'AI memory management',
    'agentic memory',
    'context persistence',
    'file system memory AI',
  ],
  'prompt-engineering': [
    'prompt engineering best practices',
    'structured prompts AI',
    'prompt templates',
  ],
  'tool-use': [
    'AI tool use',
    'function calling LLM',
    'tool integration AI',
  ],
  'workflow-automation': [
    'AI workflow automation',
    'agentic coding workflow',
    'developer AI automation',
  ],
  'best-practices': [
    'AI coding best practices',
    'LLM engineering tips',
    'AI collaboration techniques',
  ],
};
