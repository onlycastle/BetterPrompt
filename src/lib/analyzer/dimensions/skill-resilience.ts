/**
 * Skill Resilience Dimension
 *
 * Measures a developer's ability to code independently without AI assistance.
 * Score 0-100: Higher is better (more resilient skills).
 *
 * Based on VCP Paper (arXiv:2601.02410) metrics:
 * - M_CSR (Cold Start Refactor): Ability to start coding without AI help
 * - M_HT (Hallucination Trap Detection): Ability to catch AI errors
 * - E_gap (Explainability Gap): Ability to understand and explain code
 *
 * MIT Technology Review: "Skill atrophy is a real concern" with AI coding tools.
 */

import { type ParsedSession } from '../../models/index';
import { countMatches, hasMatch, PATTERNS } from './pattern-utils';

export type SkillResilienceLevel = 'at-risk' | 'developing' | 'resilient';

export interface SkillResilienceResult {
  score: number; // 0-100, higher = more resilient
  level: SkillResilienceLevel;
  breakdown: {
    coldStartCapability: number; // M_CSR: Can start coding without AI (40%)
    hallucinationDetection: number; // M_HT: Can catch AI errors (35%)
    explainabilityGap: number; // E_gap: Understands the code (25%)
  };
  warnings: string[];
  recommendations: string[];
  interpretation: string;
  vpcMetrics: {
    m_csr: number; // 0-1 scale (VCP paper format)
    m_ht: number; // 0-1 scale
    e_gap: number; // 0-1 scale (inverted: lower is better)
  };
}

/**
 * Calculate Skill Resilience Score
 */
export function calculateSkillResilience(sessions: ParsedSession[]): SkillResilienceResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const metrics = extractResilienceMetrics(sessions);

  // Calculate component scores (0-100 each)
  const csrScore = calculateColdStartScore(metrics);
  const htScore = calculateHallucinationDetectionScore(metrics);
  const egapScore = calculateExplainabilityScore(metrics);

  // Weighted average (VCP paper weights)
  const score = Math.round(csrScore * 0.4 + htScore * 0.35 + egapScore * 0.25);

  const warnings = identifyWarnings(metrics, { csrScore, htScore, egapScore });
  const recommendations = generateRecommendations(metrics, { csrScore, htScore, egapScore });

  return {
    score,
    level: getLevel(score),
    breakdown: {
      coldStartCapability: Math.round(csrScore),
      hallucinationDetection: Math.round(htScore),
      explainabilityGap: Math.round(egapScore),
    },
    warnings,
    recommendations,
    interpretation: getInterpretation(score, metrics),
    vpcMetrics: {
      m_csr: csrScore / 100,
      m_ht: htScore / 100,
      e_gap: 1 - egapScore / 100, // Inverted: lower gap is better
    },
  };
}

interface ResilienceMetrics {
  // Cold Start Capability (M_CSR)
  detailedFirstPrompts: number; // Sessions starting with detailed prompts
  vagueFirstPrompts: number; // Sessions starting with vague "help me" prompts
  codeInFirstPrompt: number; // Sessions where user provides code context first

  // Hallucination Detection (M_HT)
  errorCorrections: number; // Times user corrected AI errors
  factualChallenges: number; // Times user challenged AI claims
  hallucinationMentions: number; // Direct mentions of hallucination/wrong

  // Explainability Gap (E_gap) - INVERTED (lower gap = better)
  explanationRequests: number; // "Explain this code" requests (high = dependent)
  whatDoesThisDoQuestions: number; // "What does this do?" questions
  selfExplanations: number; // User explaining their own understanding (good)

  // Totals
  totalSessions: number;
  totalUserMessages: number;
  totalTurns: number;
}

