/**
 * Anti-Pattern Spotter Worker (Wow Agent 2)
 *
 * Phase 2 worker that detects problematic patterns:
 * - Error loops (same error repeated)
 * - Learning avoidance patterns
 * - Repeated mistakes across sessions
 *
 * @module analyzer/workers/anti-pattern-spotter-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  AntiPatternSpotterOutputSchema,
  type AntiPatternSpotterOutput,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  ANTI_PATTERN_SPOTTER_SYSTEM_PROMPT,
  buildAntiPatternSpotterUserPrompt,
} from './prompts/wow-agent-prompts';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

/**
 * Format preset for Anti-Pattern Spotter
 * - Both user and assistant messages (to track error loops)
 * - Tool calls included (for debugging pattern detection)
 */
const ANTI_PATTERN_FORMAT = {
  maxContentLength: 1500,
  includeAssistantMessages: true,
  includeToolCalls: true,
  includeDuration: true,
};

/**
 * Worker configuration
 */
export interface AntiPatternSpotterWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Anti-Pattern Spotter Worker - Detects problematic patterns
 *
 * Phase 2 worker that identifies error loops and bad habits.
 * Requires Premium tier or higher.
 */
export class AntiPatternSpotterWorker extends BaseWorker<AntiPatternSpotterOutput> {
  readonly name = 'AntiPatternSpotter';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: AntiPatternSpotterWorkerConfig) {
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
   * Execute anti-pattern detection
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<AntiPatternSpotterOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for AntiPatternSpotter');
    }

    this.logMessage('Detecting anti-patterns and bad habits...');

    // NO try-catch: let errors propagate
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      ANTI_PATTERN_FORMAT
    );
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);
    const userPrompt = buildAntiPatternSpotterUserPrompt(sessionsFormatted, moduleAJson, context.outputLanguage);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: ANTI_PATTERN_SPOTTER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: AntiPatternSpotterOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(`Health score: ${result.data.overallHealthScore}`);
    this.logMessage(`Found ${result.data.topInsights.length} anti-pattern insights`);

    return this.createSuccessResult(result.data, result.usage);
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[AntiPatternSpotterWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating AntiPatternSpotterWorker
 */
export function createAntiPatternSpotterWorker(
  config: AntiPatternSpotterWorkerConfig
): AntiPatternSpotterWorker {
  return new AntiPatternSpotterWorker(config);
}
