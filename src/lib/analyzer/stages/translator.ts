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

import { z } from 'zod';
import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import { TranslatorLLMOutputSchema, reshapeTranslatorLLMOutput, type TranslatorOutput } from '../../models/translator-output';
import type { AgentOutputs } from '../../models/agent-outputs';
import { LANGUAGE_DISPLAY_NAMES, type SupportedLanguage } from './content-writer-prompts';
import { TRANSLATOR_SYSTEM_PROMPT, buildTranslatorUserPrompt, buildRetryTranslatorUserPrompt } from './translator-prompts';
import type { WorkerStrength, WorkerGrowth } from '../../models/worker-insights';
import {
  verifyTranslation,
  calculateCJKRatio,
  type TranslationVerificationResult,
} from './translation-verifier';

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
 * Result of translator stage with verification metadata
 */
export interface VerifiedTranslatorResult extends TranslatorResult {
  verification: TranslationVerificationResult;
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

    const llmResult = await this.client.generateStructured({
      systemPrompt: TRANSLATOR_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TranslatorLLMOutputSchema,
      schemaName: 'TranslatorLLMOutput',
      maxOutputTokens: this.config.maxOutputTokens,
    });

    const result = { data: reshapeTranslatorLLMOutput(llmResult.data), usage: llmResult.usage };

    this.logTranslatedInsightsDebug(result.data.translatedAgentInsights);

