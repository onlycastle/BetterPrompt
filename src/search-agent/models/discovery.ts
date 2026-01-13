/**
 * Discovery Models
 *
 * Zod schemas for influencer discovery and content collection from social media.
 */

import { z } from 'zod';
import {
  SourcePlatformSchema,
  CredibilityTierSchema,
  PlatformIdentifierSchema,
} from './index.js';

/**
 * Engagement metrics for discovered content
 */
export const EngagementMetricsSchema = z.object({
  likes: z.number().min(0).default(0),
  comments: z.number().min(0).default(0),
  shares: z.number().min(0).default(0), // retweets, reposts
  views: z.number().min(0).optional(),
  saves: z.number().min(0).optional(), // bookmarks
  engagementRate: z.number().min(0).max(100).optional(), // (likes+comments+shares)/views * 100
});
export type EngagementMetrics = z.infer<typeof EngagementMetricsSchema>;

/**
 * Author information extracted from content
 */
export const DiscoveredAuthorSchema = z.object({
  name: z.string().min(1),
  handle: z.string().min(1), // @handle, username
  profileUrl: z.string().url().optional(),
  followerCount: z.number().min(0).optional(),
  verified: z.boolean().optional(),
  bio: z.string().max(500).optional(),
});
export type DiscoveredAuthor = z.infer<typeof DiscoveredAuthorSchema>;

/**
 * Content discovered from social media search
 */
export const DiscoveredContentSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  platform: SourcePlatformSchema,

  // Author information
  author: DiscoveredAuthorSchema,

  // Engagement metrics
  engagement: EngagementMetricsSchema,

  // Content
  title: z.string().max(500).optional(), // Not all platforms have titles
  text: z.string().min(1).max(50000),
  publishedAt: z.string().datetime(),

  // Discovery metadata
  discoveryQuery: z.string(), // The search query that found this
  discoveryTopic: z.enum(['context-engineering', 'vibe-coding', 'claude-code', 'general']),
  fetchedAt: z.string().datetime(),

  // Detected topics/tags
  detectedTopics: z.array(z.string()).default([]),

  // Processing status
  processed: z.boolean().default(false),
  knowledgeItemId: z.string().uuid().optional(), // Link to created knowledge item
});
export type DiscoveredContent = z.infer<typeof DiscoveredContentSchema>;

/**
 * Candidate influencer identified from discovered content
 */
export const CandidateInfluencerSchema = z.object({
  // Identity
  name: z.string().min(1).max(100),
  handles: z.array(PlatformIdentifierSchema).min(1),

  // Content analysis
  contentCount: z.number().min(1), // Number of high-engagement posts found
  totalEngagement: z.number().min(0), // Sum of all engagement
  avgEngagement: z.number().min(0), // Average engagement per post

  // Topic analysis
  topTopics: z.array(z.string()).min(1).max(10),
  topicBreakdown: z.record(z.string(), z.number()), // topic -> percentage

  // Credibility assessment
  suggestedTier: CredibilityTierSchema,
  tierReasoning: z.string().max(500),

  // Sample content
  sampleUrls: z.array(z.string().url()).min(1).max(5),
  sampleTitles: z.array(z.string()).max(5),

  // Metadata
  discoveredAt: z.string().datetime(),
  lastContentAt: z.string().datetime(), // Most recent content date

  // Affiliation (if detected)
  affiliation: z.string().optional(),
});
export type CandidateInfluencer = z.infer<typeof CandidateInfluencerSchema>;

/**
 * Discovery session - tracks a content discovery run
 */
export const DiscoverySessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),

  // Configuration
  config: z.object({
    platforms: z.array(SourcePlatformSchema),
    topics: z.array(z.enum(['context-engineering', 'vibe-coding', 'claude-code', 'general'])),
    timeframeStart: z.string().datetime(),
    timeframeEnd: z.string().datetime(),
    minEngagement: EngagementMetricsSchema.partial(),
  }),

  // Results
  stats: z.object({
    queriesExecuted: z.number(),
    contentFound: z.number(),
    contentFiltered: z.number(), // Passed engagement threshold
    candidateInfluencers: z.number(),
    knowledgeItemsCreated: z.number(),
    errors: z.number(),
  }),

  // Status
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  error: z.string().optional(),
});
export type DiscoverySession = z.infer<typeof DiscoverySessionSchema>;

