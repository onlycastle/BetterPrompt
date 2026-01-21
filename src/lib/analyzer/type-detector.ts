/**
 * Type Detector - Analyzes session logs to determine AI Coding Style
 *
 * Uses behavioral patterns from conversation data to score
 * each of the 5 types: Architect, Scientist, Collaborator, Speedrunner, Craftsman
 */

import {
  type ParsedSession,
  type ParsedMessage,
  type SessionMetrics,
  type TypeScores,
  type TypeDistribution,
  type CodingStyleType,
  PATTERN_KEYWORDS,
} from '../models/index';

// ============================================================================
// Metrics Extraction
// ============================================================================

/**
 * Extract metrics from a single session
 */
export function extractSessionMetrics(session: ParsedSession): SessionMetrics {
  const userMessages = session.messages.filter((m) => m.role === 'user');
  const assistantMessages = session.messages.filter((m) => m.role === 'assistant');

  // Prompt characteristics
  const promptLengths = userMessages.map((m) => m.content.length);
  const avgPromptLength =
    promptLengths.length > 0
      ? promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length
      : 0;
  const avgFirstPromptLength = promptLengths.length > 0 ? promptLengths[0] : 0;
  const maxPromptLength = Math.max(...promptLengths, 0);

  // Turn patterns
  const totalTurns = Math.min(userMessages.length, assistantMessages.length);
  const avgTurnsPerSession = totalTurns;

  // Question patterns
  const allUserContent = userMessages.map((m) => m.content.toLowerCase()).join(' ');
  const questionMarks = (allUserContent.match(/\?/g) || []).length;
  const whyHowWhatCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.questions
  );
  const questionFrequency = totalTurns > 0 ? questionMarks / totalTurns : 0;

  // Tool usage patterns
  const toolUsage = countToolUsage(assistantMessages);

  // Modification patterns
  const modificationRequestCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.modifications
  );
  const modificationRate =
    totalTurns > 0 ? modificationRequestCount / totalTurns : 0;

  // Quality signals
  const refactorKeywordCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.quality
  );
  const styleKeywordCount = countKeywordMatches(
    allUserContent,
    ['style', 'naming', 'convention', 'pattern']
  );
  const qualityTermCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.qualityTerms
  );

  // Feedback patterns
  const positiveFeedbackCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.positiveFeedback
  );
  const negativeFeedbackCount = countKeywordMatches(allUserContent, [
    'wrong',
    'bad',
    'no',
    'not',
    'error',
    "doesn't",
    "don't",
  ]);

  // Planning patterns (Architect-specific)
  const planningKeywordCount = countKeywordMatches(
    allUserContent,
    PATTERN_KEYWORDS.planning
  );
  // Step patterns: numbered lists (1., 2., 3.) or sequential words (first, then, finally)
  const stepPatterns = /\b(1\.|2\.|3\.|first,|then,|next,|finally,|step\s*\d)/gi;
  const stepPatternCount = (allUserContent.match(stepPatterns) || []).length;

  // Time patterns
  const avgCycleTimeSeconds = calculateAvgCycleTime(session.messages);
  const sessionDurationSeconds = session.durationSeconds;

  return {
    avgPromptLength,
    avgFirstPromptLength,
    maxPromptLength,
    avgTurnsPerSession,
    totalTurns,
    questionFrequency,
    whyHowWhatCount,
    toolUsage,
    modificationRequestCount,
    modificationRate,
    refactorKeywordCount,
    styleKeywordCount,
    qualityTermCount,
    positiveFeedbackCount,
    negativeFeedbackCount,
    planningKeywordCount,
    stepPatternCount,
    avgCycleTimeSeconds,
    sessionDurationSeconds,
  };
}

/**
 * Aggregate metrics from multiple sessions
 */
