/**
 * Data Extractor Worker (Phase 1 - v2 Architecture)
 *
 * Phase 1 worker that performs PURE EXTRACTION:
 * - Extracts raw developer utterances with structural metadata
 * - Extracts AI response metadata
 * - Computes session metrics
 *
 * IMPORTANT: This worker does NOT perform any semantic analysis.
 * It does NOT:
 * - Assign dimensions
 * - Classify signals (strength/growth)
 * - Detect patterns
 * - Make interpretations
 *
 * All semantic analysis is delegated to Phase 2 workers.
 *
 * @module analyzer/workers/data-extractor-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  type Phase1Output,
  type UserUtterance,
  type Phase1SessionMetrics,
  type AIInsightBlock,
} from '../../models/phase1-output';
import type { ParsedSession, ParsedMessage } from '../../models/session';
import type { OrchestratorConfig } from '../orchestrator/types';
import { strategicSampleUtterances } from '../shared/sampling-utils';
import { PHASE1_MAX_UTTERANCES, CLEAR_COMMAND_PATTERNS, KNOWN_SLASH_COMMANDS } from '../shared/constants';
import { GeminiClient, type TokenUsage } from '../clients/gemini-client';
import {
  BatchClassificationResultSchema,
  type ContentClassification,
  type ClassificationInput,
} from '../../models/content-classification';

/**
 * DataExtractorWorker - Extracts raw text and structural metadata
 *
 * Phase 1 worker that creates the Phase1Output used by Phase 2 workers.
 * Performs deterministic extraction followed by optional LLM-based filtering
 * to remove system-injected metadata from developer utterances.
 */
export class DataExtractorWorker extends BaseWorker<Phase1Output> {
  readonly name = 'DataExtractor';
  readonly phase = 1 as const;

  // Truncation/sampling limits to control downstream token usage
  private static readonly MAX_TEXT_LENGTH = 2000;

  /** Max content length for extracted insight blocks */
  private static readonly MAX_INSIGHT_CONTENT_LENGTH = 500;

  /** Max insight blocks to include in Phase 1 output (token budget control) */
  private static readonly MAX_INSIGHT_BLOCKS = 50;

  /**
   * Regex pattern for ★ Insight educational blocks in assistant messages.
   * Matches content between `★ Insight ─+` and `─+` delimiters.
   */
  private static readonly INSIGHT_BLOCK_PATTERN = /`★\s*Insight\s*─+`\n([\s\S]*?)\n`─+`/g;

  /**
   * Sanitize displayText from LLM to fix formatting issues.
   *
   * Fixes three known issues:
   * 1. Vertical text: LLM sometimes inserts \n between individual characters
   * 2. Raw markdown: Headers (# Title), bold (**text**), etc. appear as-is
   * 3. Whitespace: Multiple spaces or newlines need normalization
   *
   * @param text - The displayText from LLM classification
   * @returns Sanitized displayText safe for frontend rendering
   */
  private static sanitizeDisplayText(text: string): string {
    let result = text;
    let prev = '';
    while (result !== prev) {
      prev = result;
      result = result.replace(/(.)\n(.)/g, '$1$2');
    }

    return result
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static readonly MAX_UTTERANCES = PHASE1_MAX_UTTERANCES;
  private static readonly TRUNCATION_MARKER = '... [truncated]';

  // LLM filtering configuration
  private static readonly LLM_FILTER_MIN_LENGTH = 10; // Skip LLM for very short utterances only
  private static readonly LLM_FILTER_CONFIDENCE_THRESHOLD = 0.7; // Filter if confidence >= threshold
  private static readonly LLM_FILTER_BATCH_SIZE = 300; // Max utterances per LLM call (optimized for API cost reduction)

  /** Dedicated Gemini client for LLM filtering (created lazily) */
  private filterClient?: GeminiClient;

  /** Accumulated token usage from LLM filtering */
  private filterTokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(config?: OrchestratorConfig) {
    super(config);
  }

  /**
   * Get or create the Gemini client for LLM filtering
   */
  private getFilterClient(): GeminiClient {
    if (!this.filterClient) {
      // Use existing client from BaseWorker if available, otherwise create new one
      this.filterClient = this.client ?? new GeminiClient();
    }
    return this.filterClient;
  }

  /**
   * Check if worker can run
   */
  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0;
  }

