/**
 * Knowledge Gap Worker (Wow Agent 3)
 *
 * Phase 2 worker that analyzes knowledge gaps:
 * - Identifies gaps from repeated questions
 * - Tracks learning progress over sessions
 * - Recommends specific learning resources
 *
 * @module analyzer/workers/knowledge-gap-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  KnowledgeGapOutputSchema,
  type KnowledgeGapOutput,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  KNOWLEDGE_GAP_SYSTEM_PROMPT,
  buildKnowledgeGapUserPrompt,
} from './prompts/wow-agent-prompts';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

/**
 * Format preset for Knowledge Gap Analyzer
 * - User messages only (focusing on questions asked)
 * - No tool calls (focus on conceptual questions)
 */
const KNOWLEDGE_GAP_FORMAT = {
  maxContentLength: 1500,
  includeAssistantMessages: false,
  includeToolCalls: false,
  includeDuration: false,
};

/**
 * Worker configuration
 */
export interface KnowledgeGapWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Knowledge Gap Worker - Analyzes knowledge gaps and learning
 *
 * Phase 2 worker that identifies knowledge gaps and tracks progress.
 * Requires Premium tier or higher.
 */
export class KnowledgeGapWorker extends BaseWorker<KnowledgeGapOutput> {
  readonly name = 'KnowledgeGap';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: KnowledgeGapWorkerConfig) {
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
   * Execute knowledge gap analysis
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<KnowledgeGapOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for KnowledgeGap');
    }

    this.logMessage('Analyzing knowledge gaps and learning progress...');

    // NO try-catch: let errors propagate
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      KNOWLEDGE_GAP_FORMAT
    );
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);
    const userPrompt = buildKnowledgeGapUserPrompt(sessionsFormatted, moduleAJson, context.useKorean);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: KNOWLEDGE_GAP_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: KnowledgeGapOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(`Knowledge score: ${result.data.overallKnowledgeScore}`);
    this.logMessage(`Found ${result.data.topInsights.length} knowledge insights`);

    return this.createSuccessResult(result.data, result.usage);
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[KnowledgeGapWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating KnowledgeGapWorker
 */
export function createKnowledgeGapWorker(
  config: KnowledgeGapWorkerConfig
): KnowledgeGapWorker {
  return new KnowledgeGapWorker(config);
}
