/**
 * Phase 1 Output Schema - Pure Extraction (No Semantic Analysis)
 *
 * Phase 1 extracts raw text and structural metadata from sessions.
 * It does NOT perform any semantic analysis like:
 * - Dimension assignment
 * - Signal classification (strength/growth)
 * - Pattern detection
 * - Type classification
 *
 * These tasks are delegated to Phase 2 workers.
 *
 * @module models/phase1-output
 */

import { z } from 'zod';

// ============================================================================
// Developer Utterance Schema (Raw Text + Structural Metadata)
// ============================================================================

// ============================================================================
// Natural Language Segment Schema (Immutable Developer Text)
// ============================================================================

/**
 * A segment of the developer's natural language that must NEVER be modified.
 *
 * These segments represent the developer's actual words, thoughts, and intentions.
 * Unlike error logs, stack traces, or code blocks which can be summarized,
 * natural language segments must be preserved verbatim at all stages.
 *
 * Use cases:
 * - Evidence quotes in reports
 * - Communication pattern examples
 * - Audit trail verification
 */
export const NaturalLanguageSegmentSchema = z.object({
  /** Start character index in the original text (0-based) */
  start: z.number().int().min(0),

  /** End character index in the original text (exclusive) */
  end: z.number().int().min(0),

  /** The exact text content (immutable, never modify) */
  text: z.string(),
});
export type NaturalLanguageSegment = z.infer<typeof NaturalLanguageSegmentSchema>;

/**
 * A single developer utterance extracted from a session.
 *
 * Contains ONLY:
 * - Raw text content
 * - Structural metadata (computed, not LLM-interpreted)
 * - Contextual metadata from preceding AI response
 *
 * Does NOT contain:
 * - dimension assignment (Phase 2: StrengthGrowthWorker)
 * - signal classification (Phase 2: StrengthGrowthWorker)
 * - semantic meaning or interpretation
 */
export const DeveloperUtteranceSchema = z.object({
  /** Unique identifier: "{sessionId}_{turnIndex}" */
  id: z.string(),

  /** Raw text content from the developer's message */
  text: z.string(),

  /**
   * Display-friendly text with machine-generated content summarized.
   *
   * This field contains a sanitized version of the text where:
   * - Error logs → [Error: {brief message}]
   * - Stack traces → [Stack trace]
   * - Code blocks → [Code: {language}]
   * - CLI output → [CLI output]
   * - JSON data → [JSON data]
   *
   * The developer's natural language is preserved.
   * Used for display in reports (Communication Patterns quotes, etc.)
   */
  displayText: z.string().optional(),

  /**
   * Segments containing the developer's natural language (immutable).
   *
   * These segments mark which parts of the text are the developer's actual words
   * vs machine-generated content (error logs, stack traces, code blocks).
   *
   * CRITICAL: Text within these segments must NEVER be modified, summarized,
   * or paraphrased by any downstream component (LLM, sanitizer, etc.).
   *
   * Example:
   * Original: "로그인 잘 된다. 그런데 Error: No workspace ID 에러가 나왔어"
   * Segments: [
   *   { start: 0, end: 17, text: "로그인 잘 된다. 그런데 " },
   *   { start: 40, end: 50, text: " 에러가 나왔어" }
   * ]
   */
  naturalLanguageSegments: z.array(NaturalLanguageSegmentSchema).optional(),

  /** ISO 8601 timestamp of the message */
  timestamp: z.string(),

  /** Session UUID this utterance belongs to */
  sessionId: z.string(),

  /** Turn index within the session (0-based) */
  turnIndex: z.number().int().min(0),

  // ─────────────────────────────────────────────────────────────────────────
  // Structural Metadata (Computed, NOT LLM)
  // ─────────────────────────────────────────────────────────────────────────

  /** Character count of the text */
  characterCount: z.number().int().min(0),

  /** Word count of the text */
  wordCount: z.number().int().min(0),

  /** Whether the text contains code blocks (```...```) */
  hasCodeBlock: z.boolean(),

  /** Whether the text contains a question mark */
  hasQuestion: z.boolean(),

  /** Whether this is the first message in a session */
  isSessionStart: z.boolean().optional(),

  /** Whether this appears to be a continuation of previous work */
  isContinuation: z.boolean().optional(),

  /**
   * Whether this utterance is semantically meaningful enough for evidence.
   *
   * Determined by Phase 1 based on:
   * - Minimum word count (8+ words)
   * - Presence of questions or code blocks
   * - Context keywords (because, since, therefore, etc.)
   *
   * Utterances marked as noteworthy=false should be filtered out
   * before being used as evidence examples in Phase 2/3.
   */
  isNoteworthy: z.boolean().optional(),

  /**
   * Ratio of machine-generated content (errors, stack traces, code blocks)
   * to total content. Range: 0.0 (all developer text) to 1.0 (all machine content).
   *
   * Used by Phase 2 workers to evaluate error reporting quality:
   * - machineContentRatio > 0.95: Almost entirely machine content
   * - machineContentRatio > 0.70: Mostly machine content with some developer text
   * - machineContentRatio < 0.30: Mostly developer's natural language
   *
   * High machineContentRatio alone is NOT negative — it's a valid workflow.
   * Only becomes a Growth Area when combined with error_loop pattern.
   */
  machineContentRatio: z.number().min(0).max(1).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Context from Preceding AI Response
  // ─────────────────────────────────────────────────────────────────────────

  /** Tool calls made in the preceding AI response */
  precedingAIToolCalls: z.array(z.string()).optional(),

  /** Whether the preceding AI response contained an error */
  precedingAIHadError: z.boolean().optional(),
});
export type DeveloperUtterance = z.infer<typeof DeveloperUtteranceSchema>;

