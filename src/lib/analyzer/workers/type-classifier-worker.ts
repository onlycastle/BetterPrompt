/**
 * Type Classifier Worker (Phase 2.5)
 *
 * Phase 2.5 worker that classifies developers into the AI Collaboration Matrix
 * using ALL Phase 2 worker outputs for informed classification:
 * - 5 Coding Styles: architect, analyst, conductor, speedrunner, trendsetter
 * - 3 Control Levels: explorer, navigator, cartographer
 * - 15 Matrix Combinations (e.g., "Systems Architect", "Maestro")
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
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  TYPE_CLASSIFIER_SYSTEM_PROMPT,
  buildTypeClassifierUserPrompt,
} from './prompts/type-classifier-prompts';
import { extractEvidenceUtteranceIds } from '../shared/evidence-utils';
import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from '../../models/coding-style';

/** Extended WorkerContext for TypeClassifier (Phase 2.5) */
interface TypeClassifierContext extends WorkerContext {
  agentOutputs?: AgentOutputs;
  phase1Output?: Phase1Output;
}

/** Distribution type keys */
type DistributionKey = 'architect' | 'analyst' | 'conductor' | 'speedrunner' | 'trendsetter';

const DISTRIBUTION_KEYS: DistributionKey[] = ['architect', 'analyst', 'conductor', 'speedrunner', 'trendsetter'];

