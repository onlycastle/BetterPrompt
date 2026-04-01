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
// Expert Signals Schema (derived from Claude Code internal patterns)
// ============================================================================

/**
 * Expert-level behavioral signals detected from session data.
 * Based on patterns extracted from Claude Code's own architecture:
 * layered instructions, prompt-cache discipline, typed hooks,
 * mode-aware permissions, and thin subagent contexts.
 */
export const ExpertSignalsSchema = z.object({
  /** CLAUDE.md references detected (writing, updating, reading) */
  claudeMdReferences: z.number().int().min(0),
  /** .claude/rules/ scoped rule references */
  scopedRuleReferences: z.number().int().min(0),
  /** Hook-related references (PreToolUse, PostToolUse, settings.json hooks) */
  hookReferences: z.number().int().min(0),
  /** Skill invocations detected (beyond built-in slash commands) */
  skillInvocations: z.number().int().min(0),
  /** Proper tool selection ratio: using Read/Edit/Grep/Glob over bash equivalents */
  properToolSelectionRatio: z.number().min(0).max(1),
  /** Bash misuse count: using bash cat/grep/find when dedicated tools available */
  bashMisuseCount: z.number().int().min(0),
  /** Task/Agent delegation count for parallel or isolated work */
  taskDelegationCount: z.number().int().min(0),
  /** Context compaction actions (/compact, /clear) relative to session count */
  compactionRate: z.number().min(0),
  /** Sessions with structured first prompt (context + task + constraints) */
  structuredColdStartCount: z.number().int().min(0),
  /** Fresh session starts after failures (sunk cost avoidance) */
  freshSessionAfterFailureCount: z.number().int().min(0),
  /** Error chain breaks (strategy change after consecutive errors) */
  errorChainBreakCount: z.number().int().min(0),
  /** Verification requests before accepting output */
  verificationRequestCount: z.number().int().min(0),
});
export type ExpertSignals = z.infer<typeof ExpertSignalsSchema>;

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
  expertSignals: ExpertSignalsSchema.optional(),
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
