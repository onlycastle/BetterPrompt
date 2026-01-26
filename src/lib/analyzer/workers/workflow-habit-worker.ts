/**
 * Workflow Habit Worker (Phase 2 - v2 Architecture)
 *
 * Core Phase 2 worker that detects:
 * - Planning habits (/plan usage, task decomposition, structure-first)
 * - Critical thinking moments (verification, questioning, validation)
 * - Multitasking patterns (context pollution)
 *
 * Split from BehaviorPatternWorker to focus exclusively on positive workflow habits.
 * This worker answers: "How intentionally does this developer structure their work?"
 *
 * @module analyzer/workers/workflow-habit-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  WorkflowHabitLLMOutputSchema,
  type WorkflowHabitOutput,
  parseWorkflowHabitLLMOutput,
} from '../../models/workflow-habit-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  WORKFLOW_HABIT_SYSTEM_PROMPT,
  buildWorkflowHabitUserPrompt,
} from './prompts/workflow-habit-prompts';

/**
 * WorkflowHabitWorker - Detects workflow structure and critical thinking
 *
 * Phase 2 worker that analyzes planning habits and thinking patterns.
 * Answers: "How intentionally does this developer structure their work?"
 *
 * Premium tier - detailed workflow analysis is a premium feature.
 */
export class WorkflowHabitWorker extends BaseWorker<WorkflowHabitOutput> {
  readonly name = 'WorkflowHabit';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium'; // Workflow analysis is premium

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  /**
   * Check if worker can run
   */
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

  /**
   * Execute workflow habit analysis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<WorkflowHabitOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for WorkflowHabitWorker');
    }

    this.log('Analyzing workflow habits and critical thinking...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildWorkflowHabitUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.client!.generateStructured({
      systemPrompt: WORKFLOW_HABIT_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: WorkflowHabitLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseWorkflowHabitLLMOutput(result.data);

    this.log(`Found ${parsedOutput.planningHabits.length} planning habits`);
    this.log(`Found ${parsedOutput.criticalThinkingMoments.length} critical thinking moments`);
    this.log(`Workflow score: ${parsedOutput.overallWorkflowScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Includes tool usage counts and session start utterances for planning detection.
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    const MAX_UTTERANCES = 100;
    const MAX_AI_RESPONSES = 50;

    return {
      developerUtterances: phase1.developerUtterances.slice(0, MAX_UTTERANCES).map((u) => ({
        id: u.id,
        text: u.text.slice(0, 600),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        precedingAIToolCalls: u.precedingAIToolCalls,
        timestamp: u.timestamp,
      })),
      aiResponses: phase1.aiResponses.slice(0, MAX_AI_RESPONSES).map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        turnIndex: r.turnIndex,
        responseType: r.responseType,
        toolsUsed: r.toolsUsed,
        wasSuccessful: r.wasSuccessful,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating WorkflowHabitWorker
 */
export function createWorkflowHabitWorker(
  config: OrchestratorConfig
): WorkflowHabitWorker {
  return new WorkflowHabitWorker(config);
}