  /**
   * Execute the extraction
   *
   * Performs deterministic extraction followed by LLM-based filtering
   * to remove system-injected metadata from developer utterances.
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<Phase1Output>> {
    this.log(`Extracting from ${context.sessions.length} sessions...`);
    const totalStartTime = Date.now();

    // Reset token usage for this execution
    this.filterTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const allUserUtterances: UserUtterance[] = [];
    const allSlashCommands: string[] = [];

    // Process each session — extract ALL utterances first
    const extractStartTime = Date.now();
    for (const session of context.sessions) {
      // Extract slash commands from raw user messages BEFORE stripSystemTags
      for (const message of session.messages) {
        if (message.role === 'user') {
          const commands = DataExtractorWorker.extractSlashCommands(message.content);
          allSlashCommands.push(...commands);
        }
      }

      const utterances = this.extractFromSession(session);
      allUserUtterances.push(...utterances);
    }
    const extractElapsed = Date.now() - extractStartTime;
    this.log(`[Timing] Session extraction: ${extractElapsed}ms (${allUserUtterances.length} utterances)`);

    // Extract AI insight blocks from assistant messages (deterministic, no LLM)
    const insightStartTime = Date.now();
    const allInsightBlocks = this.extractAllInsightBlocks(context.sessions);
    const sampledInsightBlocks = this.sampleInsightBlocks(allInsightBlocks, DataExtractorWorker.MAX_INSIGHT_BLOCKS);
    const insightElapsed = Date.now() - insightStartTime;
    if (allInsightBlocks.length > 0) {
      this.log(`[Timing] Insight extraction: ${insightElapsed}ms (${allInsightBlocks.length} found, ${sampledInsightBlocks.length} sampled)`);
    }

    // NEW: Apply LLM-based filtering to remove system metadata
    const filterStartTime = Date.now();
    const filteredUtterances = await this.filterSystemMetadataWithLLM(allUserUtterances);
    const filterElapsed = Date.now() - filterStartTime;
    this.log(`[Timing] LLM filtering: ${filterElapsed}ms`);

    this.log(`Filtered ${allUserUtterances.length - filteredUtterances.length} system metadata utterances`);

    // Compute metrics from filtered data (accurate representation of developer input)
    const metricsStartTime = Date.now();
    const sessionMetrics = this.computeSessionMetrics(context.sessions, filteredUtterances, allSlashCommands);
    // Add insight block count to metrics (only if any found)
    if (allInsightBlocks.length > 0) {
      sessionMetrics.aiInsightBlockCount = allInsightBlocks.length;
    }
    const metricsElapsed = Date.now() - metricsStartTime;
    this.log(`[Timing] Metrics computation: ${metricsElapsed}ms`);

    // Apply strategic sampling to reduce downstream token usage
    const sampledUtterances = this.sampleUtterances(filteredUtterances, DataExtractorWorker.MAX_UTTERANCES);

    const output: Phase1Output = {
      developerUtterances: sampledUtterances,
      sessionMetrics,
      ...(sampledInsightBlocks.length > 0 ? { aiInsightBlocks: sampledInsightBlocks } : {}),
    };

    const totalElapsed = Date.now() - totalStartTime;
    this.log(`[Timing] Total execute(): ${totalElapsed}ms`);
    this.log(`Extracted ${filteredUtterances.length} utterances, sampled to ${sampledUtterances.length}`);

    // Return token usage from LLM filtering (if any)
    const usage = this.filterTokenUsage.totalTokens > 0 ? this.filterTokenUsage : null;
    return this.createSuccessResult(output, usage);
  }

  /**
   * Extract utterances from a single session
   *
   * NOTE: Claude Code may split complex messages (image+text) into multiple
   * JSONL lines with identical timestamps and text content. We deduplicate
   * by tracking timestamp+text combinations to avoid counting the same
   * developer input multiple times.
   */
  private extractFromSession(session: ParsedSession): UserUtterance[] {
    const utterances: UserUtterance[] = [];

    // Track seen messages to deduplicate split complex messages
    // Key: timestamp ISO string + first 200 chars of cleaned text
    const seenKeys = new Set<string>();

    let precedingAIResponse: ParsedMessage | null = null;

    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i];
      const turnIndex = i;

