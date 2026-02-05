/**
 * Session Outcome Worker (Phase 2 - v3 Architecture)
 *
 * Phase 2 worker that analyzes session outcomes, goals, and friction:
 * - Goal Categories: What was the developer trying to achieve?
 * - Session Types: How was the session structured?
 * - Outcomes: Did they achieve their goals?
 * - Friction: What obstacles did they encounter?
 *
 * This worker answers: "How successful are this developer's sessions?
 * What do they work on, and where do they get stuck?"
 *
 * Inspired by Claude Code's /insights feature which tracks:
 * - Goal categories (14 types)
 * - Satisfaction levels
 * - Friction types (12 categories)
 * - Outcome categories
 * - Session types
 *
 * @module analyzer/workers/session-outcome-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import {
  SessionOutcomeLLMOutputSchema,
  type SessionOutcomeOutput,
  parseSessionOutcomeLLMOutput,
} from '../../models/session-outcome-data';
import type { Phase1Output } from '../../models/phase1-output';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  SESSION_OUTCOME_SYSTEM_PROMPT,
  buildSessionOutcomeUserPrompt,
} from './prompts/session-outcome-prompts';
import {
  resolveKnowledgeBaseReferences,
  type WorkerInsightContext,
  type ReferencedInsight,
} from './prompts/knowledge-mapping';

/** Worker names to combine insights from */
const INSIGHT_DOMAINS = ['SessionOutcome'] as const;

/**
 * SessionOutcomeWorker - Analysis of session success and friction
 *
 * Phase 2 worker that analyzes session outcomes, goals, and friction points.
 * Answers: "How successful are this developer's sessions?"
 *
 * Uses deterministic friction signals from Phase 1 as input hints.
 */
export class SessionOutcomeWorker extends BaseWorker<SessionOutcomeOutput> {
  readonly name = 'SessionOutcome';
  readonly phase = 2 as const;

  constructor(config: OrchestratorConfig) {
    super(config);
  }

