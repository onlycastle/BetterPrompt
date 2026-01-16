/**
 * Discovery Queries
 *
 * Pre-defined search queries for discovering content from social platforms.
 */

import type { SourcePlatform } from '../../models/index';
import type { DiscoveryTopic } from '../../models/discovery';

/**
 * Search query definition
 */
export interface SearchQueryDef {
  query: string;
  topic: DiscoveryTopic;
  platform?: SourcePlatform; // If platform-specific
  priority: 'high' | 'medium' | 'low';
}

/**
 * Platform-specific search query templates
 * Use {term} placeholder for topic-specific terms
 */
export const PLATFORM_QUERY_TEMPLATES: Record<SourcePlatform, string[]> = {
  twitter: [
    '{term} site:x.com',
    '{term} site:twitter.com',
    '"{term}" from:karpathy',
    '"{term}" from:simonw',
    '"{term}" from:swyx',
    '#{term}',
  ],
  reddit: [
    '{term} site:reddit.com',
    '{term} site:reddit.com/r/LocalLLaMA',
    '{term} site:reddit.com/r/ClaudeAI',
    '{term} site:reddit.com/r/MachineLearning',
  ],
  youtube: [
    '{term} site:youtube.com',
    '{term} tutorial 2025',
    '{term} walkthrough',
  ],
  linkedin: [
    '{term} site:linkedin.com/posts',
    '{term} site:linkedin.com/pulse',
  ],
  threads: [
    '{term} site:threads.net',
  ],
  web: [
    '{term} best practices 2025',
    '{term} guide',
    '{term} tutorial',
  ],
  manual: [],
};

/**
 * Topic-specific search queries
 */
export const TOPIC_QUERIES: Record<DiscoveryTopic, SearchQueryDef[]> = {
  'context-engineering': [
    // High priority - core concepts
    { query: 'context engineering LLM', topic: 'context-engineering', priority: 'high' },
    { query: 'context window best practices', topic: 'context-engineering', priority: 'high' },
    { query: 'CLAUDE.md patterns', topic: 'context-engineering', priority: 'high' },
    { query: 'system prompt design', topic: 'context-engineering', priority: 'high' },

    // Medium priority - techniques
    { query: 'context optimization techniques', topic: 'context-engineering', priority: 'medium' },
    { query: 'long context management', topic: 'context-engineering', priority: 'medium' },
    { query: 'context injection patterns', topic: 'context-engineering', priority: 'medium' },
    { query: 'just-in-time context loading', topic: 'context-engineering', priority: 'medium' },

    // Low priority - tangential
    { query: 'context compaction LLM', topic: 'context-engineering', priority: 'low' },
    { query: 'context retrieval RAG', topic: 'context-engineering', priority: 'low' },
  ],

  'vibe-coding': [
    // High priority - Andrej Karpathy & core concept
    { query: 'vibe coding karpathy', topic: 'vibe-coding', priority: 'high' },
    { query: '"vibe coding"', topic: 'vibe-coding', priority: 'high' },
    { query: 'vibe-based development AI', topic: 'vibe-coding', priority: 'high' },
    { query: 'vibes coding AI', topic: 'vibe-coding', priority: 'high' },

    // Medium priority - related concepts
    { query: 'vibe engineering software', topic: 'vibe-coding', priority: 'medium' },
    { query: 'coding with vibes AI', topic: 'vibe-coding', priority: 'medium' },
    { query: 'AI-first development flow', topic: 'vibe-coding', priority: 'medium' },
    { query: 'letting AI drive coding', topic: 'vibe-coding', priority: 'medium' },

    // Low priority - adjacent
    { query: 'intuitive AI coding', topic: 'vibe-coding', priority: 'low' },
    { query: 'natural language coding', topic: 'vibe-coding', priority: 'low' },
  ],

  'claude-code': [
    // High priority - official and core
    { query: 'Claude Code tips', topic: 'claude-code', priority: 'high' },
    { query: 'Claude Code workflow', topic: 'claude-code', priority: 'high' },
    { query: 'Claude Code subagents', topic: 'claude-code', priority: 'high' },
    { query: 'Anthropic Claude Code', topic: 'claude-code', priority: 'high' },

    // Medium priority - features
    { query: 'Claude Code hooks', topic: 'claude-code', priority: 'medium' },
    { query: 'Claude Code slash commands', topic: 'claude-code', priority: 'medium' },
    { query: 'Claude Code MCP', topic: 'claude-code', priority: 'medium' },
    { query: 'Claude Code memory', topic: 'claude-code', priority: 'medium' },

    // Low priority - comparisons
    { query: 'Claude Code vs Cursor', topic: 'claude-code', priority: 'low' },
    { query: 'Claude Code vs Copilot', topic: 'claude-code', priority: 'low' },
  ],

  general: [
    // High priority - AI coding general
    { query: 'AI coding assistant workflow 2025', topic: 'general', priority: 'high' },
    { query: 'AI pair programming tips', topic: 'general', priority: 'high' },
    { query: 'LLM coding best practices', topic: 'general', priority: 'high' },

    // Medium priority
    { query: 'AI-first development', topic: 'general', priority: 'medium' },
    { query: 'agentic coding workflow', topic: 'general', priority: 'medium' },

    // Low priority
    { query: 'human AI collaboration coding', topic: 'general', priority: 'low' },
  ],
};

