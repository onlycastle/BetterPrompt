/**
 * Deterministic Scorer - Rubric-based scoring from Phase 1 metrics
 *
 * Computes domain scores deterministically from quantitative Phase 1 data,
 * eliminating LLM variance for scores while preserving LLM-generated narratives.
 *
 * Design: Pure function (Phase1Output → DeterministicScores)
 * - Same input always produces same output
 * - No LLM calls, no external state
 * - Unit testable with known Phase 1 fixtures
 *
 * @module analyzer/stages/deterministic-scorer
 */

import type { Phase1Output, Phase1SessionMetrics } from '../../models/phase1-output';

// ============================================================================
// Output Types
// ============================================================================

/**
 * Deterministic scores computed from Phase 1 metrics.
 * All scores are 0-100 integers.
 */
export interface DeterministicScores {
  contextEfficiency: number;
  sessionOutcome: number;
  thinkingQuality: number;
  learningBehavior: number;
  communicationPatterns: number;
  controlScore: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Clamp a value to [min, max] and round to integer */
function clampScore(value: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

/**
 * Inverted scale: higher input → lower score.
 * Maps [0, 100] → [100, 0] linearly.
 */
function invertedScale(value: number): number {
  return 100 - Math.max(0, Math.min(100, value));
}

/**
 * Bell curve scoring: optimal value range scores highest (100),
 * deviation from range reduces score.
 *
 * @param value - Input value
 * @param optimalLow - Lower bound of optimal range
 * @param optimalHigh - Upper bound of optimal range
 * @param falloffRate - How quickly score drops outside optimal range (higher = steeper)
 */
function bellCurveScore(
  value: number,
  optimalLow: number,
  optimalHigh: number,
  falloffRate = 0.01
): number {
  if (value >= optimalLow && value <= optimalHigh) return 100;

  const distance = value < optimalLow
    ? optimalLow - value
    : value - optimalHigh;

  // Gaussian-like falloff
  return 100 * Math.exp(-falloffRate * distance * distance);
}

/**
 * Coefficient of Variation (CV) for measuring consistency.
 * Returns 0 if array is empty or mean is 0.
 */
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

/**
 * Context Efficiency rubric (crystallization: HIGH)
 *
 * Signals: avgContextFillPercent, contextFillExceeded90Count, /compact + /clear usage
 */
function scoreContextEfficiency(metrics: Phase1SessionMetrics): number {
  const avgFill = metrics.avgContextFillPercent ?? 50;
  const totalSessions = Math.max(metrics.totalSessions, 1);

  // Base: lower avg context fill = more efficient (inverted)
  const baseScore = invertedScale(avgFill);

  // Overflow penalty: frequent 90%+ fill is inefficient
  const overflowCount = metrics.contextFillExceeded90Count ?? 0;
  const overflowRatio = overflowCount / totalSessions;
  const overflowPenalty = overflowRatio * 30; // up to -30 points

  // Compaction bonus: proactive /compact and /clear usage
  const slashCmds = metrics.slashCommandCounts ?? {};
  const compactCount = (slashCmds['compact'] ?? 0) + (slashCmds['clear'] ?? 0);
  const compactionBonus = compactCount > 0 ? Math.min(compactCount * 3, 15) : 0; // up to +15

  // Long session ratio penalty: many long sessions = higher overflow risk
  const longSessionRatio = (metrics.sessionHints?.longSessions ?? 0) / totalSessions;
  const longSessionPenalty = longSessionRatio * 10; // up to -10

  return clampScore(baseScore - overflowPenalty + compactionBonus - longSessionPenalty);
}

/**
 * Session Outcome rubric (crystallization: MEDIUM-HIGH)
 *
 * Signals: frictionSignals, sessionHints, questionRatio
 */
function scoreSessionOutcome(metrics: Phase1SessionMetrics): number {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const friction = metrics.frictionSignals;

  // Friction density: total friction events / sessions
  const toolFailures = friction?.toolFailureCount ?? 0;
  const rejections = friction?.userRejectionSignals ?? 0;
  const excessiveIterations = friction?.excessiveIterationSessions ?? 0;
  const contextOverflows = friction?.contextOverflowSessions ?? 0;
  const frustrationExpressions = friction?.frustrationExpressionCount ?? 0;

  const totalFriction = toolFailures + rejections + excessiveIterations + contextOverflows + frustrationExpressions;
  const frictionDensity = totalFriction / totalSessions;

  // Base: less friction = better outcome
  // frictionDensity of 0 → 85, 1 → 60, 3 → 30, 5+ → 15
  const baseScore = 85 * Math.exp(-0.3 * frictionDensity);

  // Session balance bonus: medium sessions (4-10 turns) correlate with best outcomes
  const mediumSessions = metrics.sessionHints?.mediumSessions ?? 0;
  const mediumRatio = mediumSessions / totalSessions;
  const balanceBonus = mediumRatio * 15; // up to +15

  // Excessive iteration penalty (additional, beyond friction density)
  const excessiveRatio = excessiveIterations / totalSessions;
  const excessivePenalty = excessiveRatio * 10;

  return clampScore(baseScore + balanceBonus - excessivePenalty);
}

/**
 * Thinking Quality rubric (crystallization: MEDIUM)
 *
 * Signals: /plan usage, questionRatio, rejection signals, error patterns
 */
function scoreThinkingQuality(metrics: Phase1SessionMetrics): number {
  const slashCmds = metrics.slashCommandCounts ?? {};

  // Planning score (40% weight)
  // /plan usage indicates explicit planning behavior
  const planCount = slashCmds['plan'] ?? 0;
  const reviewCount = slashCmds['review'] ?? 0;
  const planningActivityCount = planCount + reviewCount;

  // More plan commands → higher score, with diminishing returns
  // 0 → 30, 1 → 55, 3 → 75, 5+ → 85
  const planningScore = planningActivityCount > 0
    ? 30 + 55 * (1 - Math.exp(-0.4 * planningActivityCount))
    : 30; // baseline: some developers plan without /plan

  // Critical thinking score (30% weight)
  // questionRatio: higher = more questioning = more critical
  const questionRatio = metrics.questionRatio;
  // Optimal range: 0.15-0.40 questions
  const criticalThinkingFromQuestions = bellCurveScore(questionRatio * 100, 15, 40, 0.003);

  // Rejection signals indicate verification behavior
  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / Math.max(metrics.totalDeveloperUtterances, 1);
  // Some rejection is healthy (0.02-0.10), too much indicates problems
  const criticalThinkingFromRejections = bellCurveScore(rejectionRate * 100, 2, 10, 0.005);

  const criticalThinkingScore = criticalThinkingFromQuestions * 0.6 + criticalThinkingFromRejections * 0.4;

  // Error recovery score (30% weight)
  // Based on how well sessions recover from errors
  const toolFailureRate = (metrics.frictionSignals?.toolFailureCount ?? 0) / Math.max(metrics.totalMessages, 1);
  // Low failure rate = good error prevention/recovery
  // failureRate 0 → 80, 0.05 → 60, 0.15+ → 30
  let errorRecoveryScore = 80 * Math.exp(-8 * toolFailureRate) + 20;

  // Error chain penalty: long consecutive error chains indicate poor recovery
  // chain 0-2 → no penalty, 3 → -10, 5 → -20, 10+ → -30
  const errorChainMax = metrics.frictionSignals?.errorChainMaxLength ?? 0;
  if (errorChainMax >= 3) {
    const chainPenalty = Math.min((errorChainMax - 2) * 5, 30);
    errorRecoveryScore = Math.max(0, errorRecoveryScore - chainPenalty);
  }

  return clampScore(
    planningScore * 0.4 +
    criticalThinkingScore * 0.3 +
    errorRecoveryScore * 0.3
  );
}

/**
 * Learning Behavior rubric (crystallization: LOW — coarse proxy)
 *
 * Signals: questionRatio, aiInsightBlockCount, error frequency, codeBlockRatio
 */
function scoreLearningBehavior(metrics: Phase1SessionMetrics): number {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);

  // Learning intent score (50% weight)
  // questionRatio: higher = more learning intent
  const questionScore = Math.min(metrics.questionRatio * 200, 100); // 0.5 ratio → 100

  // AI insight blocks: engagement with educational content
  const insightCount = metrics.aiInsightBlockCount ?? 0;
  // insightCount 0 → 40 (neutral), 5 → 65, 15+ → 90
  const insightEngagement = insightCount > 0
    ? 40 + 50 * (1 - Math.exp(-0.1 * insightCount))
    : 40;

  const learningIntentScore = questionScore * 0.6 + insightEngagement * 0.4;

  // Mistake repetition proxy (30% weight)
  // Excessive iteration sessions suggest repeated mistakes
  const excessiveIterationRate = (metrics.frictionSignals?.excessiveIterationSessions ?? 0) / totalSessions;
  // Bare retry count: blind retries without analysis indicate poor learning
  const bareRetryRate = (metrics.frictionSignals?.bareRetryAfterErrorCount ?? 0) / totalUtterances;
  // Lower rate = fewer repeated mistakes
  // Combine excessive iteration rate with bare retry rate for broader mistake detection
  const combinedMistakeRate = excessiveIterationRate + bareRetryRate;
  const mistakeScore = invertedScale(combinedMistakeRate * 100) * 0.8 + 20;

  // Experimentation bonus (20% weight)
  // codeBlockRatio: sharing code indicates experimentation
  const codeExperimentation = Math.min(metrics.codeBlockRatio * 150, 100); // 0.67 → 100

  // Diverse tool usage (from slash commands)
  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const diversityBonus = Math.min(uniqueCommands * 8, 40); // up to +40

  const experimentationScore = codeExperimentation * 0.6 + diversityBonus * 0.4 + 20;

  return clampScore(
    learningIntentScore * 0.5 +
    mistakeScore * 0.3 +
    experimentationScore * 0.2
  );
}

/**
 * Communication Patterns rubric (crystallization: LOW — coarse proxy)
 *
 * Signals: avgDeveloperMessageLength, questionRatio, codeBlockRatio, word count distribution
 */
function scoreCommunicationPatterns(
  metrics: Phase1SessionMetrics,
  phase1Output: Phase1Output
): number {
  // Prompt quality score (40% weight)
  // Bell curve: optimal avg message length is 200-500 chars
  const avgLen = metrics.avgDeveloperMessageLength;
  const promptQualityScore = bellCurveScore(avgLen, 200, 500, 0.00003);

  // Structure score (30% weight)
  // Mix of code blocks (structured info) and questions (engagement)
  const codeStructure = Math.min(metrics.codeBlockRatio * 200, 100); // 0.5 → 100
  const questionStructure = Math.min(metrics.questionRatio * 250, 100); // 0.4 → 100
  const structureScore = codeStructure * 0.5 + questionStructure * 0.5;

  // Consistency score (30% weight)
  // Lower CV of word counts = more consistent communication
  const wordCounts = phase1Output.developerUtterances.map(u => u.wordCount);
  const cv = coefficientOfVariation(wordCounts);
  // CV of 0 → 100, 0.5 → 78, 1.0 → 60, 2.0 → 37
  const consistencyScore = 100 * Math.exp(-0.3 * cv);

  return clampScore(
    promptQualityScore * 0.4 +
    structureScore * 0.3 +
    consistencyScore * 0.3
  );
}

/**
 * Control Score rubric (determines explorer/navigator/cartographer)
 *
 * Higher score = more controlling (cartographer)
 * Lower score = more exploratory (explorer)
 */
function scoreControl(metrics: Phase1SessionMetrics): number {
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);

  // Rejection rate: higher = more controlling (verifying, correcting AI)
  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / totalUtterances;
  const rejectionSignal = Math.min(rejectionRate * 500, 100); // 0.2 → 100

  // Question ratio: higher questioning = more verification-oriented
  const questionSignal = Math.min(metrics.questionRatio * 200, 100); // 0.5 → 100

  // Prompt length: longer = more specific instructions = more controlling
  const avgLen = metrics.avgDeveloperMessageLength;
  // Normalize: 0-50 chars → low control, 200-500 → medium, 500+ → high
  const lengthSignal = Math.min(avgLen / 5, 100); // 500 chars → 100

  // Slash command diversity: more commands = more active control
  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const commandSignal = Math.min((uniqueCommands * 10 + totalCommands * 2), 100);

  return clampScore(
    rejectionSignal * 0.25 +
    questionSignal * 0.25 +
    lengthSignal * 0.25 +
    commandSignal * 0.25
  );
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute deterministic scores from Phase 1 output.
 *
 * Pure function: same Phase1Output always produces same DeterministicScores.
 * No LLM calls, no external state dependencies.
 *
 * @param phase1Output - Complete Phase 1 extraction output
 * @returns DeterministicScores with all domain scores (0-100)
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