export function aggregateMetrics(sessions: ParsedSession[]): SessionMetrics {
  if (sessions.length === 0) {
    return createEmptyMetrics();
  }

  const sessionMetrics = sessions.map(extractSessionMetrics);

  // Average all metrics
  const aggregate: SessionMetrics = {
    avgPromptLength: avg(sessionMetrics.map((m) => m.avgPromptLength)),
    avgFirstPromptLength: avg(sessionMetrics.map((m) => m.avgFirstPromptLength)),
    maxPromptLength: Math.max(...sessionMetrics.map((m) => m.maxPromptLength)),
    avgTurnsPerSession: avg(sessionMetrics.map((m) => m.avgTurnsPerSession)),
    totalTurns: sum(sessionMetrics.map((m) => m.totalTurns)),
    questionFrequency: avg(sessionMetrics.map((m) => m.questionFrequency)),
    whyHowWhatCount: sum(sessionMetrics.map((m) => m.whyHowWhatCount)),
    toolUsage: {
      read: sum(sessionMetrics.map((m) => m.toolUsage.read)),
      grep: sum(sessionMetrics.map((m) => m.toolUsage.grep)),
      glob: sum(sessionMetrics.map((m) => m.toolUsage.glob)),
      task: sum(sessionMetrics.map((m) => m.toolUsage.task)),
      plan: sum(sessionMetrics.map((m) => m.toolUsage.plan)),
      bash: sum(sessionMetrics.map((m) => m.toolUsage.bash)),
      write: sum(sessionMetrics.map((m) => m.toolUsage.write)),
      edit: sum(sessionMetrics.map((m) => m.toolUsage.edit)),
      total: sum(sessionMetrics.map((m) => m.toolUsage.total)),
    },
    modificationRequestCount: sum(
      sessionMetrics.map((m) => m.modificationRequestCount)
    ),
    modificationRate: avg(sessionMetrics.map((m) => m.modificationRate)),
    refactorKeywordCount: sum(sessionMetrics.map((m) => m.refactorKeywordCount)),
    styleKeywordCount: sum(sessionMetrics.map((m) => m.styleKeywordCount)),
    qualityTermCount: sum(sessionMetrics.map((m) => m.qualityTermCount)),
    positiveFeedbackCount: sum(sessionMetrics.map((m) => m.positiveFeedbackCount)),
    negativeFeedbackCount: sum(sessionMetrics.map((m) => m.negativeFeedbackCount)),
    planningKeywordCount: sum(sessionMetrics.map((m) => m.planningKeywordCount)),
    stepPatternCount: sum(sessionMetrics.map((m) => m.stepPatternCount)),
    avgCycleTimeSeconds: avg(sessionMetrics.map((m) => m.avgCycleTimeSeconds)),
    sessionDurationSeconds: avg(
      sessionMetrics.map((m) => m.sessionDurationSeconds)
    ),
  };

  return aggregate;
}

// ============================================================================
// Type Scoring
// ============================================================================

/**
 * Calculate raw scores for each type based on metrics
 * Each type gets points based on specific behavioral signals
 */
