/**
 * AI Control Index Dimension
 *
 * Measures how effectively a developer controls AI output vs. passively accepting it.
 * Score 0-100: Higher is better (more control over AI).
 *
 * Based on research:
 * - elvis: "Professional developers don't vibe, they control"
 * - VCP Paper (arXiv:2601.02410): Cognitive offloading measurement
 * - Anthropic: Critical verification patterns
 *
 * This distinguishes "Vibe Coders" (high AI dependency) from "AI Masters" (strategic AI control).
 */

import { type ParsedSession } from '../../models/index';
import { countMatches, hasMatch, PATTERNS } from './pattern-utils';

export type AIControlLevel = 'vibe-coder' | 'developing' | 'ai-master';

export interface AIControlResult {
  score: number; // 0-100, higher = more control
  level: AIControlLevel;
  breakdown: {
    verificationRate: number; // Rate of output verification/modification (35%)
    constraintSpecification: number; // Rate of constraint definition (25%)
    outputCritique: number; // Rate of critical feedback (25%)
    contextControl: number; // Context management capability (15%)
  };
  signals: string[];
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

/**
 * Calculate AI Control Index
 */
export function calculateAIControl(sessions: ParsedSession[]): AIControlResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const metrics = extractControlMetrics(sessions);

  // Calculate component scores (0-100 each)
  const verificationScore = calculateVerificationScore(metrics);
  const constraintScore = calculateConstraintScore(metrics);
  const critiqueScore = calculateCritiqueScore(metrics);
  const contextScore = calculateContextControlScore(metrics);

  // Weighted average
  const score = Math.round(
    verificationScore * 0.35 +
      constraintScore * 0.25 +
      critiqueScore * 0.25 +
      contextScore * 0.15
  );

  const signals = identifySignals(metrics);
  const strengths = identifyStrengths(metrics, {
    verificationScore,
    constraintScore,
    critiqueScore,
    contextScore,
  });
  const growthAreas = identifyGrowthAreas(metrics, {
    verificationScore,
    constraintScore,
    critiqueScore,
    contextScore,
  });

  return {
    score,
    level: getLevel(score),
    breakdown: {
      verificationRate: Math.round(verificationScore),
      constraintSpecification: Math.round(constraintScore),
      outputCritique: Math.round(critiqueScore),
      contextControl: Math.round(contextScore),
    },
    signals,
    strengths,
    growthAreas,
    interpretation: getInterpretation(score, metrics),
  };
}

interface ControlMetrics {
  // Verification
  modificationRequests: number;
  reviewRequests: number;
  questionCount: number;

  // Constraints
  constraintKeywords: number;
  requirementStatements: number;

  // Critique
  correctionCount: number;
  rejectionCount: number;
  alternativeRequests: number;

  // Context Control
  compactUsage: number;
  freshSessionStarts: number;
  subagentDelegations: number;

  // Totals
  totalUserMessages: number;
  totalTurns: number;
  totalSessions: number;
}