// ============================================================================
// AI Response Schema
// ============================================================================

/**
 * Extracted AI response metadata.
 *
 * Captures what the AI did in response to the developer's request.
 * This helps Phase 2 workers understand the interaction context.
 */
export const AIResponseSchema = z.object({
  /** Unique identifier: "{sessionId}_{turnIndex}" */
  id: z.string(),

  /** Session UUID */
  sessionId: z.string(),

  /** Turn index within the session (0-based) */
  turnIndex: z.number().int().min(0),

  /** Type of response */
  responseType: z.enum([
    'explanation',      // Explaining concepts or code
    'code_generation',  // Writing new code
    'code_edit',        // Editing existing code
    'error_fix',        // Fixing an error
    'question',         // Asking clarifying questions
    'tool_execution',   // Running tools/commands
    'planning',         // Creating or discussing plans
    'other',            // Other response types
  ]),

  /** Tools used in this response */
  toolsUsed: z.array(z.string()),

  /** Snippet of the response text (up to 1500 chars) */
  textSnippet: z.string().max(1500),

  /** Full length of the response text */
  fullTextLength: z.number().int().min(0),

  /** Whether this response contained an error or failure */
  hadError: z.boolean().optional(),

  /** Whether this response was successful (tool executed, code worked, etc.) */
  wasSuccessful: z.boolean().optional(),
});
export type AIResponse = z.infer<typeof AIResponseSchema>;

// ============================================================================
// Session Metrics Schema (Computed Statistics)
// ============================================================================

/**
 * Computed metrics for the analyzed sessions.
 *
 * These are deterministic calculations, not LLM interpretations.
 */
export const Phase1SessionMetricsSchema = z.object({
  /** Total number of sessions analyzed */
  totalSessions: z.number().int().min(0),

  /** Total number of messages (user + assistant) */
  totalMessages: z.number().int().min(0),

  /** Total number of developer utterances */
  totalDeveloperUtterances: z.number().int().min(0),

  /** Total number of AI responses */
  totalAIResponses: z.number().int().min(0),

  /** Average messages per session */
  avgMessagesPerSession: z.number(),

  /** Average developer message length (characters) */
  avgDeveloperMessageLength: z.number(),

  /** Percentage of developer messages that are questions */
  questionRatio: z.number().min(0).max(1),

  /** Percentage of developer messages with code blocks */
  codeBlockRatio: z.number().min(0).max(1),

  /** Date range of sessions analyzed */
  dateRange: z.object({
    earliest: z.string(),
    latest: z.string(),
  }),

  /** Tool usage counts */
  toolUsageCounts: z.record(z.string(), z.number()).optional(),
});
export type Phase1SessionMetrics = z.infer<typeof Phase1SessionMetricsSchema>;

// ============================================================================
// Complete Phase 1 Output Schema
// ============================================================================

/**
 * Complete Phase 1 extraction output.
 *
 * This is the ONLY output that passes to Phase 2 workers.
 * Phase 2 workers do NOT have access to raw sessions.
 *
 * The separation ensures:
 * 1. Phase 1 = Pure extraction (no interpretation)
 * 2. Phase 2 = Semantic analysis (on extracted data only)
 * 3. Clear data flow and easier testing
 */
export const Phase1OutputSchema = z.object({
  /** Extracted developer utterances with structural metadata */
  developerUtterances: z.array(DeveloperUtteranceSchema),

  /** Extracted AI responses */
  aiResponses: z.array(AIResponseSchema),

  /** Computed session metrics */
  sessionMetrics: Phase1SessionMetricsSchema,
});
export type Phase1Output = z.infer<typeof Phase1OutputSchema>;
