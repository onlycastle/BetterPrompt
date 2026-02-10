/**
 * Communication Patterns Worker (Phase 2 - v3 Architecture)
 *
 * Phase 2 worker that analyzes:
 * - Communication patterns: How clearly does the developer express their needs?
 * - Signature quotes: Developer's most impressive communication moments
 *
 * This worker answers: "How clearly does this developer communicate with AI?"
 *
 * Separated from ThinkingQuality for Single Responsibility Principle:
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 *
 * @module analyzer/workers/communication-patterns-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext, type DescriptionQualityResult } from './base-worker';
import {
  CommunicationPatternsLLMOutputSchema,
  type CommunicationPatternsOutput,
  type CommunicationPatternsLLMOutput,
  parseCommunicationPatternsLLMOutput,
} from '../../models/communication-patterns-data';
import type { GeminiStructuredResult } from '../clients/gemini-client';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  COMMUNICATION_PATTERNS_SYSTEM_PROMPT,
  buildCommunicationPatternsUserPrompt,
} from './prompts/communication-patterns-prompts';
import {
  resolveKnowledgeBaseReferences,
  type WorkerInsightContext,
  type ReferencedInsight,
} from './prompts/knowledge-mapping';

/** Worker names to combine insights from */
const INSIGHT_DOMAINS = ['CommunicationPatterns'] as const;

/**
 * CommunicationPatternsWorker - Analysis of communication patterns
 *
 * Phase 2 worker that analyzes communication clarity and signature quotes.
 * Answers: "How clearly does this developer communicate with AI?"
 */
export class CommunicationPatternsWorker extends BaseWorker<CommunicationPatternsOutput> {
  readonly name = 'CommunicationPatterns';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<CommunicationPatternsOutput>> {
    const { phase1Output } = this.getPhase2Context(context);

    if (!phase1Output) {
      throw new Error('Phase 1 output required for CommunicationPatternsWorker');
    }

    this.log('Analyzing communication patterns...');
    this.log(`Utterances: ${phase1Output.developerUtterances.length}`);

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const insightContext = this.getCombinedInsights([...INSIGHT_DOMAINS]);

    const userPrompt = buildCommunicationPatternsUserPrompt(phase1ForPrompt, insightContext.insights);
    this.log(`Injected ${insightContext.insights.length} professional insights`);

    // 3-Layer Defense: Layer 3 — retry loop for description quality
    const MAX_ATTEMPTS = 2;
    let bestResult: GeminiStructuredResult<CommunicationPatternsLLMOutput> | null = null;
    let bestQuality: DescriptionQualityResult | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const promptToUse = attempt === 0
        ? userPrompt
        : this.buildDescriptionQualityFeedback(userPrompt, bestQuality!);

      const result = await this.client!.generateStructured({
        systemPrompt: COMMUNICATION_PATTERNS_SYSTEM_PROMPT,
        userPrompt: promptToUse,
        responseSchema: CommunicationPatternsLLMOutputSchema,
        maxOutputTokens: 65536,
      });

      const quality = this.validateDescriptionQuality(
        result.data.strengths,
        result.data.growthAreas,
      );

      this.log(`Attempt ${attempt + 1}/${MAX_ATTEMPTS}: ${quality.details}`);

      if (!bestResult || quality.totalDescriptionChars > bestQuality!.totalDescriptionChars) {
        bestResult = result;
        bestQuality = quality;
      }

      if (quality.passed) break;
    }

    const parsedOutput = parseCommunicationPatternsLLMOutput(bestResult!.data);
    const processedOutput = this.resolveAllReferences(parsedOutput, insightContext);

    this.log(`Communication patterns: ${processedOutput.communicationPatterns.length}`);
    this.log(`Signature quotes: ${processedOutput.signatureQuotes?.length ?? 0}`);
    this.log(`Overall communication score (LLM): ${processedOutput.overallCommunicationScore}`);

    // Override with deterministic score if available (rubric-based consistency)
    const deterministicScores = (context as { deterministicScores?: { communicationPatterns: number } }).deterministicScores;
    if (deterministicScores) {
      processedOutput.overallCommunicationScore = deterministicScores.communicationPatterns;
      this.log(`Overall communication score (deterministic override): ${deterministicScores.communicationPatterns}`);
    }

    if (processedOutput.referencedInsights?.length) {
      this.log(`Referenced ${processedOutput.referencedInsights.length} professional insights`);
    }

    return this.createSuccessResult(processedOutput, bestResult!.usage);
  }

  /**
   * Resolve all [pi-XXX] references in output text fields.
   *
   * Replaces [pi-XXX] patterns with human-readable titles
   * and collects all referenced insights with their URLs.
   */
  private resolveAllReferences(
    output: CommunicationPatternsOutput,
    ctx: WorkerInsightContext
  ): CommunicationPatternsOutput {
    const allRefs: ReferencedInsight[] = [];

    const processText = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const { resolvedText, referencedInsights } = resolveKnowledgeBaseReferences(text, ctx);
      allRefs.push(...referencedInsights);
      return resolvedText;
    };

    const processedOutput: CommunicationPatternsOutput = {
      ...output,
      summary: processText(output.summary),
      // Process communication pattern descriptions and tips
      communicationPatterns: output.communicationPatterns.map((p) => ({
        ...p,
        description: processText(p.description) || p.description,
        tip: processText(p.tip),
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
    // Note: aiResponses intentionally excluded - CommunicationPatterns analyzes developer's
    // communication style from their utterances only. AI responses are not needed for
    // communication pattern analysis.
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
        timestamp: u.timestamp,
      })),
      sessionMetrics: phase1.sessionMetrics,
    };
  }
}

/**
 * Factory function for creating CommunicationPatternsWorker
 */
export function createCommunicationPatternsWorker(
  config: OrchestratorConfig
): CommunicationPatternsWorker {
  return new CommunicationPatternsWorker(config);
}
