/**
 * Context Efficiency Worker (Phase 2 - v2 Architecture)
 *
 * Phase 2 worker that analyzes context and token efficiency:
 * - Context usage patterns (fill percentage)
 * - Inefficiency patterns (late compaction, bloat)
 * - Prompt length trends
 * - Redundant information repetition
 * - Productivity metrics (iteration cycles, collaboration efficiency)
 *
 * Refactored to use Phase1Output (v2 context isolation).
 * Also consolidates productivity analysis from the deprecated ProductivityAnalystWorker.
 *
 * @module analyzer/workers/context-efficiency-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  ContextEfficiencyOutputSchema,
  type ContextEfficiencyOutput,
} from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  CONTEXT_EFFICIENCY_SYSTEM_PROMPT,
  buildContextEfficiencyUserPrompt,
} from './prompts/wow-agent-prompts';

/**
 * Context Efficiency Worker - Analyzes token and context efficiency + productivity
 *
 * Phase 2 worker that identifies context management patterns and productivity metrics.
 * Uses Phase1Output (v2 context isolation).
 */
export class ContextEfficiencyWorker extends BaseWorker<ContextEfficiencyOutput> {
  readonly name = 'ContextEfficiency';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    const phase2Context = context as Phase2WorkerContext;

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

  async execute(context: WorkerContext): Promise<WorkerResult<ContextEfficiencyOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for ContextEfficiencyWorker');
    }

    this.log('Analyzing context efficiency and productivity...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);
    const userPrompt = buildContextEfficiencyUserPrompt(phase1Json);

    const result = await this.client!.generateStructured({
      systemPrompt: CONTEXT_EFFICIENCY_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: ContextEfficiencyOutputSchema,
      maxOutputTokens: 8192,
    });

    this.log(`Efficiency score: ${result.data.overallEfficiencyScore}`);
    this.log(`Avg context fill: ${result.data.avgContextFillPercent}%`);

    return this.createSuccessResult(result.data, result.usage);
  }

  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        text: u.text.slice(0, 1500), // Longer for context analysis
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        characterCount: u.characterCount,
        wordCount: u.wordCount,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating ContextEfficiencyWorker
 */
export function createContextEfficiencyWorker(
  config: OrchestratorConfig
): ContextEfficiencyWorker {
  return new ContextEfficiencyWorker(config);
}
