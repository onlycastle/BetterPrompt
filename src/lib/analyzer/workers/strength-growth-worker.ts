/**
 * Strength & Growth Worker (Phase 2 - v2 Architecture)
 *
 * Core Phase 2 worker that identifies:
 * - Developer strengths with evidence quotes
 * - Growth areas with recommendations and quantification
 *
 * Key differences from original architecture:
 * - Receives ONLY Phase 1 output (no raw sessions)
 * - Assigns dimensions here (not in Phase 1)
 * - Always outputs English (Phase 3 handles translation)
 *
 * @module analyzer/workers/strength-growth-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthOutput,
  parseStrengthGrowthLLMOutput,
} from '../../models/strength-growth-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  STRENGTH_GROWTH_SYSTEM_PROMPT,
  buildStrengthGrowthUserPrompt,
} from './prompts/phase2-worker-prompts';

/**
 * StrengthGrowthWorker - Identifies strengths and growth areas
 *
 * Phase 2 worker that analyzes developer capabilities.
 * Runs for all tiers (FREE content - strengths and growth identification).
 */
export class StrengthGrowthWorker extends BaseWorker<StrengthGrowthOutput> {
  readonly name = 'StrengthGrowth';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'free'; // Available to all users

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  /**
   * Check if worker can run
   *
   * Requires Phase 1 output with developer utterances.
   */
  canRun(context: WorkerContext): boolean {
    const phase2Context = context as Phase2WorkerContext;

    // Must have Phase 1 output
    if (!phase2Context.phase1Output) {
      this.log('Cannot run: Phase 1 output not available');
      return false;
    }

    // Must have utterances to analyze
    if (phase2Context.phase1Output.developerUtterances.length === 0) {
      this.log('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Execute strength/growth analysis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<StrengthGrowthOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for StrengthGrowthWorker');
    }

    this.log('Analyzing strengths and growth areas...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);

    // Check for minimum data
    if (phase2Context.phase1Output.developerUtterances.length < 5) {
      this.log('Warning: Few utterances available for analysis');
    }

    // Prepare Phase 1 output as JSON for the prompt
    // We limit the data size to stay within token limits
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildStrengthGrowthUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.client!.generateStructured({
      systemPrompt: STRENGTH_GROWTH_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: StrengthGrowthLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseStrengthGrowthLLMOutput(result.data);

    this.log(`Found ${parsedOutput.strengths.length} strengths`);
    this.log(`Found ${parsedOutput.growthAreas.length} growth areas`);
    this.log(`Confidence: ${parsedOutput.confidenceScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Limits data size while preserving important information.
   * Returns a simplified object for JSON serialization (not the full schema type).
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        text: u.text.slice(0, 800),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        characterCount: u.characterCount,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        precedingAIHadError: u.precedingAIHadError,
        timestamp: u.timestamp,
      })),
      aiResponses: phase1.aiResponses.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        responseType: r.responseType,
        toolsUsed: r.toolsUsed,
        hadError: r.hadError,
        wasSuccessful: r.wasSuccessful,
        fullTextLength: r.fullTextLength,
        turnIndex: r.turnIndex,
        textSnippet: r.textSnippet?.slice(0, 300),
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }

}

/**
 * Factory function for creating StrengthGrowthWorker
 */
export function createStrengthGrowthWorker(
  config: OrchestratorConfig
): StrengthGrowthWorker {
  return new StrengthGrowthWorker(config);
}
