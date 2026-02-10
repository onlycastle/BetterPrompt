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
// AI Insight Block Schema (Extracted from Assistant Messages)
// ============================================================================

/**
 * A structured educational insight block extracted from AI assistant messages.
 *
 * These blocks are delimited by `★ Insight ─────` and `─────` markers in
 * assistant responses (used when Claude Code is in "explanatory" output mode).
 *
 * Extracted deterministically via regex in Phase 1 (no LLM required).
 * Used by Phase 2 workers:
 * - LearningBehavior (primary): knowledge gap signals, learning progress tracking
 * - ThinkingQuality (secondary): auxiliary context for thinking patterns
 */
export const AIInsightBlockSchema = z.object({
  /** Session UUID this insight belongs to */
  sessionId: z.string(),

  /** Turn index of the assistant message containing this insight (0-based) */
  turnIndex: z.number().int().min(0),

  /** Educational content between delimiters (max 500 chars) */
  content: z.string(),

  /**
   * ID of the preceding user utterance that triggered this insight.
   * Format: "{sessionId}_{turnIndex}" matching DeveloperUtterance.id
   */
  triggeringUtteranceId: z.string().optional(),
});
export type AIInsightBlock = z.infer<typeof AIInsightBlockSchema>;

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

  /**
   * Developer-initiated slash command counts (e.g., /plan, /commit, /review).
   * These represent INTENTIONAL developer actions extracted from user messages.
   * Primary signal for "Conductor" type classification (active tool orchestration).
   *
   * Extracted from:
   * - XML-tagged commands: <command-name>/xxx</command-name> (always trusted)
   * - Plain-text commands: /xxx at line start (whitelist-matched only)
   */
  slashCommandCounts: z.record(z.string(), z.number()).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Context Fill Metrics (Deterministic, calculated from tokenUsage.input)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Average context fill percentage across all messages with token data.
   * Calculated as: (input_tokens / 200,000) × 100
   *
   * This is a deterministic value based on actual token counts,
   * NOT an LLM estimate. Used by ContextEfficiencyWorker for accurate analysis.
   *
   * @example 42.3 means average 42.3% of context window used
   */
  avgContextFillPercent: z.number().min(0).max(100).optional(),

  /**
   * Maximum context fill percentage observed in any single message.
   * Useful for identifying sessions that approached context limits.
   *
   * @example 78.1 means highest observed was 78.1% of context window
   */
  maxContextFillPercent: z.number().min(0).max(100).optional(),

  /**
   * Count of messages where context fill exceeded 90%.
   * High count indicates frequent near-limit usage, potential efficiency issue.
   */
  contextFillExceeded90Count: z.number().int().min(0).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Friction Signals (Deterministic Detection)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deterministic friction signals detected from session data.
   *
   * These are hints for Phase 2 SessionOutcomeWorker to use:
   * - Not semantic analysis (that's Phase 2's job)
   * - Just counting patterns that can be detected without LLM
   *
   * Inspired by Claude Code's /insights friction tracking.
   */
  frictionSignals: z.object({
    /**
     * Count of tool execution failures (tool_result with is_error=true).
     * High count may indicate environment issues or incorrect tool usage.
     */
    toolFailureCount: z.number().int().min(0),

    /**
     * Count of user messages matching rejection patterns.
     * Patterns: "no", "wrong", "incorrect", "try again", "that's not right"
     * High count may indicate miscommunication or wrong approaches.
     */
    userRejectionSignals: z.number().int().min(0),

    /**
     * Count of sessions with excessive iterations (10+ user messages).
     * May indicate blocked states or iterative refinement.
     */
    excessiveIterationSessions: z.number().int().min(0),

    /**
     * Count of sessions where context fill exceeded 90%.
     * Indicates potential context overflow issues.
     */
    contextOverflowSessions: z.number().int().min(0),

    /**
     * Count of user messages expressing frustration or repetition.
     * Patterns: "again", "still not working", "same error", "frustrated", etc.
     * Max 1 count per message. Helps SessionOutcome detect frustrated satisfaction.
     */
    frustrationExpressionCount: z.number().int().min(0),

    /**
     * Number of unique tool error patterns that appeared 2+ times.
     * Error messages are fingerprinted (paths/timestamps removed) before comparison.
     * Helps ThinkingQuality detect error_loop and LearningBehavior detect repeatedMistakePatterns.
     */
    repeatedToolErrorPatterns: z.number().int().min(0),

    /**
     * Count of developer turns after an error where the natural language input
     * was very short (<10 words, <50% machine content) — indicating blind retry
     * without analysis. Helps LearningBehavior/ThinkingQuality detect blind_retry.
     */
    bareRetryAfterErrorCount: z.number().int().min(0),

    /**
     * Maximum consecutive turns where precedingAIHadError was true.
     * A chain of 3+ indicates an error loop. Helps ThinkingQuality detect
     * error_loop and SessionOutcome detect blocked_state.
     */
    errorChainMaxLength: z.number().int().min(0),
  }).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Session Hints (Deterministic Classification Hints)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Session structure hints for Phase 2 workers.
   *
   * These help SessionOutcomeWorker classify session types:
   * - Short sessions likely = quick_question
   * - Long sessions likely = multi_task or iterative_refinement
   */
  sessionHints: z.object({
    /** Average number of user turns per session */
    avgTurnsPerSession: z.number().min(0),

    /** Count of short sessions (1-3 user messages) */
    shortSessions: z.number().int().min(0),

    /** Count of medium sessions (4-10 user messages) */
    mediumSessions: z.number().int().min(0),

    /** Count of long sessions (11+ user messages) */
    longSessions: z.number().int().min(0),
  }).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // AI Insight Block Metrics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Total number of AI insight blocks (★ Insight) found across all sessions.
   * Only present when explanatory output mode was active.
   */
  aiInsightBlockCount: z.number().int().min(0).optional(),
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

  /** Computed session metrics */
  sessionMetrics: Phase1SessionMetricsSchema,

  /**
   * AI insight blocks extracted from assistant messages.
   *
   * Present only when sessions contain ★ Insight educational blocks
   * (generated when Claude Code is in "explanatory" output mode).
   * Sampled to max 50 blocks for token budget management.
   */
  aiInsightBlocks: z.array(AIInsightBlockSchema).optional(),
});
export type Phase1Output = z.infer<typeof Phase1OutputSchema>;
