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

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthOutput,
  parseStrengthGrowthLLMOutput,
  createEmptyStrengthGrowthOutput,
} from '../../models/strength-growth-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  STRENGTH_GROWTH_SYSTEM_PROMPT,
  buildStrengthGrowthUserPrompt,
} from './prompts/phase2-worker-prompts';

/**
 * Worker configuration
 */
export interface StrengthGrowthWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Extended WorkerContext for Phase 2 workers that require Phase 1 output
 *
 * NOTE: In the v2 architecture, Phase 2 workers should NOT access raw sessions.
 * They receive ONLY the Phase 1 output. This is enforced by the orchestrator.
 */
export interface Phase2WorkerContext extends WorkerContext {
  /** Phase 1 extraction output (REQUIRED for Phase 2 workers) */
  phase1Output?: Phase1Output;
}

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

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: StrengthGrowthWorkerConfig) {
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
   * Requires Phase 1 output with developer utterances.
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
   * Execute strength/growth analysis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<StrengthGrowthOutput>> {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      throw new Error('Phase 1 output required for StrengthGrowthWorker');
    }

    this.logMessage('Analyzing strengths and growth areas...');
    this.logMessage(`Utterances: ${phase2Context.phase1Output.developerUtterances.length}`);

    // Check for minimum data
    if (phase2Context.phase1Output.developerUtterances.length < 5) {
      this.logMessage('Warning: Few utterances available for analysis');
    }

    // Prepare Phase 1 output as JSON for the prompt
    // We limit the data size to stay within token limits
    const phase1ForPrompt = this.preparePhase1ForPrompt(phase2Context.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    const userPrompt = buildStrengthGrowthUserPrompt(phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.geminiClient.generateStructured({
      systemPrompt: STRENGTH_GROWTH_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: StrengthGrowthLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    // Parse the flattened LLM output into structured format
    const parsedOutput = parseStrengthGrowthLLMOutput(result.data);

    this.logMessage(`Found ${parsedOutput.strengths.length} strengths`);
    this.logMessage(`Found ${parsedOutput.growthAreas.length} growth areas`);
    this.logMessage(`Confidence: ${parsedOutput.confidenceScore}`);

    return this.createSuccessResult(parsedOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   *
   * Limits data size while preserving important information.
   * Returns a simplified object for JSON serialization (not the full schema type).
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    // Limit utterances to prevent token overflow
    const MAX_UTTERANCES = 100;
    const MAX_AI_RESPONSES = 50;

    return {
      developerUtterances: phase1.developerUtterances.slice(0, MAX_UTTERANCES).map((u) => ({
        id: u.id,
        text: u.text.slice(0, 800), // Truncate long texts
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
      aiResponses: phase1.aiResponses.slice(0, MAX_AI_RESPONSES).map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        responseType: r.responseType,
        toolsUsed: r.toolsUsed,
        hadError: r.hadError,
        wasSuccessful: r.wasSuccessful,
        fullTextLength: r.fullTextLength,
        turnIndex: r.turnIndex,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[StrengthGrowthWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating StrengthGrowthWorker
 */
export function createStrengthGrowthWorker(
  config: StrengthGrowthWorkerConfig
): StrengthGrowthWorker {
  return new StrengthGrowthWorker(config);
}
