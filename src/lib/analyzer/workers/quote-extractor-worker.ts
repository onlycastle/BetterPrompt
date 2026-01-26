/**
 * Quote Extractor Worker (Phase 1 - v2 Architecture)
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
 * @module analyzer/workers/quote-extractor-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  Phase1OutputSchema,
  type Phase1Output,
  type DeveloperUtterance,
  type AIResponse,
  type Phase1SessionMetrics,
  createEmptyPhase1Output,
} from '../../models/phase1-output';
import type { ParsedSession, ParsedMessage } from '../../models/session';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';

/**
 * Worker configuration
 */
export interface QuoteExtractorWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * QuoteExtractorWorker - Extracts raw text and structural metadata
 *
 * Phase 1 worker that creates the Phase1Output used by Phase 2 workers.
 * This is a deterministic extraction - no LLM calls needed.
 */
export class QuoteExtractorWorker extends BaseWorker<Phase1Output> {
  readonly name = 'QuoteExtractor';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free';

  private verbose: boolean;

  constructor(config?: QuoteExtractorWorkerConfig) {
    super();
    this.verbose = config?.verbose ?? false;
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
   * This is a deterministic extraction - no LLM calls.
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<Phase1Output>> {
    this.logMessage(`Extracting from ${context.sessions.length} sessions...`);

    const developerUtterances: DeveloperUtterance[] = [];
    const aiResponses: AIResponse[] = [];

    // Process each session
    for (const session of context.sessions) {
      const { utterances, responses } = this.extractFromSession(session);
      developerUtterances.push(...utterances);
      aiResponses.push(...responses);
    }

    // Compute session metrics
    const sessionMetrics = this.computeSessionMetrics(context.sessions, developerUtterances);

    const output: Phase1Output = {
      developerUtterances,
      aiResponses,
      sessionMetrics,
      extractionConfidence: this.computeExtractionConfidence(context.sessions),
      extractionWarnings: this.generateWarnings(context.sessions, developerUtterances),
    };

    this.logMessage(`Extracted ${developerUtterances.length} utterances`);
    this.logMessage(`Extracted ${aiResponses.length} AI responses`);

    // No token usage since this is deterministic extraction
    return this.createSuccessResult(output, null);
  }

  /**
   * Extract utterances and responses from a single session
   */
  private extractFromSession(session: ParsedSession): {
    utterances: DeveloperUtterance[];
    responses: AIResponse[];
  } {
    const utterances: DeveloperUtterance[] = [];
    const responses: AIResponse[] = [];

    let precedingAIResponse: ParsedMessage | null = null;

    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i];
      const turnIndex = i;

      if (message.role === 'user') {
        const utterance = this.extractDeveloperUtterance(
          session,
          message,
          turnIndex,
          precedingAIResponse
        );
        utterances.push(utterance);
        precedingAIResponse = null;
      } else if (message.role === 'assistant') {
        const response = this.extractAIResponse(session, message, turnIndex);
        responses.push(response);
        precedingAIResponse = message;
      }
    }

