/**
 * Deterministic Scorer - Rubric-based scoring from Phase 1 metrics
 *
 * Pure function: Phase1Output -> DeterministicScores
 * Same input always produces same output. No LLM calls, no external state.
 *
 * @module @betterprompt/shared/scoring/deterministic-scorer
 */

import type { Phase1Output, Phase1SessionMetrics } from '../schemas/phase1-output.js';
import type { DeterministicScores } from '../schemas/deterministic-scores.js';

// ============================================================================
// Utility Functions
// ============================================================================

function clampScore(value: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function invertedScale(value: number): number {
  return 100 - Math.max(0, Math.min(100, value));
}

function bellCurveScore(
  value: number,
  optimalLow: number,
  optimalHigh: number,
  falloffRate = 0.01,
): number {
  if (value >= optimalLow && value <= optimalHigh) return 100;
  const distance = value < optimalLow ? optimalLow - value : value - optimalHigh;
  return 100 * Math.exp(-falloffRate * distance * distance);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// ============================================================================
// Domain Rubrics
// ============================================================================

function scoreContextEfficiency(metrics: Phase1SessionMetrics): number {
  const avgFill = metrics.avgContextFillPercent ?? 50;
  const totalSessions = Math.max(metrics.totalSessions, 1);

  const baseScore = invertedScale(avgFill);

  const overflowCount = metrics.contextFillExceeded90Count ?? 0;
  const overflowRatio = overflowCount / totalSessions;
  const overflowPenalty = overflowRatio * 30;

  const slashCmds = metrics.slashCommandCounts ?? {};
  const compactCount = (slashCmds['compact'] ?? 0) + (slashCmds['clear'] ?? 0);
  const compactionBonus = compactCount > 0 ? Math.min(compactCount * 3, 15) : 0;

  const longSessionRatio = (metrics.sessionHints?.longSessions ?? 0) / totalSessions;
  const longSessionPenalty = longSessionRatio * 10;

  return clampScore(baseScore - overflowPenalty + compactionBonus - longSessionPenalty);
}

function scoreSessionOutcome(metrics: Phase1SessionMetrics): number {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const friction = metrics.frictionSignals;

  const toolFailures = friction?.toolFailureCount ?? 0;
  const rejections = friction?.userRejectionSignals ?? 0;
  const excessiveIterations = friction?.excessiveIterationSessions ?? 0;
  const contextOverflows = friction?.contextOverflowSessions ?? 0;
  const frustrationExpressions = friction?.frustrationExpressionCount ?? 0;

  const totalFriction = toolFailures + rejections + excessiveIterations + contextOverflows + frustrationExpressions;
  const frictionDensity = totalFriction / totalSessions;

  const baseScore = 85 * Math.exp(-0.3 * frictionDensity);

  const mediumSessions = metrics.sessionHints?.mediumSessions ?? 0;
  const mediumRatio = mediumSessions / totalSessions;
  const balanceBonus = mediumRatio * 15;

  const excessiveRatio = excessiveIterations / totalSessions;
  const excessivePenalty = excessiveRatio * 10;

  return clampScore(baseScore + balanceBonus - excessivePenalty);
}

function scoreThinkingQuality(metrics: Phase1SessionMetrics): number {
  const slashCmds = metrics.slashCommandCounts ?? {};

  // Planning (40% weight)
  const planCount = slashCmds['plan'] ?? 0;
  const reviewCount = slashCmds['review'] ?? 0;
  const planningActivityCount = planCount + reviewCount;
  const planningScore = planningActivityCount > 0
    ? 30 + 55 * (1 - Math.exp(-0.4 * planningActivityCount))
    : 30;

  // Critical thinking (30% weight)
  const questionRatio = metrics.questionRatio;
  const criticalThinkingFromQuestions = bellCurveScore(questionRatio * 100, 15, 40, 0.003);
  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / Math.max(metrics.totalDeveloperUtterances, 1);
  const criticalThinkingFromRejections = bellCurveScore(rejectionRate * 100, 2, 10, 0.005);
  const criticalThinkingScore = criticalThinkingFromQuestions * 0.6 + criticalThinkingFromRejections * 0.4;

  // Error recovery (30% weight)
  const toolFailureRate = (metrics.frictionSignals?.toolFailureCount ?? 0) / Math.max(metrics.totalMessages, 1);
  let errorRecoveryScore = 80 * Math.exp(-8 * toolFailureRate) + 20;
  const errorChainMax = metrics.frictionSignals?.errorChainMaxLength ?? 0;
  if (errorChainMax >= 3) {
    const chainPenalty = Math.min((errorChainMax - 2) * 5, 30);
    errorRecoveryScore = Math.max(0, errorRecoveryScore - chainPenalty);
  }

  return clampScore(
    planningScore * 0.4 +
    criticalThinkingScore * 0.3 +
    errorRecoveryScore * 0.3,
  );
}

function scoreLearningBehavior(metrics: Phase1SessionMetrics): number {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);

  // Learning intent (50% weight)
  const questionScore = Math.min(metrics.questionRatio * 200, 100);
  const insightCount = metrics.aiInsightBlockCount ?? 0;
  const insightEngagement = insightCount > 0
    ? 40 + 50 * (1 - Math.exp(-0.1 * insightCount))
    : 40;
  const learningIntentScore = questionScore * 0.6 + insightEngagement * 0.4;

  // Mistake repetition (30% weight)
  const excessiveIterationRate = (metrics.frictionSignals?.excessiveIterationSessions ?? 0) / totalSessions;
  const bareRetryRate = (metrics.frictionSignals?.bareRetryAfterErrorCount ?? 0) / totalUtterances;
  const combinedMistakeRate = excessiveIterationRate + bareRetryRate;
  const mistakeScore = invertedScale(combinedMistakeRate * 100) * 0.8 + 20;

  // Experimentation (20% weight)
  const codeExperimentation = Math.min(metrics.codeBlockRatio * 150, 100);
  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const diversityBonus = Math.min(uniqueCommands * 8, 40);
  const experimentationScore = codeExperimentation * 0.6 + diversityBonus * 0.4 + 20;

  return clampScore(
    learningIntentScore * 0.5 +
    mistakeScore * 0.3 +
    experimentationScore * 0.2,
  );
}

function scoreCommunicationPatterns(
  metrics: Phase1SessionMetrics,
  phase1Output: Phase1Output,
): number {
  // Prompt quality (40% weight)
  const avgLen = metrics.avgDeveloperMessageLength;
  const promptQualityScore = bellCurveScore(avgLen, 200, 500, 0.00003);

  // Structure (30% weight)
  const codeStructure = Math.min(metrics.codeBlockRatio * 200, 100);
  const questionStructure = Math.min(metrics.questionRatio * 250, 100);
  const structureScore = codeStructure * 0.5 + questionStructure * 0.5;

  // Consistency (30% weight)
  const wordCounts = phase1Output.developerUtterances.map(u => u.wordCount);
  const cv = coefficientOfVariation(wordCounts);
  const consistencyScore = 100 * Math.exp(-0.3 * cv);

  return clampScore(
    promptQualityScore * 0.4 +
    structureScore * 0.3 +
    consistencyScore * 0.3,
  );
}

function scoreControl(metrics: Phase1SessionMetrics): number {
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);

  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / totalUtterances;
  const rejectionSignal = Math.min(rejectionRate * 500, 100);

  const questionSignal = Math.min(metrics.questionRatio * 200, 100);

  const avgLen = metrics.avgDeveloperMessageLength;
  const lengthSignal = Math.min(avgLen / 5, 100);

  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const commandSignal = Math.min((uniqueCommands * 10 + totalCommands * 2), 100);

  return clampScore(
    rejectionSignal * 0.25 +
    questionSignal * 0.25 +
    lengthSignal * 0.25 +
    commandSignal * 0.25,
  );
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute deterministic scores from Phase 1 output.
 * Pure function: same Phase1Output always produces same DeterministicScores.
 */
export function computeDeterministicScores(phase1Output: Phase1Output): DeterministicScores {
  const metrics = phase1Output.sessionMetrics;

  return {
    contextEfficiency: scoreContextEfficiency(metrics),
    sessionOutcome: scoreSessionOutcome(metrics),
    thinkingQuality: scoreThinkingQuality(metrics),
    learningBehavior: scoreLearningBehavior(metrics),
    communicationPatterns: scoreCommunicationPatterns(metrics, phase1Output),
    controlScore: scoreControl(metrics),
  };
}
