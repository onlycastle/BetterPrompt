/**
 * Strength & Growth Synthesizer (Phase 2.5 - v2 Architecture)
 *
 * Phase 2.5 worker that synthesizes ALL Phase 2 worker outputs to produce
 * unified, cross-domain strengths and growth areas. Unlike a Phase 2 worker
 * that analyzes raw Phase 1 output, this Synthesizer:
 * - Receives structured outputs from TrustVerification, WorkflowHabit,
 *   KnowledgeGap, and ContextEfficiency workers
 * - Detects cross-domain patterns (e.g., blind_retry + no_planning → reactive)
 * - Uses Phase 1 utterances only for evidence quote selection
 *
 * Output schema is IDENTICAL to the original StrengthGrowthOutput for
 * backward compatibility with ContentWriter and downstream consumers.
 *
 * @module analyzer/workers/strength-growth-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthOutput,
  parseStrengthGrowthLLMOutput,
} from '../../models/strength-growth-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { AgentOutputs } from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  STRENGTH_GROWTH_SYNTHESIZER_SYSTEM_PROMPT,
  buildStrengthGrowthSynthesizerUserPrompt,
} from './prompts/phase2-worker-prompts';

/**
 * Extended WorkerContext for StrengthGrowthSynthesizer (Phase 2.5)
 *
 * Synthesizer needs:
 * - agentOutputs: All Phase 2 worker results for cross-domain analysis
 * - phase1Output: Developer utterances for evidence quote selection
 */
interface StrengthGrowthSynthesizerContext extends WorkerContext {
  agentOutputs?: AgentOutputs;
  phase1Output?: Phase1Output;
}

/**
 * StrengthGrowthWorker - Synthesizes cross-domain strengths and growth areas
 *
 * Phase 2.5 worker that runs AFTER all Phase 2 workers to synthesize their
 * outputs into unified strengths/growth assessment. Runs for all tiers
 * (FREE content - strengths and growth identification).
 */
export class StrengthGrowthWorker extends BaseWorker<StrengthGrowthOutput> {
  readonly name = 'StrengthGrowth';
  readonly phase = 2 as const; // Registered as Phase 2.5 via registerPhase2Point5Worker
  readonly minTier: Tier = 'free'; // Available to all users

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  /**
   * Check if worker can run
   *
   * Requires both Phase 2 agent outputs (for synthesis) AND Phase 1 output
   * (for evidence quotes).
   */
  canRun(context: WorkerContext): boolean {
    const synthContext = context as StrengthGrowthSynthesizerContext;

    // Must have Phase 2 agent outputs to synthesize from
    if (!synthContext.agentOutputs) {
      this.log('Cannot run: Phase 2 agent outputs not available');
      return false;
    }

    // Must have at least one Phase 2 worker output to synthesize
    const hasAnyOutput = !!(
      synthContext.agentOutputs.trustVerification ||
      synthContext.agentOutputs.workflowHabit ||
      synthContext.agentOutputs.knowledgeGap ||
      synthContext.agentOutputs.contextEfficiency
    );
    if (!hasAnyOutput) {
      this.log('Cannot run: No Phase 2 worker outputs available');
      return false;
    }

    // Must have Phase 1 output for evidence quotes
    if (!synthContext.phase1Output) {
      this.log('Cannot run: Phase 1 output not available');
      return false;
    }

    return true;
  }