/**
 * Discovery result - aggregated results from a discovery session
 */
export const DiscoveryResultSchema = z.object({
  session: DiscoverySessionSchema,
  content: z.array(DiscoveredContentSchema),
  candidates: z.array(CandidateInfluencerSchema),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

/**
 * Platform-specific engagement thresholds for "top 10%" content
 */
export const ENGAGEMENT_THRESHOLDS: Record<
  string,
  { likes: number; comments: number; shares: number; views?: number }
> = {
  twitter: { likes: 500, comments: 50, shares: 100 },
  reddit: { likes: 500, comments: 100, shares: 0 }, // Reddit doesn't have shares
  youtube: { likes: 1000, comments: 100, shares: 0, views: 50000 },
  linkedin: { likes: 200, comments: 50, shares: 50 },
  threads: { likes: 200, comments: 30, shares: 50 },
  web: { likes: 0, comments: 0, shares: 0 }, // Web doesn't have engagement
};

/**
 * Discovery topic categories with search terms
 */
export const DISCOVERY_TOPICS = {
  'context-engineering': {
    displayName: 'Context Engineering',
    searchTerms: [
      'context engineering',
      'context window management',
      'CLAUDE.md',
      'system prompt design',
      'context optimization',
      'long context',
    ],
  },
  'vibe-coding': {
    displayName: 'Vibe Coding',
    searchTerms: [
      'vibe coding',
      'vibe-based coding',
      'vibes coding',
      'coding with vibes',
      'vibe engineering',
      'vibe-driven development',
    ],
  },
  'claude-code': {
    displayName: 'Claude Code',
    searchTerms: [
      'Claude Code',
      'claude code tips',
      'claude code workflow',
      'anthropic claude code',
      'claude subagents',
      'claude hooks',
    ],
  },
  general: {
    displayName: 'AI Coding',
    searchTerms: [
      'AI coding workflow',
      'AI pair programming',
      'LLM coding assistant',
      'AI-first development',
    ],
  },
} as const;

export type DiscoveryTopic = keyof typeof DISCOVERY_TOPICS;

/**
 * Helper to check if content meets engagement threshold
 */
export function meetsEngagementThreshold(
  metrics: EngagementMetrics,
  platform: string
): boolean {
  const threshold = ENGAGEMENT_THRESHOLDS[platform];
  if (!threshold) return true; // Unknown platform, accept all

  // Meet ANY threshold (OR logic for flexibility)
  return (
    metrics.likes >= threshold.likes ||
    metrics.comments >= threshold.comments ||
    metrics.shares >= threshold.shares ||
    (threshold.views !== undefined &&
      metrics.views !== undefined &&
      metrics.views >= threshold.views)
  );
}

/**
 * Calculate engagement score for ranking
 */
export function calculateEngagementScore(metrics: EngagementMetrics): number {
  // Weighted score: likes * 1 + comments * 3 + shares * 2 + views * 0.01
  const score =
    metrics.likes +
    metrics.comments * 3 +
    metrics.shares * 2 +
    (metrics.views ?? 0) * 0.01;

  return Math.round(score);
}

/**
 * Suggest credibility tier based on engagement patterns
 */
export function suggestCredibilityTier(
  avgEngagement: number,
  contentCount: number,
  followerCount?: number
): 'high' | 'medium' | 'standard' {
  // High tier: consistently high engagement across multiple posts
  if (avgEngagement >= 1000 && contentCount >= 3) {
    return 'high';
  }

  // Also high if very large following with decent engagement
  if (followerCount && followerCount >= 100000 && avgEngagement >= 500) {
    return 'high';
  }

  // Medium tier: moderate engagement or fewer posts
  if (avgEngagement >= 300 || (contentCount >= 5 && avgEngagement >= 200)) {
    return 'medium';
  }

  return 'standard';
}
