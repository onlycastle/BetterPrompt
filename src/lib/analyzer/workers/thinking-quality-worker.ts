/**
 * Thinking Quality Worker (Phase 2 - v3 Architecture)
 *
 * Unified Phase 2 worker that combines:
 * - WorkflowHabit: Planning habits, critical thinking, multitasking
 * - TrustVerification (verification-related): Verification behavior, verification anti-patterns
 *
 * This worker answers: "How intentionally and critically does this developer work?"
 *
 * Capability-centric approach:
 * - Planning (40%): How structured and intentional is their work?
 * - Critical Thinking (60%): Do they verify AI outputs?
 *
 * Note: Communication patterns are now handled by CommunicationPatternsWorker.
 *
 * @module analyzer/workers/thinking-quality-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  ThinkingQualityLLMOutputSchema,
  type ThinkingQualityOutput,
  parseThinkingQualityLLMOutput,
} from '../../models/thinking-quality-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  THINKING_QUALITY_SYSTEM_PROMPT,
  buildThinkingQualityUserPrompt,
} from './prompts/thinking-quality-prompts';
import {
  resolveKnowledgeBaseReferences,
  type WorkerInsightContext,
  type ReferencedInsight,
} from './prompts/knowledge-mapping';

/** Worker names to combine insights from */
const INSIGHT_DOMAINS = ['WorkflowHabit', 'TrustVerification'] as const;

/**
 * ThinkingQualityWorker - Unified analysis of thinking quality
 *
 * Phase 2 worker that analyzes planning and critical thinking.
 * Answers: "How intentionally and critically does this developer work?"
 *
 * Note: Communication patterns are now handled by CommunicationPatternsWorker.
 */
export class ThinkingQualityWorker extends BaseWorker<ThinkingQualityOutput> {
  readonly name = 'ThinkingQuality';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<ThinkingQualityOutput>> {
    const { phase1Output } = this.getPhase2Context(context);

    if (!phase1Output) {
      throw new Error('Phase 1 output required for ThinkingQualityWorker');
    }

    this.log('Analyzing thinking quality (planning + critical thinking)...');
    this.log(`Utterances: ${phase1Output.developerUtterances.length}`);

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const insightContext = this.getCombinedInsights([...INSIGHT_DOMAINS]);

    const userPrompt = buildThinkingQualityUserPrompt(phase1ForPrompt, insightContext.insights);
    this.log(`Injected ${insightContext.insights.length} professional insights`);

    const result = await this.client!.generateStructured({
      systemPrompt: THINKING_QUALITY_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: ThinkingQualityLLMOutputSchema,
      maxOutputTokens: 65536,
    });

    const parsedOutput = parseThinkingQualityLLMOutput(result.data);
    const processedOutput = this.resolveAllReferences(parsedOutput, insightContext);

    this.log(`Planning score: ${processedOutput.planQualityScore}`);
    this.log(`Verification level: ${processedOutput.verificationBehavior.level}`);
    this.log(`Overall thinking quality score: ${processedOutput.overallThinkingQualityScore}`);
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
    output: ThinkingQualityOutput,
    ctx: WorkerInsightContext
  ): ThinkingQualityOutput {
    const allRefs: ReferencedInsight[] = [];

    const processText = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const { resolvedText, referencedInsights } = resolveKnowledgeBaseReferences(text, ctx);
      allRefs.push(...referencedInsights);
      return resolvedText;
    };

    const processedOutput: ThinkingQualityOutput = {
      ...output,
      summary: processText(output.summary),
      // Process multitasking pattern recommendation
      multitaskingPattern: output.multitaskingPattern
        ? {
            ...output.multitaskingPattern,
            recommendation: processText(output.multitaskingPattern.recommendation),
          }
        : output.multitaskingPattern,
      // Process verification behavior recommendation
      verificationBehavior: {
        ...output.verificationBehavior,
        recommendation: processText(output.verificationBehavior.recommendation) || output.verificationBehavior.recommendation,
      },
      // Process verification anti-pattern improvements
      verificationAntiPatterns: output.verificationAntiPatterns.map((ap) => ({
        ...ap,
        improvement: processText(ap.improvement),
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
   * Includes more data than individual workers since this is a unified worker.
   */
  public preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    // Note: aiResponses intentionally excluded - ThinkingQuality analyzes developer's
    // thinking patterns from their utterances only. AI responses are not needed for
    // planning and critical thinking analysis.
    // This optimization saves ~15,000-20,000 tokens per analysis.
    const result: Record<string, unknown> = {
      developerUtterances: phase1.developerUtterances.map((u) => ({
        id: u.id,
        // Use displayText (sanitized) if available, fallback to raw text
        // displayText has machine-generated content summarized
        text: (u.displayText || u.text).slice(0, 1000),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        wordCount: u.wordCount,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        isContinuation: u.isContinuation,
        // precedingAIToolCalls excluded - not used in thinking quality analysis
        precedingAIHadError: u.precedingAIHadError,
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };

    // Include AI insight blocks as auxiliary context (lighter than LearningBehavior)
    if (phase1.aiInsightBlocks?.length) {
      result.aiInsightBlocks = phase1.aiInsightBlocks.slice(0, 20).map((ib) => ({
        content: ib.content.slice(0, 200),
        triggeringUtteranceId: ib.triggeringUtteranceId,
      }));
    }

    return result;
  }
}

/**
 * Factory function for creating ThinkingQualityWorker
 */
export function createThinkingQualityWorker(
  config: OrchestratorConfig
): ThinkingQualityWorker {
  return new ThinkingQualityWorker(config);
}