export function calculateTypeScores(metrics: SessionMetrics): TypeScores {
  const scores: TypeScores = {
    architect: 0,
    scientist: 0,
    collaborator: 0,
    speedrunner: 0,
    craftsman: 0,
  };

  // ========== ARCHITECT SIGNALS ==========
  // Long, structured initial prompts (raised thresholds to reduce bias)
  if (metrics.avgFirstPromptLength > 800) scores.architect += 2;
  else if (metrics.avgFirstPromptLength > 500) scores.architect += 1;
  // Removed >150 tier (too low - most normal messages hit this)

  // High Task/Plan tool usage (raised thresholds)
  const planningToolRatio =
    metrics.toolUsage.total > 0
      ? (metrics.toolUsage.task + metrics.toolUsage.plan) / metrics.toolUsage.total
      : 0;
  if (planningToolRatio > 0.4) scores.architect += 2;
  else if (planningToolRatio > 0.25) scores.architect += 1;
  // Removed >5% tier (too low - incidental usage triggers this)

  // Low turns (gets it right first time) - stricter threshold
  if (metrics.avgTurnsPerSession < 2) scores.architect += 1;
  // Removed <5 tier (too common for efficient users)

  // Low modification rate - stricter threshold
  if (metrics.modificationRate < 0.05) scores.architect += 1;
  // Removed <20% tier (too common for clear communicators)

  // Planning language usage (distinguishes true architects)
  const planningKeywordRatio =
    metrics.totalTurns > 0
      ? metrics.planningKeywordCount / metrics.totalTurns
      : 0;
  if (planningKeywordRatio > 1.5) scores.architect += 3;
  else if (planningKeywordRatio > 0.8) scores.architect += 2;
  else if (planningKeywordRatio > 0.4) scores.architect += 1;

  // Step-by-step structure detection (1., 2., first...then...finally)
  const stepRatio =
    metrics.totalTurns > 0 ? metrics.stepPatternCount / metrics.totalTurns : 0;
  if (stepRatio > 0.5) scores.architect += 2;
  else if (stepRatio > 0.2) scores.architect += 1;

  // ========== SCIENTIST SIGNALS ==========
  // High question frequency
  if (metrics.questionFrequency > 1.5) scores.scientist += 3;
  else if (metrics.questionFrequency > 0.8) scores.scientist += 2;
  else if (metrics.questionFrequency > 0.4) scores.scientist += 1;

  // High why/how/what usage
  const whyHowRatio =
    metrics.totalTurns > 0 ? metrics.whyHowWhatCount / metrics.totalTurns : 0;
  if (whyHowRatio > 2) scores.scientist += 3;
  else if (whyHowRatio > 1) scores.scientist += 2;
  else if (whyHowRatio > 0.5) scores.scientist += 1;

  // High Read/Grep usage (checking existing code)
  const readGrepRatio =
    metrics.toolUsage.total > 0
      ? (metrics.toolUsage.read + metrics.toolUsage.grep + metrics.toolUsage.glob) /
        metrics.toolUsage.total
      : 0;
  if (readGrepRatio > 0.4) scores.scientist += 2;
  else if (readGrepRatio > 0.2) scores.scientist += 1;

  // High modification rate (corrects AI)
  if (metrics.modificationRate > 0.4) scores.scientist += 3;
  else if (metrics.modificationRate > 0.25) scores.scientist += 2;
  else if (metrics.modificationRate > 0.15) scores.scientist += 1;

  // ========== COLLABORATOR SIGNALS ==========
  // High turn count (lots of back-and-forth)
  if (metrics.avgTurnsPerSession > 8) scores.collaborator += 3;
  else if (metrics.avgTurnsPerSession > 5) scores.collaborator += 2;
  else if (metrics.avgTurnsPerSession > 3) scores.collaborator += 1;

  // Iterative modification patterns
  if (metrics.modificationRate > 0.3) scores.collaborator += 2;
  else if (metrics.modificationRate > 0.2) scores.collaborator += 1;

  // Positive feedback frequency
  const feedbackRatio =
    metrics.totalTurns > 0
      ? metrics.positiveFeedbackCount / metrics.totalTurns
      : 0;
  if (feedbackRatio > 0.3) scores.collaborator += 3;
  else if (feedbackRatio > 0.15) scores.collaborator += 2;
  else if (feedbackRatio > 0.05) scores.collaborator += 1;

  // ========== SPEEDRUNNER SIGNALS ==========
  // Short prompts
  if (metrics.avgPromptLength < 50) scores.speedrunner += 3;
  else if (metrics.avgPromptLength < 100) scores.speedrunner += 2;
  else if (metrics.avgPromptLength < 150) scores.speedrunner += 1;

  // High Bash/Write usage (execution focused)
  const execToolRatio =
    metrics.toolUsage.total > 0
      ? (metrics.toolUsage.bash + metrics.toolUsage.write) / metrics.toolUsage.total
      : 0;
  if (execToolRatio > 0.4) scores.speedrunner += 3;
  else if (execToolRatio > 0.25) scores.speedrunner += 2;
  else if (execToolRatio > 0.15) scores.speedrunner += 1;

  // Fast cycle time
  if (metrics.avgCycleTimeSeconds < 30) scores.speedrunner += 2;
  else if (metrics.avgCycleTimeSeconds < 60) scores.speedrunner += 1;

  // Low question frequency (just does it)
  if (metrics.questionFrequency < 0.2) scores.speedrunner += 2;
  else if (metrics.questionFrequency < 0.4) scores.speedrunner += 1;

  // ========== CRAFTSMAN SIGNALS ==========
  // High refactor/quality keyword usage
  const qualityKeywordRatio =
    metrics.totalTurns > 0
      ? (metrics.refactorKeywordCount + metrics.styleKeywordCount) /
        metrics.totalTurns
      : 0;
  if (qualityKeywordRatio > 0.3) scores.craftsman += 3;
  else if (qualityKeywordRatio > 0.15) scores.craftsman += 2;
  else if (qualityKeywordRatio > 0.05) scores.craftsman += 1;

  // Quality terms (test, type, doc)
  const qualityTermRatio =
    metrics.totalTurns > 0 ? metrics.qualityTermCount / metrics.totalTurns : 0;
  if (qualityTermRatio > 0.5) scores.craftsman += 3;
  else if (qualityTermRatio > 0.25) scores.craftsman += 2;
  else if (qualityTermRatio > 0.1) scores.craftsman += 1;

  // High Edit tool usage (refinement)
  const editRatio =
    metrics.toolUsage.total > 0
      ? metrics.toolUsage.edit / metrics.toolUsage.total
      : 0;
  if (editRatio > 0.3) scores.craftsman += 2;
  else if (editRatio > 0.15) scores.craftsman += 1;

  // Read usage (understanding before changing)
  if (readGrepRatio > 0.3) scores.craftsman += 1;

  return scores;
}