    return result;
  }

  /**
   * Translate with post-translation CJK verification and retry.
   */
  async translateWithVerification(
    englishResponse: any,
    targetLanguage: SupportedLanguage,
    agentOutputs: AgentOutputs
  ): Promise<VerifiedTranslatorResult> {
    if (targetLanguage === 'en') {
      throw new Error('translateWithVerification should not be called for English');
    }
    const nonEnLang = targetLanguage as Exclude<SupportedLanguage, 'en'>;

    const initialResult = await this.translate(englishResponse, targetLanguage, agentOutputs);
    const initialVerification = verifyTranslation(initialResult.data, nonEnLang);

    console.log(`[PHASE:TRANSLATION_VERIFY] Initial: ${initialVerification.summary}`);

    if (!initialVerification.shouldRetry) {
      return {
        ...initialResult,
        verification: initialVerification,
      };
    }

    console.log('[PHASE:TRANSLATION_VERIFY] Retrying translation with field emphasis...');

    const allFailures = [
      ...initialVerification.criticalFailures,
      ...initialVerification.nonCriticalFailures,
    ];
    const failedFieldPaths = allFailures.map(f => f.fieldPath);

    const englishDataJson = JSON.stringify(englishResponse, null, 2);
    const preparedOutputs = this.prepareAgentOutputsForTranslator(agentOutputs);
    const agentOutputsJson = JSON.stringify(preparedOutputs, null, 2);

    const retryPrompt = buildRetryTranslatorUserPrompt(
      englishDataJson,
      agentOutputsJson,
      targetLanguage,
      failedFieldPaths
    );

    const retryLLMResult = await this.client.generateStructured({
      systemPrompt: TRANSLATOR_SYSTEM_PROMPT,
      userPrompt: retryPrompt,
      responseSchema: TranslatorLLMOutputSchema,
      schemaName: 'TranslatorLLMOutput-retry',
      maxOutputTokens: this.config.maxOutputTokens,
    });
    const retryResult = { data: reshapeTranslatorLLMOutput(retryLLMResult.data), usage: retryLLMResult.usage };

    const merged = this.cherryPickMerge(initialResult.data, retryResult.data, nonEnLang);

    const combinedUsage: TokenUsage = {
      promptTokens: initialResult.usage.promptTokens + retryResult.usage.promptTokens,
      completionTokens: initialResult.usage.completionTokens + retryResult.usage.completionTokens,
      totalTokens: initialResult.usage.totalTokens + retryResult.usage.totalTokens,
    };

    const mergedVerification = verifyTranslation(merged, nonEnLang);
    console.log(`[PHASE:TRANSLATION_VERIFY] After retry+merge: ${mergedVerification.summary}`);

    if (mergedVerification.criticalFailures.length > 0) {
      console.log(`[PHASE:TRANSLATION_VERIFY] Falling back to individual field translation for ${mergedVerification.criticalFailures.length} critical fields`);

      let fallbackUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // Only attempt individual fallback for fields that can be applied back.
      // Array fields (promptPatterns, topFocusAreas) rely on cherry-pick merge.
      const SINGLE_FIELD_APPLICABLE = new Set(['personalitySummary', 'weeklyInsights.narrative']);

      for (const failure of mergedVerification.criticalFailures) {
        if (!SINGLE_FIELD_APPLICABLE.has(failure.fieldPath)) {
          console.log(`[PHASE:TRANSLATION_VERIFY] Skipping field fallback (array field): ${failure.fieldPath}`);
          continue;
        }

        const originalText = this.extractFieldText(merged, failure.fieldPath);
        if (!originalText || originalText.length < 10) continue;

        const englishText = this.extractFieldText(
          { ...englishResponse, personalitySummary: englishResponse.personalitySummary } as TranslatorOutput,
          failure.fieldPath
        );
        const textToTranslate = englishText || originalText;

        const singleResult = await this.translateSingleField(textToTranslate, targetLanguage);
        this.applyFieldTranslation(merged, failure.fieldPath, singleResult.translatedText);
        fallbackUsage = {
          promptTokens: fallbackUsage.promptTokens + singleResult.usage.promptTokens,
          completionTokens: fallbackUsage.completionTokens + singleResult.usage.completionTokens,
          totalTokens: fallbackUsage.totalTokens + singleResult.usage.totalTokens,
        };
        console.log(`[PHASE:TRANSLATION_VERIFY] Field fallback success: ${failure.fieldPath}`);
      }

      combinedUsage.promptTokens += fallbackUsage.promptTokens;
      combinedUsage.completionTokens += fallbackUsage.completionTokens;
      combinedUsage.totalTokens += fallbackUsage.totalTokens;
    }

    const finalVerification = verifyTranslation(merged, nonEnLang);
    console.log(`[PHASE:TRANSLATION_VERIFY] Final: ${finalVerification.summary}`);

    return {
      data: merged,
      usage: combinedUsage,
      verification: finalVerification,
    };
  }

  /**
   * Translate a single text field as last-resort fallback.
   */
  private async translateSingleField(
    text: string,
    targetLanguage: SupportedLanguage
  ): Promise<{ translatedText: string; usage: TokenUsage }> {
    const langName = LANGUAGE_DISPLAY_NAMES[targetLanguage];
    const schema = z.object({
      translatedText: z.string().describe(`Text translated to ${langName}`),
    });

    const result = await this.client.generateStructured({
      systemPrompt: TRANSLATOR_SYSTEM_PROMPT,
      userPrompt: `Translate this developer analysis text to ${langName}. Keep technical terms (AI, Git, TypeScript, etc.) in English. Keep **bold markers** and 「」 quote markers. Keep evidence quotes in their original language.\n\nText to translate:\n${text}`,
      responseSchema: schema,
      maxOutputTokens: 8192,
    });

    return { translatedText: result.data.translatedText, usage: result.usage };
  }

  /**
   * Cherry-pick merge: pick the version with higher CJK ratio for each field.
   */
  private cherryPickMerge(
    initial: TranslatorOutput,
    retry: TranslatorOutput,
    targetLanguage: Exclude<SupportedLanguage, 'en'>
  ): TranslatorOutput {
    const merged = { ...initial };

    const textFields = ['personalitySummary'] as const;
    for (const field of textFields) {
      const initialText = initial[field] ?? '';
      const retryText = retry[field] ?? '';
      const initialRatio = calculateCJKRatio(initialText, targetLanguage).cjkRatio;
      const retryRatio = calculateCJKRatio(retryText, targetLanguage).cjkRatio;
      if (retryRatio > initialRatio && retryText.length > 0) {
        (merged as any)[field] = retryText;
      }
    }

    const sectionFields = [
      'promptPatterns', 'topFocusAreas', 'antiPatternsAnalysis',
      'criticalThinkingAnalysis', 'planningAnalysis', 'translatedAgentInsights',
      'projectSummaries', 'weeklyInsights', 'actionablePractices',
    ] as const;

    for (const field of sectionFields) {
      const initialVal = initial[field];
      const retryVal = retry[field];
      if (!retryVal) continue;
      if (!initialVal) {
        (merged as any)[field] = retryVal;
        continue;
      }

      const initialText = JSON.stringify(initialVal);
      const retryText = JSON.stringify(retryVal);
      const initialRatio = calculateCJKRatio(initialText, targetLanguage).cjkRatio;
      const retryRatio = calculateCJKRatio(retryText, targetLanguage).cjkRatio;
      if (retryRatio > initialRatio) {
        (merged as any)[field] = retryVal;
      }
    }

    return merged;
  }

  /**
   * Extract a text string from TranslatorOutput by field path.
   */
  private extractFieldText(output: TranslatorOutput, fieldPath: string): string | undefined {
    switch (fieldPath) {
      case 'personalitySummary':
        return output.personalitySummary;
      case 'promptPatterns[].description':
        return output.promptPatterns?.map(p => p.description).join(' ');
      case 'topFocusAreas.areas[].narrative':
        return output.topFocusAreas?.areas?.map(a => a.narrative).join(' ');
      case 'weeklyInsights.narrative':
        return output.weeklyInsights?.narrative;
      default:
        return undefined;
    }
  }

  /**
   * Apply a translated text back to the appropriate field in TranslatorOutput.
   */
  private applyFieldTranslation(output: TranslatorOutput, fieldPath: string, translatedText: string): void {
    switch (fieldPath) {
      case 'personalitySummary':
        output.personalitySummary = translatedText;
        break;
      case 'weeklyInsights.narrative':
        if (output.weeklyInsights) {
          output.weeklyInsights.narrative = translatedText;
        }
        break;
      // Array fields (promptPatterns[].description, topFocusAreas.areas[].narrative)
      // cannot be applied back from concatenated text — handled by cherry-pick merge only.
    }
  }

  /**
   * Prepare agentOutputs for translator by extracting structured
   * title/description fields for translation (evidence excluded).
   */
  private prepareAgentOutputsForTranslator(agentOutputs: AgentOutputs): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};

    const v3WorkerKeys = ['thinkingQuality', 'communicationPatterns', 'learningBehavior', 'sessionOutcome'] as const;
    for (const key of v3WorkerKeys) {
      const worker = agentOutputs[key];
      if (worker) {
        this.processWorker(prepared, key, worker);
      }
    }

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

    const contextEfficiency = agentOutputs.contextEfficiency ?? agentOutputs.efficiency;
    if (contextEfficiency) {
      this.processWorker(prepared, 'contextEfficiency', contextEfficiency);
    }

    if (agentOutputs.knowledgeGap) {
      this.processWorker(prepared, 'knowledgeGap', agentOutputs.knowledgeGap);
    }

    return prepared;
  }

  /**
   * Process a single worker output, extracting structured title/description for translation.
   *
   * Evidence is NOT included — it stays in the original language.
   */
  private processWorker(
    prepared: Record<string, unknown>,
    key: string,
    worker: Record<string, unknown>
  ): void {
    const strengths = worker.strengths as WorkerStrength[] | undefined;
    const growthAreas = worker.growthAreas as WorkerGrowth[] | undefined;

    if ((strengths && strengths.length > 0) || (growthAreas && growthAreas.length > 0)) {
      prepared[key] = {
        strengths: (strengths ?? []).map(s => ({
          title: s.title,
          description: s.description,
        })),
        growthAreas: (growthAreas ?? []).map(g => ({
          title: g.title,
          description: g.description,
          recommendation: g.recommendation ?? '',
        })),
      };
    }
  }

  private logDebug(label: string, data: unknown): void {
    if (process.env.NODE_ENV !== 'development') return;
    const formattedData = Array.isArray(data) ? data.join(', ') : data;
    console.log(`[Translator] ${label}: ${formattedData}`);
  }

  private logTranslatedInsightsDebug(transInsights: any): void {
    if (process.env.NODE_ENV !== 'development' || !transInsights) {
      console.log(`[Translator] Output translatedAgentInsights present: ${Boolean(transInsights)}`);
      return;
    }

    const keysWithData = Object.keys(transInsights).filter(k => transInsights[k]);
    console.log(`[Translator] Keys with data: ${keysWithData.join(', ')}`);

    for (const key of keysWithData) {
      const insight = transInsights[key];
      const strengthsCount = Array.isArray(insight?.strengths) ? insight.strengths.length : 0;
      const growthCount = Array.isArray(insight?.growthAreas) ? insight.growthAreas.length : 0;
      // Legacy format fallback
      const legacyStrengths = insight?.strengthsData?.length ?? 0;
      const legacyGrowth = insight?.growthAreasData?.length ?? 0;
      console.log(`[Translator] ${key}: strengths=${strengthsCount}, growthAreas=${growthCount}` +
        (legacyStrengths > 0 ? `, legacyStrengthsData=${legacyStrengths}chars` : '') +
        (legacyGrowth > 0 ? `, legacyGrowthAreasData=${legacyGrowth}chars` : ''));
    }
  }
}
