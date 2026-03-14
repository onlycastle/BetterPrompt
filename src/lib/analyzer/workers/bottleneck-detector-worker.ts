/**
 * Bottleneck Detector Worker
 *
 * Quick Fix pipeline worker that condenses all 5 insight worker perspectives
 * into a single LLM call to identify the top 3 time-wasting patterns.
 *
 * Key differences from Phase 2 insight workers:
 * - Single LLM call (vs 5 parallel workers)
 * - Focused on actionable bottlenecks, not comprehensive analysis
 * - Outputs concrete "better prompts" instead of abstract recommendations
 * - Targets ~30 second time-to-value
 *
 * @module analyzer/workers/bottleneck-detector-worker
 */

import { BaseWorker } from './base-worker';
import type { WorkerResult, WorkerContext } from '../orchestrator/types';
import type { OrchestratorConfig } from '../orchestrator/types';
import type { Phase1Output } from '../../models/phase1-output';
import {
  BottleneckDetectorLLMOutputSchema,
  type Bottleneck,
  parseBottleneckDetectorOutput,
} from '../../models/quick-fix-data';
import {
  BOTTLENECK_DETECTOR_SYSTEM_PROMPT,
  buildBottleneckDetectorUserPrompt,
} from './prompts/bottleneck-detector-prompts';

// ============================================================================
// Types
// ============================================================================

/**
 * BottleneckDetector output — the top 3 bottlenecks with suggested prompts.
 */
export interface BottleneckDetectorOutput {
  bottlenecks: Bottleneck[];
  overallHealthScore: number;
  summary: string;
}

// ============================================================================
// Worker Implementation
// ============================================================================

export class BottleneckDetectorWorker extends BaseWorker<BottleneckDetectorOutput> {
  readonly name = 'BottleneckDetector';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<BottleneckDetectorOutput>> {
    const { phase1Output } = this.getPhase2Context(context);
    if (!phase1Output) {
      throw new Error('BottleneckDetector requires Phase 1 output');
    }

    this.log(`Analyzing ${phase1Output.developerUtterances.length} utterances for bottlenecks`);

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const userPrompt = buildBottleneckDetectorUserPrompt(phase1ForPrompt);

    // Single LLM call — Quick Fix prioritizes speed over retry quality
    const result = await this.client!.generateStructured({
      systemPrompt: BOTTLENECK_DETECTOR_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: BottleneckDetectorLLMOutputSchema,
      maxOutputTokens: 16384, // Smaller than full workers — bottleneck output is compact
    });

    const parsed = parseBottleneckDetectorOutput(result.data);

    this.log(
      `Detected ${parsed.bottlenecks.length} bottlenecks, ` +
      `health score: ${parsed.overallHealthScore}`
    );

    return this.createSuccessResult(
      {
        bottlenecks: parsed.bottlenecks,
        overallHealthScore: parsed.overallHealthScore,
        summary: parsed.summary,
      },
      result.usage,
    );
  }

  /**
   * Prepare Phase 1 data for the bottleneck detector prompt.
   *
   * More aggressive filtering than full workers since Quick Fix
   * focuses on recent sessions and needs to be fast.
   * Limits to ~100 utterances from the most recent sessions.
   */
  public preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    // Take only the most recent ~100 utterances (Quick Fix focuses on recent patterns)
    const recentUtterances = phase1.developerUtterances
      .slice(-100)
      .map((u) => ({
        id: u.id,
        text: (u.displayText || u.text).slice(0, 500), // More aggressive truncation
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        precedingAIHadError: u.precedingAIHadError,
        machineContentRatio: u.machineContentRatio,
      }));

    return {
      developerUtterances: recentUtterances,
      sessionMetrics: {
        // Include key friction signals
        frictionSignals: phase1.sessionMetrics.frictionSignals,
        sessionHints: phase1.sessionMetrics.sessionHints,
        slashCommandCounts: phase1.sessionMetrics.slashCommandCounts,
        // Include basic session stats
        totalSessions: phase1.sessionMetrics.totalSessions,
        avgMessagesPerSession: phase1.sessionMetrics.avgMessagesPerSession,
        avgContextFillPercent: phase1.sessionMetrics.avgContextFillPercent,
      },
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createBottleneckDetectorWorker(
  config: OrchestratorConfig
): BottleneckDetectorWorker {
  return new BottleneckDetectorWorker(config);
}
