/**
 * Influencer Domain Models
 *
 * Zod schemas for tracking AI thought leaders and content creators.
 * Single source of truth for influencer-related types.
 *
 * @module domain/models/influencer
 */

import { z } from 'zod';
import { CredibilityTierSchema, type CredibilityTier } from './knowledge';

// Re-export CredibilityTier for convenience
export { CredibilityTierSchema, type CredibilityTier };

// ============================================================================
// Platform Types
// ============================================================================

/**
 * Platform types for influencer identifiers
 */
export const InfluencerPlatformSchema = z.enum([
  'twitter',
  'youtube',
  'linkedin',
  'github',
  'web',
  'reddit',
]);
export type InfluencerPlatform = z.infer<typeof InfluencerPlatformSchema>;

/**
 * Platform-specific identifier for an influencer
 */
export const PlatformIdentifierSchema = z.object({
  platform: InfluencerPlatformSchema,
  handle: z.string(), // @handle, channel ID, username
  profileUrl: z.string().url().optional(),
});
export type PlatformIdentifier = z.infer<typeof PlatformIdentifierSchema>;

// ============================================================================
// Influencer Schemas
// ============================================================================

/**
 * Tracked influencer
 */
export const InfluencerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(3000),
  description: z.string().max(500),
  credibilityTier: CredibilityTierSchema,

  // Platform identifiers (can have multiple)
  identifiers: z.array(PlatformIdentifierSchema).min(1),

  // Topics this influencer is known for
  expertiseTopics: z.array(z.string()).min(1).max(20),

  // Organization affiliation
  affiliation: z.string().optional(),

  // Metadata
  addedAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  lastContentAt: z.string().datetime().optional(),
  contentCount: z.number().default(0),

  // Active flag
  isActive: z.boolean().default(true),
});
export type Influencer = z.infer<typeof InfluencerSchema>;

/**
 * Influencer registry collection
 */
export const InfluencerRegistrySchema = z.object({
  version: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  influencers: z.array(InfluencerSchema),
});
export type InfluencerRegistry = z.infer<typeof InfluencerRegistrySchema>;

/**
 * Influencer match result (when detecting from content)
 */
export const InfluencerMatchSchema = z.object({
  influencer: InfluencerSchema,
  matchedOn: PlatformIdentifierSchema,
  confidence: z.number().min(0).max(1),
});
export type InfluencerMatch = z.infer<typeof InfluencerMatchSchema>;

/**
 * Candidate influencer discovered from content
 */
export const CandidateInfluencerSchema = z.object({
  name: z.string(),
  handle: z.string(),
  platform: InfluencerPlatformSchema,
  profileUrl: z.string().url().optional(),
  suggestedTier: CredibilityTierSchema,
  discoveredFrom: z.string().url(),
  discoveredAt: z.string().datetime(),
  mentionCount: z.number().default(1),
});
export type CandidateInfluencer = z.infer<typeof CandidateInfluencerSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to normalize handles for comparison
 */
export function normalizeHandle(handle: string): string {
  return handle.toLowerCase().replace(/^@/, '').trim();
}

/**
 * Helper to extract handle from URL
 */
