/**
 * Translator Stage Implementation
 *
 * Phase 4 of the pipeline: Dedicated translation stage.
 * Translates English ContentWriter output into the target language using
 * a separate LLM call for focused, high-quality translation.
 *
 * Runs conditionally: only when the detected language is non-English.
 * For English users, this stage is skipped entirely (no LLM call).
 *
 * Input: English VerboseLLMResponse (sanitized) + AgentOutputs
 * Output: TranslatorOutput (translated text fields only)
 *
 * @module analyzer/stages/translator
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import { TranslatorOutputSchema, type TranslatorOutput } from '../../models/translator-output';
import type { AgentOutputs } from '../../models/agent-outputs';
import type { SupportedLanguage } from './content-writer-prompts';
import { TRANSLATOR_SYSTEM_PROMPT, buildTranslatorUserPrompt } from './translator-prompts';

/**
 * Configuration for the Translator stage
 */
export interface TranslatorConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

/**
 * Result of translator stage including token usage
 */
export interface TranslatorResult {
  data: TranslatorOutput;
  usage: TokenUsage;
}

/**
 * Default configuration values
 *
 * Uses the same model as ContentWriter for consistency.
 * maxOutputTokens set to maximum (65536) since translation output
 * can be similar in size to the English input.
 */
const DEFAULT_CONFIG: Required<Omit<TranslatorConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 65536,
  maxRetries: 2,
};

/**
 * Translator Stage — Dedicated translation for non-English output
 *
 * Follows the same pattern as ContentWriterStage:
 * - Own GeminiClient instance
 * - Own configuration
 * - Returns {data, usage} result tuple
 *
 * The orchestrator calls this AFTER ContentWriter when the detected
 * language is non-English. The translated text fields are then merged
 * back into the English response, preserving all structural/numeric fields.
 */
export class TranslatorStage {
  private client: GeminiClient;
  private config: Required<Omit<TranslatorConfig, 'apiKey'>>;

  constructor(config: TranslatorConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.config = {
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens || DEFAULT_CONFIG.maxOutputTokens,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };
  }

  /**
   * Translate English ContentWriter output into the target language
   *
   * @param englishResponse - Sanitized English VerboseLLMResponse from ContentWriter
   * @param targetLanguage - Target language for translation (must not be 'en')
   * @param agentOutputs - Phase 2 agent outputs (for translatedAgentInsights)
   * @returns TranslatorResult with translated text fields and token usage
   */
  async translate(
    englishResponse: any,
    targetLanguage: SupportedLanguage,
    agentOutputs: AgentOutputs
  ): Promise<TranslatorResult> {
    const englishDataJson = JSON.stringify(englishResponse, null, 2);
    const agentOutputsJson = JSON.stringify(agentOutputs, null, 2);

    const userPrompt = buildTranslatorUserPrompt(
      englishDataJson,
      agentOutputsJson,
      targetLanguage
    );

    return this.client.generateStructured({
      systemPrompt: TRANSLATOR_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TranslatorOutputSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });
  }
}
