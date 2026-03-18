/**
 * Session Summarizer Stage - Phase 1.5 LLM Session Summary Generation
 *
 * Generates concise 1-line summaries for each analyzed session using LLM.
 * These summaries describe what the developer primarily worked on.
 *
 * Pipeline position: After Phase 1 (DataExtractor), before Phase 2 (Insight Workers)
 *
 * Key features:
 * - Single LLM call for all sessions (batch processing)
 * - Structured output via SessionSummaryBatchLLMSchema
 * - Truncated message previews to minimize token usage
 *
 * Note: This is separate from the plugin Activity Scanner
 * which generates deterministic summaries for ALL recent sessions.
 * Phase 1.5 generates LLM-quality summaries for the top-50 analyzed sessions only.
 *
 * @module analyzer/stages/session-summarizer
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import {
  SESSION_SUMMARIZER_SYSTEM_PROMPT,
  buildSessionSummarizerUserPrompt,
  type SessionSummarizerInput,
} from './session-summarizer-prompts';
import {
  SessionSummaryBatchLLMSchema,
  type SessionSummaryBatchLLM,
} from '../../models/session-summary-data';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the Session Summarizer stage
 */
export interface SessionSummarizerConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  maxOutputTokens?: number;
}

/**
 * Result of session summarizer stage including token usage
 */
export interface SessionSummarizerResult {
  data: SessionSummaryBatchLLM;
  usage: TokenUsage;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<SessionSummarizerConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
  maxRetries: 2,
  maxOutputTokens: 65536,
};

// ============================================================================
// Session Summarizer Stage
// ============================================================================

/**
 * Session Summarizer Stage - LLM-based session summary generation
 *
 * Generates 1-line summaries for each analyzed session by sending
 * truncated message previews to the LLM in a single batch call.
 *
 * @example
 * ```typescript
 * const summarizer = new SessionSummarizerStage({
 *   apiKey: process.env.GOOGLE_GEMINI_API_KEY,
 * });
 *
 * const result = await summarizer.summarize([
 *   { sessionId: 'abc', projectName: 'my-app', messages: [...] },
 * ]);
 * console.log(result.data.summaries); // [{ sessionId: 'abc', summary: 'Implement auth flow' }]
 * ```
 */
export class SessionSummarizerStage {
  private client: GeminiClient;
  private maxOutputTokens: number;

  constructor(config: SessionSummarizerConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.maxOutputTokens = config.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens;
  }

  /**
   * Generate 1-line summaries for each session
   *
   * @param sessions - Array of session data with truncated message previews
   * @returns Batch summaries with token usage
   */
  async summarize(
    sessions: SessionSummarizerInput[]
  ): Promise<SessionSummarizerResult> {
    if (sessions.length === 0) {
      return {
        data: { summaries: [] },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const userPrompt = buildSessionSummarizerUserPrompt(sessions);

    const result = await this.client.generateStructured({
      systemPrompt: SESSION_SUMMARIZER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: SessionSummaryBatchLLMSchema,
      maxOutputTokens: this.maxOutputTokens,
    });

    return {
      data: result.data,
      usage: result.usage,
    };
  }
}
