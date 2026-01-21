/**
 * Pattern Detective Worker (Wow Agent 1)
 *
 * Phase 2 worker that discovers conversation patterns:
 * - Repeated questions across sessions
 * - Conversation style patterns
 * - Request start patterns
 *
 * @module analyzer/workers/pattern-detective-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  PatternDetectiveOutputSchema,
  type PatternDetectiveOutput,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  PATTERN_DETECTIVE_SYSTEM_PROMPT,
  buildPatternDetectiveUserPrompt,
} from './prompts/wow-agent-prompts';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

/**
 * Format preset for Pattern Detective
 * - User messages only (analyzing their communication style)
 * - No tool calls (focus on language patterns)
 */
const PATTERN_DETECTIVE_FORMAT = {
  maxContentLength: 1500,
  includeAssistantMessages: false,
  includeToolCalls: false,
  includeDuration: false,
};

/**
 * Worker configuration
 */
export interface PatternDetectiveWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Pattern Detective Worker - Discovers conversation patterns
 *
 * Phase 2 worker that analyzes communication style and patterns.
 * Available for all tiers (free and above).
 */
export class PatternDetectiveWorker extends BaseWorker<PatternDetectiveOutput> {
  readonly name = 'PatternDetective';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'free';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: PatternDetectiveWorkerConfig) {
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
   * Requires Module A output and sufficient tier
   */
  canRun(context: WorkerContext): boolean {
    if (!this.isTierSufficient(context.tier)) {
      return false;
    }
    return context.sessions.length > 0 && context.moduleAOutput !== undefined;
  }

  /**
   * Execute pattern detection analysis
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<PatternDetectiveOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for PatternDetective');
    }

    this.logMessage('Analyzing conversation patterns...');

    // NO try-catch: let errors propagate
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      PATTERN_DETECTIVE_FORMAT
    );
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);
    const userPrompt = buildPatternDetectiveUserPrompt(sessionsFormatted, moduleAJson);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: PATTERN_DETECTIVE_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: PatternDetectiveOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(`Found ${result.data.topInsights.length} insights`);
    this.logMessage(`Confidence: ${(result.data.confidenceScore * 100).toFixed(0)}%`);

    return this.createSuccessResult(result.data, result.usage);
  }


  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[PatternDetectiveWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating PatternDetectiveWorker
 */
export function createPatternDetectiveWorker(
  config: PatternDetectiveWorkerConfig
): PatternDetectiveWorker {
  return new PatternDetectiveWorker(config);
}
