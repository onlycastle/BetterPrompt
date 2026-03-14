/**
 * Core Types for Plugin-First Architecture
 *
 * Minimal type definitions needed by MCP tools and core modules.
 * These mirror the types from src/lib/models/ but are standalone
 * to avoid cross-compilation boundary issues.
 *
 * @module plugin/lib/core/types
 */

import { z } from 'zod';

// ============================================================================
// Session Types (from src/lib/models/session.ts)
// ============================================================================

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

export const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);

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

export const AssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean().optional(),
  message: z.object({
    id: z.string().optional(),
    role: z.literal('assistant'),
    content: z.array(ContentBlockSchema),
    model: z.string().optional(),
    stop_reason: z.string().optional(),
    usage: TokenUsageSchema.optional(),
  }),
});

/** Supported JSONL line types */
export const JSONLLineSchema = z.discriminatedUnion('type', [
  UserMessageSchema,
  AssistantMessageSchema,
  // Queue operations and file history are parsed but not analyzed
  z.object({ type: z.literal('queue-operation'), timestamp: z.string() }).passthrough(),
  z.object({ type: z.literal('file-history-snapshot'), timestamp: z.string() }).passthrough(),
]);
export type JSONLLine = z.infer<typeof JSONLLineSchema>;

// ============================================================================
// Session Metadata
// ============================================================================

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
  avgContextUtilization?: number;
  maxContextUtilization?: number;
}

// ============================================================================
// Phase 1 Output Types (from src/lib/models/phase1-output.ts)
// ============================================================================

export interface UserUtterance {
  id: string;
  text: string;
  displayText?: string;
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  characterCount: number;
  wordCount: number;
  hasCodeBlock: boolean;
  hasQuestion: boolean;
  isSessionStart?: boolean;
  isContinuation?: boolean;
  machineContentRatio?: number;
  precedingAIToolCalls?: string[];
  precedingAIHadError?: boolean;
}

export interface AIInsightBlock {
  sessionId: string;
  turnIndex: number;
  content: string;
  triggeringUtteranceId?: string;
}

export interface FrictionSignals {
  toolFailureCount: number;
  userRejectionSignals: number;
  excessiveIterationSessions: number;
  contextOverflowSessions: number;
  frustrationExpressionCount: number;
  repeatedToolErrorPatterns: number;
  bareRetryAfterErrorCount: number;
  errorChainMaxLength: number;
}

export interface SessionHints {
  avgTurnsPerSession: number;
  shortSessions: number;
  mediumSessions: number;
  longSessions: number;
}

export interface Phase1SessionMetrics {
  totalSessions: number;
  totalMessages: number;
  totalDeveloperUtterances: number;
  totalAIResponses: number;
  avgMessagesPerSession: number;
  avgDeveloperMessageLength: number;
  questionRatio: number;
  codeBlockRatio: number;
  dateRange: { earliest: string; latest: string };
  slashCommandCounts?: Record<string, number>;
  avgContextFillPercent?: number;
  maxContextFillPercent?: number;
  contextFillExceeded90Count?: number;
  frictionSignals?: FrictionSignals;
  sessionHints?: SessionHints;
  aiInsightBlockCount?: number;
}

export interface Phase1Output {
  developerUtterances: UserUtterance[];
  sessionMetrics: Phase1SessionMetrics;
  aiInsightBlocks?: AIInsightBlock[];
}

// ============================================================================
// Deterministic Scoring Types
// ============================================================================

export interface DeterministicScores {
  contextEfficiency: number;
  sessionOutcome: number;
  thinkingQuality: number;
  learningBehavior: number;
  communicationPatterns: number;
  controlScore: number;
}

// ============================================================================
// Coding Style Types (from src/lib/models/coding-style.ts)
// ============================================================================

export type CodingStyleType = 'architect' | 'analyst' | 'conductor' | 'speedrunner' | 'trendsetter';
export type AIControlLevel = 'explorer' | 'navigator' | 'cartographer';

export interface DeterministicTypeResult {
  primaryType: CodingStyleType;
  distribution: {
    architect: number;
    analyst: number;
    conductor: number;
    speedrunner: number;
    trendsetter: number;
  };
  controlLevel: AIControlLevel;
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
}

// ============================================================================
// Domain Results (for save_domain_results tool)
// ============================================================================

export interface DomainStrength {
  title: string;
  description: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
}

export interface DomainGrowthArea {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
}

export interface DomainResult {
  domain: string;
  overallScore: number;
  confidenceScore: number;
  strengths: DomainStrength[];
  growthAreas: DomainGrowthArea[];
  /** Domain-specific extra data (varies per domain) */
  data?: Record<string, unknown>;
  analyzedAt: string;
}

// ============================================================================
// Report Types
// ============================================================================

export interface AnalysisReport {
  userId: string;
  analyzedAt: string;
  phase1Metrics: Phase1SessionMetrics;
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult;
  domainResults: DomainResult[];
  content?: {
    topFocusAreas?: Array<{
      title: string;
      narrative: string;
      actions: { start: string; stop: string; continue: string };
    }>;
    personalitySummary?: string[];
  };
}

// ============================================================================
// Matrix Names & Metadata (from src/lib/models/coding-style.ts)
// ============================================================================

export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    explorer: 'Sketch Architect',
    navigator: 'Blueprint Architect',
    cartographer: 'Master Architect',
  },
  analyst: {
    explorer: 'Curious Analyst',
    navigator: 'Systematic Analyst',
    cartographer: 'Forensic Analyst',
  },
  conductor: {
    explorer: 'Jam Session Conductor',
    navigator: 'Ensemble Conductor',
    cartographer: 'Symphony Conductor',
  },
  speedrunner: {
    explorer: 'Freestyle Speedrunner',
    navigator: 'Route Speedrunner',
    cartographer: 'TAS Speedrunner',
  },
  trendsetter: {
    explorer: 'Vibe Trendsetter',
    navigator: 'Wave Trendsetter',
    cartographer: 'Signal Trendsetter',
  },
};

export const MATRIX_METADATA: Record<CodingStyleType, Record<AIControlLevel, { emoji: string }>> = {
  architect: {
    explorer: { emoji: '✏️' },
    navigator: { emoji: '📐' },
    cartographer: { emoji: '🏗️' },
  },
  analyst: {
    explorer: { emoji: '🔍' },
    navigator: { emoji: '🔬' },
    cartographer: { emoji: '🧬' },
  },
  conductor: {
    explorer: { emoji: '🎸' },
    navigator: { emoji: '🎼' },
    cartographer: { emoji: '🎻' },
  },
  speedrunner: {
    explorer: { emoji: '🏄' },
    navigator: { emoji: '⚡' },
    cartographer: { emoji: '🎮' },
  },
  trendsetter: {
    explorer: { emoji: '🌊' },
    navigator: { emoji: '📡' },
    cartographer: { emoji: '🔮' },
  },
};