      if (message.role === 'user') {
        // Strip system tags first to get clean text for deduplication
        const cleanText = this.stripSystemTags(message.content).trim();

        // Generate deduplication key from timestamp + cleaned text prefix
        const dedupeKey = this.getDeduplicationKey(message.timestamp, cleanText);

        // Skip if we've already seen this timestamp+text combination
        if (seenKeys.has(dedupeKey)) {
          this.log(`Skipping duplicate utterance: timestamp=${message.timestamp.toISOString()}, text="${cleanText.slice(0, 50)}..."`);
          continue;
        }
        seenKeys.add(dedupeKey);

        const utterance = this.extractDeveloperUtterance(
          session,
          message,
          turnIndex,
          precedingAIResponse
        );
        // Skip utterances that became empty after system tag removal
        if (utterance.text.trim()) {
          utterances.push(utterance);
        }
        precedingAIResponse = null;
      } else if (message.role === 'assistant') {
        // Track preceding AI response for context metadata on next user utterance
        precedingAIResponse = message;
      }
    }

    return utterances;
  }

  /**
   * Extract a developer utterance with structural metadata
   */
  private extractDeveloperUtterance(
    session: ParsedSession,
    message: ParsedMessage,
    turnIndex: number,
    precedingAI: ParsedMessage | null
  ): UserUtterance {
    // Strip system-injected tags FIRST, before any processing
    const rawText = message.content;
    const originalText = this.stripSystemTags(rawText);
    const text = this.truncateText(originalText, DataExtractorWorker.MAX_TEXT_LENGTH);
    const id = `${session.sessionId}_${turnIndex}`;

    // Extract natural language segments (immutable developer text)
    const naturalLanguageSegments = this.extractNaturalLanguageSegments(originalText);

    // Calculate machine content ratio: 1 - (natural language chars / total chars)
    // Ratio of 1.0 = all machine content, 0.0 = all developer text
    // Use segment range (end - start) for accurate ratio, not trimmed text length
    const totalChars = originalText.length;
    const naturalLanguageChars = naturalLanguageSegments.reduce(
      (sum, segment) => sum + (segment.end - segment.start),
      0
    );
    const machineContentRatio = totalChars > 0
      ? 1 - (naturalLanguageChars / totalChars)
      : 0;

    return {
      id,
      text,
      timestamp: message.timestamp.toISOString(),
      sessionId: session.sessionId,
      turnIndex,

      // Natural language segments (protected from modification)
      naturalLanguageSegments: naturalLanguageSegments.length > 0 ? naturalLanguageSegments : undefined,

      // Machine content ratio for Phase 2 error reporting evaluation
      machineContentRatio,

      // Structural metadata computed from ORIGINAL text (preserves accurate metrics)
      characterCount: originalText.length,
      wordCount: this.countWords(originalText),
      hasCodeBlock: this.hasCodeBlock(originalText),
      hasQuestion: this.hasQuestion(originalText),
      isSessionStart: turnIndex === 0,
      isContinuation: this.isContinuation(originalText),

      // Context from preceding AI response
      precedingAIToolCalls: precedingAI?.toolCalls?.map(tc => tc.name),
      precedingAIHadError: this.hadError(precedingAI),
    };
  }

  // Claude Code context window size in tokens
  private static readonly CONTEXT_WINDOW_SIZE = 200_000;

  /**
   * Compute context fill metrics from token usage data.
   *
   * Calculates deterministic context fill percentages based on actual input_tokens
   * from ParsedMessage.tokenUsage. This replaces LLM estimation with real data.
   *
   * @param sessions - All parsed sessions
   * @returns Context fill metrics or undefined if no token data available
   */
  private computeContextFillMetrics(
    sessions: ParsedSession[]
  ): {
    avgContextFillPercent?: number;
    maxContextFillPercent?: number;
    contextFillExceeded90Count?: number;
  } {
    const fillPercentages: number[] = [];

    for (const session of sessions) {
      for (const message of session.messages) {
        // Only assistant messages have tokenUsage (input represents context at that point)
        if (message.role === 'assistant' && message.tokenUsage?.input) {
          const fillPercent = (message.tokenUsage.input / DataExtractorWorker.CONTEXT_WINDOW_SIZE) * 100;
          fillPercentages.push(fillPercent);
        }
      }
    }

    if (fillPercentages.length === 0) {
      // No token data available
      return {};
    }

    const avgFill = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
    const maxFill = Math.max(...fillPercentages);
    const exceeded90Count = fillPercentages.filter(p => p >= 90).length;

    return {
      avgContextFillPercent: Math.round(avgFill * 10) / 10, // 1 decimal place
      maxContextFillPercent: Math.round(maxFill * 10) / 10,
      contextFillExceeded90Count: exceeded90Count,
    };
  }

  /**
   * Compute aggregated session metrics
   */
  private computeSessionMetrics(
    sessions: ParsedSession[],
    utterances: UserUtterance[],
    allSlashCommands: string[] = []
  ): Phase1SessionMetrics {
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalDevUtterances = utterances.length;
    const totalAIResponses = totalMessages - totalDevUtterances;

    const avgDeveloperMessageLength = utterances.length > 0
      ? utterances.reduce((sum, u) => sum + u.characterCount, 0) / utterances.length
      : 0;

    const questionCount = utterances.filter(u => u.hasQuestion).length;
    const codeBlockCount = utterances.filter(u => u.hasCodeBlock).length;

    // Calculate slash command counts (developer-initiated actions)
    const slashCommandCounts: Record<string, number> = {};
    for (const cmd of allSlashCommands) {
      slashCommandCounts[cmd] = (slashCommandCounts[cmd] || 0) + 1;
    }

    // Calculate date range
    const timestamps = sessions.flatMap(s =>
      s.messages.map(m => m.timestamp.toISOString())
    );
    timestamps.sort();

    // Calculate context fill metrics (deterministic, from token data)
    const contextFillMetrics = this.computeContextFillMetrics(sessions);

    // Calculate friction signals (deterministic detection)
    const frictionSignals = this.computeFrictionSignals(sessions, utterances);

    // Calculate session hints (deterministic classification hints)
    const sessionHints = this.computeSessionHints(sessions);

    return {
      totalSessions: sessions.length,
      totalMessages,
      totalDeveloperUtterances: totalDevUtterances,
      totalAIResponses,
      avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
      avgDeveloperMessageLength,
      questionRatio: utterances.length > 0 ? questionCount / utterances.length : 0,
      codeBlockRatio: utterances.length > 0 ? codeBlockCount / utterances.length : 0,
      dateRange: {
        earliest: timestamps[0] ?? new Date().toISOString(),
        latest: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
      },
      // Slash command counts (developer-initiated actions)
      ...(Object.keys(slashCommandCounts).length > 0 ? { slashCommandCounts } : {}),
      // Context fill metrics (deterministic calculation)
      ...contextFillMetrics,
      // Friction signals for SessionOutcomeWorker
      frictionSignals,
      // Session hints for SessionOutcomeWorker
      sessionHints,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Slash Command Extraction (Developer-Initiated Actions)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract slash commands from raw user message content.
   *
   * MUST be called on raw content BEFORE stripSystemTags(), because
   * XML-tagged commands (`<command-name>/xxx</command-name>`) are stripped
   * by that method.
   *
   * Two extraction strategies:
   * 1. XML-tagged: `<command-name>/xxx</command-name>` — always trusted
   * 2. Plain-text: `/xxx` at line start — only if in KNOWN_SLASH_COMMANDS whitelist
   *    (prevents false positives from file paths like `/Users/foo/bar`)
   *
   * @param rawContent - Raw message content before system tag stripping
   * @returns Array of slash command names (without leading `/`)
   */
  private static extractSlashCommands(rawContent: string): string[] {
    const commands: string[] = [];

    // Strategy 1: XML-tagged commands (always trusted)
    const xmlPattern = /<command-name>\/([\w-]+)<\/command-name>/g;
    let match;
    while ((match = xmlPattern.exec(rawContent)) !== null) {
      commands.push(match[1]!);
    }

    // Strategy 2: Plain-text `/xxx` at line start (whitelist-matched only)
    const plainPattern = /^\/(\w[\w-]*)/gm;
    while ((match = plainPattern.exec(rawContent)) !== null) {
      const cmd = match[1]!;
      if (KNOWN_SLASH_COMMANDS.has(cmd)) {
        commands.push(cmd);
      }
    }

    return commands;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Segment-Aware Session Splitting (/clear boundary detection)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a message is a /clear command.
   * Checks raw content (before stripSystemTags) so XML-tagged variants are detected.
   */
  private static isClearCommand(message: ParsedMessage): boolean {
    if (message.role !== 'user') return false;
    return CLEAR_COMMAND_PATTERNS.some(pattern => pattern.test(message.content));
  }

  /**
   * Split a session's messages into logical segments at /clear boundaries.
   * The /clear message itself is excluded from all segments.
   * Returns at least one segment (the original messages if no /clear found).
   */
  private static splitSessionByClears(messages: ParsedMessage[]): ParsedMessage[][] {
    const segments: ParsedMessage[][] = [];
    let current: ParsedMessage[] = [];

    for (const message of messages) {
      if (DataExtractorWorker.isClearCommand(message)) {
        if (current.length > 0) {
          segments.push(current);
        }
        current = [];
      } else {
        current.push(message);
      }
    }

    if (current.length > 0) {
      segments.push(current);
    }

    return segments.length > 0 ? segments : [[]];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Friction Signal Detection (Deterministic)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * User rejection patterns - phrases indicating developer rejected AI's suggestion.
   * These are checked case-insensitively at word boundaries.
   */
  private static readonly REJECTION_PATTERNS = [
    /\b(no|nope|wrong|incorrect|that'?s not right)\b/i,
    /\b(try again|redo|fix this|doesn'?t work|didn'?t work)\b/i,
    /\b(not what I (asked|wanted|meant))\b/i,
    /\b(you misunderstood|that'?s not what)\b/i,
  ];

  /**
   * Frustration/repetition expression patterns.
   * Detected in user messages to signal frustration or repeated failures.
   * Max 1 match per message.
   */
  private static readonly FRUSTRATION_PATTERNS = [
    // Repetition signals
    /\b(again)\b/i,
    /\b(keep(s)? happening)\b/i,
    /\b(keep(s)? failing)\b/i,
    /\b(same (error|issue|problem|bug))\b/i,
    /\b(still not working)\b/i,
    /\b(over and over)\b/i,
    /\b(one more time)\b/i,
    /\b(happening again)\b/i,
    /\b(still broken)\b/i,
    /\b(still failing)\b/i,
    // Frustration signals
    /\b(frustrated)\b/i,
    /\b(annoying)\b/i,
    /\bwhy isn'?t\b/i,
    /\bwhy doesn'?t\b/i,
    /\b(what'?s wrong)\b/i,
    /\b(give up)\b/i,
    /\b(this is broken)\b/i,
    /\b(stuck on)\b/i,
  ];

  /**
   * Normalize an error message into a fingerprint for deduplication.
   * Removes variable parts (file paths, line numbers, timestamps, hex addresses)
   * so that the same type of error maps to the same key.
   */
  private static normalizeErrorFingerprint(errorMessage: string): string {
    return errorMessage
      .replace(/\/[\w\-./]+/g, '<PATH>')           // file paths
      .replace(/:\d+:\d+/g, '<LOC>')               // line:col
      .replace(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/g, '<TS>')  // timestamps
      .replace(/0x[0-9a-f]+/gi, '<ADDR>')           // hex addresses
      .slice(0, 200)
      .trim();
  }

  /**
   * Compute friction signals from sessions (deterministic detection).
   *
   * These signals help SessionOutcomeWorker identify friction points:
   * - Tool failures (from tool_result.is_error)
   * - User rejections (from rejection pattern matching)
   * - Excessive iterations (sessions with 10+ user messages)
   * - Context overflow (sessions hitting 90%+ context)
   */
  private computeFrictionSignals(
    sessions: ParsedSession[],
    utterances: UserUtterance[]
  ): Phase1SessionMetrics['frictionSignals'] {
    let toolFailureCount = 0;
    let userRejectionSignals = 0;
    let excessiveIterationSessions = 0;
    let contextOverflowSessions = 0;
    let frustrationExpressionCount = 0;
    let bareRetryAfterErrorCount = 0;
    let errorChainMaxLength = 0;

    // Track all tool error fingerprints across sessions for repeated pattern detection
    const errorFingerprints = new Map<string, number>();

    for (const session of sessions) {
      // Split session into logical segments at /clear boundaries
      const segments = DataExtractorWorker.splitSessionByClears(session.messages);

      for (const segment of segments) {
        let segmentUserMessages = 0;
        let segmentHadContextOverflow = false;

        for (const message of segment) {
          if (message.role === 'user') {
            segmentUserMessages++;
            const text = message.content;

            // Check for rejection patterns in user messages
            for (const pattern of DataExtractorWorker.REJECTION_PATTERNS) {
              if (pattern.test(text)) {
                userRejectionSignals++;
                break; // Count max once per message
              }
            }

            // Check for frustration/repetition expressions
            for (const pattern of DataExtractorWorker.FRUSTRATION_PATTERNS) {
              if (pattern.test(text)) {
                frustrationExpressionCount++;
                break; // Count max once per message
              }
            }
          }

          if (message.role === 'assistant') {
            // Count tool failures and collect error fingerprints
            if (message.toolCalls) {
              for (const toolCall of message.toolCalls) {
                if (toolCall.isError) {
                  toolFailureCount++;

                  // Fingerprint tool errors for repeated pattern detection
                  if (toolCall.result) {
                    const fingerprint = DataExtractorWorker.normalizeErrorFingerprint(toolCall.result);
                    if (fingerprint) {
                      errorFingerprints.set(fingerprint, (errorFingerprints.get(fingerprint) ?? 0) + 1);
                    }
                  }
                }
              }
            }

            // Check for context overflow
            if (message.tokenUsage?.input) {
              const fillPercent = (message.tokenUsage.input / DataExtractorWorker.CONTEXT_WINDOW_SIZE) * 100;
              if (fillPercent >= 90) {
                segmentHadContextOverflow = true;
              }
            }
          }
        }

        // Count excessive iteration segments (10+ user messages)
        if (segmentUserMessages >= 10) {
          excessiveIterationSessions++;
        }

        // Count context overflow segments
        if (segmentHadContextOverflow) {
          contextOverflowSessions++;
        }
      }
    }

    // Compute bare retry count and error chain max from utterances
    // (utterances have precedingAIHadError, wordCount, machineContentRatio)
    // Group utterances by session to compute per-session error chains
    const utterancesBySession = new Map<string, UserUtterance[]>();
    for (const u of utterances) {
      const group = utterancesBySession.get(u.sessionId) ?? [];
      group.push(u);
      utterancesBySession.set(u.sessionId, group);
    }

    for (const sessionUtterances of utterancesBySession.values()) {
      let currentChain = 0;

      for (const u of sessionUtterances) {
        if (u.precedingAIHadError) {
          currentChain++;

          // Bare retry: short natural language after an error (no analysis)
          const ratio = u.machineContentRatio ?? 0;
          if (u.wordCount < 10 && ratio < 0.5) {
            bareRetryAfterErrorCount++;
          }
        } else {
          currentChain = 0;
        }

        if (currentChain > errorChainMaxLength) {
          errorChainMaxLength = currentChain;
        }
      }
    }

    // Count unique error patterns that appeared 2+ times
    let repeatedToolErrorPatterns = 0;
    for (const count of errorFingerprints.values()) {
      if (count >= 2) {
        repeatedToolErrorPatterns++;
      }
    }

    return {
      toolFailureCount,
      userRejectionSignals,
      excessiveIterationSessions,
      contextOverflowSessions,
      frustrationExpressionCount,
      repeatedToolErrorPatterns,
      bareRetryAfterErrorCount,
      errorChainMaxLength,
    };
  }

  /**
   * Compute session hints for SessionOutcomeWorker.
   *
   * Helps classify session types:
   * - Short sessions (1-3 user messages) → likely quick_question
   * - Medium sessions (4-10 user messages) → likely single_task
   * - Long sessions (11+ user messages) → likely multi_task or iterative_refinement
   */
  private computeSessionHints(
    sessions: ParsedSession[]
  ): Phase1SessionMetrics['sessionHints'] {
    let totalUserTurns = 0;
    let totalSegments = 0;
    let shortSessions = 0;
    let mediumSessions = 0;
    let longSessions = 0;

    for (const session of sessions) {
      // Split session into logical segments at /clear boundaries
      const segments = DataExtractorWorker.splitSessionByClears(session.messages);

      for (const segment of segments) {
        const userMessageCount = segment.filter(m => m.role === 'user').length;
        totalUserTurns += userMessageCount;
        totalSegments++;

        if (userMessageCount <= 3) {
          shortSessions++;
        } else if (userMessageCount <= 10) {
          mediumSessions++;
        } else {
          longSessions++;
        }
      }
    }

    return {
      avgTurnsPerSession: totalSegments > 0 ? totalUserTurns / totalSegments : 0,
      shortSessions,
      mediumSessions,
      longSessions,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI Insight Block Extraction (Deterministic)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract all AI insight blocks from assistant messages across all sessions.
   *
   * Scans assistant messages for ★ Insight educational blocks and extracts
   * the content between delimiters. Links each insight to the preceding
   * user utterance via triggeringUtteranceId.
   *
   * @param sessions - All parsed sessions
   * @returns Array of extracted insight blocks
   */
  private extractAllInsightBlocks(sessions: ParsedSession[]): AIInsightBlock[] {
    const blocks: AIInsightBlock[] = [];

    for (const session of sessions) {
      let lastUserTurnIndex: number | null = null;

      for (let i = 0; i < session.messages.length; i++) {
        const message = session.messages[i];

        if (message.role === 'user') {
          lastUserTurnIndex = i;
        } else if (message.role === 'assistant') {
          // Reset regex state for each message
          DataExtractorWorker.INSIGHT_BLOCK_PATTERN.lastIndex = 0;

          let match;
          while ((match = DataExtractorWorker.INSIGHT_BLOCK_PATTERN.exec(message.content)) !== null) {
            const rawContent = match[1].trim();
            if (!rawContent) continue;

            const content = rawContent.length > DataExtractorWorker.MAX_INSIGHT_CONTENT_LENGTH
              ? rawContent.slice(0, DataExtractorWorker.MAX_INSIGHT_CONTENT_LENGTH) + '...'
              : rawContent;

            const block: AIInsightBlock = {
              sessionId: session.sessionId,
              turnIndex: i,
              content,
            };

            // Link to preceding user utterance if available
            if (lastUserTurnIndex !== null) {
              block.triggeringUtteranceId = `${session.sessionId}_${lastUserTurnIndex}`;
            }

            blocks.push(block);
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Sample insight blocks to fit within token budget.
   *
   * Uses bookend strategy per session: keep first + last insight per session,
   * fill remaining slots with evenly-spaced middle insights.
   *
   * @param blocks - All extracted insight blocks
   * @param maxCount - Maximum number of blocks to include
   * @returns Sampled insight blocks preserving session distribution
   */
  private sampleInsightBlocks(blocks: AIInsightBlock[], maxCount: number): AIInsightBlock[] {
    if (blocks.length <= maxCount) return blocks;

    // Group by session
    const bySession = new Map<string, AIInsightBlock[]>();
    for (const block of blocks) {
      const group = bySession.get(block.sessionId) ?? [];
      group.push(block);
      bySession.set(block.sessionId, group);
    }

    const sampled = new Set<AIInsightBlock>();

    // Keep first + last per session (bookends)
    for (const group of bySession.values()) {
      sampled.add(group[0]);
      if (group.length > 1) {
        sampled.add(group[group.length - 1]);
      }
    }

    // Fill remaining slots with evenly-spaced middle blocks
    const remaining = maxCount - sampled.size;
    if (remaining > 0) {
      const unsampled = blocks.filter(b => !sampled.has(b));
      const step = Math.max(1, Math.floor(unsampled.length / remaining));
      for (let i = 0; i < unsampled.length && sampled.size < maxCount; i += step) {
        sampled.add(unsampled[i]);
      }
    }

    // Return in original order
    return blocks.filter(b => sampled.has(b));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Truncation & Sampling Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Truncate text at word boundary, appending marker if truncated.
   * Falls back to hard cut if word boundary is too far back (>20%).
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const cutPoint = maxLength - DataExtractorWorker.TRUNCATION_MARKER.length;
    const lastSpace = text.lastIndexOf(' ', cutPoint);

    // Use word boundary if it's within 20% of the cut point
    const minAcceptable = cutPoint * 0.8;
    const truncated = lastSpace > minAcceptable
      ? text.slice(0, lastSpace)
      : text.slice(0, cutPoint);

    return truncated + DataExtractorWorker.TRUNCATION_MARKER;
  }

  /**
   * Strategic sampling of developer utterances.
   * Delegates to shared utility (bookend + even spacing strategy).
   */
  private sampleUtterances(
    all: UserUtterance[],
    maxCount: number
  ): UserUtterance[] {
    return strategicSampleUtterances(all, maxCount);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods (Structural, NOT Semantic)
  // ─────────────────────────────────────────────────────────────────────────

  private countWords(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  private hasCodeBlock(text: string): boolean {
    return text.includes('```') || text.includes('`');
  }

  private hasQuestion(text: string): boolean {
    return text.includes('?');
  }

  private isContinuation(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    const continuationPhrases = [
      'continue', 'go on', 'keep going', 'proceed', 'next',
      'and then', 'also', 'additionally', 'furthermore',
    ];
    return continuationPhrases.some(phrase => lowerText.startsWith(phrase));
  }

  /**
   * Strip system-injected tags from user message content.
   * Claude Code injects these tags into user-role messages.
   * These are not the developer's own words.
   */
  private stripSystemTags(text: string): string {
    const systemTagPatterns = [
      // Claude Code system tags
      /<system-reminder>[\s\S]*?<\/system-reminder>/g,
      /<command-name>[\s\S]*?<\/command-name>/g,
      /<command-message>[\s\S]*?<\/command-message>/g,
      /<command-args>[\s\S]*?<\/command-args>/g,
      /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
      /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
      /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g,

      // Task notification tags (Sisyphus/Ralph Loop system)
      /<task-notification>[\s\S]*?<\/task-notification>/g,
      /<task-id>[\s\S]*?<\/task-id>/g,
      /<status>[\s\S]*?<\/status>/g,
      /<summary>[\s\S]*?<\/summary>/g,
      /<result>[\s\S]*?<\/result>/g,
      /<output-file>[\s\S]*?<\/output-file>/g,
    ];

    let cleaned = text;
    for (const pattern of systemTagPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.replace(/\s{2,}/g, ' ').trim();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LLM-based System Metadata Filtering
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Filter system metadata from developer utterances using LLM classification.
   *
   * This method identifies and removes plain-text system metadata that isn't
   * caught by the regex-based stripSystemTags() method, such as:
   * - Skill documentation blocks ("Base directory for this skill: /path/...")
   * - Session continuation summaries ("This session is being continued...")
   * - Other system-injected content addressed TO Claude, not FROM the developer
   *
   * Optimization strategies:
   * 1. Skip short utterances (< 100 chars) - likely genuine developer input
   * 2. Batch processing - classify multiple utterances in one LLM call
   * 3. Use regex pre-filtering for known patterns before LLM
   *
   * @param utterances - All extracted developer utterances
   * @returns Filtered utterances with system metadata removed
   */
  private async filterSystemMetadataWithLLM(
    utterances: UserUtterance[]
  ): Promise<UserUtterance[]> {
    // Skip regex pre-filtering - rely solely on LLM classification
    // This allows LLM to handle all patterns including CLI/terminal output
    const preFiltered = utterances;

    // Separate utterances that need LLM classification
    const needsClassification = preFiltered.filter(
      u => u.text.length >= DataExtractorWorker.LLM_FILTER_MIN_LENGTH
    );
    const shortUtterances = preFiltered.filter(
      u => u.text.length < DataExtractorWorker.LLM_FILTER_MIN_LENGTH
    );

    if (needsClassification.length === 0) {
      // No LLM needed - all utterances are short enough to pass through
      return preFiltered;
    }

    const totalBatches = Math.ceil(needsClassification.length / DataExtractorWorker.LLM_FILTER_BATCH_SIZE);
    const PARALLEL_LIMIT = 3;
    this.log(`Classifying ${needsClassification.length} utterances for system metadata... (${totalBatches} batches, ${PARALLEL_LIMIT} parallel)`);

    // Prepare all batches
    const batches: { index: number; items: UserUtterance[] }[] = [];
    for (let i = 0; i < needsClassification.length; i += DataExtractorWorker.LLM_FILTER_BATCH_SIZE) {
      batches.push({
        index: batches.length + 1,
        items: needsClassification.slice(i, i + DataExtractorWorker.LLM_FILTER_BATCH_SIZE),
      });
    }

    // Process batches in parallel with concurrency limit
    const allResults: { batch: UserUtterance[]; classifications: ContentClassification[] }[] = [];

    for (let i = 0; i < batches.length; i += PARALLEL_LIMIT) {
      const parallelBatches = batches.slice(i, i + PARALLEL_LIMIT);
      const roundStartTime = Date.now();

      const results = await Promise.all(
        parallelBatches.map(async ({ index, items }) => {
          const classifications = await this.classifyBatch(items);
          return { index, batch: items, classifications };
        })
      );

      const roundElapsed = Date.now() - roundStartTime;
      const processedIndices = parallelBatches.map(b => b.index).join(',');
      this.log(`[Timing] Batches [${processedIndices}]/${totalBatches}: ${roundElapsed}ms (${parallelBatches.length} parallel)`);

      allResults.push(...results.map(r => ({ batch: r.batch, classifications: r.classifications })));
    }

    // Process all classification results
    const classifiedUtterances: UserUtterance[] = [];

    for (const { batch, classifications } of allResults) {
      // Keep only utterances classified as developer input with sufficient confidence
      for (let j = 0; j < batch.length; j++) {
        const classification = classifications[j];
        if (
          classification?.classification === 'developer' ||
          (classification?.classification === 'system' &&
            classification.confidence < DataExtractorWorker.LLM_FILTER_CONFIDENCE_THRESHOLD)
        ) {
          const utterance = batch[j]!;

          // Apply displayText from LLM sanitization
          // If LLM provided a sanitized displayText, use it (with additional sanitization)
          // Otherwise fallback to original text (no truncation - Phase 2 Workers handle as needed)
          if (classification?.displayText && classification.displayText.trim()) {
            // Apply post-processing to fix LLM formatting issues
            // (vertical text, raw markdown, whitespace)
            utterance.displayText = DataExtractorWorker.sanitizeDisplayText(classification.displayText);
          } else {
            // No displayText from LLM - use original text as-is
            utterance.displayText = utterance.text;
          }

          classifiedUtterances.push(utterance);
        } else {
          this.log(`Filtered: "${batch[j]!.text.slice(0, 50)}..." (${classification?.reason ?? 'system metadata'})`);
        }
      }
    }

    // Set displayText for short utterances (they bypass LLM, so set displayText = text)
    for (const utterance of shortUtterances) {
      if (!utterance.displayText) {
        utterance.displayText = utterance.text;
      }
    }

    // Combine short utterances (passed through) with classified ones
    return [...shortUtterances, ...classifiedUtterances];
  }

  /**
   * Classify a batch of utterances using LLM.
   *
   * @param batch - Utterances to classify
   * @returns Array of classifications in the same order as input
   */
  private async classifyBatch(
    batch: UserUtterance[]
  ): Promise<ContentClassification[]> {
    const inputs: ClassificationInput[] = batch.map(u => ({
      id: u.id,
      text: u.text,
    }));

    const systemPrompt = this.buildFilterSystemPrompt();
    const userPrompt = this.buildFilterUserPrompt(inputs);

    try {
      const client = this.getFilterClient();
      const result = await client.generateStructured({
        systemPrompt,
        userPrompt,
        responseSchema: BatchClassificationResultSchema,
        maxOutputTokens: 65536,
      });

      // Accumulate token usage
      this.filterTokenUsage.promptTokens += result.usage.promptTokens;
      this.filterTokenUsage.completionTokens += result.usage.completionTokens;
      this.filterTokenUsage.totalTokens += result.usage.totalTokens;

      const classifications = result.data.classifications;

      // Validate response length matches input batch
      if (classifications.length !== batch.length) {
        this.log(`Warning: LLM returned ${classifications.length} classifications for ${batch.length} inputs`);
        // Pad with conservative defaults if LLM returned fewer
        while (classifications.length < batch.length) {
          classifications.push({
            classification: 'developer',
            confidence: 0.5,
            reason: 'Missing classification, defaulting to developer',
          });
        }
        // Truncate if LLM returned more (unlikely but defensive)
        if (classifications.length > batch.length) {
          classifications.length = batch.length;
        }
      }

      return classifications;
    } catch (error) {
      // On LLM failure, fall back to keeping all utterances (conservative approach)
      // This is an exception to the No Fallback policy because filtering is optional
      console.warn('[DataExtractor] LLM classification failed, keeping all utterances:', error);
      return batch.map(() => ({
        classification: 'developer' as const,
        confidence: 0.5,
        reason: 'LLM classification failed, defaulting to developer',
      }));
    }
  }

  /**
   * Build the system prompt for the content classification LLM.
   *
   * This prompt performs TWO tasks in one call:
   * 1. Classification: developer vs system metadata
   * 2. Sanitization: Create display-friendly text for developer utterances
   *
   * OPTIMIZED: Reduced from ~4,500 tokens to ~1,200 tokens while preserving core logic.
   * Formatting issues (vertical text, markdown) are handled by sanitizeDisplayText().
   */
  private buildFilterSystemPrompt(): string {
    return `You are a content classifier for developer-AI conversation analysis.

## Classification
Classify as "developer" (keep) or "system" (filter):

**SYSTEM (filter out):**
- Skill docs: "Base directory for this skill:", session summaries
- CLI output without context: build logs, npm/git output, status symbols (✓✕⚠)
- Plan documents: "Implement the following plan:" + markdown content
- System instructions addressed TO Claude

**DEVELOPER (keep):**
- Questions, requests, instructions, code snippets, feedback
- Error reports WITH developer context: "I got this error: [error]"

## Sanitization (developer texts only)
Create displayText that:
- PRESERVES developer's words verbatim
- SUMMARIZES machine content: errors → [Error: brief], stack traces → [Stack trace], code → [Code: lang]
- SHORT TEXT (<50 chars): return UNCHANGED
- Target: <300 chars

EXAMPLE:
Input: "Login works. But got this: Error: No workspace ID at getData (storage.ts:91)"
Output: {"classification":"developer","confidence":0.95,"reason":"Developer reporting error","displayText":"Login works. But got this: [Error: No workspace ID][Stack trace]"}

When in doubt, classify as "developer". Return JSON with classifications array.`;
  }

  /**
   * Build the user prompt with the batch of texts to classify.
   */
  private buildFilterUserPrompt(inputs: ClassificationInput[]): string {
    const items = inputs.map((input, i) => {
      // Truncate very long texts for the classification prompt
      const truncatedText = input.text.length > 500
        ? input.text.slice(0, 500) + '...[truncated]'
        : input.text;
      return `[${i + 1}] ID: ${input.id}\nText: ${truncatedText}`;
    }).join('\n\n---\n\n');

    return `Classify each of the following ${inputs.length} text segments as "developer" or "system":

${items}

Return exactly ${inputs.length} classifications in order.`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Natural Language Preservation Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract natural language segments from text.
   *
   * Identifies which parts of the text are developer's actual words
   * vs machine-generated content (error logs, stack traces, code blocks).
   *
   * Machine content patterns:
   * - Error messages: Error:, Exception:, ERROR:
   * - Stack traces: at Function.method, Traceback
   * - Code blocks: ```...```
   * - JSON data: { "key": ... }
   * - CLI output: npm ERR!, git push output
   *
   * @param text - The original developer utterance text
   * @returns Array of natural language segments with start/end positions
   */
  private extractNaturalLanguageSegments(text: string): Array<{ start: number; end: number; text: string }> {
    const segments: Array<{ start: number; end: number; text: string }> = [];

    // Patterns for machine-generated content (to EXCLUDE from natural language)
    const machinePatterns: RegExp[] = [
      // Error messages and stack traces
      /(?:Error|ERROR|Exception|TypeError|SyntaxError|ReferenceError):\s*[^\n]+/g,
      /(?:at\s+\w+\.\w+\s*\([^)]+\))/g,
      /Traceback \(most recent call last\):[\s\S]*?(?=\n[^\s]|$)/g,

      // Code blocks
      /```[\s\S]*?```/g,

      // JSON data (objects and arrays)
      /\{[\s\S]*?\}/g,
      /\[[\s\S]*?\]/g,

      // CLI/terminal output patterns
      /npm\s+(?:ERR!|WARN)[^\n]*/g,
      /(?:GET|POST|PUT|DELETE|PATCH)\s+\/\S+\s+\d{3}/g,

      // File paths with line numbers
      /(?:at\s+)?[/\\]?(?:\w+[/\\])+\w+\.\w+:\d+(?::\d+)?/g,
    ];

    // Find all machine content ranges
    const machineRanges: Array<{ start: number; end: number }> = [];

    for (const pattern of machinePatterns) {
      let match;
      // Reset regex state for global patterns
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        machineRanges.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Sort and merge overlapping ranges
    machineRanges.sort((a, b) => a.start - b.start);
    const mergedRanges: Array<{ start: number; end: number }> = [];
    for (const range of machineRanges) {
      const last = mergedRanges[mergedRanges.length - 1];
      if (last && range.start <= last.end) {
        last.end = Math.max(last.end, range.end);
      } else {
        mergedRanges.push({ ...range });
      }
    }

    // Extract natural language segments (gaps between machine content)
    let currentPos = 0;
    for (const range of mergedRanges) {
      if (range.start > currentPos) {
        const rawSegment = text.slice(currentPos, range.start);
        const trimmed = rawSegment.trim();
        if (trimmed.length > 0) {
          // Adjust indices to match trimmed text
          const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length;
          const trailingWhitespace = rawSegment.length - rawSegment.trimEnd().length;
          segments.push({
            start: currentPos + leadingWhitespace,
            end: range.start - trailingWhitespace,
            text: trimmed,
          });
        }
      }
      currentPos = range.end;
    }

    // Add final segment if any text remains
    if (currentPos < text.length) {
      const rawSegment = text.slice(currentPos);
      const trimmed = rawSegment.trim();
      if (trimmed.length > 0) {
        const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length;
        const trailingWhitespace = rawSegment.length - rawSegment.trimEnd().length;
        segments.push({
          start: currentPos + leadingWhitespace,
          end: text.length - trailingWhitespace,
          text: trimmed,
        });
      }
    }

    // If no machine content was found, the entire text is natural language
    if (segments.length === 0 && text.trim().length > 0) {
      const trimmed = text.trim();
      const leadingWhitespace = text.length - text.trimStart().length;
      const trailingWhitespace = text.length - text.trimEnd().length;
      segments.push({
        start: leadingWhitespace,
        end: text.length - trailingWhitespace,
        text: trimmed,
      });
    }

    return segments;
  }

  private hadError(message: ParsedMessage | null): boolean {
    if (!message) return false;

    if (message.toolCalls?.some(tc => tc.isError)) return true;

    const content = message.content.toLowerCase();
    return content.includes('error:') || content.includes('failed') ||
           content.includes('exception') || content.includes('traceback');
  }

  /**
   * Generate a deduplication key for a message.
   *
   * Uses timestamp + text content prefix for uniqueness.
   * Claude Code may split complex messages (image+text) into multiple
   * JSONL lines with identical timestamps and text content.
   *
   * @param timestamp - Message timestamp
   * @param text - Cleaned text content (after system tag removal)
   * @returns Deduplication key string
   */
  private getDeduplicationKey(timestamp: Date, text: string): string {
    const isoTimestamp = timestamp.toISOString();
    // Use first 200 chars to avoid issues with very long identical messages
    const textPrefix = text.slice(0, 200);
    return `${isoTimestamp}|${textPrefix}`;
  }

}

/**
 * Factory function for creating DataExtractorWorker
 */
export function createDataExtractorWorker(
  config?: OrchestratorConfig
): DataExtractorWorker {
  return new DataExtractorWorker(config);
}