/**
 * Influencer-specific queries
 * Search for content from known influencers
 */
export const INFLUENCER_QUERIES = [
  // Andrej Karpathy
  { influencer: 'karpathy', queries: [
    'from:karpathy vibe coding',
    'from:karpathy context',
    'from:karpathy AI coding',
    'site:youtube.com/@AndrejKarpathy AI',
  ]},
  // Simon Willison
  { influencer: 'simonw', queries: [
    'from:simonw context engineering',
    'from:simonw prompt engineering',
    'from:simonw Claude',
    'site:simonwillison.net LLM',
  ]},
  // Swyx
  { influencer: 'swyx', queries: [
    'from:swyx AI engineering',
    'from:swyx context',
    'from:swyx smol',
  ]},
  // Harrison Chase
  { influencer: 'hwchase17', queries: [
    'from:hwchase17 agents',
    'from:hwchase17 context',
    'from:hwchase17 LangChain',
  ]},
  // Pieter Levels
  { influencer: 'levelsio', queries: [
    'from:levelsio vibe coding',
    'from:levelsio AI coding',
    'from:levelsio Claude',
  ]},
];

/**
 * Generate all search queries for a discovery session
 */
export function generateSearchQueries(options: {
  topics: DiscoveryTopic[];
  platforms: SourcePlatform[];
  includeInfluencerQueries?: boolean;
  priorityFilter?: ('high' | 'medium' | 'low')[];
}): string[] {
  const queries: Set<string> = new Set();
  const priorityFilter = options.priorityFilter || ['high', 'medium'];

  // Add topic-based queries
  for (const topic of options.topics) {
    const topicQueries = TOPIC_QUERIES[topic] || [];

    for (const queryDef of topicQueries) {
      if (!priorityFilter.includes(queryDef.priority)) continue;

      // Add base query
      queries.add(queryDef.query);

      // Add platform-specific variants
      for (const platform of options.platforms) {
        const templates = PLATFORM_QUERY_TEMPLATES[platform] || [];
        for (const template of templates.slice(0, 2)) {
          // Only first 2 templates to avoid explosion
          const platformQuery = template.replace('{term}', queryDef.query);
          queries.add(platformQuery);
        }
      }
    }
  }

  // Add influencer queries if requested
  if (options.includeInfluencerQueries) {
    for (const influencerGroup of INFLUENCER_QUERIES) {
      for (const query of influencerGroup.queries.slice(0, 2)) {
        // Limit per influencer
        queries.add(query);
      }
    }
  }

  return Array.from(queries);
}

/**
 * Get queries for a specific topic and priority
 */
export function getTopicQueries(
  topic: DiscoveryTopic,
  priority?: 'high' | 'medium' | 'low'
): SearchQueryDef[] {
  const queries = TOPIC_QUERIES[topic] || [];
  if (!priority) return queries;
  return queries.filter((q) => q.priority === priority);
}

/**
 * Estimate number of queries for a discovery session
 */
export function estimateQueryCount(options: {
  topics: DiscoveryTopic[];
  platforms: SourcePlatform[];
  includeInfluencerQueries?: boolean;
}): number {
  return generateSearchQueries({
    ...options,
    priorityFilter: ['high', 'medium'],
  }).length;
}
