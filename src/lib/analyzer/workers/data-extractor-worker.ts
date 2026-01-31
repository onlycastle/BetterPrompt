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
  private static readonly MAX_UTTERANCES = PHASE1_MAX_UTTERANCES;
  private static readonly MAX_AI_RESPONSES = PHASE1_MAX_AI_RESPONSES;
  private static readonly TRUNCATION_MARKER = '... [truncated]';

  // LLM filtering configuration
  private static readonly LLM_FILTER_MIN_LENGTH = 10; // Skip LLM for very short utterances only
  private static readonly LLM_FILTER_CONFIDENCE_THRESHOLD = 0.7; // Filter if confidence >= threshold
  private static readonly LLM_FILTER_BATCH_SIZE = 20; // Max utterances per LLM call

  /** Dedicated Gemini client for LLM filtering (created lazily) */
  private filterClient?: GeminiClient;

  /** Accumulated token usage from LLM filtering */
  private filterTokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(config?: OrchestratorConfig) {
    if (config) {
      super(config);
    } else {
      super();
    }
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

    // Reset token usage for this execution
    this.filterTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const allDeveloperUtterances: DeveloperUtterance[] = [];
    const allAIResponses: AIResponse[] = [];

    // Process each session — extract ALL utterances/responses first
    for (const session of context.sessions) {
      const { utterances, responses } = this.extractFromSession(session);
      allDeveloperUtterances.push(...utterances);
      allAIResponses.push(...responses);
    }

    // NEW: Apply LLM-based filtering to remove system metadata
    const filteredUtterances = await this.filterSystemMetadataWithLLM(allDeveloperUtterances);

    this.log(`Filtered ${allDeveloperUtterances.length - filteredUtterances.length} system metadata utterances`);

    // Compute metrics from filtered data (accurate representation of developer input)
    const sessionMetrics = this.computeSessionMetrics(context.sessions, filteredUtterances);

    // Apply strategic sampling to reduce downstream token usage
    const sampledUtterances = this.sampleUtterances(filteredUtterances, DataExtractorWorker.MAX_UTTERANCES);
    const sampledResponses = this.sampleAIResponses(allAIResponses, DataExtractorWorker.MAX_AI_RESPONSES);

    const output: Phase1Output = {
      developerUtterances: sampledUtterances,
      aiResponses: sampledResponses,
      sessionMetrics,
    };

    this.log(`Extracted ${filteredUtterances.length} utterances, sampled to ${sampledUtterances.length}`);
    this.log(`Extracted ${allAIResponses.length} AI responses, sampled to ${sampledResponses.length}`);

    // Return token usage from LLM filtering (if any)
    const usage = this.filterTokenUsage.totalTokens > 0 ? this.filterTokenUsage : null;
    return this.createSuccessResult(output, usage);
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

      // Noteworthy flag for evidence filtering
      isNoteworthy: this.determineNoteworthy(originalText),

      // Context from preceding AI response
      precedingAIToolCalls: precedingAI?.toolCalls?.map(tc => tc.name),
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

    if (this.isPlanningResponse(tools)) return 'planning';
    if (this.isCodeEditResponse(tools)) return 'code_edit';
    if (this.isCodeGenerationResponse(tools)) return 'code_generation';
    if (this.isErrorFixResponse(content)) return 'error_fix';
    if (this.isToolExecutionResponse(tools)) return 'tool_execution';
    if (this.isQuestionResponse(content)) return 'question';
    if (this.isExplanationResponse(content)) return 'explanation';

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
    };
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
   * Determine if an utterance is semantically meaningful enough for evidence.
   *
   * Noteworthy utterances should:
   * 1. Have sufficient length (8+ words) for context
   * 2. Contain structural importance (questions, code blocks)
   * 3. Include explanatory context keywords
   *
   * Short confirmations like "ok", "좋았어", "이건 잘 되었어" are filtered out.
   *
   * @param text - The utterance text to evaluate
   * @returns true if the utterance is noteworthy
   */
  private determineNoteworthy(text: string): boolean {
    const wordCount = this.countWords(text);

    // Minimum word count threshold
    if (wordCount < 8) {
      return false;
    }

    // Has structural importance: questions or code blocks
    if (this.hasQuestion(text) || this.hasCodeBlock(text)) {
      return true;
    }

    // Contains explanatory context keywords (EN + KO)
    const contextPatterns = /\b(because|since|therefore|however|although|considering|specifically|actually|instead|before|after|first|then|next|finally)\b|그래서|왜냐하면|때문에|확인|체크|살펴|분석|이유|방법|문제|해결|수정|변경|추가|삭제|구현|테스트/i;
    if (contextPatterns.test(text)) {
      return true;
    }

    // Minimum threshold for longer texts (20+ words are likely meaningful)
    if (wordCount >= 20) {
      return true;
    }

    return false;
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
    utterances: DeveloperUtterance[]
  ): Promise<DeveloperUtterance[]> {
    // Pre-filter with known regex patterns (fast path)
    const preFiltered = utterances.filter(u => !this.isKnownSystemMetadata(u.text));

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

    this.log(`Classifying ${needsClassification.length} utterances for system metadata...`);

    // Process in batches to manage token usage
    const classifiedUtterances: DeveloperUtterance[] = [];

    for (let i = 0; i < needsClassification.length; i += DataExtractorWorker.LLM_FILTER_BATCH_SIZE) {
      const batch = needsClassification.slice(i, i + DataExtractorWorker.LLM_FILTER_BATCH_SIZE);
      const classifications = await this.classifyBatch(batch);

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
          // If LLM provided a sanitized displayText, use it
          // Otherwise fallback to truncated original text
          if (classification?.displayText && classification.displayText.trim()) {
            utterance.displayText = classification.displayText;
          } else {
            // No displayText from LLM - use original text (truncated for display)
            utterance.displayText = utterance.text.length > 300
              ? utterance.text.slice(0, 297) + '...'
              : utterance.text;
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
   * Check if text matches known system metadata patterns (regex fast path).
   * Returns true if the utterance should be filtered out.
   */
  private isKnownSystemMetadata(text: string): boolean {
    const trimmedText = text.trim();

    // Filter out single-character utterances (too short to be meaningful)
    // Examples: ".", "ㅇ", "k", "y" — these are noise, not developer intent
    if (trimmedText.length <= 1) {
      return true;
    }

    const knownPatterns = [
      // Skill documentation blocks
      /^Base directory for this skill:/i,
      /^This skill is located at:/i,

      // Session continuation summaries
      /^This session is being continued from a previous conversation/i,
      /^Continuing from previous session/i,

      // Claude Code internal instructions
      /^IMPORTANT: this context may or may not be relevant/i,
      /^The following skills are available/i,

      // Plan execution prompts (system-injected by /plan skill)
      /^Implement the following plan:/i,

      // Claude-generated Insight blocks (injected via session context)
      /★ Insight/,
      /`★ Insight/,
      /^─{10,}/,

      // Error stacks and tracebacks (pasted debug output, not developer intent)
      /^Error:|^ERROR:|^Exception:|^Traceback \(most recent call last\):/,
      /^\s+at \w+\.\w+\s*\(/m,

      // Server logs (pasted terminal output, not developer intent)
      /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD) \/\S+.*\d{3}/m,
    ];

    return knownPatterns.some(pattern => pattern.test(trimmedText));
  }

  /**
   * Classify a batch of utterances using LLM.
   *
   * @param batch - Utterances to classify
   * @returns Array of classifications in the same order as input
   */
  private async classifyBatch(
    batch: DeveloperUtterance[]
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
        maxOutputTokens: 4096,
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
   */
  private buildFilterSystemPrompt(): string {
    return `You are a content classifier AND sanitizer for developer-AI conversation analysis.

## TASK 1: Classification
Classify each text segment as either:
1. "developer" - Actual developer input (questions, requests, code, feedback)
2. "system" - System-injected metadata (skill docs, session summaries, hook outputs)

SYSTEM METADATA PATTERNS (filter these out):
- Skill documentation blocks starting with "Base directory for this skill:"
- Session continuation summaries starting with "This session is being continued"
- Claude Code system instructions or context injections
- Hook outputs, command outputs, tool results embedded in user messages
- Any instructional content addressed TO Claude, not FROM the developer

DEVELOPER INPUT PATTERNS (keep these):
- Questions, requests, or instructions for the AI assistant
- Code snippets the developer wants help with
- Feedback on AI responses
- Error messages the developer is reporting/asking about
- Conversational responses, implementation requests, bug reports

## TASK 2: Sanitization (for "developer" texts only)
Create a display-friendly version (displayText) that:
- PRESERVES the developer's actual words and intent verbatim
- SUMMARIZES machine-generated content they pasted:
  - Error logs (## Error Type, Error:, Exception:) → [Error: {brief message, max 50 chars}]
  - Stack traces (at Function.method, Traceback, file:line) → [Stack trace]
  - Code blocks (\`\`\`...\`\`\`) → [Code: {language or 'snippet'}]
  - CLI/terminal output (npm logs, git output, command results) → [CLI output]
  - JSON data (large JSON objects/arrays) → [JSON data]
- KEEPS the result under 300 characters when possible
- If text has NO machine-generated content, displayText = original text (unchanged)

EXAMPLE INPUT:
"Great, login works now. But after logging in and naming the company CT, I got this: ## Error Type Console Error ## Error Message No workspace ID set at SupabaseStorageManager.getData (lib/supabase-storage.ts:91:15) at DashboardOverviewPage.useEffect.loadData (app/dashboard/page.tsx:94:41)"

EXAMPLE OUTPUT:
{
  "classification": "developer",
  "confidence": 0.95,
  "reason": "Developer reporting an error encountered during login",
  "displayText": "Great, login works now. But after logging in and naming the company CT, I got this: [Error: No workspace ID set][Stack trace]"
}

IMPORTANT GUIDELINES:
- Only provide displayText for "developer" classified texts (not for "system")
- NEVER alter the developer's natural language - only summarize pasted technical content
- When in doubt about classification, default to "developer"
- Use confidence scores to indicate certainty (0.0-1.0)

Respond with a JSON object containing an array of classifications.`;
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

  private hadError(message: ParsedMessage | null): boolean {
    if (!message) return false;

    if (message.toolCalls?.some(tc => tc.isError)) return true;

    const content = message.content.toLowerCase();
    return content.includes('error:') || content.includes('failed') ||
           content.includes('exception') || content.includes('traceback');
  }

  private wasSuccessful(message: ParsedMessage): boolean {
    if (message.toolCalls?.length && !this.hadError(message)) return true;

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
