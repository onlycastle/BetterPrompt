/**
 * Type Classifier Worker (Phase 2 - v2 Architecture)
 *
 * Phase 2 worker that classifies developers into the AI Collaboration Matrix:
 * - 5 Coding Styles: architect, scientist, collaborator, speedrunner, craftsman
 * - 3 Control Levels: explorer, navigator, cartographer
 * - 15 Matrix Combinations (e.g., "Systems Architect", "Mad Scientist")
 *
 * Also assesses Collaboration Maturity (Vibe Coder spectrum).
 *
 * This is the "fun/viral" element of the report - shareable personality type.
 *
 * Refactored from TypeSynthesisWorker to work with Phase 1 output only.
 *
 * @module analyzer/workers/type-classifier-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  TypeClassifierOutputSchema,
  type TypeClassifierOutput,
} from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { BehaviorPatternOutput } from '../../models/behavior-pattern-data';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TYPE_CLASSIFIER_SYSTEM_PROMPT,
  buildTypeClassifierUserPrompt,
} from './prompts/phase2-worker-prompts';
import { z } from 'zod';

/**
 * Worker configuration
 */
export interface TypeClassifierWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

/**
 * Extended WorkerContext for TypeClassifier
 *
 * TypeClassifier runs AFTER other Phase 2 workers to incorporate their insights.
 */
interface TypeClassifierContext extends WorkerContext {
  phase1Output?: Phase1Output;
  strengthGrowthOutput?: StrengthGrowthOutput;
  behaviorPatternOutput?: BehaviorPatternOutput;
}

/**
 * LLM output schema for TypeClassifier (matches TypeClassifierOutputSchema)
 */
const TypeClassifierLLMSchema = z.object({
  primaryType: z.enum(['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman']),
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),
  controlLevel: z.enum(['explorer', 'navigator', 'cartographer']),
  controlScore: z.number().min(0).max(100),
  matrixName: z.string().max(50),
  matrixEmoji: z.string().max(10),
  collaborationMaturity: z.object({
    level: z.enum(['vibe_coder', 'supervised_coder', 'ai_assisted_engineer', 'reluctant_user']),
    description: z.string().max(300),
    indicators: z.array(z.string().max(200)),
  }).optional(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().max(500).optional(),
});

/**
 * TypeClassifierWorker - Classifies developers into the AI Collaboration Matrix
 *
 * Phase 2 worker that provides the viral/shareable personality type.
 * Runs for all tiers (FREE content - type classification is fun/marketing).
 */
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'free'; // Available to all users

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: TypeClassifierWorkerConfig) {
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
    const tcContext = context as TypeClassifierContext;

    // Must have Phase 1 output
    if (!tcContext.phase1Output) {
      this.logMessage('Cannot run: Phase 1 output not available');
      return false;
    }

    // Must have utterances to analyze
    if (tcContext.phase1Output.developerUtterances.length === 0) {
      this.logMessage('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Execute type classification
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TypeClassifierOutput>> {
    const tcContext = context as TypeClassifierContext;

    if (!tcContext.phase1Output) {
      throw new Error('Phase 1 output required for TypeClassifierWorker');
    }

    this.logMessage('Classifying developer into AI Collaboration Matrix...');

    // Prepare Phase 1 output
    const phase1ForPrompt = this.preparePhase1ForPrompt(tcContext.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    // Prepare summaries from other Phase 2 workers if available
    const strengthGrowthSummary = tcContext.strengthGrowthOutput
      ? this.summarizeStrengthGrowth(tcContext.strengthGrowthOutput)
      : undefined;

    const behaviorPatternSummary = tcContext.behaviorPatternOutput
      ? this.summarizeBehaviorPattern(tcContext.behaviorPatternOutput)
      : undefined;

    const userPrompt = buildTypeClassifierUserPrompt(
      phase1Json,
      strengthGrowthSummary,
      behaviorPatternSummary
    );

    // Call Gemini
    const result = await this.geminiClient.generateStructured({
      systemPrompt: TYPE_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TypeClassifierLLMSchema,
      maxOutputTokens: 8192,
    });

    // Validate distribution sums to 100
    const dist = result.data.distribution;
    const sum = dist.architect + dist.scientist + dist.collaborator + dist.speedrunner + dist.craftsman;
    if (Math.abs(sum - 100) > 1) {
      this.logMessage(`Warning: Distribution sums to ${sum}, normalizing...`);
      // Normalize
      const factor = 100 / sum;
      dist.architect = Math.round(dist.architect * factor);
      dist.scientist = Math.round(dist.scientist * factor);
      dist.collaborator = Math.round(dist.collaborator * factor);
      dist.speedrunner = Math.round(dist.speedrunner * factor);
      dist.craftsman = Math.round(dist.craftsman * factor);
    }

    this.logMessage(`Type: ${result.data.primaryType}`);
    this.logMessage(`Control: ${result.data.controlLevel} (${result.data.controlScore})`);
    this.logMessage(`Matrix: ${result.data.matrixName} ${result.data.matrixEmoji}`);

    return this.createSuccessResult(result.data as TypeClassifierOutput, result.usage);
  }

  /**
   * Prepare Phase 1 output for the prompt
   * Returns a simplified object for JSON serialization (not the full schema type).
   */
  private preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    const MAX_UTTERANCES = 80;

    return {
      developerUtterances: phase1.developerUtterances.slice(0, MAX_UTTERANCES).map((u) => ({
        id: u.id,
        text: u.text.slice(0, 500),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }

  /**
   * Summarize StrengthGrowth output for type classification
   */
  private summarizeStrengthGrowth(output: StrengthGrowthOutput): string {
    const strengthTitles = output.strengths.map(s => s.title).slice(0, 5).join(', ');
    const growthTitles = output.growthAreas.map(g => g.title).slice(0, 5).join(', ');
    const dimensions = new Set([
      ...output.strengths.map(s => s.dimension),
      ...output.growthAreas.map(g => g.dimension),
    ]);

    return `Strengths: ${strengthTitles || 'None identified'}
Growth Areas: ${growthTitles || 'None identified'}
Dimensions covered: ${Array.from(dimensions).join(', ')}
Confidence: ${output.confidenceScore}`;
  }

  /**
   * Summarize BehaviorPattern output for type classification
   */
  private summarizeBehaviorPattern(output: BehaviorPatternOutput): string {
    const antiPatternTypes = output.antiPatterns.map(ap => ap.type).slice(0, 5).join(', ');
    const planningTypes = output.planningHabits.map(ph => `${ph.type}(${ph.frequency})`).join(', ');

    return `Anti-patterns: ${antiPatternTypes || 'None detected'}
Planning habits: ${planningTypes || 'None detected'}
Verification level: ${output.verificationBehavior.level}
Health score: ${output.overallHealthScore}
Critical thinking moments: ${output.criticalThinkingMoments.length}`;
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[TypeClassifierWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating TypeClassifierWorker
 */
export function createTypeClassifierWorker(
  config: TypeClassifierWorkerConfig
): TypeClassifierWorker {
  return new TypeClassifierWorker(config);
}