  canRun(context: WorkerContext): boolean {
    return this.checkPhase2Preconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<SessionOutcomeOutput>> {
    const { phase1Output } = this.getPhase2Context(context);

    if (!phase1Output) {
      throw new Error('Phase 1 output required for SessionOutcomeWorker');
    }

    this.log('Analyzing session outcomes (goals, friction, success rates)...');
    this.log(`Sessions: ${phase1Output.sessionMetrics.totalSessions}`);
    this.log(`Utterances: ${phase1Output.developerUtterances.length}`);

    // Log friction signals from Phase 1 (deterministic hints)
    if (phase1Output.sessionMetrics.frictionSignals) {
      const fs = phase1Output.sessionMetrics.frictionSignals;
      this.log(`Friction hints: tool_failures=${fs.toolFailureCount}, rejections=${fs.userRejectionSignals}, excessive_iterations=${fs.excessiveIterationSessions}`);
    }

    const phase1ForPrompt = this.preparePhase1ForPrompt(phase1Output);
    const insightContext = this.getCombinedInsights([...INSIGHT_DOMAINS]);

    const userPrompt = buildSessionOutcomeUserPrompt(phase1ForPrompt, insightContext.insights);
    this.log(`Injected ${insightContext.insights.length} professional insights`);

    const result = await this.client!.generateStructured({
      systemPrompt: SESSION_OUTCOME_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: SessionOutcomeLLMOutputSchema,
      maxOutputTokens: 65536,
    });

    const parsedOutput = parseSessionOutcomeLLMOutput(result.data);
    const processedOutput = this.resolveAllReferences(parsedOutput, insightContext);

    this.log(`Overall success rate: ${processedOutput.overallSuccessRate}%`);
    this.log(`Overall outcome score: ${processedOutput.overallOutcomeScore}`);
    this.log(`Sessions analyzed: ${processedOutput.sessionAnalyses.length}`);
    this.log(`Goals tracked: ${processedOutput.goalDistribution.length}`);
    this.log(`Friction types: ${processedOutput.frictionSummary.length}`);
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
    output: SessionOutcomeOutput,
    ctx: WorkerInsightContext
  ): SessionOutcomeOutput {
    const allRefs: ReferencedInsight[] = [];

    const processText = (text: string | undefined): string | undefined => {
      if (!text) return text;
      const { resolvedText, referencedInsights } = resolveKnowledgeBaseReferences(text, ctx);
      allRefs.push(...referencedInsights);
      return resolvedText;
    };

    const processedOutput: SessionOutcomeOutput = {
      ...output,
      summary: processText(output.summary),
      // Process friction summary recommendations
      frictionSummary: output.frictionSummary.map((fs) => ({
        ...fs,
        commonCause: processText(fs.commonCause) || fs.commonCause,
        recommendation: processText(fs.recommendation) || fs.recommendation,
      })),
      // Process success pattern descriptions
      successPatterns: output.successPatterns.map((sp) => ({
        ...sp,
        pattern: processText(sp.pattern) || sp.pattern,
      })),
      // Process failure pattern descriptions
      failurePatterns: output.failurePatterns.map((fp) => ({
        ...fp,
        pattern: processText(fp.pattern) || fp.pattern,
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
   *
   * Includes session-level grouping for outcome analysis:
   * - Groups utterances by session for per-session analysis
   * - Includes friction signals as deterministic hints
   * - Includes session hints for type classification
   */
  public preparePhase1ForPrompt(phase1: Phase1Output): Record<string, unknown> {
    // Group utterances by session for per-session analysis
    const sessionGroups = new Map<string, typeof phase1.developerUtterances>();
    for (const utterance of phase1.developerUtterances) {
      const existing = sessionGroups.get(utterance.sessionId) || [];
      existing.push(utterance);
      sessionGroups.set(utterance.sessionId, existing);
    }

    // Build session summaries for the prompt
    const sessionSummaries = Array.from(sessionGroups.entries()).map(([sessionId, utterances]) => {
      // Sort by turnIndex to get chronological order
      const sorted = [...utterances].sort((a, b) => a.turnIndex - b.turnIndex);

      return {
        sessionId,
        turnCount: sorted.length,
        // First utterance often indicates the goal
        firstUtterance: {
          id: sorted[0]?.id,
          text: (sorted[0]?.displayText || sorted[0]?.text || '').slice(0, 500),
          hasQuestion: sorted[0]?.hasQuestion,
        },
        // Last utterance often indicates the outcome
        lastUtterance: sorted.length > 1 ? {
          id: sorted[sorted.length - 1]?.id,
          text: (sorted[sorted.length - 1]?.displayText || sorted[sorted.length - 1]?.text || '').slice(0, 300),
        } : undefined,
        // Key utterances in between (every 3rd for longer sessions)
        keyUtterances: sorted.length > 4
          ? sorted.filter((_, i) => i > 0 && i < sorted.length - 1 && i % 3 === 0)
              .slice(0, 3)
              .map((u) => ({
                id: u.id,
                text: (u.displayText || u.text).slice(0, 200),
                turnIndex: u.turnIndex,
              }))
          : [],
        // Metadata
        hasCodeBlocks: sorted.some((u) => u.hasCodeBlock),
        questionCount: sorted.filter((u) => u.hasQuestion).length,
        hadPrecedingErrors: sorted.some((u) => u.precedingAIHadError),
      };
    });

    return {
      // Session-grouped data for per-session analysis
      sessionSummaries: sessionSummaries.slice(0, 20), // Max 20 sessions

      // Full utterances for detailed analysis (limited)
      developerUtterances: phase1.developerUtterances.slice(0, 100).map((u) => ({
        id: u.id,
        text: (u.displayText || u.text).slice(0, 500),
        sessionId: u.sessionId,
        turnIndex: u.turnIndex,
        hasCodeBlock: u.hasCodeBlock,
        hasQuestion: u.hasQuestion,
        isSessionStart: u.isSessionStart,
        precedingAIHadError: u.precedingAIHadError,
      })),

      // Session metrics with friction signals
      sessionMetrics: {
        totalSessions: phase1.sessionMetrics.totalSessions,
        totalMessages: phase1.sessionMetrics.totalMessages,
        avgMessagesPerSession: phase1.sessionMetrics.avgMessagesPerSession,
        questionRatio: phase1.sessionMetrics.questionRatio,
        codeBlockRatio: phase1.sessionMetrics.codeBlockRatio,
        toolUsageCounts: phase1.sessionMetrics.toolUsageCounts,
        dateRange: phase1.sessionMetrics.dateRange,
        // Friction signals (deterministic hints from Phase 1)
        frictionSignals: phase1.sessionMetrics.frictionSignals,
        // Session hints (deterministic classification hints)
        sessionHints: phase1.sessionMetrics.sessionHints,
      },
    };
  }
}

/**
 * Factory function for creating SessionOutcomeWorker
 */
export function createSessionOutcomeWorker(
  config: OrchestratorConfig
): SessionOutcomeWorker {
  return new SessionOutcomeWorker(config);
}