/**
 * Apply dampening to Architect scores when close to other types.
 * This distinguishes "generally good users" from "true architects"
 * by reducing Architect scores when other types are competitive.
 */
export function applyArchitectDampening(scores: TypeScores): TypeScores {
  const dampened = { ...scores };

  const otherTypes = ['scientist', 'collaborator', 'speedrunner', 'craftsman'] as const;
  const secondHighest = Math.max(...otherTypes.map((t) => scores[t]));

  if (scores.architect > 0 && secondHighest > 0) {
    const architectAdvantage = scores.architect - secondHighest;

    // When Architect is within 3 points of another type, apply dampening
    // This prevents Architect from winning tie-breakers in mixed profiles
    if (architectAdvantage <= 3) {
      const dampeningFactor = architectAdvantage <= 1 ? 0.6 : 0.8;
      dampened.architect = Math.round(scores.architect * dampeningFactor);
    }
  }

  return dampened;
}

/**
 * Convert raw scores to percentage distribution (sum to 100)
 */
export function scoresToDistribution(scores: TypeScores): TypeDistribution {
  // Apply Architect dampening to reduce bias toward "good user" = "architect"
  const dampened = applyArchitectDampening(scores);

  const total =
    dampened.architect +
    dampened.scientist +
    dampened.collaborator +
    dampened.speedrunner +
    dampened.craftsman;

  if (total === 0) {
    // Equal distribution if no signals
    return {
      architect: 20,
      scientist: 20,
      collaborator: 20,
      speedrunner: 20,
      craftsman: 20,
    };
  }

  const distribution: TypeDistribution = {
    architect: Math.round((dampened.architect / total) * 100),
    scientist: Math.round((dampened.scientist / total) * 100),
    collaborator: Math.round((dampened.collaborator / total) * 100),
    speedrunner: Math.round((dampened.speedrunner / total) * 100),
    craftsman: Math.round((dampened.craftsman / total) * 100),
  };

  // Ensure sum is exactly 100 (adjust highest value for rounding errors)
  const sum =
    distribution.architect +
    distribution.scientist +
    distribution.collaborator +
    distribution.speedrunner +
    distribution.craftsman;

  if (sum !== 100) {
    const diff = 100 - sum;
    const highest = getPrimaryType(distribution);
    distribution[highest] += diff;
  }

  return distribution;
}