export function extractHandleFromUrl(url: string, platform: InfluencerPlatform): string | null {
  const patterns: Record<InfluencerPlatform, RegExp[]> = {
    twitter: [/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/],
    youtube: [
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    ],
    linkedin: [
      /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/,
      /linkedin\.com\/company\/([a-zA-Z0-9_-]+)/,
    ],
    github: [/github\.com\/([a-zA-Z0-9_-]+)/],
    reddit: [
      /reddit\.com\/user\/([a-zA-Z0-9_-]+)/,
      /reddit\.com\/u\/([a-zA-Z0-9_-]+)/,
    ],
    web: [],
  };

  for (const pattern of patterns[platform] || []) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Detect platform from URL
 */
export function detectPlatformFromUrl(url: string): InfluencerPlatform | null {
  const platformPatterns: [InfluencerPlatform, RegExp][] = [
    ['twitter', /(?:twitter\.com|x\.com)/],
    ['youtube', /youtube\.com/],
    ['linkedin', /linkedin\.com/],
    ['github', /github\.com/],
    ['reddit', /reddit\.com/],
  ];

  for (const [platform, pattern] of platformPatterns) {
    if (pattern.test(url)) return platform;
  }

  return 'web';
}

// ============================================================================
// Default Influencers
// ============================================================================

/**
 * Default influencers for AI coding domain
 */
export const DEFAULT_INFLUENCERS: Omit<Influencer, 'id' | 'addedAt'>[] = [
  {
    name: 'Andrej Karpathy',
    description: 'AI researcher, former Tesla AI Director, OpenAI founding team member',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'karpathy' },
      { platform: 'youtube', handle: 'AndrejKarpathy' },
      { platform: 'github', handle: 'karpathy' },
    ],
    expertiseTopics: ['deep-learning', 'AI-engineering', 'vibe-coding', 'neural-networks'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Simon Willison',
    description: 'Creator of Datasette, Django co-creator, prolific AI blogger and tool builder',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'simonw' },
      { platform: 'github', handle: 'simonw' },
      { platform: 'web', handle: 'simonwillison.net' },
    ],
    expertiseTopics: ['prompt-engineering', 'LLM-tools', 'AI-ethics', 'context-engineering'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Harrison Chase',
    description: 'Co-founder and CEO of LangChain, AI agent architecture expert',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'hwchase17' },
      { platform: 'github', handle: 'hwchase17' },
    ],
    expertiseTopics: ['AI-agents', 'LangChain', 'orchestration', 'RAG'],
    affiliation: 'LangChain',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Swyx (Shawn Wang)',
    description: 'AI engineer, writer, and speaker. Known for smol-ai tools and AI engineering content',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'swyx' },
      { platform: 'github', handle: 'swyxio' },
    ],
    expertiseTopics: ['AI-engineering', 'smol-tools', 'developer-experience', 'prompt-engineering'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Pieter Levels',
    description: 'Indie hacker, vibe coding practitioner, creator of multiple AI-powered products',
    credibilityTier: 'medium',
    identifiers: [
      { platform: 'twitter', handle: 'levelsio' },
      { platform: 'web', handle: 'levels.io' },
    ],
    expertiseTopics: ['vibe-coding', 'indie-hacking', 'AI-products', 'rapid-prototyping'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Riley Goodside',
    description: 'Prompt engineering pioneer and researcher at Scale AI',
    credibilityTier: 'medium',
    identifiers: [{ platform: 'twitter', handle: 'goodside' }],
    expertiseTopics: ['prompt-engineering', 'jailbreaking', 'LLM-behaviors', 'prompt-injection'],
    affiliation: 'Scale AI',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Eugene Yan',
    description: 'Senior Applied Scientist at Amazon, writes about ML engineering and LLM patterns',
    credibilityTier: 'medium',
    identifiers: [
      { platform: 'twitter', handle: 'eugeneyan' },
      { platform: 'web', handle: 'eugeneyan.com' },
      { platform: 'github', handle: 'eugeneyan' },
    ],
    expertiseTopics: ['ML-engineering', 'LLM-patterns', 'production-ML', 'system-design'],
    affiliation: 'Amazon',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'McKay Wrigley',
    description: 'Creator of Chatbot UI and AI coding tools, focuses on developer productivity',
    credibilityTier: 'medium',
    identifiers: [
      { platform: 'twitter', handle: 'mckaywrigley' },
      { platform: 'github', handle: 'mckaywrigley' },
    ],
    expertiseTopics: ['AI-coding-tools', 'chatbot-UI', 'developer-productivity'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Addy Osmani',
    description:
      'Google Chrome engineering lead, distinguished between vibe coding and AI-assisted engineering',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'addyosmani' },
      { platform: 'github', handle: 'addyosmani' },
      { platform: 'web', handle: 'addyosmani.com' },
    ],
    expertiseTopics: [
      'AI-assisted-engineering',
      'vibe-coding-critique',
      'web-development',
      'developer-productivity',
    ],
    affiliation: 'Google',
    contentCount: 0,
    isActive: true,
  },
  {
    name: 'Drew Breunig',
    description: 'AI strategist, coined context poisoning/distraction/confusion concepts',
    credibilityTier: 'medium',
    identifiers: [
      { platform: 'twitter', handle: 'dbreunig' },
      { platform: 'web', handle: 'dbreunig.com' },
    ],
    expertiseTopics: ['context-engineering', 'AI-strategy', 'context-management'],
    affiliation: 'Independent',
    contentCount: 0,
    isActive: true,
  },
];