    return { utterances, responses };
  }

  /**
   * Extract a developer utterance with structural metadata
   */
  private extractDeveloperUtterance(
    session: ParsedSession,
    message: ParsedMessage,
    turnIndex: number,
    precedingAI: ParsedMessage | null
  ): DeveloperUtterance {
    const text = message.content;
    const id = `${session.sessionId}_${turnIndex}`;

    return {
      id,
      text,
      timestamp: message.timestamp.toISOString(),
      sessionId: session.sessionId,
      turnIndex,

      // Structural metadata (computed, NOT LLM)
      characterCount: text.length,
      wordCount: this.countWords(text),
      hasCodeBlock: this.hasCodeBlock(text),
      hasQuestion: this.hasQuestion(text),
      isSessionStart: turnIndex === 0,
      isContinuation: this.isContinuation(text),

      // Context from preceding AI response
      precedingAIToolCalls: precedingAI?.toolCalls?.map(tc => tc.name),
      precedingAIResponseLength: precedingAI?.content.length ?? 0,
      precedingAIHadError: this.hadError(precedingAI),
    };
  }

  /**
   * Extract AI response metadata
   */
  private extractAIResponse(
    session: ParsedSession,
    message: ParsedMessage,
    turnIndex: number
  ): AIResponse {
    const id = `${session.sessionId}_${turnIndex}`;
    const toolsUsed = message.toolCalls?.map(tc => tc.name) ?? [];

    return {
      id,
      sessionId: session.sessionId,
      turnIndex,
      responseType: this.classifyResponseType(message),
      toolsUsed,
      textSnippet: message.content.slice(0, 1500),
      fullTextLength: message.content.length,
      hadError: this.hadError(message),
      wasSuccessful: this.wasSuccessful(message),
    };
  }

  /**
   * Classify the response type based on content and tools used
   */
  private classifyResponseType(message: ParsedMessage): AIResponse['responseType'] {
    const tools = message.toolCalls?.map(tc => tc.name) ?? [];
    const content = message.content.toLowerCase();

    // Check for planning indicators
    if (tools.includes('EnterPlanMode') || tools.includes('ExitPlanMode') ||
        tools.includes('TodoWrite') || tools.includes('TodoRead')) {
      return 'planning';
    }

    // Check for code editing
    if (tools.includes('Edit') || tools.includes('Write')) {
      return 'code_edit';
    }

    // Check for code generation (Write without Read)
    if (tools.includes('Write') && !tools.includes('Read')) {
      return 'code_generation';
    }

    // Check for error fixing indicators
    if (content.includes('error') || content.includes('fix') ||
        content.includes('bug') || content.includes('issue')) {
      return 'error_fix';
    }

    // Check for tool execution
    if (tools.includes('Bash') || tools.includes('Task')) {
      return 'tool_execution';
    }

    // Check for questions
    if (content.includes('?') || content.includes('would you') ||
        content.includes('do you want')) {
      return 'question';
    }

    // Check for explanation
    if (content.includes('let me explain') || content.includes('this means') ||
        content.includes('because')) {
      return 'explanation';
    }

    return 'other';
  }

  /**
   * Compute aggregated session metrics
   */
  private computeSessionMetrics(
    sessions: ParsedSession[],
    utterances: DeveloperUtterance[]
  ): Phase1SessionMetrics {
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalDevUtterances = utterances.length;
    const totalAIResponses = totalMessages - totalDevUtterances;

    const avgDeveloperMessageLength = utterances.length > 0
      ? utterances.reduce((sum, u) => sum + u.characterCount, 0) / utterances.length
      : 0;

    const questionCount = utterances.filter(u => u.hasQuestion).length;
    const codeBlockCount = utterances.filter(u => u.hasCodeBlock).length;

    // Calculate tool usage counts
    const toolUsageCounts: Record<string, number> = {};
    for (const session of sessions) {
      for (const message of session.messages) {
        if (message.role === 'assistant' && message.toolCalls) {
          for (const tool of message.toolCalls) {
            toolUsageCounts[tool.name] = (toolUsageCounts[tool.name] || 0) + 1;
          }
        }
      }
    }

    // Calculate session durations
    const durations = sessions.map(s => s.durationSeconds / 60); // Convert to minutes
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Calculate date range
    const timestamps = sessions.flatMap(s =>
      s.messages.map(m => m.timestamp.toISOString())
    );
    timestamps.sort();

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
      toolUsageCounts,
      sessionDurations: {
        min: minDuration,
        max: maxDuration,
        avg: avgDuration,
      },
    };
  }

  /**
   * Compute extraction confidence based on data quality
   */
  private computeExtractionConfidence(sessions: ParsedSession[]): number {
    if (sessions.length === 0) return 0;

    // Higher confidence with more sessions
    const sessionFactor = Math.min(sessions.length / 10, 1);

    // Higher confidence with more messages
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const messageFactor = Math.min(totalMessages / 50, 1);

    // Average of both factors
    return Math.round((sessionFactor + messageFactor) / 2 * 100) / 100;
  }

  /**
   * Generate warnings about the extraction
   */
  private generateWarnings(
    sessions: ParsedSession[],
    utterances: DeveloperUtterance[]
  ): string[] {
    const warnings: string[] = [];

    if (sessions.length < 3) {
      warnings.push('Few sessions available - analysis may be limited');
    }

    if (utterances.length < 10) {
      warnings.push('Few developer utterances - insights may be limited');
    }

    const avgLength = utterances.length > 0
      ? utterances.reduce((sum, u) => sum + u.characterCount, 0) / utterances.length
      : 0;

    if (avgLength < 50) {
      warnings.push('Short average message length - may indicate brief interactions');
    }

    return warnings;
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

  private hadError(message: ParsedMessage | null): boolean {
    if (!message) return false;

    // Check tool call errors
    if (message.toolCalls?.some(tc => tc.isError)) {
      return true;
    }

    // Check content for error indicators
    const content = message.content.toLowerCase();
    return content.includes('error:') || content.includes('failed') ||
           content.includes('exception') || content.includes('traceback');
  }

  private wasSuccessful(message: ParsedMessage): boolean {
    // Check if tools completed without errors
    if (message.toolCalls?.length && !this.hadError(message)) {
      return true;
    }

    // Check content for success indicators
    const content = message.content.toLowerCase();
    return content.includes('done') || content.includes('completed') ||
           content.includes('success') || content.includes('created');
  }

  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[QuoteExtractorWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating QuoteExtractorWorker
 */
export function createQuoteExtractorWorker(
  config?: QuoteExtractorWorkerConfig
): QuoteExtractorWorker {
  return new QuoteExtractorWorker(config);
}
