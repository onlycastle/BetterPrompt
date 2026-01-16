/**
 * Analysis Domain Models
 *
 * Consolidated Zod schemas for session analysis, evaluation, and coding style detection.
 * This is the single source of truth for all analysis-related types.
 *
 * @module domain/models/analysis
 */

import { z } from 'zod';

// ============================================================================
// JSONL Input Types - Raw Claude Code session log format
// ============================================================================

/**
 * Content block types in Claude messages
 */
export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type TextBlock = z.infer<typeof TextBlockSchema>;

export const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;

export const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});
export type ToolResultBlock = z.infer<typeof ToolResultBlockSchema>;

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

/**
 * Token usage schema
 */
export const TokenUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  cache_creation: z
    .object({
      ephemeral_5m_input_tokens: z.number(),
      ephemeral_1h_input_tokens: z.number(),
    })
    .optional(),
  service_tier: z.string().optional(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * User message from JSONL
 */
export const UserMessageSchema = z.object({
  type: z.literal('user'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  cwd: z.string().optional(),
  version: z.string().optional(),
  gitBranch: z.string().optional(),
  userType: z.string().optional(),
  isSidechain: z.boolean().optional(),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(ContentBlockSchema)]),
  }),
});
export type UserMessage = z.infer<typeof UserMessageSchema>;

/**
 * Assistant message from JSONL
 */
export const AssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  cwd: z.string().optional(),
  version: z.string().optional(),
  gitBranch: z.string().optional(),
  userType: z.string().optional(),
  isSidechain: z.boolean().optional(),
  requestId: z.string().optional(),
  message: z.object({
    model: z.string().optional(),
    id: z.string().optional(),
    type: z.literal('message').optional(),
    role: z.literal('assistant'),
    content: z.array(ContentBlockSchema),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: TokenUsageSchema.optional(),
  }),
});
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

/**
 * Queue operation from JSONL (internal, usually skipped)
 */
export const QueueOperationSchema = z.object({
  type: z.literal('queue-operation'),
  operation: z.enum(['dequeue', 'enqueue']),
  timestamp: z.string(),
  sessionId: z.string(),
});
export type QueueOperation = z.infer<typeof QueueOperationSchema>;

/**
 * File history snapshot from JSONL (internal, usually skipped)
 */
export const FileHistorySnapshotSchema = z.object({
  type: z.literal('file-history-snapshot'),
  messageId: z.string(),
  isSnapshotUpdate: z.boolean(),
  snapshot: z.object({
    messageId: z.string(),
    trackedFileBackups: z.record(z.unknown()),
    timestamp: z.string(),
  }),
});
export type FileHistorySnapshot = z.infer<typeof FileHistorySnapshotSchema>;

/**
 * Union of all JSONL line types
 */
export const JSONLLineSchema = z.union([
  UserMessageSchema,
  AssistantMessageSchema,
  QueueOperationSchema,
  FileHistorySnapshotSchema,
]);
export type JSONLLine = z.infer<typeof JSONLLineSchema>;

// ============================================================================
// Parsed Session Types - Internal representation after parsing
// ============================================================================

/**
 * Tool call representation (simplified from raw format)
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

/**
 * Parsed message - simplified for analysis
 */
export interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: string; // Flattened text content
  toolCalls?: ToolCall[];
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Session statistics
 */
export interface SessionStats {
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  uniqueToolsUsed: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Fully parsed session ready for analysis
 */
export interface ParsedSession {
  sessionId: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: ParsedMessage[];
  stats: SessionStats;
}

/**
 * Lightweight session metadata for listing
 */
export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string; // Last segment of path
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string; // Full path to JSONL file
}

// ============================================================================
// Type Guards for JSONL Parsing
// ============================================================================

/**
 * Check if a parsed JSONL line is a user or assistant message
 */
export function isConversationMessage(
  line: JSONLLine
): line is UserMessage | AssistantMessage {
  return line.type === 'user' || line.type === 'assistant';
}

/**
 * Check if content is a text block
 */
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text';
}

/**
 * Check if content is a tool use block
 */
export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

/**
 * Check if content is a tool result block
 */