function extractControlMetrics(sessions: ParsedSession[]): ControlMetrics {
  let modificationRequests = 0;
  let reviewRequests = 0;
  let questionCount = 0;

  let constraintKeywords = 0;
  let requirementStatements = 0;

  let correctionCount = 0;
  let rejectionCount = 0;
  let alternativeRequests = 0;

  let compactUsage = 0;
  let freshSessionStarts = 0;
  let subagentDelegations = 0;

  let totalUserMessages = 0;
  let totalTurns = 0;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
    totalUserMessages += userMessages.length;
    totalTurns += Math.min(userMessages.length, assistantMessages.length);

    // Check if this looks like a fresh start (first message is specific/detailed)
    if (userMessages.length > 0) {
      const firstMsg = userMessages[0].content;
      if (firstMsg.length > 200 || hasMatch(firstMsg, PATTERNS.detailedStart)) {
        freshSessionStarts++;
      }
    }

    for (const msg of userMessages) {
      const content = msg.content;
      const lowerContent = content.toLowerCase();

      // Verification patterns
      modificationRequests += countMatches(content, PATTERNS.modificationRequest);
      reviewRequests += countMatches(content, PATTERNS.review);
      questionCount += countMatches(content, PATTERNS.question);

      // Constraint patterns
      constraintKeywords += countMatches(content, PATTERNS.constraintsFull);
      requirementStatements += countMatches(content, PATTERNS.requirement);

      // Critique patterns
      correctionCount += countMatches(lowerContent, PATTERNS.correction);
      rejectionCount += countMatches(lowerContent, PATTERNS.rejection);
      alternativeRequests += countMatches(lowerContent, PATTERNS.alternative);

      // Context control patterns
      compactUsage += countMatches(content, PATTERNS.compactCommand);
      subagentDelegations += countMatches(lowerContent, PATTERNS.subagent);
    }

    // Count Task tool usage from assistant messages
    for (const msg of assistantMessages) {
      if (msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          if (tool.name.toLowerCase() === 'task') {
            subagentDelegations++;
          }
        }
      }
    }
  }

  return {
    modificationRequests,
    reviewRequests,
    questionCount,
    constraintKeywords,
    requirementStatements,
    correctionCount,
    rejectionCount,
    alternativeRequests,
    compactUsage,
    freshSessionStarts,
    subagentDelegations,
    totalUserMessages,
    totalTurns,
    totalSessions: sessions.length,
  };
}

function calculateVerificationScore(metrics: ControlMetrics): number {
  if (metrics.totalTurns === 0) return 50;

  // Verification rate = (modifications + reviews + questions) / total turns
  const verificationActions =
    metrics.modificationRequests + metrics.reviewRequests + metrics.questionCount;
  const verificationRate = verificationActions / metrics.totalTurns;

  // Target: ~50% of turns should have verification (elvis: "50% modification rate is professional")
  // Score peaks at 50% verification rate, drops slightly above/below
  if (verificationRate >= 0.4 && verificationRate <= 0.6) {
    return 100;
  } else if (verificationRate >= 0.3 && verificationRate <= 0.7) {
    return 80;
  } else if (verificationRate >= 0.2 && verificationRate <= 0.8) {
    return 60;
  } else if (verificationRate >= 0.1) {
    return 40;
  }
  return 20;
}

function calculateConstraintScore(metrics: ControlMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // Constraint rate per message
  const constraintRate =
    (metrics.constraintKeywords + metrics.requirementStatements) / metrics.totalUserMessages;

  // Target: ~1-2 constraints per message is good
  return Math.min(Math.round(constraintRate * 50), 100);
}

function calculateCritiqueScore(metrics: ControlMetrics): number {
  if (metrics.totalTurns === 0) return 50;

  // Critique rate = (corrections + rejections + alternatives) / turns
  const critiqueActions =
    metrics.correctionCount + metrics.rejectionCount + metrics.alternativeRequests;
  const critiqueRate = critiqueActions / metrics.totalTurns;

  // Some critique is good (shows engagement), but too much might indicate problems
  // Target: 10-30% critique rate
  if (critiqueRate >= 0.1 && critiqueRate <= 0.3) {
    return 100;
  } else if (critiqueRate >= 0.05 && critiqueRate <= 0.4) {
    return 70;
  } else if (critiqueRate > 0) {
    return 50;
  }
  return 30; // No critique at all might mean passive acceptance
}

function calculateContextControlScore(metrics: ControlMetrics): number {
  // Context control indicators
  const compactBonus = Math.min(metrics.compactUsage * 20, 40);
  const freshSessionBonus = Math.min(
    (metrics.freshSessionStarts / metrics.totalSessions) * 30,
    30
  );
  const delegationBonus = Math.min(metrics.subagentDelegations * 5, 30);

  return Math.min(compactBonus + freshSessionBonus + delegationBonus, 100);
}

function getLevel(score: number): AIControlLevel {
  if (score >= 65) return 'ai-master';
  if (score >= 35) return 'developing';
  return 'vibe-coder';
}

