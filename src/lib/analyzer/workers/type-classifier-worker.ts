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
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TYPE_CLASSIFIER_SYSTEM_PROMPT,
  buildTypeClassifierUserPrompt,
} from './prompts/type-classifier-prompts';
import { z } from 'zod';

/**
 * Extended WorkerContext for TypeClassifier (Phase 2.5)
 *
 * TypeClassifier runs AFTER all Phase 2 workers to incorporate their insights.
 * It receives agentOutputs containing all Phase 2 results — no raw Phase1Output needed.
 */
interface TypeClassifierContext extends WorkerContext {
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
 */
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const; // Registered as Phase 2.5 via registerPhase2Point5Worker

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    const tcContext = context as TypeClassifierContext;

    // Must have Phase 2 agent outputs to classify from
    if (!tcContext.agentOutputs) {
      this.log('Cannot run: Phase 2 agent outputs not available');
      return false;
    }

    // Must have at least one Phase 2 worker output
    const hasAnyOutput = Object.values(tcContext.agentOutputs).some(v => v != null);
    if (!hasAnyOutput) {
      this.log('Cannot run: No Phase 2 worker outputs available');
      return false;
    }

    return true;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<TypeClassifierOutput>> {
    const tcContext = context as TypeClassifierContext;

    const agentOutputs = tcContext.agentOutputs ?? {};

    this.log('Classifying developer into AI Collaboration Matrix (Phase 2.5)...');

    // Prepare summaries from ALL Phase 2 workers
    const strengthGrowthSummary = agentOutputs.strengthGrowth
      ? this.summarizeStrengthGrowth(agentOutputs.strengthGrowth)
      : undefined;

    // Build combined Phase 2 summary for the prompt
    const phase2Summary = this.buildPhase2Summary(agentOutputs);

    const userPrompt = buildTypeClassifierUserPrompt(
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
    const keys: (keyof typeof dist)[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

    if (Math.abs(sum - 100) > 1) {
      this.log(`Warning: Distribution sums to ${sum}, normalizing...`);
      this.normalizeDistribution(dist, keys, sum);
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
      const antiPatternTypes = tv.antiPatterns?.map(ap => ap.type).join(', ') || 'none';
      sections.push(`### Trust & Verification
- Anti-patterns detected: ${tv.antiPatterns?.length ?? 0} (types: ${antiPatternTypes})
- Verification level: ${tv.verificationBehavior?.level ?? 'unknown'}
- Trust health score: ${tv.overallTrustHealthScore}/100
- Confidence: ${tv.confidenceScore}`);
    }

    // WorkflowHabit: planning + critical thinking + multitasking
    if (agentOutputs.workflowHabit) {
      const wh = agentOutputs.workflowHabit;
      const planningDetails = wh.planningHabits?.map(ph => `${ph.type}(${ph.frequency}, effectiveness=${ph.effectiveness ?? 'unknown'})`).join(', ') || 'none';
      const ctTypes = wh.criticalThinkingMoments?.map(ct => ct.type).join(', ') || 'none';
      sections.push(`### Workflow Habits
- Planning habits: ${planningDetails}
- Critical thinking moments: ${wh.criticalThinkingMoments?.length ?? 0} (types: ${ctTypes})
- Workflow score: ${wh.overallWorkflowScore}/100
- Confidence: ${wh.confidenceScore}`);
    }

    // KnowledgeGap
    if (agentOutputs.knowledgeGap) {
      const kg = agentOutputs.knowledgeGap;
      // Extract topic names from the flattened knowledgeGapsData ("topic:question_count:depth:example;...")
      const gapTopics = kg.knowledgeGapsData
        ? kg.knowledgeGapsData.split(';').filter(Boolean).map(entry => entry.split(':')[0]).join(', ')
        : 'none';
      // Extract learning topics from learningProgressData ("topic:start_level:current_level:evidence;...")
      const learningTopics = kg.learningProgressData
        ? kg.learningProgressData.split(';').filter(Boolean).map(entry => entry.split(':')[0]).join(', ')
        : 'none';
      sections.push(`### Knowledge Gap
- Knowledge score: ${kg.overallKnowledgeScore}/100
- Gap topics: ${gapTopics}
- Learning progress topics: ${learningTopics}
- Top insights: ${kg.topInsights?.join('; ') || 'none'}
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
   * Normalize distribution percentages to sum exactly to 100
   */
  private normalizeDistribution(
    dist: Record<string, number>,
    keys: string[],
    sum: number
  ): void {
    if (sum === 0) {
      for (const key of keys) {
        dist[key] = 20;
      }
      return;
    }

    const factor = 100 / sum;
    for (const key of keys) {
      dist[key] = Math.round(dist[key] * factor);
    }

    const newSum = keys.reduce((s, k) => s + dist[k], 0);
    if (newSum !== 100) {
      const maxKey = keys.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
      dist[maxKey] += 100 - newSum;
    }
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