export function isToolResultBlock(
  block: ContentBlock
): block is ToolResultBlock {
  return block.type === 'tool_result';
}

// ============================================================================
// Evaluation Types - LLM Analysis Output
// ============================================================================

/**
 * Rating schema - qualitative assessment of collaboration skills
 * Using growth-focused language
 */
export const RatingSchema = z.enum(['Strong', 'Developing', 'Needs Work']);
export type Rating = z.infer<typeof RatingSchema>;

/**
 * Clue (evidence) schema - specific quotes from the conversation
 * that support the rating
 */
export const ClueSchema = z.object({
  type: z.enum(['positive', 'negative']),
  quote: z
    .string()
    .min(10)
    .max(500)
    .describe('Direct quote from the conversation'),
  explanation: z
    .string()
    .min(10)
    .max(300)
    .describe('Why this quote is evidence for the rating'),
});
export type Clue = z.infer<typeof ClueSchema>;

/**
 * Category evaluation schema - assessment for a single category
 * (Planning, Critical Thinking, or Code Understanding)
 */
export const CategoryEvaluationSchema = z.object({
  rating: RatingSchema,
  summary: z
    .string()
    .min(50)
    .max(500)
    .describe('2-3 sentence summary of performance in this category'),
  clues: z
    .array(ClueSchema)
    .min(1)
    .max(5)
    .describe('1-5 specific evidence items'),
});
export type CategoryEvaluation = z.infer<typeof CategoryEvaluationSchema>;

/**
 * Full evaluation schema - complete assessment of a session
 * This is the primary output from the LLM analyzer
 */
export const EvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  analyzedAt: z.string().datetime(),

  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,

  overallSummary: z
    .string()
    .min(100)
    .max(1000)
    .describe("Overall assessment of the developer's AI collaboration style"),

  recommendations: z
    .array(z.string().min(20).max(200))
    .min(1)
    .max(5)
    .describe('Specific, actionable recommendations for improvement'),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/**
 * Schema for LLM response parsing - excludes metadata fields
 * that are added after the LLM call
 */
