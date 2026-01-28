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
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { TrustVerificationOutput } from '../../models/trust-verification-data';
import type { WorkflowHabitOutput } from '../../models/workflow-habit-data';

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

  /**
   * Prepare agentOutputs for translator by normalizing all agents to
   * flat pipe-delimited string format matching what the translator prompt expects.
   *
   * The translator prompt expects each agent to have `strengthsData` and `growthAreasData`
   * as pipe-delimited strings (e.g., "title|description|evidence;...").
   * - knowledgeGap, contextEfficiency: already have this format (pass through)
   * - strengthGrowth, trustVerification, workflowHabit: structured arrays → pre-converted
   */
  private prepareAgentOutputsForTranslator(agentOutputs: AgentOutputs): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};

    // Agents that already output flat pipe-delimited strings
    const flatStringAgentKeys = ['knowledgeGap', 'contextEfficiency'] as const;

    for (const key of flatStringAgentKeys) {
      if (agentOutputs[key]) {
        const agent = agentOutputs[key] as Record<string, unknown>;
        prepared[key] = {
          strengthsData: agent.strengthsData ?? '',
          growthAreasData: agent.growthAreasData ?? '',
        };
      }
    }

    // Convert v2 strengthGrowth structured arrays → flat strings
    if (agentOutputs.strengthGrowth) {
      prepared.strengthGrowth = this.flattenStrengthGrowth(agentOutputs.strengthGrowth);
    }

    // Convert v2 trustVerification structured arrays → flat strings
    if (agentOutputs.trustVerification) {
      prepared.trustVerification = this.flattenTrustVerification(agentOutputs.trustVerification);
    }

    // Convert v2 workflowHabit structured arrays → flat strings
    if (agentOutputs.workflowHabit) {
      prepared.workflowHabit = this.flattenWorkflowHabit(agentOutputs.workflowHabit);
    }

    return prepared;
  }

  /**
   * Flatten StrengthGrowth structured data to pipe-delimited strings.
   * Output format matches TranslatedAgentInsight expectations:
   * - strengthsData: "title|description|quote1,quote2;..."
   * - growthAreasData: "title|description|evidence|recommendation|frequency|severity|priority;..."
   */
  private flattenStrengthGrowth(sg: StrengthGrowthOutput): { strengthsData: string; growthAreasData: string } {
    const strengthsData = (sg.strengths ?? []).map(s => {
      const quotes = (s.evidence ?? []).map(e => e.quote).join(',');
      return `${s.title}|${s.description}|${quotes}`;
    }).join(';');

    const growthAreasData = (sg.growthAreas ?? []).map(g => {
      const quotes = (g.evidence ?? []).map(e => e.quote).join(',');
      return `${g.title}|${g.description}|${quotes}|${g.recommendation}|${g.frequency ?? ''}|${g.severity ?? ''}|${g.priorityScore ?? ''}`;
    }).join(';');

    return { strengthsData, growthAreasData };
  }

  /**
   * Flatten TrustVerification structured data to pipe-delimited strings.
   * Converts strengths array and anti-patterns to translation format.
   */
  private flattenTrustVerification(tv: TrustVerificationOutput): { strengthsData: string; growthAreasData: string } {
    // Flatten actual strengths array (WorkerStrength.evidence is string[])
    const strengthsData = (tv.strengths ?? []).map(s => {
      const quotes = (s.evidence ?? []).join(',');
      return `${s.title}|${s.description}|${quotes}|${s.frequency ?? ''}`;
    }).join(';');

    // Convert anti-patterns to growth areas format, then merge with actual growthAreas
    const antiPatternGrowth = (tv.antiPatterns ?? []).map(ap => {
      const quotes = (ap.examples ?? []).map(e => e.quote).join(',');
      const title = `Anti-Pattern: ${ap.type.replace(/_/g, ' ')}`;
      const description = ap.improvement ?? `Detected ${ap.type} pattern`;
      const severity = ap.severity === 'critical' ? 'critical' :
        ap.severity === 'significant' ? 'high' :
        ap.severity === 'moderate' ? 'medium' : 'low';
      const priority = ap.severity === 'critical' ? '90' :
        ap.severity === 'significant' ? '70' :
        ap.severity === 'moderate' ? '50' : '30';
      return `${title}|${description}|${quotes}|${ap.improvement ?? ''}|${ap.sessionPercentage ?? ''}|${severity}|${priority}`;
    });

    // Include actual growthAreas from the worker (WorkerGrowth.evidence is string[])
    const workerGrowth = (tv.growthAreas ?? []).map(g => {
      const quotes = (g.evidence ?? []).join(',');
      return `${g.title}|${g.description}|${quotes}|${g.recommendation}|${g.frequency ?? ''}|${g.severity ?? ''}|${g.frequency ?? ''}`;
    });

    const growthAreasData = [...antiPatternGrowth, ...workerGrowth].join(';');

    return { strengthsData, growthAreasData };
  }

  /**
   * Flatten WorkflowHabit structured data to pipe-delimited strings.
   * Converts strengths array and weak planning habits to translation format.
   */
  private flattenWorkflowHabit(wh: WorkflowHabitOutput): { strengthsData: string; growthAreasData: string } {
    // Flatten actual strengths array (WorkerStrength.evidence is string[])
    const strengthsData = (wh.strengths ?? []).map(s => {
      const quotes = (s.evidence ?? []).join(',');
      return `${s.title}|${s.description}|${quotes}|${s.frequency ?? ''}`;
    }).join(';');

    // Convert weak planning habits to growth areas format
    const weakHabits = (wh.planningHabits ?? []).filter(h =>
      h.effectiveness === 'low' || h.frequency === 'rarely' || h.frequency === 'never'
    );

    const weakHabitGrowth = weakHabits.map(h => {
      const typeLabel = h.type.replace(/_/g, ' ');
      const quotes = (h.examples ?? []).join(',');
      return `Planning: ${typeLabel}|Planning habit "${typeLabel}" is ${h.frequency}|${quotes}|Improve ${typeLabel} frequency||medium|50`;
    });

    // Include actual growthAreas from the worker (WorkerGrowth.evidence is string[])
    const workerGrowth = (wh.growthAreas ?? []).map(g => {
      const quotes = (g.evidence ?? []).join(',');
      return `${g.title}|${g.description}|${quotes}|${g.recommendation}|${g.frequency ?? ''}|${g.severity ?? ''}|${g.frequency ?? ''}`;
    });

    const growthAreasData = [...weakHabitGrowth, ...workerGrowth].join(';');

    return { strengthsData, growthAreasData };
  }
}
