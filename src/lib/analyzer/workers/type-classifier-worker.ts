/**
 * Type Classifier Worker (Phase 2.5 - v2 Architecture)
 *
 * Phase 2.5 worker that classifies developers into the AI Collaboration Matrix
 * using ALL Phase 2 worker outputs for informed classification:
 * - 5 Coding Styles: architect, scientist, collaborator, speedrunner, craftsman
 * - 3 Control Levels: explorer, navigator, cartographer
 * - 15 Matrix Combinations (e.g., "Systems Architect", "Mad Scientist")
 *
 * Also assesses Collaboration Maturity (Vibe Coder spectrum).
 * Merges functionality from the deprecated TypeSynthesisWorker.
 *
 * This is the "fun/viral" element of the report - shareable personality type.
 *
 * @module analyzer/workers/type-classifier-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  type TypeClassifierOutput,
  type AgentOutputs,
} from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TYPE_CLASSIFIER_SYSTEM_PROMPT,
  buildTypeClassifierUserPrompt,
} from './prompts/phase2-worker-prompts';
import { z } from 'zod';

/**
 * Extended WorkerContext for TypeClassifier (Phase 2.5)
 *
 * TypeClassifier runs AFTER all Phase 2 workers to incorporate their insights.
 * It receives phase1Output AND agentOutputs containing all Phase 2 results.
 */
interface TypeClassifierContext extends WorkerContext {
  phase1Output?: Phase1Output;
  agentOutputs?: AgentOutputs;
}

/**
 * LLM output schema for TypeClassifier
 * Includes synthesis fields merged from TypeSynthesis
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
  // Synthesis fields (merged from TypeSynthesis)
  adjustmentReasons: z.array(z.string().max(3000)).max(5).optional(),
  confidenceBoost: z.number().min(0).max(1).optional(),
  synthesisEvidence: z.string().max(1000).optional(),
});

/**
 * TypeClassifierWorker - Classifies developers into the AI Collaboration Matrix
 *
 * Phase 2.5 worker that provides the viral/shareable personality type.
 * Runs AFTER all Phase 2 workers to use their insights for informed classification.
 * Runs for all tiers (FREE content - type classification is fun/marketing).
 */
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const; // Registered as Phase 2.5 via registerPhase2Point5Worker
  readonly minTier: Tier = 'free'; // Available to all users

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  /**
   * Check if worker can run
   */
  canRun(context: WorkerContext): boolean {
    const tcContext = context as TypeClassifierContext;

    // Must have Phase 1 output (passed via agentOutputs context)
    if (!tcContext.phase1Output) {
      this.log('Cannot run: Phase 1 output not available');
      return false;
    }

    // Must have utterances to analyze
    if (tcContext.phase1Output.developerUtterances.length === 0) {
      this.log('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Execute type classification with Phase 2 synthesis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TypeClassifierOutput>> {
    const tcContext = context as TypeClassifierContext;

    if (!tcContext.phase1Output) {
      throw new Error('Phase 1 output required for TypeClassifierWorker');
    }

    this.log('Classifying developer into AI Collaboration Matrix (Phase 2.5)...');

    // Prepare Phase 1 output
    const phase1ForPrompt = this.preparePhase1ForPrompt(tcContext.phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);

    // Prepare summaries from ALL Phase 2 workers
    const agentOutputs = tcContext.agentOutputs ?? {};
    const strengthGrowthSummary = agentOutputs.strengthGrowth
      ? this.summarizeStrengthGrowth(agentOutputs.strengthGrowth)
      : undefined;

    // Build combined Phase 2 summary for the prompt
    const phase2Summary = this.buildPhase2Summary(agentOutputs);

    const userPrompt = buildTypeClassifierUserPrompt(
      phase1Json,
      strengthGrowthSummary,
      phase2Summary || undefined
    );

    // Call Gemini
    const result = await this.client!.generateStructured({
      systemPrompt: TYPE_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TypeClassifierLLMSchema,
      maxOutputTokens: 8192,
    });

    // Validate distribution sums to 100
    const dist = result.data.distribution;
    const sum = dist.architect + dist.scientist + dist.collaborator + dist.speedrunner + dist.craftsman;
    if (Math.abs(sum - 100) > 1) {
      this.log(`Warning: Distribution sums to ${sum}, normalizing...`);
      const factor = 100 / sum;
      const keys: (keyof typeof dist)[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];
      for (const key of keys) {
        dist[key] = Math.round(dist[key] * factor);
      }
      // Compensate rounding error on the largest value to ensure exact sum of 100
      const newSum = keys.reduce((s, k) => s + dist[k], 0);
      if (newSum !== 100) {
        const maxKey = keys.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
        dist[maxKey] += 100 - newSum;
      }
    }

    this.log(`Type: ${result.data.primaryType}`);
    this.log(`Control: ${result.data.controlLevel} (${result.data.controlScore})`);
    this.log(`Matrix: ${result.data.matrixName} ${result.data.matrixEmoji}`);
    if (result.data.confidenceBoost) {
      this.log(`Confidence boost: +${(result.data.confidenceBoost * 100).toFixed(0)}%`);
    }

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
   * Build a comprehensive Phase 2 summary from all available worker outputs
   *
   * This replaces the old TypeSynthesis approach of reading from legacy agents.
   * Now uses the new v2 workers: TrustVerification, WorkflowHabit,
   * KnowledgeGap, ContextEfficiency.
   */
  private buildPhase2Summary(agentOutputs: AgentOutputs): string | null {
    const sections: string[] = [];

    // TrustVerification: anti-patterns + verification behavior
    if (agentOutputs.trustVerification) {
      const tv = agentOutputs.trustVerification;
      sections.push(`### Trust & Verification
- Anti-patterns detected: ${tv.antiPatterns?.length ?? 0}
- Verification level: ${tv.verificationBehavior?.level ?? 'unknown'}
- Trust health score: ${tv.overallTrustHealthScore}/100
- Confidence: ${tv.confidenceScore}`);
    }

    // WorkflowHabit: planning + critical thinking + multitasking
    if (agentOutputs.workflowHabit) {
      const wh = agentOutputs.workflowHabit;
      const planningTypes = wh.planningHabits?.map(ph => ph.type).join(', ') || 'none';
      sections.push(`### Workflow Habits
- Planning habits: ${planningTypes}
- Critical thinking moments: ${wh.criticalThinkingMoments?.length ?? 0}
- Workflow score: ${wh.overallWorkflowScore}/100
- Confidence: ${wh.confidenceScore}`);
    }

    // KnowledgeGap
    if (agentOutputs.knowledgeGap) {
      const kg = agentOutputs.knowledgeGap;
      sections.push(`### Knowledge Gap
- Knowledge score: ${kg.overallKnowledgeScore}/100
- Confidence: ${kg.confidenceScore}`);
    }

    // ContextEfficiency
    if (agentOutputs.contextEfficiency) {
      const ce = agentOutputs.contextEfficiency;
      sections.push(`### Context Efficiency
- Efficiency score: ${ce.overallEfficiencyScore}/100
- Avg context fill: ${ce.avgContextFillPercent}%
- Confidence: ${ce.confidenceScore}`);
    }

    if (sections.length === 0) return null;

    return `## PHASE 2 ANALYSIS SUMMARY\n${sections.join('\n\n')}`;
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
}

/**
 * Factory function for creating TypeClassifierWorker
 */
export function createTypeClassifierWorker(
  config: OrchestratorConfig
): TypeClassifierWorker {
  return new TypeClassifierWorker(config);
}
