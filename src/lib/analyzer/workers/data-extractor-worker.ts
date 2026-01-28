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
  type DeveloperUtterance,
  type AIResponse,
  type Phase1SessionMetrics,
} from '../../models/phase1-output';
import type { ParsedSession, ParsedMessage } from '../../models/session';
import type { OrchestratorConfig } from '../orchestrator/types';
import { strategicSampleUtterances, strategicSampleAIResponses } from '../shared/sampling-utils';
import { PHASE1_MAX_UTTERANCES, PHASE1_MAX_AI_RESPONSES } from '../shared/constants';

/**
 * DataExtractorWorker - Extracts raw text and structural metadata
 *
 * Phase 1 worker that creates the Phase1Output used by Phase 2 workers.
 * This is a deterministic extraction - no LLM calls needed.
 */
export class DataExtractorWorker extends BaseWorker<Phase1Output> {
  readonly name = 'DataExtractor';
  readonly phase = 1 as const;

  // Truncation/sampling limits to control downstream token usage
  private static readonly MAX_TEXT_LENGTH = 2000;
  private static readonly MAX_UTTERANCES = PHASE1_MAX_UTTERANCES;
  private static readonly MAX_AI_RESPONSES = PHASE1_MAX_AI_RESPONSES;
  private static readonly TRUNCATION_MARKER = '... [truncated]';

