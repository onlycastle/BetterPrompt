/**
 * Cross-Session Anti-Pattern Worker (Phase 2)
 *
 * Detects behavioral patterns that repeat across multiple sessions.
 * Only patterns appearing in 2+ sessions qualify as behavioral patterns.
 * Single-session occurrences are isolated incidents, not patterns.
 *
 * Anti-Pattern Hierarchy:
 * - CRITICAL: blind_approval, sunk_cost_loop
 * - WARNING: passive_acceptance, blind_retry
 * - INFO: delegation_without_review
 *
 * @module analyzer/workers/cross-session-anti-pattern-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  CrossSessionAntiPatternOutputSchema,
  type CrossSessionAntiPatternOutput,
  getAllCrossSessionPatterns,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT,
  buildCrossSessionAntiPatternUserPrompt,
} from './prompts/cross-session-anti-pattern-prompts';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

/**
 * Format preset for Cross-Session Anti-Pattern Detection
 * - Both user and assistant messages (to track approval patterns)
 * - Tool calls included (for delegation pattern detection)
 * - Duration included (for sunk cost loop detection)
 */
const CROSS_SESSION_FORMAT = {
  maxContentLength: 1500,
  includeAssistantMessages: true,
  includeToolCalls: true,
  includeDuration: true,
};

/**
 * Worker configuration
 */
export interface CrossSessionAntiPatternWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Cross-Session Anti-Pattern Worker
 *
 * Phase 2 worker that identifies behavioral anti-patterns recurring across sessions.
 * Requires Premium tier or higher.
 *
 * Key innovation: LLM sees ALL sessions at once and identifies patterns
 * that appear in 2+ sessions, not per-session analysis.
 */
export class CrossSessionAntiPatternWorker extends BaseWorker<CrossSessionAntiPatternOutput> {
  readonly name = 'CrossSessionAntiPattern';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: CrossSessionAntiPatternWorkerConfig) {
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
   *
   * Requires:
   * - Premium tier or higher
   * - At least 2 sessions (minimum for pattern detection)
   * - Module A output available
   */
  canRun(context: WorkerContext): boolean {
    if (!this.isTierSufficient(context.tier)) {
      return false;
    }

    // Need at least 2 sessions for cross-session pattern detection
    if (context.sessions.length < 2) {
      this.logMessage('Skipping: Need at least 2 sessions for cross-session detection');
      return false;
    }

    return context.moduleAOutput !== undefined;
  }

  /**
   * Execute cross-session anti-pattern detection
   *
   * Key approach: Send ALL sessions to LLM at once,
   * ask it to find patterns appearing in 2+ sessions.
   *
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<CrossSessionAntiPatternOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for CrossSessionAntiPattern');
    }

    const sessionCount = context.sessions.length;
    this.logMessage(`Detecting cross-session anti-patterns across ${sessionCount} sessions...`);

    // Format ALL sessions together with clear session boundaries
    const sessionsFormatted = this.formatSessionsWithBoundaries(context);
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);

    const userPrompt = buildCrossSessionAntiPatternUserPrompt(
      sessionCount,
      sessionsFormatted,
      moduleAJson,
      context.outputLanguage
    );

    const result = await this.geminiClient.generateStructured({
      systemPrompt: CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: CrossSessionAntiPatternOutputSchema,
      maxOutputTokens: 12288, // Higher limit for cross-session analysis
    });

    // Log results
    const patterns = getAllCrossSessionPatterns(result.data);
    const criticalCount = patterns.filter((p) => p.severity === 'critical').length;
    const warningCount = patterns.filter((p) => p.severity === 'warning').length;
    const infoCount = patterns.filter((p) => p.severity === 'info').length;

    this.logMessage(`Pattern density: ${result.data.patternDensity}%`);
    this.logMessage(`Cross-session consistency: ${(result.data.crossSessionConsistency * 100).toFixed(1)}%`);
    this.logMessage(`Detected patterns: ${criticalCount} critical, ${warningCount} warning, ${infoCount} info`);

    return this.createSuccessResult(result.data, result.usage);
  }

  /**
   * Format sessions with clear boundaries for cross-session analysis
   *
   * Each session is clearly delimited with session ID header
   * so the LLM can easily track patterns across sessions.
   */
  private formatSessionsWithBoundaries(context: WorkerContext): string {
    const formattedSessions: string[] = [];

    for (let i = 0; i < context.sessions.length; i++) {
      const session = context.sessions[i];
      const sessionId = session.sessionId || `session_${i + 1}`;

      // Format this single session
      const sessionFormatted = formatSessionsForAnalysis([session], CROSS_SESSION_FORMAT);

      // Add clear session boundary
      formattedSessions.push(
        `\n${'='.repeat(60)}\n` +
        `SESSION: ${sessionId}\n` +
        `${'='.repeat(60)}\n` +
        sessionFormatted
      );
    }

    return formattedSessions.join('\n');
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[CrossSessionAntiPatternWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating CrossSessionAntiPatternWorker
 */
export function createCrossSessionAntiPatternWorker(
  config: CrossSessionAntiPatternWorkerConfig
): CrossSessionAntiPatternWorker {
  return new CrossSessionAntiPatternWorker(config);
}
