/**
 * Knowledge Domain Models
 *
 * Consolidated Zod schemas for knowledge items, professional insights,
 * and content categorization. Single source of truth for knowledge-related types.
 *
 * @module domain/models/knowledge
 */

import { z } from 'zod';

// ============================================================================
// Dimension Names (imported concept from unified-report.ts)
// ============================================================================

/**
 * 6 Analysis Dimensions - shared between Professional Insights and Knowledge Items
 * This creates alignment between what we measure and what we recommend.
 */
export const DimensionNameSchema = z.enum([
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
]);
export type DimensionName = z.infer<typeof DimensionNameSchema>;

// ============================================================================
// Topic & Content Classification (Legacy - kept for DB migration compatibility)
// ============================================================================

/**
 * Topic categories for AI engineering knowledge
 * @deprecated Use applicableDimensions + subCategories instead
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
  'youtube',
  'linkedin',
]);
export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;

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
 * Credibility tier for content sources
 */
export const CredibilityTierSchema = z.enum(['high', 'medium', 'standard']);
export type CredibilityTier = z.infer<typeof CredibilityTierSchema>;

// ============================================================================
// Knowledge Item Schemas
// ============================================================================

/**
 * Knowledge item source information
 */
export const KnowledgeSourceSchema = z.object({
  platform: SourcePlatformSchema,
  url: z.string().url(),
  author: z.string().optional(),
  authorHandle: z.string().optional(), // @handle, channel name, or profile slug
  publishedAt: z.string().datetime().optional(),
  fetchedAt: z.string().datetime(),
  influencerId: z.string().uuid().optional(), // Link to tracked influencer
  credibilityTier: CredibilityTierSchema.optional(), // Author credibility
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
 * Knowledge item - a single piece of curated knowledge
 *
 * Uses applicableDimensions + subCategories to align with Professional Insights:
 * - applicableDimensions: Which dimensions this knowledge helps with (min 1)
 * - subCategories: Keywords per dimension for search matching
 */
export const KnowledgeItemSchema = z.object({
  id: z.string().uuid(),
  version: z.literal('1.0.0'),

  // Content
  title: z.string().min(10).max(3000),
  summary: z.string().min(50).max(1000),
  content: z.string().min(100).max(10000),

  // Classification - NEW unified dimension system
  applicableDimensions: z.array(DimensionNameSchema).min(1),
  subCategories: z.record(DimensionNameSchema, z.array(z.string())).optional(),

  // Legacy classification (kept for migration, will be removed)
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
 * Knowledge collection - grouped items by dimension
 */
export const KnowledgeCollectionSchema = z.object({
  version: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  dimensions: z.record(DimensionNameSchema, z.array(z.string().uuid())),
  /** @deprecated Use dimensions instead */
  categories: z.record(TopicCategorySchema, z.array(z.string().uuid())).optional(),
  totalItems: z.number(),
});
export type KnowledgeCollection = z.infer<typeof KnowledgeCollectionSchema>;

/**
 * Knowledge statistics
 */
export interface KnowledgeStats {
  totalItems: number;
  byDimension: Partial<Record<DimensionName, number>>;
  /** @deprecated Use byDimension instead */
  byCategory?: Partial<Record<TopicCategory, number>>;
  byPlatform: Partial<Record<SourcePlatform, number>>;
  byStatus: Partial<Record<KnowledgeStatus, number>>;
  avgRelevanceScore: number;
  highQualityCount: number; // score >= 0.7
}

/**
 * Knowledge search filters
 */
export interface KnowledgeFilters {
  dimension?: DimensionName;
  dimensions?: DimensionName[]; // Search across multiple dimensions
  /** @deprecated Use dimension instead */
  category?: TopicCategory;
  platform?: SourcePlatform;
  status?: KnowledgeStatus;
  minScore?: number;
  author?: string;
  tags?: string[];
  query?: string; // Full-text search
}

// ============================================================================
// Professional Insights - Curated tips for developers
// ============================================================================

/**
 * Professional Insight category
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
    authorHandle: z.string().optional(), // @handle for X posts
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

// ============================================================================
// Constants
// ============================================================================

/**
 * Dimension display names for UI (unified with unified-report.ts)
 */
export const DIMENSION_DISPLAY_NAMES: Record<DimensionName, string> = {
  aiCollaboration: 'AI Collaboration Mastery',
  contextEngineering: 'Context Engineering',
  toolMastery: 'Tool Mastery',
  burnoutRisk: 'Burnout Risk',
  aiControl: 'AI Control Index',
  skillResilience: 'Skill Resilience',
};

/**
 * All dimension names for iteration
 */
export const ALL_DIMENSIONS: DimensionName[] = [
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
];

/**
 * Default topic categories for searches
 * @deprecated Use ALL_DIMENSIONS instead
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
 * @deprecated Use DIMENSION_DISPLAY_NAMES instead
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

/**
 * Mapping from legacy TopicCategory to DimensionName
 * Used during migration and for backward compatibility
 */
export const TOPIC_TO_DIMENSION_MAP: Record<TopicCategory, DimensionName> = {
  'context-engineering': 'contextEngineering',
  'memory-management': 'contextEngineering',
  'prompt-engineering': 'aiCollaboration',
  'tool-use': 'toolMastery',
  subagents: 'toolMastery',
  'claude-code-skills': 'toolMastery',
  'workflow-automation': 'toolMastery',
  'best-practices': 'skillResilience',
  other: 'skillResilience',
};

/**
 * Relevance score thresholds
 */
export const RELEVANCE_THRESHOLDS = {
  accept: 0.7, // Auto-accept if score >= this
  review: 0.4, // Needs review if score between this and accept
  reject: 0.4, // Auto-reject if score < this
} as const;

// ============================================================================
// Initial Professional Insights (DEPRECATED - now in database)
// ============================================================================

/**
 * Initial Professional Insights based on verified research
 *
 * @deprecated Professional insights are now stored in the `professional_insights`
 * database table. This constant is kept only as a reference for the seed migration.
 *
 * For accessing insights programmatically, use:
 * ```typescript
 * import { createSupabaseProfessionalInsightRepository } from '../infrastructure/storage/supabase/professional-insight-repo';
 * const repo = createSupabaseProfessionalInsightRepository();
 * const result = await repo.findEnabled();
 * ```
 *
 * See also:
 * - supabase/migrations/017_professional_insights.sql (schema)
 * - supabase/migrations/018_seed_professional_insights.sql (seed data)
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
    applicableControlLevels: ['explorer', 'navigator'],
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
  {
    version: '1.0.0',
    category: 'tool',
    title: 'The 50% Context Rule',
    keyTakeaway:
      'Research shows ~50% context window utilization is optimal. Above 70%, LLM performance degrades and hallucination risk increases.',
    actionableAdvice: [
      'Use /compact command when sessions get long',
      'Start fresh sessions for new tasks instead of continuing old ones',
      'Delegate to subagents to distribute context load',
      'Monitor your context usage - if AI responses degrade, context may be overloaded',
    ],
    source: {
      type: 'research',
      url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
      author: 'Anthropic Research',
    },
    applicableDimensions: ['contextEngineering'],
    maxScore: 60,
    priority: 9,
    enabled: true,
  },
  // ============================================================================
  // Anti-Patterns & Critical Thinking Insights (NEW)
  // ============================================================================
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Sunk Cost Fallacy in AI Prompting',
    keyTakeaway:
      'When AI fails repeatedly with the same approach, continuing to tweak the prompt is a sunk cost fallacy. Reset context and try a fundamentally different approach.',
    actionableAdvice: [
      'If the same error occurs 3+ times, reset context completely and start fresh',
      'Analyze error messages before retrying - understand what went wrong',
      "Don't let frustration drive your prompts - take a breath and rethink",
      "Recognize AI's limitations - some tasks may need a different tool or manual approach",
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/sunk-cost-fallacy',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['aiControl', 'skillResilience'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Trust but Verify: Critical Thinking in AI Collaboration',
    keyTakeaway:
      'Professional developers verify AI output before accepting. Passive acceptance leads to bugs, security issues, and skill atrophy.',
    actionableAdvice: [
      "Ask 'are you sure?' at least once per complex task",
      'Run tests before accepting AI-generated code',
      'Question AI assumptions - ask why it chose a particular approach',
      'Request alternatives for important decisions',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/trust-but-verify',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['aiControl', 'skillResilience'],
    priority: 9,
    enabled: true,
  },
  // ============================================================================
  // Additional Dimension Insights
  // ============================================================================
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Iteration Efficiency Assessment',
    keyTakeaway:
      'Efficient developers complete iteration cycles in 2-3 turns on average. More than 5 turns indicates unclear requirements or wrong approach.',
    actionableAdvice: [
      'Be specific about what to change before iterating',
      'Consider a new approach after 4+ turns',
      'Document successful patterns',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/iteration-efficiency',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['aiControl'],
    maxScore: 60,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Learning Velocity in AI-Assisted Development',
    keyTakeaway:
      'Top developers use AI as a learning accelerator, not a knowledge replacement. Ask "why" as often as "how".',
    actionableAdvice: [
      'After asking "how", ask "why this approach?"',
      'Record recurring patterns - they are learning opportunities',
      'Periodically implement without AI',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/learning-velocity',
      author: 'Educational Research',
    },
    applicableDimensions: ['skillResilience'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Scope Management for AI Collaboration',
    keyTakeaway:
      'Clear scope determines AI collaboration success. "Do only this" works better than "do this and that".',
    actionableAdvice: [
      'Request one task per prompt',
      "Don't add new tasks before completing current ones",
      'Use "first X, then Y" pattern',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/scope-management',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['aiCollaboration'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'Targeted Refinement vs Shotgun Debugging',
    keyTakeaway:
      'Telling AI "change only this part" yields more accurate edits. Requesting a full redo changes other parts too.',
    actionableAdvice: [
      'Specify exact location when requesting edits',
      '"Edit only this function" instead of "redo everything"',
      'Request multiple edits one at a time',
    ],
    source: {
      type: 'x-post',
      url: 'https://twitter.com/example/targeted-refinement',
      author: 'AI Engineering',
    },
    applicableDimensions: ['aiControl', 'aiCollaboration'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'The "Why" Question Test',
    keyTakeaway:
      'Count how many times you asked "why" in a session. Zero means no knowledge transfer is happening.',
    actionableAdvice: [
      'After receiving code, ask "why this approach?"',
      'When using a library, confirm "why this library?"',
      "Don't skip over parts you don't understand - ask questions",
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/why-question-test',
      author: 'Educational Research',
    },
    applicableDimensions: ['skillResilience'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
  // ============================================================================
  // Claude Code Best Practices (from ykdojo/claude-code-tips, Anthropic Engineering)
  // ============================================================================
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Fresh Sessions Outperform Continued Context',
    keyTakeaway:
      'Starting new sessions often yields better results than continuing degraded context. Use /compact or restart when AI responses become incoherent.',
    actionableAdvice: [
      'Start fresh sessions for new distinct tasks',
      'Use /compact to summarize and clear when context degrades',
      'Recognize context exhaustion: repetitive errors, ignoring instructions',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['contextEngineering'],
    maxScore: 60,
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Task Decomposition: The A→A1→A2→A3→B Pattern',
    keyTakeaway:
      'Break complex tasks into numbered subtasks. Complete each subtask before moving to the next. This prevents scope creep and improves AI focus.',
    actionableAdvice: [
      'Decompose tasks: "First do A1, then A2, then A3, then B"',
      'Verify each subtask completion before proceeding',
      'Keep subtasks small enough to complete in 1-2 AI turns',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['contextEngineering', 'aiCollaboration'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Keep MCP Servers Under 10 for Optimal Context',
    keyTakeaway:
      'Each MCP server consumes context window tokens. More than 10 servers can significantly degrade performance by reducing available context for actual work.',
    actionableAdvice: [
      'Audit your MCP configuration regularly',
      'Remove unused or rarely-used MCP servers',
      'Consolidate related functionality into fewer servers',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/affaan-m/everything-claude-code',
      author: 'Everything Claude Code',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Keep CLAUDE.md Minimal and Focused',
    keyTakeaway:
      'CLAUDE.md is loaded into every conversation. Bloated instructions waste context. Focus on project-specific rules, not general coding advice.',
    actionableAdvice: [
      'Include only project-specific conventions and rules',
      'Avoid generic coding best practices (Claude already knows them)',
      'Review and prune CLAUDE.md monthly',
      'Use .cursorrules or .windsurfrules for editor-specific config',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['contextEngineering'],
    minScore: 50,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'The Write-Test-Verify Cycle',
    keyTakeaway:
      'After AI generates code, always run tests before accepting. This catches hallucinations and ensures the code actually works.',
    actionableAdvice: [
      'Run "npm test" or equivalent after each significant change',
      'Ask AI to write tests first, then implement',
      'Never merge AI code without running the full test suite',
    ],
    source: {
      type: 'official',
      url: 'https://www.anthropic.com/engineering/claude-code-best-practices',
      author: 'Anthropic Engineering',
    },
    applicableDimensions: ['aiControl', 'skillResilience'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Cascade Pattern: Parallel AI Instances',
    keyTakeaway:
      'Run multiple Claude instances in parallel for independent tasks. One researches while another implements. Use terminal multiplexers like tmux.',
    actionableAdvice: [
      'Use tmux/screen to manage multiple Claude sessions',
      'Split independent tasks across parallel sessions',
      'Let one session research while another codes',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['toolMastery'],
    minScore: 70,
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Terminal Aliases Reduce Friction',
    keyTakeaway:
      'Create short aliases for common Claude commands. "cc" for "claude", "ccc" for "claude --continue". Small friction reductions compound.',
    actionableAdvice: [
      'Add "alias cc=claude" to your shell config',
      'Create "ccc" for --continue, "ccr" for --resume',
      'Document aliases in your personal notes for consistency',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['toolMastery'],
    priority: 6,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Simple Agents Beat Complex Ones',
    keyTakeaway:
      'Research from Anthropic shows simple, well-prompted agents outperform complex multi-step frameworks. Invest in prompts, not orchestration complexity.',
    actionableAdvice: [
      'Start with the simplest agent architecture that works',
      'Add complexity only when simple approaches fail',
      'Prefer explicit instructions over implicit inference',
    ],
    source: {
      type: 'official',
      url: 'https://www.anthropic.com/engineering/building-effective-agents',
      author: 'Anthropic Engineering',
    },
    applicableDimensions: ['aiCollaboration', 'toolMastery'],
    minScore: 60,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Treat Context Like Memory Allocation',
    keyTakeaway:
      'Context window is like RAM - finite and precious. Loading unnecessary files or long chat history causes "context OOM". Be deliberate about what you load.',
    actionableAdvice: [
      'Only read files you actually need',
      'Use /compact before context becomes bloated',
      'Clear context when switching tasks',
      'Monitor for signs of context exhaustion: repeated mistakes, forgotten instructions',
    ],
    source: {
      type: 'official',
      url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
      author: 'Anthropic',
    },
    applicableDimensions: ['contextEngineering'],
    maxScore: 70,
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Reduce System Prompt to Recover 10k+ Tokens',
    keyTakeaway:
      'Heavy system prompts (CLAUDE.md, MCP tools) can consume 10k+ tokens before you even start. Audit and trim for meaningful context gains.',
    actionableAdvice: [
      'Use /cost command to check token usage',
      'Remove redundant MCP servers from configuration',
      'Keep CLAUDE.md under 500 lines',
      'Prefer project-level over global CLAUDE.md rules',
    ],
    source: {
      type: 'blog',
      url: 'https://github.com/ykdojo/claude-code-tips',
      author: 'Claude Code Tips',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery'],
    minScore: 70,
    priority: 8,
    enabled: true,
  },
  // ============================================================================
  // Anthropic Research: AI Assistance Impact on Coding Skills (3 insights)
  // Source: https://www.anthropic.com/research/AI-assistance-coding-skills
  // ============================================================================
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'The 17% Comprehension Gap',
    keyTakeaway:
      'Anthropic research found that AI-assisted developers showed 17% lower comprehension of the code they produced compared to unassisted developers. Speed gains come at a hidden cost.',
    actionableAdvice: [
      'After AI generates code, explain it to yourself line-by-line before accepting',
      'Keep a "learning journal" of new patterns you encounter in AI-generated code',
      "If you can't explain a section, ask AI 'why this approach?' before moving on",
    ],
    source: {
      type: 'research',
      url: 'https://www.anthropic.com/research/AI-assistance-coding-skills',
      author: 'Anthropic Research',
    },
    applicableDimensions: ['aiControl', 'skillResilience'],
    priority: 10,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Debugging Skills Suffer Most',
    keyTakeaway:
      'Anthropic study showed debugging abilities declined more than other coding skills with AI assistance. Debugging requires understanding code deeply - exactly what passive acceptance undermines.',
    actionableAdvice: [
      'When bugs occur, attempt diagnosis yourself before asking AI',
      'Practice reading stack traces and error messages without AI interpretation',
      'Weekly challenge: debug one issue using only documentation and logs',
    ],
    source: {
      type: 'research',
      url: 'https://www.anthropic.com/research/AI-assistance-coding-skills',
      author: 'Anthropic Research',
    },
    applicableDimensions: ['skillResilience', 'aiControl'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Cognitive Effort is the Learning Mechanism',
    keyTakeaway:
      'The same struggle that AI eliminates is what builds lasting skill. Anthropic research suggests the discomfort of problem-solving is the mechanism of learning, not a bug to be optimized away.',
    actionableAdvice: [
      'Embrace productive struggle - 10-15 minutes of effort before asking AI',
      'Use AI as a tutor, not an answer machine: ask for hints, not solutions',
      'Treat easy AI wins as learning debt that needs repayment',
    ],
    source: {
      type: 'research',
      url: 'https://www.anthropic.com/research/AI-assistance-coding-skills',
      author: 'Anthropic Research',
    },
    applicableDimensions: ['skillResilience'],
    priority: 8,
    enabled: true,
  },
  // ============================================================================
  // Boris Cherny Thread: Claude Code Power Tips (7 insights)
  // Source: https://x.com/bcherny/status/2017742741636321619
  // Author: Boris Cherny (Anthropic Engineer)
  // ============================================================================
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Invest in CLAUDE.md: Let Claude Write Its Own Rules',
    keyTakeaway:
      'Boris Cherny recommends having Claude update its own CLAUDE.md when you give feedback. This creates a compounding improvement loop where Claude learns your preferences over time.',
    actionableAdvice: [
      'When you correct Claude, say "update CLAUDE.md with this preference"',
      'Include coding style, error handling patterns, and testing requirements',
      'Review CLAUDE.md monthly - remove outdated rules, keep what works',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery', 'aiControl'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Turn Repeated Tasks into Skills',
    keyTakeaway:
      'Use the /skill command to capture common workflows. This reduces context overhead and ensures consistent execution of repeated tasks.',
    actionableAdvice: [
      'Identify tasks you do repeatedly (commit, deploy, test patterns)',
      'Create custom skills with /skill for these workflows',
      'Skills are reusable prompts - invest time to craft them well',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['toolMastery'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Zero-Context Bug Fixing with MCP',
    keyTakeaway:
      'Using MCP servers like Sentry integration, you can paste a bug URL and Claude will fix it with zero context - it fetches everything it needs automatically.',
    actionableAdvice: [
      'Set up Sentry MCP for automatic error context fetching',
      'Paste issue URLs directly instead of copying error details manually',
      'MCP turns external tools into context sources Claude can query directly',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['toolMastery', 'aiCollaboration'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Make Claude Your Code Reviewer',
    keyTakeaway:
      'Train Claude to review code the way you like by teaching it your standards in CLAUDE.md. "Review this PR" becomes a powerful command when Claude knows your preferences.',
    actionableAdvice: [
      'Document your code review criteria in CLAUDE.md',
      'Include what you look for: error handling, naming, test coverage',
      'Use "review this like you\'re me" for personalized feedback',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['aiControl', 'aiCollaboration'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Subagents Keep Your Context Window Clean',
    keyTakeaway:
      'Subagents run in isolated context windows. Delegate exploratory tasks to them to keep your main conversation focused and prevent context pollution.',
    actionableAdvice: [
      'Use Task tool to delegate research and exploration to subagents',
      'Subagent results come back summarized, not raw',
      'Reserve main context for decision-making and implementation',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['contextEngineering', 'toolMastery'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'tool',
    title: 'Use Claude for Data Analysis via CLI',
    keyTakeaway:
      'Claude Code can analyze CSVs, logs, and data files directly. Pipe data through Claude for quick analysis without switching to specialized tools.',
    actionableAdvice: [
      'Pipe log files directly: "cat logs.txt | claude \'find errors\'"',
      'Analyze CSVs: "claude \'summarize this data\' < data.csv"',
      'Combine with shell tools for powerful data pipelines',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['toolMastery'],
    priority: 6,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Use Explanatory Mode for Active Learning',
    keyTakeaway:
      'Claude Code has an explanatory output style that teaches as it works. Use this mode when learning new codebases or unfamiliar patterns to build understanding, not just output.',
    actionableAdvice: [
      'Enable explanatory mode when exploring unfamiliar code',
      'Ask Claude to explain its reasoning, not just its output',
      'Treat AI sessions as learning opportunities, not just task completion',
    ],
    source: {
      type: 'x-post',
      url: 'https://x.com/bcherny/status/2017742741636321619',
      author: 'Boris Cherny',
      authorHandle: '@bcherny',
    },
    applicableDimensions: ['skillResilience'],
    priority: 8,
    enabled: true,
  },
  // ============================================================================
  // AI Skill Formation Research (arXiv:2601.20245 - Shen & Tamkin)
  // Source: https://arxiv.org/abs/2601.20245
  // ============================================================================
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Scaffolding Collapse: When AI Support Becomes a Crutch',
    keyTakeaway:
      'AI assistance can prevent the productive struggle that builds lasting skills. The comfort of scaffolded help may collapse your independent problem-solving ability.',
    actionableAdvice: [
      'Before asking AI, spend 5-10 minutes attempting the problem yourself',
      'Write pseudocode or outline your approach before involving AI',
      'Periodically solve problems without AI to maintain independence',
    ],
    source: {
      type: 'arxiv',
      url: 'https://arxiv.org/abs/2601.20245',
      author: 'Shen & Tamkin (How AI Impacts Skill Formation)',
    },
    applicableDimensions: ['skillResilience', 'aiControl'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'The Selective Learning Trap',
    keyTakeaway:
      'Delegating "boring" parts to AI while only learning "interesting" parts creates dangerous knowledge gaps. Full-stack understanding requires uncomfortable practice.',
    actionableAdvice: [
      'Identify topics you consistently delegate to AI - these are likely knowledge gaps',
      'Force yourself to understand the "boring" parts at least once',
      'Ask AI to explain delegated tasks, not just do them',
    ],
    source: {
      type: 'arxiv',
      url: 'https://arxiv.org/abs/2601.20245',
      author: 'Shen & Tamkin (How AI Impacts Skill Formation)',
    },
    applicableDimensions: ['skillResilience'],
    maxScore: 60,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'The Skill Formation Spectrum: Finding Your Optimal AI Level',
    keyTakeaway:
      'Research shows optimal AI integration varies by task complexity. For learning new skills: less AI. For familiar tasks: more AI. Match AI level to your growth goals.',
    actionableAdvice: [
      'New concepts: Ask AI for explanations, not implementations',
      'Familiar tasks: Use AI freely for productivity',
      'Periodically audit which category each task falls into',
    ],
    source: {
      type: 'arxiv',
      url: 'https://arxiv.org/abs/2601.20245',
      author: 'Shen & Tamkin (How AI Impacts Skill Formation)',
    },
    applicableDimensions: ['aiCollaboration', 'skillResilience'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Trial-and-Error Learning Debt',
    keyTakeaway:
      'Every problem AI solves instantly is a learning opportunity you did not take. Accumulating this debt weakens your debugging and architectural intuition.',
    actionableAdvice: [
      'When AI fixes a bug, ask "why did this work?" before moving on',
      'Keep a failure journal - what would you have tried without AI?',
      'Occasionally debug without AI to maintain diagnostic skills',
    ],
    source: {
      type: 'arxiv',
      url: 'https://arxiv.org/abs/2601.20245',
      author: 'Shen & Tamkin (How AI Impacts Skill Formation)',
    },
    applicableDimensions: ['skillResilience', 'aiControl'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
];