  constructor(config?: OrchestratorConfig) {
    if (config) {
      super(config);
    } else {
      super();
    }
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
    this.log(`Extracting from ${context.sessions.length} sessions...`);

    const allDeveloperUtterances: DeveloperUtterance[] = [];
    const allAIResponses: AIResponse[] = [];

    // Process each session — extract ALL utterances/responses first
    for (const session of context.sessions) {
      const { utterances, responses } = this.extractFromSession(session);
      allDeveloperUtterances.push(...utterances);
      allAIResponses.push(...responses);
    }

    // Compute metrics from FULL data (preserves accurate totals)
    const sessionMetrics = this.computeSessionMetrics(context.sessions, allDeveloperUtterances);

    // Apply strategic sampling to reduce downstream token usage
    const sampledUtterances = this.sampleUtterances(allDeveloperUtterances, DataExtractorWorker.MAX_UTTERANCES);
    const sampledResponses = this.sampleAIResponses(allAIResponses, DataExtractorWorker.MAX_AI_RESPONSES);

    const output: Phase1Output = {
      developerUtterances: sampledUtterances,
      aiResponses: sampledResponses,
      sessionMetrics,
      extractionConfidence: this.computeExtractionConfidence(context.sessions),
      extractionWarnings: this.generateWarnings(
        context.sessions,
        allDeveloperUtterances,
        sampledUtterances,
        allAIResponses,
        sampledResponses
      ),
    };

    this.log(`Extracted ${allDeveloperUtterances.length} utterances, sampled to ${sampledUtterances.length}`);
    this.log(`Extracted ${allAIResponses.length} AI responses, sampled to ${sampledResponses.length}`);

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
        // Skip utterances that became empty after system tag removal
        if (utterance.text.trim()) {
          utterances.push(utterance);
        }
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
    // Strip system-injected tags FIRST, before any processing
    const rawText = message.content;
    const originalText = this.stripSystemTags(rawText);
    const text = this.truncateText(originalText, DataExtractorWorker.MAX_TEXT_LENGTH);
    const id = `${session.sessionId}_${turnIndex}`;

    return {
      id,
      text,
      timestamp: message.timestamp.toISOString(),
      sessionId: session.sessionId,
      turnIndex,

      // Structural metadata computed from ORIGINAL text (preserves accurate metrics)
      characterCount: originalText.length,
      wordCount: this.countWords(originalText),
      hasCodeBlock: this.hasCodeBlock(originalText),
      hasQuestion: this.hasQuestion(originalText),
      isSessionStart: turnIndex === 0,
      isContinuation: this.isContinuation(originalText),

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

    if (this.isPlanningResponse(tools)) {
      return 'planning';
    }

    if (this.isCodeEditResponse(tools)) {
      return 'code_edit';
    }

    if (this.isCodeGenerationResponse(tools)) {
      return 'code_generation';
    }

    if (this.isErrorFixResponse(content)) {
      return 'error_fix';
    }

    if (this.isToolExecutionResponse(tools)) {
      return 'tool_execution';
    }

    if (this.isQuestionResponse(content)) {
      return 'question';
    }

    if (this.isExplanationResponse(content)) {
      return 'explanation';
    }

    return 'other';
  }

  private isPlanningResponse(tools: string[]): boolean {
    return tools.some(t => ['EnterPlanMode', 'ExitPlanMode', 'TodoWrite', 'TodoRead'].includes(t));
  }

  private isCodeEditResponse(tools: string[]): boolean {
    return tools.includes('Edit') || tools.includes('Write');
  }

  private isCodeGenerationResponse(tools: string[]): boolean {
    return tools.includes('Write') && !tools.includes('Read');
  }

  private isErrorFixResponse(content: string): boolean {
    const errorKeywords = ['error', 'fix', 'bug', 'issue'];
    return errorKeywords.some(keyword => content.includes(keyword));
  }

  private isToolExecutionResponse(tools: string[]): boolean {
    return tools.includes('Bash') || tools.includes('Task');
  }

  private isQuestionResponse(content: string): boolean {
    const questionIndicators = ['?', 'would you', 'do you want'];
    return questionIndicators.some(indicator => content.includes(indicator));
  }

  private isExplanationResponse(content: string): boolean {
    const explanationIndicators = ['let me explain', 'this means', 'because'];
    return explanationIndicators.some(indicator => content.includes(indicator));
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
    allUtterances: DeveloperUtterance[],
    sampledUtterances?: DeveloperUtterance[],
    allResponses?: AIResponse[],
    sampledResponses?: AIResponse[]
  ): string[] {
    const warnings: string[] = [];

    if (sessions.length < 3) {
      warnings.push('Few sessions available - analysis may be limited');
    }

    if (allUtterances.length < 10) {
      warnings.push('Few developer utterances - insights may be limited');
    }

    const avgLength = allUtterances.length > 0
      ? allUtterances.reduce((sum, u) => sum + u.characterCount, 0) / allUtterances.length
      : 0;

    if (avgLength < 50) {
      warnings.push('Short average message length - may indicate brief interactions');
    }

    // Report sampling stats
    if (sampledUtterances && sampledUtterances.length < allUtterances.length) {
      warnings.push(
        `Utterances sampled: ${sampledUtterances.length}/${allUtterances.length} (strategic sampling applied)`
      );
    }

    if (allResponses && sampledResponses && sampledResponses.length < allResponses.length) {
      warnings.push(
        `AI responses sampled: ${sampledResponses.length}/${allResponses.length} (strategic sampling applied)`
      );
    }

    // Report text truncation stats
    const truncatedCount = (sampledUtterances ?? allUtterances)
      .filter(u => u.text.endsWith(DataExtractorWorker.TRUNCATION_MARKER))
      .length;
    if (truncatedCount > 0) {
      warnings.push(`${truncatedCount} utterance(s) truncated to ${DataExtractorWorker.MAX_TEXT_LENGTH} chars`);
    }

    return warnings;
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
    all: DeveloperUtterance[],
    maxCount: number
  ): DeveloperUtterance[] {
    return strategicSampleUtterances(all, maxCount);
  }

  /**
   * Strategic sampling of AI responses.
   * Delegates to shared utility (error-prioritized + even spacing strategy).
   */
  private sampleAIResponses(
    all: AIResponse[],
    maxCount: number
  ): AIResponse[] {
    return strategicSampleAIResponses(all, maxCount);
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

}

/**
 * Factory function for creating DataExtractorWorker
 */
export function createDataExtractorWorker(
  config?: OrchestratorConfig
): DataExtractorWorker {
  return new DataExtractorWorker(config);
}
