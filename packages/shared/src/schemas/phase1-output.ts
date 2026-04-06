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
// Utterance Evidence Context Schema (concrete session JSONL evidence)
// ============================================================================

/**
 * Concrete detail extracted from a single AI tool call.
 *
 * Provides the specific parameters needed to populate Evidence field
 * "context" anchors in PEA growth areas. For example:
 * - Read("src/lib/auth.ts") → "after reading src/lib/auth.ts"
 * - Bash("npm test") → "after running npm test"
 * - Grep("isAuthenticated") → "after searching for isAuthenticated"
 */
export const ToolCallEvidenceSchema = z.object({
  /** Tool name (e.g. "Read", "Edit", "Bash", "Grep", "Glob") */
  name: z.string(),

  /**
   * Concrete parameter detail for this tool call type:
   * - Read/Edit/Write: file_path value
   * - Grep: pattern (+ optional path)
   * - Glob: pattern (+ optional path)
   * - Bash: command string (truncated to 120 chars)
   * - Task/Agent: description/prompt (truncated to 80 chars)
   * - WebFetch: url value (truncated to 120 chars)
   */
  detail: z.string().optional(),

  /** Whether this tool call resulted in an error */
  isError: z.boolean().optional(),

  /**
   * Truncated error message (max 200 chars) from the tool result.
   * Only present when isError is true. Used for "after X failed with Y" evidence context.
   */
  errorText: z.string().optional(),
});
export type ToolCallEvidence = z.infer<typeof ToolCallEvidenceSchema>;

/**
 * Rich evidence context for a single user utterance, extracted from session JSONL.
 *
 * Provides the concrete metrics, tool call sequences, and timestamps needed
 * to populate Evidence field moments in PEA growth areas without requiring
 * LLM workers to re-parse session logs.
 *
 * Look up by utteranceId to get evidence context for a specific moment:
 *   evidenceContexts.find(ctx => ctx.utteranceId === utteranceId)
 */
export const UtteranceEvidenceContextSchema = z.object({
  /**
   * Utterance ID — matches UserUtterance.id format: {sessionId}_{messageIndex}.
   * This is the primary lookup key connecting evidence context to utterances.
   */
  utteranceId: z.string(),

  /** Session this utterance belongs to */
  sessionId: z.string(),

  /** ISO 8601 timestamp from the raw JSONL message — enables temporal verification */
  timestamp: z.string(),

  /**
   * Sequence of tool calls the AI made in the response immediately preceding
   * this utterance. Includes concrete parameters (file paths, commands, patterns)
   * and error states for specific citation in evidence context fields.
   *
   * Empty array when there is no preceding AI response or no tool calls were made.
   * Used to build context anchors like "after Read(auth.ts) then Bash(npm test)".
   */
  precedingToolSequence: z.array(ToolCallEvidenceSchema),

  /**
   * Context window fill percentage (0-100) computed from the preceding
   * assistant message's token usage. Enables evidence like "context was 87% full".
   * Absent when token usage data is unavailable.
   */
  contextFillPercent: z.number().min(0).max(100).optional(),

  /**
   * Cumulative count of tool call errors in this session up to and including
   * the assistant response preceding this utterance.
   * Enables evidence like "the 4th tool failure in this session".
   */
  cumulativeErrorCount: z.number().int().min(0),

  /** 1-indexed user turn number within this session (1 = first user message) */
  sessionTurnNumber: z.number().int().min(1),

  /**
   * Seconds elapsed since session start at this utterance's timestamp.
   * Enables temporal context in evidence: "early in the session" vs "after 45 minutes".
   * Absent when session start time cannot be determined.
   */
  sessionDurationAtTurnSec: z.number().min(0).optional(),
});
export type UtteranceEvidenceContext = z.infer<typeof UtteranceEvidenceContextSchema>;

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
  /**
   * Rich evidence contexts extracted per user utterance from session JSONL.
   *
   * Provides concrete metrics (context fill %, cumulative error counts),
   * tool call sequences with parameters (file paths, commands, patterns),
   * and timestamps for each utterance. Used by LLM workers to populate
   * Evidence field moments in PEA growth areas with specific session anchors.
   *
   * Look up by utteranceId: evidenceContexts.find(ctx => ctx.utteranceId === id)
   * Ordered by session then turn position for predictable access patterns.
   */
  evidenceContexts: z.array(UtteranceEvidenceContextSchema).optional(),
});
export type Phase1Output = z.infer<typeof Phase1OutputSchema>;
