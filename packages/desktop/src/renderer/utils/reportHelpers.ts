/**
 * Report Helpers
 *
 * Shared utilities for extracting and formatting report data.
 */

import type { AnalysisResultResponse } from '../types/report';

/**
 * Type result format expected by TypeResultSection component
 */
export interface TypeResult {
  primaryType: AnalysisResultResponse['evaluation']['primaryType'];
  controlLevel: AnalysisResultResponse['evaluation']['controlLevel'];
  distribution: AnalysisResultResponse['evaluation']['distribution'];
  sessionCount: number;
  analyzedAt: string;
  metrics: {
    avgPromptLength: number;
    avgFirstPromptLength: number;
    avgTurnsPerSession: number;
    questionFrequency: number;
    modificationRate: number;
    toolUsageHighlight: string;
  };
  typeSynthesis?: AnalysisResultResponse['evaluation']['agentOutputs'] extends { typeSynthesis?: infer T } ? T : undefined;
}

/**
 * Extract type result from evaluation for TypeResultSection component
 *
 * Converts VerboseEvaluation into the format needed for 15-type matrix display.
 * Returns null if evaluation is undefined.
 */
export function extractTypeResult(
  evaluation: AnalysisResultResponse['evaluation'] | undefined
): TypeResult | null {
  if (!evaluation) return null;

  return {
    primaryType: evaluation.primaryType,
    controlLevel: evaluation.controlLevel,
    distribution: evaluation.distribution,
    sessionCount: evaluation.sessionsAnalyzed,
    analyzedAt: evaluation.analyzedAt,
    metrics: {
      avgPromptLength: evaluation.avgPromptLength || 0,
      avgFirstPromptLength: 0,
      avgTurnsPerSession: evaluation.avgTurnsPerSession || 0,
      questionFrequency: 0,
      modificationRate: 0,
      toolUsageHighlight: '',
    },
    typeSynthesis: evaluation.agentOutputs?.typeSynthesis,
  };
}
