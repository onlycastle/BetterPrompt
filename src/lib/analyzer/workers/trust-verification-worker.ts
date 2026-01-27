/**
 * Trust Verification Worker (Phase 2 - v2 Architecture)
 *
 * Core Phase 2 worker that detects:
 * - Anti-patterns (error loops, blind retry, passive acceptance, vibe coder patterns)
 * - Verification behavior level (Vibe Coder spectrum)
 * - Pattern types for knowledge base matching
 *
 * Split from BehaviorPatternWorker to focus exclusively on trust/verification concerns.
 * This worker answers: "Does this developer blindly trust AI or verify outputs?"
 *
 * Based on research from Addy Osmani (Vibe Coding vs AI-Assisted Engineering)
 *
 * @module analyzer/workers/trust-verification-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type Phase2WorkerContext } from './base-worker';
import {
  TrustVerificationLLMOutputSchema,
  type TrustVerificationOutput,
  parseTrustVerificationLLMOutput,
} from '../../models/trust-verification-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TRUST_VERIFICATION_SYSTEM_PROMPT,
  buildTrustVerificationUserPrompt,
} from './prompts/trust-verification-prompts';

/**
 * TrustVerificationWorker - Detects trust issues and verification gaps
 *
 * Phase 2 worker that analyzes anti-patterns and verification behavior.
 * Answers: "Does this developer blindly trust AI or verify outputs?"
 *
 * Premium tier - anti-pattern and verification analysis is a premium feature.
 */
export class TrustVerificationWorker extends BaseWorker<TrustVerificationOutput> {
  readonly name = 'TrustVerification';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium'; // Anti-pattern analysis is premium

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
   * Execute trust verification analysis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TrustVerificationOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for TrustVerificationWorker');
    }

    this.log('Analyzing trust patterns and verification behavior...');
    this.log(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);
    this.log(`AI Responses: ${phase2Context.phase1Output.aiResponses.length}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildTrustVerificationUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.client!.generateStructured({
      systemPrompt: TRUST_VERIFICATION_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TrustVerificationLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseTrustVerificationLLMOutput(result.data);

    this.log(`Found ${parsedOutput.antiPatterns.length} anti-patterns`);
    this.log(`Verification level: ${parsedOutput.verificationBehavior.level}`);
    this.log(`Trust health score: ${parsedOutput.overallTrustHealthScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Prioritizes error-related AI responses for anti-pattern detection.
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        text: u.text.slice(0, 1000),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        precedingAIHadError: u.precedingAIHadError,
        precedingAIToolCalls: u.precedingAIToolCalls,
        timestamp: u.timestamp,
      })),
      aiResponses: phase1.aiResponses.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        turnIndex: r.turnIndex,
        responseType: r.responseType,
        toolsUsed: r.toolsUsed,
        hadError: r.hadError,
        wasSuccessful: r.wasSuccessful,
        fullTextLength: r.fullTextLength,
        textSnippet: r.textSnippet?.slice(0, 400),
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating TrustVerificationWorker
 */
export function createTrustVerificationWorker(
  config: OrchestratorConfig
): TrustVerificationWorker {
  return new TrustVerificationWorker(config);
}