function extractResilienceMetrics(sessions: ParsedSession[]): ResilienceMetrics {
  let detailedFirstPrompts = 0;
  let vagueFirstPrompts = 0;
  let codeInFirstPrompt = 0;

  let errorCorrections = 0;
  let factualChallenges = 0;
  let hallucinationMentions = 0;

  let explanationRequests = 0;
  let whatDoesThisDoQuestions = 0;
  let selfExplanations = 0;

  let totalUserMessages = 0;
  let totalTurns = 0;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
    totalUserMessages += userMessages.length;
    totalTurns += Math.min(userMessages.length, assistantMessages.length);

    // Analyze first prompt (Cold Start indicator)
    if (userMessages.length > 0) {
      const firstMsg = userMessages[0].content;

      // Check if first prompt is detailed (shows independent thinking)
      if (hasMatch(firstMsg, PATTERNS.detailedStart) && firstMsg.length > 100) {
        detailedFirstPrompts++;
      } else if (hasMatch(firstMsg, PATTERNS.vagueStart) && firstMsg.length < 50) {
        vagueFirstPrompts++;
      }

      // Check if user provides code context
      if (hasMatch(firstMsg, PATTERNS.codeBlock)) {
        codeInFirstPrompt++;
      }
    }

    // Analyze all user messages
    for (const msg of userMessages) {
      const content = msg.content;
      const lowerContent = content.toLowerCase();

      // Error corrections (M_HT)
      errorCorrections += countMatches(lowerContent, PATTERNS.correction);

      // Factual challenges (M_HT)
      factualChallenges += countMatches(lowerContent, PATTERNS.factualChallenge);

      // Hallucination mentions (M_HT)
      hallucinationMentions += countMatches(lowerContent, PATTERNS.hallucination);

      // Explanation requests (E_gap - negative indicator)
      explanationRequests += countMatches(content, PATTERNS.explanationRequest);

      // "What does this" questions (E_gap - negative indicator)
      whatDoesThisDoQuestions += countMatches(lowerContent, PATTERNS.whatDoes);

      // Self-explanations (E_gap - positive indicator)
      selfExplanations += countMatches(lowerContent, PATTERNS.selfExplanation);
    }
  }

  return {
    detailedFirstPrompts,
    vagueFirstPrompts,
    codeInFirstPrompt,
    errorCorrections,
    factualChallenges,
    hallucinationMentions,
    explanationRequests,
    whatDoesThisDoQuestions,
    selfExplanations,
    totalSessions: sessions.length,
    totalUserMessages,
    totalTurns,
  };
}

function calculateColdStartScore(metrics: ResilienceMetrics): number {
  if (metrics.totalSessions === 0) return 50;

  // M_CSR: Can you start coding without AI hand-holding?
  const detailedRate = metrics.detailedFirstPrompts / metrics.totalSessions;
  const vagueRate = metrics.vagueFirstPrompts / metrics.totalSessions;
  const codeContextRate = metrics.codeInFirstPrompt / metrics.totalSessions;

  // Higher detailed starts + code context = better cold start capability
  // Lower vague starts = better
  const rawScore = detailedRate * 0.5 + codeContextRate * 0.3 + (1 - vagueRate) * 0.2;

  return Math.min(Math.round(rawScore * 100), 100);
}

function calculateHallucinationDetectionScore(metrics: ResilienceMetrics): number {
  if (metrics.totalTurns === 0) return 50;

  // M_HT: Can you catch AI errors?
  const detectionActions =
    metrics.errorCorrections + metrics.factualChallenges + metrics.hallucinationMentions;
  const detectionRate = detectionActions / metrics.totalTurns;

  // Some detection is expected and healthy (10-30% of turns)
  // Too little might mean blind acceptance, too much might mean AI is failing
  if (detectionRate >= 0.1 && detectionRate <= 0.3) {
    return 90;
  } else if (detectionRate >= 0.05 && detectionRate <= 0.4) {
    return 70;
  } else if (detectionRate > 0) {
    return 50;
  }
  return 30; // No corrections at all is concerning
}

function calculateExplainabilityScore(metrics: ResilienceMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // E_gap: Do you understand the code you're working with?
  // High explanation requests = gap in understanding (bad)
  // Self-explanations = showing understanding (good)

  const explanationRate =
    (metrics.explanationRequests + metrics.whatDoesThisDoQuestions) / metrics.totalUserMessages;
  const selfExplanationRate = metrics.selfExplanations / metrics.totalUserMessages;

  // Lower explanation requests + higher self-explanations = better
  const rawScore = (1 - Math.min(explanationRate, 1)) * 0.6 + Math.min(selfExplanationRate * 3, 1) * 0.4;

  return Math.min(Math.round(rawScore * 100), 100);
}

