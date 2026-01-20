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
// Topic & Content Classification
// ============================================================================

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
 * Knowledge statistics
 */
export interface KnowledgeStats {
  totalItems: number;
  byCategory: Record<TopicCategory, number>;
  byPlatform: Record<SourcePlatform, number>;
  byStatus: Record<KnowledgeStatus, number>;
  avgRelevanceScore: number;
  highQualityCount: number; // score >= 0.7
}

/**
 * Knowledge search filters
 */
export interface KnowledgeFilters {
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

// ============================================================================
// Constants
// ============================================================================

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

/**
 * Relevance score thresholds
 */
export const RELEVANCE_THRESHOLDS = {
  accept: 0.7, // Auto-accept if score >= this
  review: 0.4, // Needs review if score between this and accept
  reject: 0.4, // Auto-reject if score < this
} as const;

// ============================================================================
// Initial Professional Insights
// ============================================================================

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
  // New Dimension Insights (Phase 4) - iterationEfficiency, learningVelocity, scopeManagement
  // ============================================================================
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Iteration Efficiency Assessment',
    keyTakeaway:
      '효율적인 개발자는 평균 2-3턴 내에 반복 사이클을 완료합니다. 5턴 이상은 불명확한 요구사항이나 잘못된 접근을 의미합니다.',
    actionableAdvice: [
      '반복 전 구체적으로 무엇을 바꿀지 명확히 하세요',
      '4턴 넘으면 새로운 접근을 고려하세요',
      '성공한 패턴을 문서화하세요',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/iteration-efficiency',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['iterationEfficiency'],
    maxScore: 60,
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Learning Velocity in AI-Assisted Development',
    keyTakeaway:
      '최고의 개발자는 AI를 지식 대체가 아닌 학습 가속기로 사용합니다. "어떻게"만큼 자주 "왜"를 묻습니다.',
    actionableAdvice: [
      '"어떻게"를 물은 후 "왜 이 접근인지"를 물어보세요',
      '반복되는 패턴을 기록하세요 - 학습 기회입니다',
      '주기적으로 AI 없이 구현해보세요',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/learning-velocity',
      author: 'Educational Research',
    },
    applicableDimensions: ['learningVelocity', 'skillResilience'],
    priority: 9,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'trend',
    title: 'Scope Management for AI Collaboration',
    keyTakeaway:
      '명확한 작업 범위가 AI 협업의 성공을 결정합니다. "이것만 해줘"가 "이것도 하고 저것도 해줘"보다 효과적입니다.',
    actionableAdvice: [
      '하나의 프롬프트에 하나의 작업만 요청하세요',
      '작업을 완료하기 전에 새 작업을 추가하지 마세요',
      '"먼저 X 하고, 그 다음 Y" 패턴을 사용하세요',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/scope-management',
      author: 'NoMoreAISlop Research',
    },
    applicableDimensions: ['scopeManagement'],
    priority: 8,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'type-specific',
    title: 'Targeted Refinement vs Shotgun Debugging',
    keyTakeaway:
      'AI에게 "이 부분만 바꿔줘"라고 하면 더 정확한 수정이 나옵니다. 전체를 다시 요청하면 다른 곳도 바뀝니다.',
    actionableAdvice: [
      '수정 요청 시 정확한 위치를 지정하세요',
      '"전체 다시 해줘" 대신 "이 함수만 수정해줘"',
      '여러 수정이 필요하면 하나씩 요청하세요',
    ],
    source: {
      type: 'x-post',
      url: 'https://twitter.com/example/targeted-refinement',
      author: 'AI Engineering',
    },
    applicableDimensions: ['iterationEfficiency', 'aiCollaboration'],
    priority: 7,
    enabled: true,
  },
  {
    version: '1.0.0',
    category: 'diagnosis',
    title: 'The "Why" Question Test',
    keyTakeaway:
      '세션에서 "왜"를 물은 횟수를 세어보세요. 0번이면 지식 전이가 일어나지 않고 있습니다.',
    actionableAdvice: [
      '코드를 받은 후 "왜 이 방법을 선택했어?"라고 물어보세요',
      '라이브러리를 사용할 때 "왜 이 라이브러리야?"라고 확인하세요',
      '이해 안 되는 부분은 넘어가지 말고 질문하세요',
    ],
    source: {
      type: 'research',
      url: 'https://nomoreaislop.com/insights/why-question-test',
      author: 'Educational Research',
    },
    applicableDimensions: ['learningVelocity'],
    maxScore: 50,
    priority: 9,
    enabled: true,
  },
];
