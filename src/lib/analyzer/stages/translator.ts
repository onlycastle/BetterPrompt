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
import type { WorkerStrength, WorkerGrowth } from '../../models/worker-insights';

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
    const preparedOutputs = this.prepareAgentOutputsForTranslator(agentOutputs);
    const agentOutputsJson = JSON.stringify(preparedOutputs, null, 2);

    this.logDebug('Input agentOutputs keys', Object.keys(agentOutputs));
    this.logDebug('Prepared for translation keys', Object.keys(preparedOutputs));

    const userPrompt = buildTranslatorUserPrompt(
      englishDataJson,
      agentOutputsJson,
      targetLanguage
    );

    const result = await this.client.generateStructured({
      systemPrompt: TRANSLATOR_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TranslatorOutputSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    this.logTranslatedInsightsDebug(result.data.translatedAgentInsights);

    return result;
  }

  /**
   * Prepare agentOutputs for translator by normalizing all workers to
   * flat pipe-delimited string format matching what the translator prompt expects.
   *
   * The translator prompt expects each worker to have `strengthsData` and `growthAreasData`
   * as pipe-delimited strings (e.g., "title|description|evidence;...").
   *
   * v3 Architecture:
   * - thinkingQuality, learningBehavior: consolidated workers with structured arrays
   * - contextEfficiency, knowledgeGap: may have string or array format
   * - efficiency: alias for contextEfficiency in v3
   */
  private prepareAgentOutputsForTranslator(agentOutputs: AgentOutputs): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};

    // Process v3 workers (thinkingQuality, communicationPatterns, learningBehavior)
    const v3WorkerKeys = ['thinkingQuality', 'communicationPatterns', 'learningBehavior'] as const;
    for (const key of v3WorkerKeys) {
      const worker = agentOutputs[key];
      if (worker) {
        this.processWorker(prepared, key, worker);
      }
    }

    // Extract communicationPatterns array from CommunicationPatterns worker for translation.
    // Use separate key 'communicationPatternsArray' to avoid overwriting the
    // strengthsData/growthAreasData set by processWorker() above.
    // The translator prompt expects promptPatterns (= communicationPatterns) to be translated:
    // patternName, description, tip → translate to target language
    // examples → keep quotes in original language, translate analysis
    if (agentOutputs.communicationPatterns?.communicationPatterns) {
      const patterns = agentOutputs.communicationPatterns.communicationPatterns;
      if (patterns.length > 0) {
        prepared['communicationPatternsArray'] = patterns.map(p => ({
          patternName: p.patternName,
          description: p.description,
          examples: p.examples,
          tip: p.tip,
        }));
      }
    }

    // Process contextEfficiency (may be in agentOutputs.contextEfficiency or agentOutputs.efficiency)
    const contextEfficiency = agentOutputs.contextEfficiency ?? agentOutputs.efficiency;
    if (contextEfficiency) {
      this.processWorker(prepared, 'contextEfficiency', contextEfficiency);
    }

    // Process knowledgeGap (legacy but still in AgentOutputs type)
    if (agentOutputs.knowledgeGap) {
      this.processWorker(prepared, 'knowledgeGap', agentOutputs.knowledgeGap);
    }

    return prepared;
  }

  /**
   * Process a single worker output, normalizing to pipe-delimited string format.
   * Handles both string and array formats for strengths/growthAreas.
   */
  private processWorker(
    prepared: Record<string, unknown>,
    key: string,
    worker: Record<string, unknown>
  ): void {
    const strengthsData = this.extractOrFlattenStrengths(worker);
    const growthAreasData = this.extractOrFlattenGrowthAreas(worker);

    if (strengthsData || growthAreasData) {
      prepared[key] = {
        strengthsData: strengthsData ?? '',
        growthAreasData: growthAreasData ?? '',
      };
    }
  }

  /**
   * Extract strengthsData string or flatten strengths array to pipe-delimited string.
   */
  private extractOrFlattenStrengths(worker: Record<string, unknown>): string | undefined {
    const strengthsData = worker.strengthsData as string | undefined;
    if (strengthsData?.trim()) return strengthsData;

    const strengths = worker.strengths as WorkerStrength[] | undefined;
    return strengths?.length ? this.flattenWorkerStrengths(strengths) : undefined;
  }

  /**
   * Extract growthAreasData string or flatten growthAreas array to pipe-delimited string.
   */
  private extractOrFlattenGrowthAreas(worker: Record<string, unknown>): string | undefined {
    const growthAreasData = worker.growthAreasData as string | undefined;
    if (growthAreasData?.trim()) return growthAreasData;

    const growthAreas = worker.growthAreas as WorkerGrowth[] | undefined;
    return growthAreas?.length ? this.flattenWorkerGrowthAreas(growthAreas) : undefined;
  }

  /**
   * Flatten generic WorkerStrength array to pipe-delimited string.
   * Used as fallback when strengthsData string is empty but strengths[] exists.
   * Format: "title|description|quote1,quote2;..."
   */
  private flattenWorkerStrengths(strengths: WorkerStrength[]): string {
    return strengths.map(s => {
      const quotes = (s.evidence ?? []).join(',');
      return `${s.title}|${s.description}|${quotes}`;
    }).join(';');
  }

  /**
   * Flatten generic WorkerGrowth array to pipe-delimited string.
   * Used as fallback when growthAreasData string is empty but growthAreas[] exists.
   * Format: "title|description|evidence|recommendation|severity;..."
   */
  private flattenWorkerGrowthAreas(growthAreas: WorkerGrowth[]): string {
    return growthAreas.map(g => {
      const quotes = (g.evidence ?? []).join(',');
      return `${g.title}|${g.description}|${quotes}|${g.recommendation}|${g.severity ?? ''}`;
    }).join(';');
  }

  /**
   * Log debug message in development mode
   */
  private logDebug(label: string, data: unknown): void {
    if (process.env.NODE_ENV !== 'development') return;
    const formattedData = Array.isArray(data) ? data.join(', ') : data;
    console.log(`[Translator] ${label}: ${formattedData}`);
  }

  /**
   * Log translated insights debug info
   */
  private logTranslatedInsightsDebug(transInsights: any): void {
    if (process.env.NODE_ENV !== 'development' || !transInsights) {
      console.log(`[Translator] Output translatedAgentInsights present: ${Boolean(transInsights)}`);
      return;
    }

    const keysWithData = Object.keys(transInsights).filter(k => transInsights[k]);
    console.log(`[Translator] Keys with data: ${keysWithData.join(', ')}`);

    for (const key of keysWithData) {
      const insight = transInsights[key];
      const strengthsLength = insight?.strengthsData?.length ?? 0;
      const growthLength = insight?.growthAreasData?.length ?? 0;
      console.log(`[Translator] ${key}: strengthsData=${strengthsLength}chars, growthAreasData=${growthLength}chars`);
    }
  }
}