function getLevel(score: number): SkillResilienceLevel {
  if (score >= 70) return 'resilient';
  if (score >= 40) return 'developing';
  return 'at-risk';
}

interface ComponentScores {
  csrScore: number;
  htScore: number;
  egapScore: number;
}

function identifyWarnings(metrics: ResilienceMetrics, scores: ComponentScores): string[] {
  const warnings: string[] = [];

  if (scores.csrScore < 40) {
    warnings.push(
      'Low cold-start capability - you may struggle to begin coding without AI'
    );
  }

  if (scores.htScore < 40) {
    warnings.push(
      'Low hallucination detection - AI errors might slip through unnoticed'
    );
  }

  if (scores.egapScore < 40) {
    warnings.push(
      'High explainability gap - you may not fully understand the code being generated'
    );
  }

  if (metrics.vagueFirstPrompts > metrics.detailedFirstPrompts) {
    warnings.push(
      'Most sessions start vaguely - try specifying requirements upfront'
    );
  }

  if (metrics.errorCorrections === 0 && metrics.totalTurns > 20) {
    warnings.push(
      'No AI errors caught - either AI is perfect or you may be missing mistakes'
    );
  }

  if (metrics.explanationRequests > metrics.totalUserMessages * 0.3) {
    warnings.push(
      'Frequent explanation requests - consider studying the codebase independently'
    );
  }

  return warnings.slice(0, 4);
}

function generateRecommendations(
  metrics: ResilienceMetrics,
  scores: ComponentScores
): string[] {
  const recommendations: string[] = [];

  // Cold Start recommendations
  if (scores.csrScore < 60) {
    recommendations.push(
      'Practice "cold starts": Before asking AI, write out your requirements first'
    );
    recommendations.push(
      'Try starting with your own pseudocode or outline before asking for implementation'
    );
  }

  // Hallucination Detection recommendations
  if (scores.htScore < 60) {
    recommendations.push(
      'Use "Inverted TDD": Write tests first, then ask AI to implement - tests catch errors'
    );
    recommendations.push(
      'Challenge AI claims: Ask "Are you sure?" or "Verify this" for important statements'
    );
  }

  // Explainability recommendations
  if (scores.egapScore < 60) {
    recommendations.push(
      'Before using generated code, explain it to yourself line by line'
    );
    recommendations.push(
      'Spend 10 minutes daily reading code without AI - it builds understanding'
    );
  }

  // General resilience
  if (metrics.selfExplanations === 0) {
    recommendations.push(
      'Share your understanding with AI ("I think this works because...") to validate'
    );
  }

  return recommendations.slice(0, 4);
}

function getInterpretation(score: number, metrics: ResilienceMetrics): string {
  if (score >= 70) {
    return `Resilient skills! You can code independently (${metrics.detailedFirstPrompts} detailed starts), catch AI errors (${metrics.errorCorrections} corrections), and understand the code. You're using AI as a tool, not a crutch.`;
  }
  if (score >= 40) {
    return `Developing resilience. You show some independence but could strengthen your skills. Try the "cold start" practice: write requirements and pseudocode before involving AI. This builds the muscle memory you need.`;
  }
  return `Skill atrophy risk detected. Heavy AI reliance may be weakening your coding fundamentals. The VCP research shows this is common but reversible. Try: 1) Write specs before asking AI, 2) Explain generated code to yourself, 3) Catch at least one AI error per session.`;
}

function createDefaultResult(): SkillResilienceResult {
  return {
    score: 50,
    level: 'developing',
    breakdown: {
      coldStartCapability: 50,
      hallucinationDetection: 50,
      explainabilityGap: 50,
    },
    warnings: [],
    recommendations: ['Complete more sessions to measure your skill resilience'],
    interpretation:
      'Not enough data to calculate Skill Resilience. Complete more sessions for accurate analysis.',
    vpcMetrics: {
      m_csr: 0.5,
      m_ht: 0.5,
      e_gap: 0.5,
    },
  };
}
