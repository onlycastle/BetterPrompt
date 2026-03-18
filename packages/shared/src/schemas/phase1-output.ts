/**
 * Phase 1 Output Schemas - Pure Extraction Types
 *
 * Canonical Zod schemas for Phase 1 deterministic extraction output.
 * Used by both the plugin (MCP tools) and server (analysis pipeline).
 *
 * Phase 1 extracts raw text and structural metadata from sessions.
 * It does NOT perform any semantic analysis (that's Phase 2).
 *
 * @module @betterprompt/shared/schemas/phase1-output
 */

import { z } from 'zod';
import { ParsedSessionSchema } from './session.js';

// ============================================================================
// AI Insight Block Schema
// ============================================================================

export const AIInsightBlockSchema = z.object({
  sessionId: z.string(),
  turnIndex: z.number().int().min(0),
  content: z.string(),
  triggeringUtteranceId: z.string().optional(),
});
export type AIInsightBlock = z.infer<typeof AIInsightBlockSchema>;

// ============================================================================
// Natural Language Segment Schema
// ============================================================================

export const NaturalLanguageSegmentSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  text: z.string(),
});
export type NaturalLanguageSegment = z.infer<typeof NaturalLanguageSegmentSchema>;

// ============================================================================
// User Utterance Schema
// ============================================================================

export const UserUtteranceSchema = z.object({
  id: z.string(),
  text: z.string(),
  displayText: z.string().optional(),
  naturalLanguageSegments: z.array(NaturalLanguageSegmentSchema).optional(),
  timestamp: z.string(),
  sessionId: z.string(),
  turnIndex: z.number().int().min(0),
  characterCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  hasCodeBlock: z.boolean(),
  hasQuestion: z.boolean(),
  isSessionStart: z.boolean().optional(),
  isContinuation: z.boolean().optional(),
  machineContentRatio: z.number().min(0).max(1).optional(),
  precedingAIToolCalls: z.array(z.string()).optional(),
  precedingAIHadError: z.boolean().optional(),
});
export type UserUtterance = z.infer<typeof UserUtteranceSchema>;

// ============================================================================
// Friction Signals Schema
// ============================================================================

export const FrictionSignalsSchema = z.object({
  toolFailureCount: z.number().int().min(0),
  userRejectionSignals: z.number().int().min(0),
  excessiveIterationSessions: z.number().int().min(0),
  contextOverflowSessions: z.number().int().min(0),
  frustrationExpressionCount: z.number().int().min(0),
  repeatedToolErrorPatterns: z.number().int().min(0),
  bareRetryAfterErrorCount: z.number().int().min(0),
  errorChainMaxLength: z.number().int().min(0),
});
export type FrictionSignals = z.infer<typeof FrictionSignalsSchema>;

// ============================================================================
// Session Hints Schema
// ============================================================================

export const SessionHintsSchema = z.object({
  avgTurnsPerSession: z.number().min(0),
  shortSessions: z.number().int().min(0),
  mediumSessions: z.number().int().min(0),
  longSessions: z.number().int().min(0),
});
export type SessionHints = z.infer<typeof SessionHintsSchema>;

// ============================================================================
// Phase 1 Session Metrics Schema
// ============================================================================

export const Phase1SessionMetricsSchema = z.object({
  totalSessions: z.number().int().min(0),
  totalMessages: z.number().int().min(0),
  totalDeveloperUtterances: z.number().int().min(0),
  totalAIResponses: z.number().int().min(0),
  avgMessagesPerSession: z.number(),
  avgDeveloperMessageLength: z.number(),
  questionRatio: z.number().min(0).max(1),
  codeBlockRatio: z.number().min(0).max(1),
  dateRange: z.object({
    earliest: z.string(),
    latest: z.string(),
  }),
  slashCommandCounts: z.record(z.string(), z.number()).optional(),
  avgContextFillPercent: z.number().min(0).max(100).optional(),
  maxContextFillPercent: z.number().min(0).max(100).optional(),
  contextFillExceeded90Count: z.number().int().min(0).optional(),
  frictionSignals: FrictionSignalsSchema.optional(),
  sessionHints: SessionHintsSchema.optional(),
  aiInsightBlockCount: z.number().int().min(0).optional(),
});
export type Phase1SessionMetrics = z.infer<typeof Phase1SessionMetricsSchema>;

// ============================================================================
// Activity Session Schema (per-session metadata for Phase 1.5/2 stages)
// ============================================================================

/**
 * Per-session metadata emitted alongside aggregate metrics.
 * Required by downstream stages:
 * - SessionSummarizer (Phase 1.5): needs sessionId, projectName, messageCount
 * - ProjectSummarizer (Phase 2): groups by projectName
 * - WeeklyInsightGenerator (Phase 2): needs timestamps, durations, token totals
 */
export const ActivitySessionSchema = z.object({
  sessionId: z.string(),
  projectName: z.string(),
  projectPath: z.string().optional(),
  startTime: z.string(),
  durationSeconds: z.number().min(0),
  messageCount: z.number().int().min(0),
  userMessageCount: z.number().int().min(0),
  assistantMessageCount: z.number().int().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  /** First user message text (truncated to 200 chars) for summary context */
  firstUserMessage: z.string().optional(),
});
export type ActivitySession = z.infer<typeof ActivitySessionSchema>;

// ============================================================================
// Complete Phase 1 Output Schema
// ============================================================================

export const Phase1OutputSchema = z.object({
  developerUtterances: z.array(UserUtteranceSchema),
  sessionMetrics: Phase1SessionMetricsSchema,
  aiInsightBlocks: z.array(AIInsightBlockSchema).optional(),
  /** Per-session metadata for Phase 1.5/2 stages */
  activitySessions: z.array(ActivitySessionSchema).optional(),
  /** Full parsed sessions preserved for downstream evidence and parity needs */
  sessions: z.array(ParsedSessionSchema).optional(),
  skippedFiles: z.number().optional(),
});
export type Phase1Output = z.infer<typeof Phase1OutputSchema>;
