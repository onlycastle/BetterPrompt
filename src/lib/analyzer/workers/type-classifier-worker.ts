/**
 * Type Classifier Worker (Phase 2.5)
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
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TYPE_CLASSIFIER_SYSTEM_PROMPT,
  buildTypeClassifierUserPrompt,
} from './prompts/type-classifier-prompts';
import { z } from 'zod';

/** Extended WorkerContext for TypeClassifier (Phase 2.5) */
interface TypeClassifierContext extends WorkerContext {
  agentOutputs?: AgentOutputs;
}

/** Distribution type keys */
type DistributionKey = 'architect' | 'scientist' | 'collaborator' | 'speedrunner' | 'craftsman';

const DISTRIBUTION_KEYS: DistributionKey[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

/** LLM output schema for TypeClassifier */
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
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    const { agentOutputs } = context as TypeClassifierContext;

    if (!agentOutputs) {
      this.log('Cannot run: Phase 2 agent outputs not available');
      return false;
    }

    const hasAnyOutput = Object.values(agentOutputs).some((v) => v != null);
    if (!hasAnyOutput) {
      this.log('Cannot run: No Phase 2 worker outputs available');
      return false;
    }

    return true;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<TypeClassifierOutput>> {
    const { agentOutputs = {} } = context as TypeClassifierContext;

    this.log('Classifying developer into AI Collaboration Matrix (Phase 2.5)...');

    const phase2Summary = this.buildPhase2Summary(agentOutputs);
    const userPrompt = buildTypeClassifierUserPrompt(phase2Summary || undefined);

    const result = await this.client!.generateStructured({
      systemPrompt: TYPE_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TypeClassifierLLMSchema,
      maxOutputTokens: 8192,
    });

    const dist = result.data.distribution;
    const sum = DISTRIBUTION_KEYS.reduce((acc, key) => acc + dist[key], 0);

    if (Math.abs(sum - 100) > 1) {
      this.log(`Warning: Distribution sums to ${sum}, normalizing...`);
      this.normalizeDistribution(dist, sum);
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
   * Build a comprehensive Phase 2 summary from unified worker outputs
   *
   * Uses v3 unified workers (capability-based):
   * - ThinkingQuality: Planning + Critical Thinking + Communication
   * - CommunicationPatterns: Communication Patterns + Signature Quotes
   * - LearningBehavior: Knowledge Gaps + Repeated Mistakes
   * - Efficiency (ContextEfficiency)
   */
  private buildPhase2Summary(agentOutputs: AgentOutputs): string | null {
    const sections: string[] = [];

    // ThinkingQuality: Planning + Critical Thinking (v3.1 - Communication is separate worker)
    if (agentOutputs.thinkingQuality) {
      const tq = agentOutputs.thinkingQuality;
      const antiPatternTypes = tq.verificationAntiPatterns?.map(ap => ap.type).join(', ') || 'none';
      sections.push(`### Thinking Quality
- Plan quality score: ${tq.planQualityScore}/100
- Verification level: ${tq.verificationBehavior?.level ?? 'unknown'}
- Verification anti-patterns: ${tq.verificationAntiPatterns?.length ?? 0} (types: ${antiPatternTypes})
- Overall thinking quality: ${tq.overallThinkingQualityScore}/100
- Confidence: ${tq.confidenceScore}`);
    }

    // CommunicationPatterns: Communication Patterns + Signature Quotes (v3.1 - separate worker)
    if (agentOutputs.communicationPatterns) {
      const cp = agentOutputs.communicationPatterns;
      const commPatternTypes = cp.communicationPatterns?.map(p => p.patternName).join(', ') || 'none';
      sections.push(`### Communication Patterns
- Communication patterns: ${cp.communicationPatterns?.length ?? 0} (types: ${commPatternTypes})
- Signature quotes: ${cp.signatureQuotes?.length ?? 0}
- Overall communication score: ${cp.overallCommunicationScore}/100
- Confidence: ${cp.confidenceScore}`);
    }

    // LearningBehavior: Knowledge Gaps + Repeated Mistakes
    if (agentOutputs.learningBehavior) {
      const lb = agentOutputs.learningBehavior;
      const gapTopics = lb.knowledgeGaps?.map(g => g.topic).join(', ') || 'none';
      const learningTopics = lb.learningProgress?.map(p => p.topic).join(', ') || 'none';
      const mistakeCategories = lb.repeatedMistakePatterns?.map(m => m.category).join(', ') || 'none';
      sections.push(`### Learning Behavior
- Overall learning score: ${lb.overallLearningScore}/100
- Knowledge gaps: ${lb.knowledgeGaps?.length ?? 0} (topics: ${gapTopics})
- Learning progress: ${lb.learningProgress?.length ?? 0} (topics: ${learningTopics})
- Repeated mistake patterns: ${lb.repeatedMistakePatterns?.length ?? 0} (categories: ${mistakeCategories})
- Top insights: ${lb.topInsights?.join('; ') || 'none'}
- Confidence: ${lb.confidenceScore}`);
    }

    // Efficiency: Context usage and token management
    if (agentOutputs.efficiency) {
      const ef = agentOutputs.efficiency;
      sections.push(`### Efficiency
- Efficiency score: ${ef.overallEfficiencyScore}/100
- Avg context fill: ${ef.avgContextFillPercent}%
- Confidence: ${ef.confidenceScore}`);
    }

    if (sections.length === 0) return null;

    return `## PHASE 2 ANALYSIS SUMMARY\n${sections.join('\n\n')}`;
  }

  /**
   * Normalize distribution percentages to sum exactly to 100
   */
  private normalizeDistribution(
    dist: Record<DistributionKey, number>,
    sum: number
  ): void {
    if (sum === 0) {
      DISTRIBUTION_KEYS.forEach(key => { dist[key] = 20; });
      return;
    }

    const factor = 100 / sum;
    DISTRIBUTION_KEYS.forEach(key => {
      dist[key] = Math.round(dist[key] * factor);
    });

    const newSum = DISTRIBUTION_KEYS.reduce((s, k) => s + dist[k], 0);
    if (newSum !== 100) {
      const maxKey = DISTRIBUTION_KEYS.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
      dist[maxKey] += 100 - newSum;
    }
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
