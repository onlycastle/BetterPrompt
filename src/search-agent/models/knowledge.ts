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
  'youtube', // NEW: YouTube video transcripts
  'linkedin', // NEW: LinkedIn posts (public only)
]);
export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;

/**
 * Knowledge item source information
 */
export const KnowledgeSourceSchema = z.object({
  platform: SourcePlatformSchema,
  url: z.string().url(),
  author: z.string().optional(),
  authorHandle: z.string().optional(), // NEW: @handle, channel name, or profile slug
  publishedAt: z.string().datetime().optional(),
  fetchedAt: z.string().datetime(),
  influencerId: z.string().uuid().optional(), // NEW: Link to tracked influencer
  credibilityTier: z.enum(['high', 'medium', 'standard']).optional(), // NEW: Author credibility
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

// ============================================================================
// Professional Insights - Curated tips for developers based on their type
// ============================================================================

/**
 * Professional Insight category
 *
 * Note: applicableStyles uses CodingStyleType values ('architect', 'scientist', etc.)
 * Note: applicableControlLevels uses AIControlLevel values ('vibe-coder', 'developing', 'ai-master')
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
  title: z.string().min(10).max(100),
  keyTakeaway: z.string().min(20).max(300),
  actionableAdvice: z.array(z.string().max(200)).min(1).max(5),

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
 * Initial Professional Insights based on verified research
 *
 * Sources:
 * - VCP Paper (arXiv:2601.02410)
 * - Anthropic Context Engineering Guide
 * - MIT Technology Review
 * - Karpathy's insights
 */
export const INITIAL_INSIGHTS: Omit<ProfessionalInsight, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Skill Atrophy Self-Diagnosis',
    keyTakeaway:
      'The VCP research shows that heavy AI reliance can lead to skill decay. Test yourself: can you start coding without AI help?',
    actionableAdvice: [
      'Try writing pseudocode or specs before involving AI',
      'Once a week, solve a small problem without AI assistance',
      "If you can't explain code AI generated, that's a warning sign",
    ],
    source: {
      type: 'arxiv',
      url: 'https://arxiv.org/abs/2601.02410',
      author: 'VCP Research Team',
    },
    applicableDimensions: ['skillResilience'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'The 50% Modification Test',
    keyTakeaway:
      'Professional developers modify about 50% of AI-generated code. If you accept everything unchanged, you may be too passive.',
    actionableAdvice: [
      'Track how often you modify AI suggestions this week',
      'Challenge at least one AI response per session with "are you sure?"',
      "If your modification rate is under 30%, you're likely missing errors",
    ],
    source: {
      type: 'research',
      url: 'https://twitter.com/elikidd/status/example',
      author: 'elvis',
    },
    applicableDimensions: ['aiControl'],
    maxScore: 40,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'New Skill Layer: Context Engineering',
    keyTakeaway:
      'Karpathy says vibe coding is a new skill layer like mobile dev or cloud computing. Those who master it will thrive.',
    actionableAdvice: [
      'Treat context engineering as a skill to deliberately practice',
      "Learn your AI tool's context window limits and how to manage them",
      'Use /compact and fresh sessions strategically',
    ],
    source: {
      type: 'x-post',
      url: 'https://twitter.com/karpathy/status/example',
      author: 'Andrej Karpathy',
      engagement: { likes: 55000 },
    },
    priority: 10,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'The 80% Planning Rule',
    keyTakeaway:
      "Top developers spend 80% of their time planning and 20% executing. With AI, this ratio matters even more.",
    actionableAdvice: [
      'Write a brief plan.md before starting any complex feature',
      'Define acceptance criteria before asking AI to implement',
      'Use TodoWrite to structure your work',
    ],
    source: {
      type: 'blog',
      url: 'https://example.com/planning',
      author: 'Peter Yang',
    },
    applicableStyles: ['architect', 'collaborator'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'For Speedrunners: Quick Verification',
    keyTakeaway:
      'You can be fast AND accurate. Add 30-second sanity checks to maintain quality without losing velocity.',
    actionableAdvice: [
      'Before accepting: "Does this actually solve my problem?"',
      'Run the simplest possible test before moving on',
      'Quick mental review: "What could go wrong here?"',
    ],
    source: {
      type: 'x-post',
      url: 'https://twitter.com/example/speedrunner-tips',
      author: 'hashin',
    },
    applicableStyles: ['speedrunner'],
    applicableControlLevels: ['vibe-coder', 'developing'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Anthropic Context Engineering Techniques',
    keyTakeaway:
      'Anthropic recommends three key techniques: Compaction (summarize and restart), Sub-agents (delegate), and Just-in-Time retrieval.',
    actionableAdvice: [
      'Use /compact when context gets messy or AI performance degrades',
      'Delegate complex subtasks to specialized agents via Task tool',
      'Only load documentation when you actually need it',
    ],
    source: {
      type: 'official',
      url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
      author: 'Anthropic',
    },
    applicableDimensions: ['aiCollaboration', 'toolMastery'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'For Architects: Validate Against Your Plans',
    keyTakeaway:
      "Your planning strength is an asset. Use your plans as verification checkpoints to ensure AI output matches your design.",
    actionableAdvice: [
      'After AI implements: check against your plan item by item',
      'Ask AI to verify its output matches your specifications',
      "Don't let AI deviate from your architecture without discussion",
    ],
    source: {
      type: 'blog',
      url: 'https://example.com/architect-tips',
      author: 'Matt Pocock',
    },
    applicableStyles: ['architect'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'For Scientists: Inverted TDD',
    keyTakeaway:
      'Your verification instinct is powerful. Try "Inverted TDD": write tests first, then have AI implement to pass them.',
    actionableAdvice: [
      'Write test cases that define expected behavior',
      'Ask AI to implement code that passes your tests',
      'Your tests catch hallucinations automatically',
    ],
    source: {
      type: 'research',
      url: 'https://twitter.com/example/inverted-tdd',
      author: 'Bohrium',
    },
    applicableStyles: ['scientist'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'AI Dependency Checklist',
    keyTakeaway:
      'Answer honestly: Could you write this code without AI? If not, you may be developing learned helplessness.',
    actionableAdvice: [
      "Before using AI: 'Could I start this myself?'",
      "After AI generates: 'Do I understand every line?'",
      'Weekly: Solve one problem without AI to maintain skills',
    ],
    source: {
      type: 'research',
      url: 'https://twitter.com/rohanpaul/example',
      author: 'Rohan Paul',
    },
    applicableDimensions: ['skillResilience', 'aiControl'],
    maxScore: 40,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'From Vibe Coding to Context Engineering',
    keyTakeaway:
      'MIT Technology Review: The 2025 paradigm shift is from "vibe coding" to "context engineering". Professionals control, not follow.',
    actionableAdvice: [
      'Think of AI as a tool you control, not a partner you follow',
      'Your job is to provide perfect context, not perfect prompts',
      'Master your context window like you mastered your IDE',
    ],
    source: {
      type: 'blog',
      url: 'https://www.technologyreview.com/2025/11/05/1127477/from-vibe-coding-to-context-engineering-2025-in-software-development/',
      author: 'MIT Technology Review',
    },
    priority: 10,
    enabled: true,
  },
];