/**
 * Get the primary (highest scoring) type
 */
export function getPrimaryType(
  distribution: TypeDistribution
): CodingStyleType {
  let maxType: CodingStyleType = 'architect';
  let maxValue = distribution.architect;

  for (const [type, value] of Object.entries(distribution)) {
    if (value > maxValue) {
      maxValue = value;
      maxType = type as CodingStyleType;
    }
  }

  return maxType;
}

/**
 * Get the highlight tool usage for display
 */
export function getToolUsageHighlight(metrics: SessionMetrics): string {
  const { toolUsage } = metrics;

  if (toolUsage.total === 0) return 'No tool usage detected';

  // Find top 2 tools
  const tools = [
    { name: 'Read', count: toolUsage.read },
    { name: 'Grep', count: toolUsage.grep },
    { name: 'Glob', count: toolUsage.glob },
    { name: 'Task', count: toolUsage.task },
    { name: 'Plan', count: toolUsage.plan },
    { name: 'Bash', count: toolUsage.bash },
    { name: 'Write', count: toolUsage.write },
    { name: 'Edit', count: toolUsage.edit },
  ].sort((a, b) => b.count - a.count);

  const top2 = tools.slice(0, 2).filter((t) => t.count > 0);

  if (top2.length === 0) return 'Minimal tool usage';

  return top2
    .map((t) => `${t.name} (${Math.round((t.count / toolUsage.total) * 100)}%)`)
    .join(', ');
}

// ============================================================================
// Helper Functions
// ============================================================================

function countKeywordMatches(text: string, keywords: readonly string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(regex);
    count += matches ? matches.length : 0;
  }
  return count;
}

function countToolUsage(
  messages: ParsedMessage[]
): SessionMetrics['toolUsage'] {
  const usage = {
    read: 0,
    grep: 0,
    glob: 0,
    task: 0,
    plan: 0,
    bash: 0,
    write: 0,
    edit: 0,
    total: 0,
  };

  for (const message of messages) {
    if (!message.toolCalls) continue;

    for (const tool of message.toolCalls) {
      const name = tool.name.toLowerCase();
      usage.total++;

      if (name.includes('read')) usage.read++;
      else if (name.includes('grep')) usage.grep++;
      else if (name.includes('glob')) usage.glob++;
      else if (name.includes('task')) usage.task++;
      else if (name.includes('plan') || name.includes('todo')) usage.plan++;
      else if (name.includes('bash')) usage.bash++;
      else if (name.includes('write')) usage.write++;
      else if (name.includes('edit')) usage.edit++;
    }
  }

  return usage;
}

function calculateAvgCycleTime(messages: ParsedMessage[]): number {
  if (messages.length < 2) return 0;

  let totalTime = 0;
  let cycles = 0;

  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === 'user' && messages[i - 1].role === 'assistant') {
      const diff =
        messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
      totalTime += diff / 1000; // Convert to seconds
      cycles++;
    }
  }

  return cycles > 0 ? totalTime / cycles : 0;
}

function createEmptyMetrics(): SessionMetrics {
  return {
    avgPromptLength: 0,
    avgFirstPromptLength: 0,
    maxPromptLength: 0,
    avgTurnsPerSession: 0,
    totalTurns: 0,
    questionFrequency: 0,
    whyHowWhatCount: 0,
    toolUsage: {
      read: 0,
      grep: 0,
      glob: 0,
      task: 0,
      plan: 0,
      bash: 0,
      write: 0,
      edit: 0,
      total: 0,
    },
    modificationRequestCount: 0,
    modificationRate: 0,
    refactorKeywordCount: 0,
    styleKeywordCount: 0,
    qualityTermCount: 0,
    positiveFeedbackCount: 0,
    negativeFeedbackCount: 0,
    planningKeywordCount: 0,
    stepPatternCount: 0,
    avgCycleTimeSeconds: 0,
    sessionDurationSeconds: 0,
  };
}

function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
