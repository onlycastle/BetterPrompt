/**
 * Behavior Pattern Worker (Phase 2 - v2 Architecture)
 *
 * Core Phase 2 worker that detects:
 * - Anti-patterns (error loops, blind retry, passive acceptance, vibe coder patterns)
 * - Planning habits (/plan usage, task decomposition, structure-first)
 * - Critical thinking moments (verification, questioning, validation)
 * - Verification behavior level (Vibe Coder spectrum)
 * - Multitasking patterns (context pollution)
 *
 * Integrates functionality from:
 * - AntiPatternSpotter
 * - CrossSessionAntiPattern
 * - MultitaskingAnalyzer
 *
 * Based on research from Addy Osmani (Vibe Coding vs AI-Assisted Engineering)
 *
 * @module analyzer/workers/behavior-pattern-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  BehaviorPatternLLMOutputSchema,
  type BehaviorPatternOutput,
  parseBehaviorPatternLLMOutput,
  createEmptyBehaviorPatternOutput,
} from '../../models/behavior-pattern-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  BEHAVIOR_PATTERN_SYSTEM_PROMPT,
  buildBehaviorPatternUserPrompt,
} from './prompts/phase2-worker-prompts';

/**
 * Worker configuration
 */
export interface BehaviorPatternWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Extended WorkerContext for Phase 2 workers
 */
interface Phase2WorkerContext extends WorkerContext {
  phase1Output?: Phase1Output;
}

/**
 * BehaviorPatternWorker - Detects behavioral patterns and anti-patterns
 *
 * Phase 2 worker that analyzes developer habits.
 * Includes Vibe Coder spectrum assessment from research.
 *
 * Premium tier - anti-patterns and verification analysis are premium features.
 */
export class BehaviorPatternWorker extends BaseWorker<BehaviorPatternOutput> {
  readonly name = 'BehaviorPattern';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium'; // Anti-pattern analysis is premium

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: BehaviorPatternWorkerConfig) {
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
    const phase2Context = context as Phase2WorkerContext;

    // Must have Phase 1 output
    if (!phase2Context.phase1Output) {
      this.logMessage('Cannot run: Phase 1 output not available');
      return false;
    }

    // Must have utterances to analyze
    if (phase2Context.phase1Output.developerUtterances.length === 0) {
      this.logMessage('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Execute behavior pattern analysis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<BehaviorPatternOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for BehaviorPatternWorker');
    }

    this.logMessage('Analyzing behavioral patterns and anti-patterns...');
    this.logMessage(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);
    this.logMessage(`AI Responses: ${phase2Context.phase1Output.aiResponses.length}`);

    // Prepare Phase 1 output for the prompt
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildBehaviorPatternUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.geminiClient.generateStructured({
      systemPrompt: BEHAVIOR_PATTERN_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: BehaviorPatternLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseBehaviorPatternLLMOutput(result.data);

    this.logMessage(`Found ${parsedOutput.antiPatterns.length} anti-patterns`);
    this.logMessage(`Found ${parsedOutput.planningHabits.length} planning habits`);
    this.logMessage(`Found ${parsedOutput.criticalThinkingMoments.length} critical thinking moments`);
    this.logMessage(`Verification level: ${parsedOutput.verificationBehavior.level}`);
    this.logMessage(`Health score: ${parsedOutput.overallHealthScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Includes both utterances and AI responses for pattern detection.
   * AI response data helps detect error loops and retry patterns.
   * Returns a simplified object for JSON serialization (not the full schema type).
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    const MAX_UTTERANCES = 100;
    const MAX_AI_RESPONSES = 100;

    // Include error-related AI responses for anti-pattern detection
    const aiResponsesWithErrors = phase1.aiResponses.filter(r => r.hadError);
    const otherResponses = phase1.aiResponses.filter(r => !r.hadError);

    // Prioritize error responses for anti-pattern detection
    const selectedResponses = [
      ...aiResponsesWithErrors.slice(0, MAX_AI_RESPONSES / 2),
      ...otherResponses.slice(0, MAX_AI_RESPONSES / 2),
    ];

    return {
      developerUtterances: phase1.developerUtterances.slice(0, MAX_UTTERANCES).map((u) => ({
        id: u.id,
        text: u.text.slice(0, 600), // Shorter for pattern detection
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
      aiResponses: selectedResponses.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        turnIndex: r.turnIndex,
        responseType: r.responseType,
        toolsUsed: r.toolsUsed,
        hadError: r.hadError,
        wasSuccessful: r.wasSuccessful,
        fullTextLength: r.fullTextLength,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[BehaviorPatternWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating BehaviorPatternWorker
 */
export function createBehaviorPatternWorker(
  config: BehaviorPatternWorkerConfig
): BehaviorPatternWorker {
  return new BehaviorPatternWorker(config);
}
