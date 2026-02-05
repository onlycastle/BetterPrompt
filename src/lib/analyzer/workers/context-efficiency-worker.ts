/**
 * Context Efficiency Worker (Phase 2 - v2 Architecture)
 *
 * Phase 2 worker that analyzes context and token efficiency:
 * - Context usage patterns (fill percentage)
 * - Inefficiency patterns (late compaction, bloat)
 * - Prompt length trends
 * - Redundant information repetition
 * - Productivity metrics (iteration cycles, collaboration efficiency)
 *
 * Refactored to use Phase1Output (v2 context isolation).
 * Also consolidates productivity analysis from the deprecated ProductivityAnalystWorker.
 *
 * @module analyzer/workers/context-efficiency-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  ContextEfficiencyLLMOutputSchema,
  parseContextEfficiencyLLMOutput,
  type ContextEfficiencyOutput,
} from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  buildContextEfficiencySystemPrompt,
  buildContextEfficiencyUserPrompt,
} from './prompts/context-efficiency-prompts';
import {
  getInsightsForWorker,
  resolveKnowledgeBaseReferences,
  type WorkerInsightContext,
  type ReferencedInsight,
} from './prompts/knowledge-mapping';

/**
 * Context Efficiency Worker - Analyzes token and context efficiency + productivity
 *
 * Phase 2 worker that identifies context management patterns and productivity metrics.
 * Uses Phase1Output (v2 context isolation).
 */
export class ContextEfficiencyWorker extends BaseWorker<ContextEfficiencyOutput> {
  readonly name = 'ContextEfficiency';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<ContextEfficiencyOutput>> {
    const { phase1Output } = this.getPhase2Context(context);

    if (!phase1Output) {
      throw new Error('Phase 1 output required for ContextEfficiencyWorker');
    }

    this.log('Analyzing context efficiency and productivity...');
    this.log(`Utterances: ${phase1Output.developerUtterances.length}`);

    // Log Phase 1 calculated context fill metrics (deterministic values)
    const { avgContextFillPercent, maxContextFillPercent, contextFillExceeded90Count } = phase1Output.sessionMetrics;
    if (avgContextFillPercent !== undefined) {
      this.log(`Phase 1 context fill: avg=${avgContextFillPercent}%, max=${maxContextFillPercent}%, exceeded90=${contextFillExceeded90Count}`);
    } else {
      this.log('Phase 1 context fill: no token data available');
    }

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const phase1Json = JSON.stringify(phase1ForPrompt, null, 2);
    const userPrompt = buildContextEfficiencyUserPrompt(phase1Json);

    const insightContext = getInsightsForWorker(this.name);
    const systemPrompt = buildContextEfficiencySystemPrompt(insightContext.insights);
    this.log(`Injected ${insightContext.insights.length} professional insights`);

    const result = await this.client!.generateStructured({
      systemPrompt,
      userPrompt,
      responseSchema: ContextEfficiencyLLMOutputSchema,
      maxOutputTokens: 65536,
    });

    const parsedOutput = parseContextEfficiencyLLMOutput(result.data);
    const processedOutput = this.resolveAllReferences(parsedOutput, insightContext);

    this.log(`Efficiency score: ${processedOutput.overallEfficiencyScore}`);
    this.log(`Avg context fill: ${processedOutput.avgContextFillPercent}%`);
    if (processedOutput.referencedInsights?.length) {
      this.log(`Referenced ${processedOutput.referencedInsights.length} professional insights`);
    }

    return this.createSuccessResult(processedOutput, result.usage);
  }

  /**
   * Resolve all [pi-XXX] references in output text fields.
   *
   * Replaces [pi-XXX] patterns with human-readable titles (e.g., "Context Engineering")
   * and collects all referenced insights with their URLs.
   */
  private resolveAllReferences(
    output: ContextEfficiencyOutput,
    ctx: WorkerInsightContext
  ): ContextEfficiencyOutput {
    const allRefs: ReferencedInsight[] = [];

    const processText = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const { resolvedText, referencedInsights } = resolveKnowledgeBaseReferences(text, ctx);
      allRefs.push(...referencedInsights);
      return resolvedText;
    };

    const processedOutput: ContextEfficiencyOutput = {
      ...output,
      productivitySummary: processText(output.productivitySummary),
      strengths: output.strengths?.map((s) => ({
        ...s,
        description: processText(s.description) || s.description,
      })),
      growthAreas: output.growthAreas?.map((g) => ({
        ...g,
        description: processText(g.description) || g.description,
        recommendation: processText(g.recommendation) || g.recommendation,
      })),
      // Process KPT fields too
      kptKeep: output.kptKeep?.map((k) => processText(k) || k),
      kptProblem: output.kptProblem?.map((p) => processText(p) || p),
      kptTry: output.kptTry?.map((t) => processText(t) || t),
      topInsights: output.topInsights?.map((i) => processText(i) || i),
    };

    // Deduplicate referenced insights by ID
    const uniqueRefs = Array.from(
      new Map(allRefs.map((r) => [r.id, r])).values()
    );

    if (uniqueRefs.length > 0) {
      processedOutput.referencedInsights = uniqueRefs;
    }

    return processedOutput;
  }

  public preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        // Use displayText (sanitized) if available, fallback to raw text
        // displayText has machine-generated content (error logs, stack traces, code) summarized
        // Longer limit for context analysis
        text: (u.displayText || u.text).slice(0, 1500),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        characterCount: u.characterCount,
        wordCount: u.wordCount,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating ContextEfficiencyWorker
 */
export function createContextEfficiencyWorker(
  config: OrchestratorConfig
): ContextEfficiencyWorker {
  return new ContextEfficiencyWorker(config);
}
