/**
 * Knowledge Gap Worker (Phase 2 - v2 Architecture)
 *
 * Phase 2 worker that analyzes knowledge gaps:
 * - Identifies gaps from repeated questions
 * - Tracks learning progress over sessions
 * - Recommends specific learning resources
 *
 * Refactored to use Phase1Output (v2 context isolation).
 *
 * @module analyzer/workers/knowledge-gap-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  KnowledgeGapOutputSchema,
  type KnowledgeGapOutput,
} from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  KNOWLEDGE_GAP_SYSTEM_PROMPT,
  buildKnowledgeGapUserPrompt,
} from './prompts/wow-agent-prompts';

/**
 * Knowledge Gap Worker - Analyzes knowledge gaps and learning
 *
 * Phase 2 worker that identifies knowledge gaps and tracks progress.
 * Uses Phase1Output (v2 context isolation).
 * Requires Premium tier or higher.
 */
export class KnowledgeGapWorker extends BaseWorker<KnowledgeGapOutput> {
  readonly name = 'KnowledgeGap';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  /**
   * Check if worker can run
   */
  canRun(context: WorkerContext): boolean {
    const phase2Context = context as Phase2WorkerContext;

    if (!this.isTierSufficient(context.tier)) {
      return false;
    }

    if (!phase2Context.phase1Output) {
      this.log('Cannot run: Phase 1 output not available');
      return false;
    }

    if (phase2Context.phase1Output.developerUtterances.length === 0) {
      this.log('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Execute knowledge gap analysis
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<KnowledgeGapOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for KnowledgeGapWorker');
    }

    this.log('Analyzing knowledge gaps and learning progress...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);
    const userPrompt = buildKnowledgeGapUserPrompt(phase1Json);

    const result = await this.client!.generateStructured({
      systemPrompt: KNOWLEDGE_GAP_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: KnowledgeGapOutputSchema,
      maxOutputTokens: 8192,
    });

    this.log(`Knowledge score: ${result.data.overallKnowledgeScore}`);
    this.log(`Found ${result.data.topInsights.length} knowledge insights`);

    return this.createSuccessResult(result.data, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Focuses on questions and learning-related utterances.
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        text: u.text.slice(0, 800),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating KnowledgeGapWorker
 */
export function createKnowledgeGapWorker(
  config: OrchestratorConfig
): KnowledgeGapWorker {
  return new KnowledgeGapWorker(config);
}