export const LLMResponseSchema = z.object({
  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,
  overallSummary: z.string().min(100).max(1000),
  recommendations: z.array(z.string().min(20).max(200)).min(1).max(5),
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// ============================================================================
// AI Coding Style Types - MBTI-like personality types for developers
// ============================================================================

/**
 * The 5 AI Coding Style Types
 * All types are positive - each has strengths and growth points
 */
export const CodingStyleTypeSchema = z.enum([
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
]);
export type CodingStyleType = z.infer<typeof CodingStyleTypeSchema>;

/**
 * AI Control Level - measures how well you control AI vs depend on it
 * Based on: elvis ("Professional developers don't vibe, they control")
 */
export const AIControlLevelSchema = z.enum([
  'vibe-coder', // High AI dependency
  'developing', // Learning balance
  'ai-master', // Strategic AI control
]);
export type AIControlLevel = z.infer<typeof AIControlLevelSchema>;

/**
 * Raw metrics extracted from session analysis
 */
export interface SessionMetrics {
  // Prompt characteristics
  avgPromptLength: number;
  avgFirstPromptLength: number;
  maxPromptLength: number;

  // Turn patterns
  avgTurnsPerSession: number;
  totalTurns: number;

  // Question patterns
  questionFrequency: number; // Questions per turn
  whyHowWhatCount: number;

  // Tool usage patterns
  toolUsage: {
    read: number;
    grep: number;
    glob: number;
    task: number;
    plan: number;
    bash: number;
    write: number;
    edit: number;
    total: number;
  };

  // Modification patterns
  modificationRequestCount: number;
  modificationRate: number; // modification requests / total turns

  // Quality signals
  refactorKeywordCount: number;
  styleKeywordCount: number;
  qualityTermCount: number; // test, type, doc mentions

  // Feedback patterns
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;

  // Time patterns
  avgCycleTimeSeconds: number;
  sessionDurationSeconds: number;
}

/**
 * Scores for each type (0-100)
 */
export interface TypeScores {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

/**
 * Distribution as percentages (sum to 100)
 */
export interface TypeDistribution {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

/**
 * A conversation sample that demonstrates a type
 */
export interface ConversationEvidence {
  type: CodingStyleType;
  quote: string;
  timestamp: Date;
  explanation: string;
}

/**
 * Schema for the type detection result
 */
export const TypeResultSchema = z.object({
  primaryType: CodingStyleTypeSchema,
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),
  metrics: z.object({
    avgPromptLength: z.number(),
    avgFirstPromptLength: z.number(),
    avgTurnsPerSession: z.number(),
    questionFrequency: z.number(),
    modificationRate: z.number(),
    toolUsageHighlight: z.string(),
  }),
  evidence: z.array(
    z.object({
      type: CodingStyleTypeSchema,
      quote: z.string(),
      timestamp: z.string(),
      explanation: z.string(),
    })
  ),
  sessionCount: z.number(),
  analyzedAt: z.string(),
});
export type TypeResult = z.infer<typeof TypeResultSchema>;

/**
 * 2D Matrix combining Style (5) x Control Level (3) = 15 combinations
 */
export interface CodingStyleMatrix {
  primaryStyle: CodingStyleType;
  controlLevel: AIControlLevel;
  combinedName: string;
  combinedEmoji: string;
}

// ============================================================================
// Analysis Dimensions - Numeric scores (0-100)
// ============================================================================

/**
 * Dimension level based on score
 */
export const DimensionLevelSchema = z.enum([
  'needs-work', // 0-39
  'developing', // 40-69
  'strong', // 70-100
]);
export type DimensionLevel = z.infer<typeof DimensionLevelSchema>;

/**
 * Single dimension result
 */
export const DimensionResultSchema = z.object({
  score: z.number().min(0).max(100),
  level: DimensionLevelSchema,
  reasoning: z.string().max(500),
});
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

/**
 * All analysis dimensions
 */
export const DimensionsSchema = z.object({
  aiCollaboration: DimensionResultSchema,
  promptEngineering: DimensionResultSchema,
  burnoutRisk: DimensionResultSchema,
  toolMastery: DimensionResultSchema,
  aiControl: DimensionResultSchema,
  skillResilience: DimensionResultSchema,
});
export type Dimensions = z.infer<typeof DimensionsSchema>;

// ============================================================================
// Stored Analysis - Persisted evaluation with metadata
// ============================================================================

/**
 * Stored analysis schema - persisted evaluation with metadata
 */
export const StoredAnalysisSchema = z.object({
  version: z.literal('1.0.0'),
  createdAt: z.string().datetime(),

  evaluation: EvaluationSchema,

  metadata: z.object({
    projectPath: z.string(),
    projectName: z.string(),
    durationSeconds: z.number(),
    messageCount: z.number(),
    toolCallCount: z.number(),
    claudeCodeVersion: z.string(),
  }),

  // Optional extended analysis (v2.0+)
  typeResult: TypeResultSchema.optional(),
  dimensions: DimensionsSchema.optional(),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;

/**
 * Analysis summary for listing - lightweight representation
 */
export interface AnalysisSummary {
  sessionId: string;
  projectName: string;
  analyzedAt: Date;
  ratings: {
    planning: string;
    criticalThinking: string;
    codeUnderstanding: string;
  };
  filePath: string;
}

// ============================================================================
// Constants - Pattern Keywords & Metadata
// ============================================================================

/**
 * Keywords for pattern detection in sessions
 */
export const PATTERN_KEYWORDS = {
  // Questions (Scientist signals)
  questions: ['why', 'how', 'what', 'explain', 'clarify', 'understand'],

  // Modification requests (Scientist/Collaborator signals)
  modifications: [
    'change',
    'fix',
    'update',
    'modify',
    'adjust',
    'correct',
    'wrong',
    'error',
    'bug',
    'issue',
  ],

  // Planning patterns (Architect signals)
  planning: [
    'first',
    'then',
    'next',
    'step',
    'plan',
    'design',
    'architecture',
    'approach',
    'strategy',
    'before we',
  ],

  // Speed patterns (Speedrunner signals)
  speed: [
    'quick',
    'fast',
    'just do',
    'make it',
    'run',
    'execute',
    'next',
    'done',
    'ok',
  ],

  // Quality patterns (Craftsman signals)
  quality: [
    'refactor',
    'clean',
    'style',
    'naming',
    'readable',
    'maintainable',
    'pattern',
    'consistent',
  ],

  // Quality terms (Craftsman signals)
  qualityTerms: ['test', 'type', 'doc', 'lint', 'format', 'prettier', 'eslint'],

  // Positive feedback (Collaborator signals)
  positiveFeedback: [
    'thanks',
    'thank you',
    'great',
    'good',
    'nice',
    'perfect',
    'excellent',
    'awesome',
    'love it',
  ],

  // Iteration patterns (Collaborator signals)
  iteration: [
    'but',
    'however',
    'also',
    'add',
    'more',
    'another',
    'additionally',
    'almost',
    'close',
  ],
} as const;

/**
 * Type metadata for display
 */
export const TYPE_METADATA: Record<
  CodingStyleType,
  {
    emoji: string;
    name: string;
    tagline: string;
    description: string;
    strengths: string[];
    growthPoints: string[];
  }
> = {
  architect: {
    emoji: '🏗️',
    name: 'Architect',
    tagline: 'Strategic thinker who plans before diving into code',
    description:
      'You approach AI collaboration with a clear vision. Your structured prompts and systematic planning maximize AI implementation speed while maintaining consistency.',
    strengths: [
      'Systematic approach to complex systems',
      "Maximizes AI's implementation speed",
      'High consistency in output',
    ],
    growthPoints: [
      'Quick prototyping can sometimes be more efficient',
      'Over-planning may delay execution',
    ],
  },
  scientist: {
    emoji: '🔬',
    name: 'Scientist',
    tagline: 'Truth-seeker who always verifies AI output',
    description:
      "You maintain healthy skepticism toward AI output. Your verification habits catch bugs early and ensure high code quality while keeping your skills sharp.",
    strengths: [
      'Catches bugs early',
      'High code quality',
      'Low AI dependency, maintains skills',
    ],
    growthPoints: [
      'Verifying everything can slow velocity',
      'More AI trust could improve efficiency',
    ],
  },
  collaborator: {
    emoji: '🤝',
    name: 'Collaborator',
    tagline: 'Partnership master who finds answers through dialogue',
    description:
      'You excel at iterative refinement through conversation. Your collaborative approach maximizes AI synergy and leads to quality improvement through iteration.',
    strengths: [
      'Maximizes AI synergy',
      'Quality improvement through iteration',
      'Flexible problem solving',
    ],
    growthPoints: [
      'Clearer initial requirements could reduce turns',
      'Sometimes one clear request is more efficient',
    ],
  },
  speedrunner: {
    emoji: '⚡',
    name: 'Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
    strengths: [
      'Rapid prototyping',
      'New discoveries through experimentation',
      'High output per time',
    ],
    growthPoints: [
      'Technical debt may accumulate',
      'Sometimes slower design is more efficient',
    ],
  },
  craftsman: {
    emoji: '🔧',
    name: 'Craftsman',
    tagline: 'Artisan who prioritizes code quality above all',
    description:
      'You care deeply about code quality and consistency. Your attention to detail produces maintainable code and minimizes long-term technical debt.',
    strengths: [
      'Produces maintainable code',
      'Maintains team codebase consistency',
      'Minimizes long-term technical debt',
    ],
    growthPoints: [
      'Perfectionism may delay deployment',
      'Speed matters too at MVP stage',
    ],
  },
};

/**
 * Matrix names for each Style x Control combination
 */
export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    'vibe-coder': 'Dreamer',
    developing: 'Planner',
    'ai-master': 'Systems Architect',
  },
  scientist: {
    'vibe-coder': 'Curious',
    developing: 'Investigator',
    'ai-master': 'Research Master',
  },
  collaborator: {
    'vibe-coder': 'Follower',
    developing: 'Partner',
    'ai-master': 'Conductor',
  },
  speedrunner: {
    'vibe-coder': 'Yolo Coder',
    developing: 'Fast Learner',
    'ai-master': 'Efficient Master',
  },
  craftsman: {
    'vibe-coder': 'Perfectionist',
    developing: 'Quality Seeker',
    'ai-master': 'Code Artisan',
  },
};

/**
 * Detailed metadata for each Matrix combination
 */
export const MATRIX_METADATA: Record<
  CodingStyleType,
  Record<
    AIControlLevel,
    {
      emoji: string;
      description: string;
      keyStrength: string;
      growthPath: string;
    }
  >
> = {
  architect: {
    'vibe-coder': {
      emoji: '💭',
      description: 'You plan well but tend to let AI take over implementation.',
      keyStrength: 'Clear vision and planning',
      growthPath: 'Try validating AI output against your plans more actively',
    },
    developing: {
      emoji: '📐',
      description: 'You balance planning with hands-on verification.',
      keyStrength: 'Structured approach with growing control',
      growthPath: 'Keep building verification habits',
    },
    'ai-master': {
      emoji: '🏛️',
      description: 'You orchestrate AI with precision, using plans as control mechanisms.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
    },
  },
  scientist: {
    'vibe-coder': {
      emoji: '🔎',
      description: 'You ask questions but may accept answers too readily.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more often',
    },
    developing: {
      emoji: '🧪',
      description: 'You verify AI output and are building critical thinking habits.',
      keyStrength: 'Growing verification skills',
      growthPath: 'Add systematic testing to your workflow',
    },
    'ai-master': {
      emoji: '🔬',
      description: 'You treat every AI output as a hypothesis to be tested.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
    },
  },
  collaborator: {
    'vibe-coder': {
      emoji: '👥',
      description: 'You converse with AI but let it lead the dialogue.',
      keyStrength: 'Open communication style',
      growthPath: 'Try directing conversations more actively',
    },
    developing: {
      emoji: '🤝',
      description: 'You engage in balanced dialogue with AI.',
      keyStrength: 'Effective back-and-forth refinement',
      growthPath: 'Focus on asking more probing questions',
    },
    'ai-master': {
      emoji: '🎭',
      description: 'You conduct AI like an orchestra, directing every iteration.',
      keyStrength: 'Masterful iterative refinement',
      growthPath: 'Document your collaboration patterns for others',
    },
  },
  speedrunner: {
    'vibe-coder': {
      emoji: '🎲',
      description: 'You move fast but may skip important verifications.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
    },
    developing: {
      emoji: '🏃',
      description: 'You balance speed with growing verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
    },
    'ai-master': {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic AI delegation.',
      keyStrength: 'Efficient mastery - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
    },
  },
  craftsman: {
    'vibe-coder': {
      emoji: '🎨',
      description: 'You care about quality but rely heavily on AI to achieve it.',
      keyStrength: 'High standards and attention to detail',
      growthPath: 'Practice writing quality code without AI assistance',
    },
    developing: {
      emoji: '🔧',
      description: 'You actively refine AI output to meet your quality standards.',
      keyStrength: 'Active quality improvement process',
      growthPath: 'Keep developing your manual coding skills',
    },
    'ai-master': {
      emoji: '💎',
      description: 'You use AI as a precision tool to achieve exceptional quality.',
      keyStrength: 'Masterful quality control with AI assistance',
      growthPath: 'Set quality benchmarks for your team',
    },
  },
};

/**
 * Control level metadata for display
 */
export const CONTROL_LEVEL_METADATA: Record<
  AIControlLevel,
  {
    name: string;
    description: string;
    scoreRange: string;
  }
> = {
  'vibe-coder': {
    name: 'Vibe Coder',
    description: 'High AI dependency - you tend to accept AI output without much modification',
    scoreRange: '0-34',
  },
  developing: {
    name: 'Developing',
    description: 'Learning balance - you are building control habits over AI',
    scoreRange: '35-64',
  },
  'ai-master': {
    name: 'AI Master',
    description: 'Strategic control - you direct AI effectively as a tool',
    scoreRange: '65-100',
  },
};

/**
 * Get the combined matrix result for a style and control level
 */
export function getMatrixResult(
  style: CodingStyleType,
  controlLevel: AIControlLevel
): CodingStyleMatrix {
  return {
    primaryStyle: style,
    controlLevel,
    combinedName: MATRIX_NAMES[style][controlLevel],
    combinedEmoji: MATRIX_METADATA[style][controlLevel].emoji,
  };
}
