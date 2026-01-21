/**
 * Context Efficiency Worker (Wow Agent 4)
 *
 * Phase 2 worker that analyzes context and token efficiency:
 * - Context usage patterns (fill percentage)
 * - Inefficiency patterns (late compaction, bloat)
 * - Prompt length trends
 * - Redundant information repetition
 *
 * @module analyzer/workers/context-efficiency-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  ContextEfficiencyOutputSchema,
  type ContextEfficiencyOutput,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  CONTEXT_EFFICIENCY_SYSTEM_PROMPT,
  buildContextEfficiencyUserPrompt,
} from './prompts/wow-agent-prompts';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

/**
 * Format preset for Context Efficiency Analyzer
 * - User messages only (analyzing prompt patterns)
 * - No tool calls (focus on context usage)
 * - Duration included (for efficiency metrics)
 */
const CONTEXT_EFFICIENCY_FORMAT = {
  maxContentLength: 2000, // Longer to capture more context patterns
  includeAssistantMessages: false,
  includeToolCalls: false,
  includeDuration: true,
};

/**
 * Worker configuration
 */
export interface ContextEfficiencyWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Context Efficiency Worker - Analyzes token and context efficiency
 *
 * Phase 2 worker that identifies context management patterns.
 * Requires Premium tier or higher.
 */
export class ContextEfficiencyWorker extends BaseWorker<ContextEfficiencyOutput> {
  readonly name = 'ContextEfficiency';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: ContextEfficiencyWorkerConfig) {
    super();
    this.geminiClient = new GeminiClient({
      apiKey: config.geminiApiKey,
      model: config.model ?? 'gemini-3-flash-preview',
      temperature: config.temperature ?? 1.0,
      maxRetries: config.maxRetries ?? 2,
    } as GeminiClientConfig);
    this.verbose = config.verbose ?? false;
  }

  /**
   * Check if worker can run
   */
  canRun(context: WorkerContext): boolean {
    if (!this.isTierSufficient(context.tier)) {
      return false;
    }
    return context.sessions.length > 0 && context.moduleAOutput !== undefined;
  }

  /**
   * Execute context efficiency analysis
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<ContextEfficiencyOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for ContextEfficiency');
    }

    this.logMessage('Analyzing context and token efficiency...');

    // NO try-catch: let errors propagate
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      CONTEXT_EFFICIENCY_FORMAT
    );
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);
    const userPrompt = buildContextEfficiencyUserPrompt(sessionsFormatted, moduleAJson);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: CONTEXT_EFFICIENCY_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: ContextEfficiencyOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(`Efficiency score: ${result.data.overallEfficiencyScore}`);
    this.logMessage(`Avg context fill: ${result.data.avgContextFillPercent}%`);

    return this.createSuccessResult(result.data, result.usage);
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[ContextEfficiencyWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating ContextEfficiencyWorker
 */
export function createContextEfficiencyWorker(
  config: ContextEfficiencyWorkerConfig
): ContextEfficiencyWorker {
  return new ContextEfficiencyWorker(config);
}