interface ComponentScores {
  verificationScore: number;
  constraintScore: number;
  critiqueScore: number;
  contextScore: number;
}

function identifySignals(metrics: ControlMetrics): string[] {
  const signals: string[] = [];

  if (metrics.modificationRequests > 5) {
    signals.push(`${metrics.modificationRequests} modification requests - active output refinement`);
  }
  if (metrics.correctionCount > 3) {
    signals.push(`${metrics.correctionCount} corrections made - catching AI errors`);
  }
  if (metrics.constraintKeywords > 10) {
    signals.push(`${metrics.constraintKeywords} constraints specified - clear requirements`);
  }
  if (metrics.compactUsage > 0) {
    signals.push(`${metrics.compactUsage} /compact uses - managing context proactively`);
  }
  if (metrics.alternativeRequests > 2) {
    signals.push(`${metrics.alternativeRequests} alternative requests - exploring options`);
  }
  if (metrics.subagentDelegations > 3) {
    signals.push(`${metrics.subagentDelegations} subagent delegations - orchestrating AI`);
  }

  return signals.slice(0, 5);
}

function identifyStrengths(metrics: ControlMetrics, scores: ComponentScores): string[] {
  const strengths: string[] = [];

  if (scores.verificationScore >= 70) {
    strengths.push('Strong verification habits - you actively review and refine AI output');
  }
  if (scores.constraintScore >= 70) {
    strengths.push('Clear constraint definition - you set explicit boundaries for AI');
  }
  if (scores.critiqueScore >= 70) {
    strengths.push('Healthy skepticism - you catch errors and request alternatives');
  }
  if (scores.contextScore >= 70) {
    strengths.push('Excellent context management - you use /compact and subagents effectively');
  }

  if (metrics.modificationRequests > 10) {
    strengths.push('Iterative refinement - you shape AI output through feedback');
  }
  if (metrics.correctionCount > 5) {
    strengths.push('Error detection - you catch and correct AI mistakes');
  }

  return strengths.slice(0, 4);
}

function identifyGrowthAreas(metrics: ControlMetrics, scores: ComponentScores): string[] {
  const growthAreas: string[] = [];

  if (scores.verificationScore < 40) {
    growthAreas.push('Try reviewing AI output more critically before accepting');
  }
  if (scores.constraintScore < 40) {
    growthAreas.push('Specify constraints explicitly (must, should not, required, etc.)');
  }
  if (scores.critiqueScore < 40) {
    growthAreas.push('Don\'t hesitate to say "no" or request alternatives');
  }
  if (scores.contextScore < 40) {
    growthAreas.push('Use /compact to manage context and Task tool to delegate');
  }

  if (metrics.alternativeRequests === 0) {
    growthAreas.push('Try asking for alternative approaches before accepting the first solution');
  }
  if (metrics.questionCount < 5) {
    growthAreas.push('Ask more clarifying questions to validate AI assumptions');
  }

  return growthAreas.slice(0, 4);
}

function getInterpretation(score: number, metrics: ControlMetrics): string {
  if (score >= 65) {
    return `AI Master! You effectively control AI output with ${metrics.modificationRequests} modifications and ${metrics.constraintKeywords} constraints. You're directing AI as a tool, not following it blindly.`;
  }
  if (score >= 35) {
    return `Developing control over AI. You show some verification habits but could be more deliberate about constraints and critiquing output. Remember: professionals modify ~50% of AI suggestions.`;
  }
  return `High AI dependency detected. You may be accepting AI output too passively. Try adding explicit constraints, questioning assumptions, and requesting alternatives. Small changes can dramatically improve code quality.`;
}

function createDefaultResult(): AIControlResult {
  return {
    score: 50,
    level: 'developing',
    breakdown: {
      verificationRate: 50,
      constraintSpecification: 50,
      outputCritique: 50,
      contextControl: 50,
    },
    signals: [],
    strengths: [],
    growthAreas: ['Complete more sessions to measure your AI control patterns'],
    interpretation:
      'Not enough data to calculate AI Control Index. Complete more sessions for accurate analysis.',
  };
}