  /**
   * Execute cross-domain strength/growth synthesis
   *
   * NO FALLBACK: Errors propagate to fail the analysis.
   */
  async execute(context: WorkerContext): Promise<WorkerResult<StrengthGrowthOutput>> {
    const synthContext = context as StrengthGrowthSynthesizerContext;

    if (!synthContext.agentOutputs || !synthContext.phase1Output) {
      throw new Error('Phase 2 agent outputs and Phase 1 output required for StrengthGrowthSynthesizer');
    }

    this.log('Synthesizing cross-domain strengths and growth areas (Phase 2.5)...');

    // Build structured summaries from Phase 2 worker outputs
    const workerSummaries = buildWorkerSummaries(synthContext.agentOutputs);
    this.log(`Worker summaries: ${workerSummaries.length} chars`);

    // Prepare Phase 1 reference data (truncated for token efficiency)
    const phase1Reference = preparePhase1Reference(synthContext.phase1Output);
    const phase1Json = JSON.stringify(phase1Reference, null, 2);
    this.log(`Phase 1 reference: ${synthContext.phase1Output.developerUtterances.length} utterances`);

    const userPrompt = buildStrengthGrowthSynthesizerUserPrompt(workerSummaries, phase1Json);

    // Call Gemini with the flattened schema
    const result = await this.client!.generateStructured({
      systemPrompt: STRENGTH_GROWTH_SYNTHESIZER_SYSTEM_PROMPT,
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
}

/**
 * Factory function for creating StrengthGrowthWorker
 */
export function createStrengthGrowthWorker(
  config: OrchestratorConfig
): StrengthGrowthWorker {
  return new StrengthGrowthWorker(config);
}

// ============================================================================
// Synthesizer Helper Functions
// ============================================================================

/**
 * Build structured markdown summaries from Phase 2 worker outputs.
 *
 * Serializes TrustVerification, WorkflowHabit, KnowledgeGap, and
 * ContextEfficiency outputs into a readable format for the Synthesizer LLM.
 */
export function buildWorkerSummaries(agentOutputs: AgentOutputs): string {
  const sections: string[] = [];

  // TrustVerification summary
  if (agentOutputs.trustVerification) {
    const tv = agentOutputs.trustVerification;
    const antiPatternDetails = tv.antiPatterns?.map(ap => {
      const severity = ap.severity ?? 'unknown';
      const sessionPct = ap.sessionPercentage != null ? `${ap.sessionPercentage}%` : 'unknown';
      return `  - ${ap.type}: severity=${severity}, sessions=${sessionPct}, improvement="${ap.improvement ?? 'none'}"`;
    }).join('\n') || '  (none detected)';

    sections.push(`### TrustVerification
- Trust health score: ${tv.overallTrustHealthScore}/100
- Verification level: ${tv.verificationBehavior?.level ?? 'unknown'}
- Anti-patterns detected: ${tv.antiPatterns?.length ?? 0}
${antiPatternDetails}
- Confidence: ${tv.confidenceScore}
- Summary: ${tv.summary ?? '(none)'}`);
  }

  // WorkflowHabit summary
  if (agentOutputs.workflowHabit) {
    const wh = agentOutputs.workflowHabit;
    const planningDetails = wh.planningHabits?.map(ph =>
      `  - ${ph.type}: frequency=${ph.frequency}, effectiveness=${ph.effectiveness ?? 'unknown'}`
    ).join('\n') || '  (none detected)';
    const ctDetails = wh.criticalThinkingMoments?.map(ct =>
      `  - ${ct.type}: "${ct.quote?.slice(0, 100) ?? ''}"`
    ).join('\n') || '  (none detected)';

    sections.push(`### WorkflowHabit
- Workflow score: ${wh.overallWorkflowScore}/100
- Planning habits:
${planningDetails}
- Critical thinking moments: ${wh.criticalThinkingMoments?.length ?? 0}
${ctDetails}
- Confidence: ${wh.confidenceScore}
- Summary: ${wh.summary ?? '(none)'}`);
  }

  // KnowledgeGap summary
  if (agentOutputs.knowledgeGap) {
    const kg = agentOutputs.knowledgeGap;
    const gapTopics = kg.knowledgeGapsData
      ? kg.knowledgeGapsData.split(';').filter(Boolean).map(entry => {
          const parts = entry.split(':');
          return `  - ${parts[0]}: count=${parts[1] ?? '?'}, depth=${parts[2] ?? '?'}`;
        }).join('\n')
      : '  (none detected)';
    const learningTopics = kg.learningProgressData
      ? kg.learningProgressData.split(';').filter(Boolean).map(entry => {
          const parts = entry.split(':');
          return `  - ${parts[0]}: ${parts[1] ?? '?'} → ${parts[2] ?? '?'}`;
        }).join('\n')
      : '  (no progress tracked)';

    // Include strengths/growth areas if available
    const kgStrengths = kg.strengthsData ? `\n- Worker-reported strengths: ${kg.strengthsData}` : '';
    const kgGrowth = kg.growthAreasData ? `\n- Worker-reported growth areas: ${kg.growthAreasData}` : '';

    sections.push(`### KnowledgeGap
- Knowledge score: ${kg.overallKnowledgeScore}/100
- Knowledge gaps:
${gapTopics}
- Learning progress:
${learningTopics}${kgStrengths}${kgGrowth}
- Confidence: ${kg.confidenceScore}`);
  }

  // ContextEfficiency summary
  if (agentOutputs.contextEfficiency) {
    const ce = agentOutputs.contextEfficiency;
    const inefficiencyPatterns = ce.inefficiencyPatternsData
      ? ce.inefficiencyPatternsData.split(';').filter(Boolean).map(entry => {
          const parts = entry.split(':');
          return `  - ${parts[0]}: frequency=${parts[1] ?? '?'}, impact=${parts[2] ?? '?'}`;
        }).join('\n')
      : '  (none detected)';

    // Include strengths/growth areas if available
    const ceStrengths = ce.strengthsData ? `\n- Worker-reported strengths: ${ce.strengthsData}` : '';
    const ceGrowth = ce.growthAreasData ? `\n- Worker-reported growth areas: ${ce.growthAreasData}` : '';

    sections.push(`### ContextEfficiency
- Efficiency score: ${ce.overallEfficiencyScore}/100
- Average context fill: ${ce.avgContextFillPercent}%
- Inefficiency patterns:
${inefficiencyPatterns}${ceStrengths}${ceGrowth}
- Productivity score: ${ce.overallProductivityScore ?? 'N/A'}
- Confidence: ${ce.confidenceScore}`);
  }

  if (sections.length === 0) {
    return '(No Phase 2 worker outputs available)';
  }

  return sections.join('\n\n');
}

/**
 * Prepare Phase 1 output as reference data for evidence quote selection.
 *
 * Truncates utterance text to 500 chars for token efficiency while
 * preserving utterance IDs and structural metadata.
 */
export function preparePhase1Reference(phase1: Phase1Output): Record<string, unknown> {
  return {
    developerUtterances: phase1.developerUtterances.map((u) => ({
      id: u.id,
      text: u.text.slice(0, 500),
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
    sessionMetrics: phase1.sessionMetrics,
  };
}