/** LLM output schema for TypeClassifier */
const TypeClassifierLLMSchema = z.object({
  primaryType: CodingStyleTypeSchema,
  distribution: z.object({
    architect: z.number().min(0).max(100),
    analyst: z.number().min(0).max(100),
    conductor: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    trendsetter: z.number().min(0).max(100),
  }),
  controlLevel: AIControlLevelSchema,
  controlScore: z.number().min(0).max(100),
  matrixName: z.string().max(50),
  matrixEmoji: z.string().max(10),
  collaborationMaturity: z.object({
    level: z.enum(['vibe_coder', 'supervised_coder', 'ai_assisted_engineer', 'reluctant_user']),
    description: z.string().max(300),
    indicators: z.array(z.string().max(200)),
  }).optional(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().max(2500),
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
    const { agentOutputs = {}, phase1Output } = context as TypeClassifierContext;

    this.log('Classifying developer into AI Collaboration Matrix (Phase 2.5)...');

    // Extract evidence-based utterances for personalized reasoning narrative
    const topUtterances = this.extractTopUtterances(agentOutputs, phase1Output);

    const phase2Summary = this.buildPhase2Summary(agentOutputs, phase1Output);
    const userPrompt = buildTypeClassifierUserPrompt(phase2Summary || undefined, topUtterances);

    const result = await this.client!.generateStructured({
      systemPrompt: TYPE_CLASSIFIER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TypeClassifierLLMSchema,
      maxOutputTokens: 65536,
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
   * Extract top utterances from Phase 1 based on Phase 2 evidence IDs.
   * Returns undefined if phase1Output is not available (graceful degradation).
   */
  private extractTopUtterances(
    agentOutputs: AgentOutputs,
    phase1Output?: Phase1Output
  ): { id: string; text: string; wordCount: number }[] | undefined {
    if (!phase1Output) return undefined;

    const evidenceIds = extractEvidenceUtteranceIds(agentOutputs);
    if (evidenceIds.size === 0) {
      this.log('No Phase 2 evidence utteranceIds found for reasoning narrative');
      return undefined;
    }

    const topUtterances = phase1Output.developerUtterances
      .filter(u => evidenceIds.has(u.id))
      .map(u => ({
        id: u.id,
        text: (u.displayText || u.text).slice(0, 1500),
        wordCount: u.wordCount,
      }));

    this.log(`Using ${topUtterances.length} evidence-based utterances for reasoning (from ${evidenceIds.size} Phase 2 evidence IDs)`);
    return topUtterances.length > 0 ? topUtterances : undefined;
  }

  /**
   * Build a comprehensive Phase 2 summary from unified worker outputs
   *
   * Uses v3 unified workers (capability-based):
   * - ThinkingQuality: Planning + Critical Thinking
   * - CommunicationPatterns: Communication Patterns + Signature Quotes
   * - LearningBehavior: Knowledge Gaps + Repeated Mistakes
   * - Efficiency (ContextEfficiency)
   *
   * Also enriches with Phase 1 data:
   * - Tool Usage (for Conductor detection)
   * - Trend Keyword Frequency (for Trendsetter detection)
   */
  private buildPhase2Summary(agentOutputs: AgentOutputs, phase1Output?: Phase1Output): string | null {
    const sections: string[] = [];

    // Order: Efficiency → Communication → Learning → ThinkingQuality → Tool Usage → Trend Sensitivity
    // Rationale: Place planQualityScore in middle, add new quantitative sections at end.

    // Efficiency: Context usage and token management
    if (agentOutputs.efficiency) {
      const ef = agentOutputs.efficiency;
      sections.push(`### Efficiency
- Efficiency score: ${ef.overallEfficiencyScore}/100
- Avg context fill: ${ef.avgContextFillPercent}%
- Confidence: ${ef.confidenceScore}`);
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

    // ThinkingQuality: Planning + Critical Thinking (v3.1 - Communication is separate worker)
    // Placed in middle to reduce anchoring on planQualityScore
    if (agentOutputs.thinkingQuality) {
      const tq = agentOutputs.thinkingQuality;
      const antiPatternTypes = tq.verificationAntiPatterns?.map(ap => ap.type).join(', ') || 'none';
      sections.push(`### Thinking Quality
- Overall thinking quality: ${tq.overallThinkingQualityScore}/100
- Verification level: ${tq.verificationBehavior?.level ?? 'unknown'}
- Verification anti-patterns: ${tq.verificationAntiPatterns?.length ?? 0} (types: ${antiPatternTypes})
- Plan quality score: ${tq.planQualityScore}/100
- Confidence: ${tq.confidenceScore}`);
    }

    // Tool Usage Section (from Phase 1) — for Conductor detection
    if (phase1Output?.sessionMetrics?.toolUsageCounts) {
      const tools = phase1Output.sessionMetrics.toolUsageCounts;
      const uniqueTools = Object.keys(tools).length;
      const totalCalls = Object.values(tools).reduce((sum, count) => sum + count, 0);
      const enterPlanMode = tools['EnterPlanMode'] || tools['enterplanmode'] || 0;
      const todoWrite = tools['TodoWrite'] || tools['todowrite'] || 0;
      const taskTool = tools['Task'] || tools['task'] || 0;
      sections.push(`### Tool Usage (from Phase 1)
- Unique tools: ${uniqueTools} types (${Object.keys(tools).slice(0, 8).join(', ')}${uniqueTools > 8 ? '...' : ''})
- EnterPlanMode: ${enterPlanMode}, TodoWrite: ${todoWrite}, Task: ${taskTool}
- Total tool calls: ${totalCalls}`);
    }

    // Trend Sensitivity Section (from Phase 1 utterances) — for Trendsetter detection
    if (phase1Output?.developerUtterances) {
      const TREND_KEYWORDS_KO = ['최신', '트렌드', '유행', '새로운', '업데이트된', '요즘'];
      const TREND_KEYWORDS_EN = ['latest', 'newest', 'trending', 'modern', 'up-to-date', 'best practice', 'current version', 'recently released'];
      const allKeywords = [...TREND_KEYWORDS_KO, ...TREND_KEYWORDS_EN];

      const keywordCounts: Record<string, number> = {};
      let totalMatches = 0;

      for (const utterance of phase1Output.developerUtterances) {
        const text = (utterance.displayText || utterance.text).toLowerCase();
        for (const keyword of allKeywords) {
          const regex = new RegExp(keyword.toLowerCase(), 'g');
          const matches = text.match(regex);
          if (matches) {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + matches.length;
            totalMatches += matches.length;
          }
        }
      }

      const totalUtterances = phase1Output.developerUtterances.length;
      const density = totalUtterances > 0 ? ((totalMatches / totalUtterances) * 100).toFixed(1) : '0.0';

      const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kw, count]) => `"${kw}" (${count})`)
        .join(', ');

      sections.push(`### Trend Sensitivity (from Phase 1 utterances)
- Trend keyword count: ${totalMatches} (across ${totalUtterances} utterances)
- Trend keyword density: ${density}%
- Example keywords found: ${topKeywords || 'none'}`);
    }

    if (sections.length === 0) return null;

    return `## PHASE 2 ANALYSIS SUMMARY\n${sections.join('\n\n')}`;
  }

  /**
   * Normalize distribution percentages to sum exactly to 100
   * Default is 20% each (5 types)
   */
  private normalizeDistribution(
    dist: Record<DistributionKey, number>,
    sum: number
  ): void {
    if (sum === 0) {
      DISTRIBUTION_KEYS.forEach(key => { dist[key] = 20; });
      return;
    }

    // Scale all values proportionally
    const factor = 100 / sum;
    DISTRIBUTION_KEYS.forEach(key => {
      dist[key] = Math.round(dist[key] * factor);
    });

    // Adjust largest value to ensure exact sum of 100
    const newSum = DISTRIBUTION_KEYS.reduce((s, k) => s + dist[k], 0);
    const maxKey = DISTRIBUTION_KEYS.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
    dist[maxKey] += 100 - newSum;
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
