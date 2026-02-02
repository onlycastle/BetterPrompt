/**
 * Learning Behavior Worker (Phase 2 - v3 Architecture)
 *
 * Unified Phase 2 worker that combines:
 * - KnowledgeGap: Knowledge gaps, learning progress, recommended resources
 * - TrustVerification (repetition-related): Repeated mistake patterns
 *
 * This worker answers: "How much does this developer try to learn? Do they repeat the same mistakes?"
 *
 * Capability-centric approach:
 * - Knowledge Gaps: What topics do they struggle with?
 * - Learning Progress: Are they improving over time?
 * - Repeated Mistakes: Do they learn from errors or repeat them?
 *
 * @module analyzer/workers/learning-behavior-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  LearningBehaviorLLMOutputSchema,
  type LearningBehaviorOutput,
  parseLearningBehaviorLLMOutput,
} from '../../models/learning-behavior-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  LEARNING_BEHAVIOR_SYSTEM_PROMPT,
  buildLearningBehaviorUserPrompt,
} from './prompts/learning-behavior-prompts';
import {
  resolveKnowledgeBaseReferences,
  type WorkerInsightContext,
  type ReferencedInsight,
} from './prompts/knowledge-mapping';

/** Worker names to combine insights from */
const INSIGHT_DOMAINS = ['KnowledgeGap', 'TrustVerification'] as const;

/**
 * LearningBehaviorWorker - Unified analysis of learning behavior
 *
 * Phase 2 worker that analyzes knowledge gaps, learning progress, and repeated mistakes.
 * Answers: "How much does this developer try to learn? Do they repeat the same mistakes?"
 */
export class LearningBehaviorWorker extends BaseWorker<LearningBehaviorOutput> {
  readonly name = 'LearningBehavior';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<LearningBehaviorOutput>> {
    const { phase1Output } = this.getPhase2Context(context);

    if (!phase1Output) {
      throw new Error('Phase 1 output required for LearningBehaviorWorker');
    }

    this.log('Analyzing learning behavior (knowledge gaps + repeated mistakes)...');
    this.log(`Utterances: ${phase1Output.developerUtterances.length}`);

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const insightContext = this.getCombinedInsights([...INSIGHT_DOMAINS]);

    const userPrompt = buildLearningBehaviorUserPrompt(phase1ForPrompt, insightContext.insights);
    this.log(`Injected ${insightContext.insights.length} professional insights`);

    const result = await this.client!.generateStructured({
      systemPrompt: LEARNING_BEHAVIOR_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: LearningBehaviorLLMOutputSchema,
      maxOutputTokens: 16384,
    });

    const parsedOutput = parseLearningBehaviorLLMOutput(result.data);
    const processedOutput = this.resolveAllReferences(parsedOutput, insightContext);

    this.log(`Knowledge gaps: ${processedOutput.knowledgeGaps.length}`);
    this.log(`Learning progress items: ${processedOutput.learningProgress.length}`);
    this.log(`Repeated mistake patterns: ${processedOutput.repeatedMistakePatterns.length}`);
    this.log(`Overall learning score: ${processedOutput.overallLearningScore}`);
    if (processedOutput.referencedInsights?.length) {
      this.log(`Referenced ${processedOutput.referencedInsights.length} professional insights`);
    }

    return this.createSuccessResult(processedOutput, result.usage);
  }

  /**
   * Resolve all [pi-XXX] references in output text fields.
   *
   * Replaces [pi-XXX] patterns with human-readable titles
   * and collects all referenced insights with their URLs.
   */
  private resolveAllReferences(
    output: LearningBehaviorOutput,
    ctx: WorkerInsightContext
  ): LearningBehaviorOutput {
    const allRefs: ReferencedInsight[] = [];

    const processText = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const { resolvedText, referencedInsights } = resolveKnowledgeBaseReferences(text, ctx);
      allRefs.push(...referencedInsights);
      return resolvedText;
    };

    const processTextArray = (arr: string[] | undefined): string[] | undefined => {
      if (!arr) return arr;
      return arr.map((text) => processText(text) || text);
    };

    const processedOutput: LearningBehaviorOutput = {
      ...output,
      summary: processText(output.summary),
      // Process KPT fields
      kptKeep: processTextArray(output.kptKeep),
      kptProblem: processTextArray(output.kptProblem),
      kptTry: processTextArray(output.kptTry),
      topInsights: processTextArray(output.topInsights) || [],
      // Process repeated mistake recommendations
      repeatedMistakePatterns: output.repeatedMistakePatterns.map((p) => ({
        ...p,
        recommendation: processText(p.recommendation) || p.recommendation,
      })),
      // Process strengths descriptions
      strengths: output.strengths?.map((s) => ({
        ...s,
        description: processText(s.description) || s.description,
      })),
      // Process growth areas descriptions and recommendations
      growthAreas: output.growthAreas?.map((g) => ({
        ...g,
        description: processText(g.description) || g.description,
        recommendation: processText(g.recommendation) || g.recommendation,
      })),
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

  /**
   * Prepare Phase 1 output for the prompt.
   */
  public preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    // Note: aiResponses intentionally excluded - LearningBehavior analyzes learning patterns
    // from developer utterances only. The key signal `precedingAIHadError` is already included
    // in developerUtterances, making aiResponses redundant for this analysis.
    // This optimization saves ~15,000-20,000 tokens per analysis.
    return {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        // Use displayText (sanitized) if available, fallback to raw text
        text: (u.displayText || u.text).slice(0, 1000),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        // precedingAIToolCalls excluded - not used in learning behavior analysis
        precedingAIHadError: u.precedingAIHadError,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating LearningBehaviorWorker
 */
export function createLearningBehaviorWorker(
  config: OrchestratorConfig
): LearningBehaviorWorker {
  return new LearningBehaviorWorker(config);
}
