/**
 * Communication Patterns Worker (Phase 2)
 *
 * Analyzes developer communication patterns with AI by directly examining
 * developerUtterances from Phase 1. Produces patterns with utteranceId-based
 * evidence that can be verified against original data.
 *
 * This worker was moved from Phase 3 ContentWriter to enable:
 * - Direct access to all developerUtterances (not limited topUtterances)
 * - utteranceId-based evidence (vs. LLM-generated quotes)
 * - Clear separation: Phase 2 analyzes, Phase 3 narrates
 *
 * @module analyzer/workers/communication-patterns-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  CommunicationPatternsLLMOutputSchema,
  type CommunicationPatternsOutput,
  parseCommunicationPatternsLLMOutput,
} from '../../models/communication-patterns-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  COMMUNICATION_PATTERNS_SYSTEM_PROMPT,
  buildCommunicationPatternsUserPrompt,
} from './prompts/communication-patterns-prompts';

/**
 * CommunicationPatternsWorker - Analyzes developer-AI communication patterns
 *
 * Phase 2 worker that examines how developers communicate with AI:
 * - Questioning styles (Socratic, verification-seeking, etc.)
 * - Context provision (rich vs. minimal)
 * - Iteration patterns (refinement loops, pivots, etc.)
 * - Structural approaches (blueprints, incremental, exploratory)
 */
export class CommunicationPatternsWorker extends BaseWorker<CommunicationPatternsOutput> {
  readonly name = 'CommunicationPatterns';
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

    // Need minimum utterances for meaningful pattern detection
    if (phase2Context.phase1Output.developerUtterances.length < 5) {
      this.log('Cannot run: Insufficient utterances for pattern detection (need at least 5)');
      return false;
    }

    return true;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<CommunicationPatternsOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for CommunicationPatternsWorker');
    }

    this.log('Analyzing communication patterns...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);
    this.log(`Sessions: ${phase2Context.phase1Output.sessionMetrics.totalSessions}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildCommunicationPatternsUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.client!.generateStructured({
      systemPrompt: COMMUNICATION_PATTERNS_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: CommunicationPatternsLLMOutputSchema,
      maxOutputTokens: 32768, // Larger output for detailed pattern analysis
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseCommunicationPatternsLLMOutput(result.data);

    this.log(`Found ${parsedOutput.patterns.length} communication patterns`);
    this.log(`Overall effectiveness score: ${parsedOutput.overallEffectivenessScore}`);
    this.log(`Confidence: ${parsedOutput.confidenceScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt.
   *
   * Focuses on utterance data needed for pattern detection:
   * - Full utterance text (with displayText preference)
   * - Metadata for context (wordCount, hasQuestion, etc.)
   * - Session metrics for frequency calculations
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        // Use displayText (sanitized) if available, fallback to raw text
        // Truncate to reasonable length for prompt
        text: (u.displayText || u.text).slice(0, 1500),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        timestamp: u.timestamp,
      })),
      sessionMetrics: {
        totalSessions: phase1.sessionMetrics.totalSessions,
        totalDeveloperUtterances: phase1.sessionMetrics.totalDeveloperUtterances,
        avgDeveloperMessageLength: phase1.sessionMetrics.avgDeveloperMessageLength,
        avgMessagesPerSession: phase1.sessionMetrics.avgMessagesPerSession,
      },
    };
  }
}

/**
 * Factory function for creating CommunicationPatternsWorker
 */
export function createCommunicationPatternsWorker(
  config: OrchestratorConfig
): CommunicationPatternsWorker {
  return new CommunicationPatternsWorker(config);
}
