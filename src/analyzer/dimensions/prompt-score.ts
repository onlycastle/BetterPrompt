/**
 * Prompt Engineering Score Dimension
 *
 * Measures how effective a developer's prompts are.
 * Score 0-100: Higher is better.
 *
 * Source: https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
 * "Effective prompting is now a key developer skill"
 */

import { type ParsedSession } from '../../models/index.js';

export interface PromptScoreResult {
  score: number; // 0-100, higher is better
  breakdown: {
    contextProvision: number;
    specificity: number;
    iterationEfficiency: number;
    firstTrySuccess: number;
    constraintClarity: number;
  };
  bestPrompt: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  worstPrompt: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  tips: string[];
  avgPromptLength: number;
  constraintUsageRate: number;
}

/**
 * Calculate Prompt Engineering Score
 */
export function calculatePromptScore(sessions: ParsedSession[]): PromptScoreResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const allPrompts = extractPrompts(sessions);

  if (allPrompts.length === 0) {
    return createDefaultResult();
  }

  // Score each prompt
  const scoredPrompts = allPrompts.map((prompt) => ({
    ...prompt,
    ...scorePrompt(prompt.content),
  }));

  // Calculate aggregate metrics
  const avgContextProvision =
    scoredPrompts.reduce((sum, p) => sum + p.contextScore, 0) / scoredPrompts.length;
  const avgSpecificity =
    scoredPrompts.reduce((sum, p) => sum + p.specificityScore, 0) / scoredPrompts.length;
  const avgConstraintClarity =
    scoredPrompts.reduce((sum, p) => sum + p.constraintScore, 0) / scoredPrompts.length;

  // Calculate iteration efficiency (fewer back-and-forths = better first prompts)
  const iterationEfficiency = calculateIterationEfficiency(sessions);

  // Calculate first-try success rate
  const firstTrySuccess = calculateFirstTrySuccess(sessions);

  // Overall score
  const score = Math.round(
    avgContextProvision * 0.25 +
      avgSpecificity * 0.20 +
      iterationEfficiency * 0.20 +
      firstTrySuccess * 0.20 +
      avgConstraintClarity * 0.15
  );

  // Find best and worst prompts
  const sortedPrompts = [...scoredPrompts].sort((a, b) => b.totalScore - a.totalScore);
  const bestPrompt = sortedPrompts[0];
  const worstPrompt = sortedPrompts[sortedPrompts.length - 1];

  // Generate tips
  const tips = generateTips(
    avgContextProvision,
    avgSpecificity,
    avgConstraintClarity,
    scoredPrompts
  );

  const avgPromptLength =
    scoredPrompts.reduce((sum, p) => sum + p.content.length, 0) / scoredPrompts.length;

  const constraintUsageRate =
    scoredPrompts.filter((p) => p.constraintScore > 50).length / scoredPrompts.length;

  return {
    score,
    breakdown: {
      contextProvision: Math.round(avgContextProvision),
      specificity: Math.round(avgSpecificity),
      iterationEfficiency: Math.round(iterationEfficiency),
      firstTrySuccess: Math.round(firstTrySuccess),
      constraintClarity: Math.round(avgConstraintClarity),
    },
    bestPrompt: bestPrompt
      ? {
          content: truncate(bestPrompt.content, 300),
          score: bestPrompt.totalScore,
          reasons: bestPrompt.positiveReasons,
        }
      : null,
    worstPrompt:
      worstPrompt && worstPrompt.totalScore < 50
        ? {
            content: truncate(worstPrompt.content, 300),
            score: worstPrompt.totalScore,
            reasons: worstPrompt.negativeReasons,
          }
        : null,
    tips,
    avgPromptLength: Math.round(avgPromptLength),
    constraintUsageRate: Math.round(constraintUsageRate * 100),
  };
}

interface ExtractedPrompt {
  content: string;
  timestamp: Date;
  isFirstInSession: boolean;
}

interface ScoredPrompt extends ExtractedPrompt {
  contextScore: number;
  specificityScore: number;
  constraintScore: number;
  totalScore: number;
  positiveReasons: string[];
  negativeReasons: string[];
}

function extractPrompts(sessions: ParsedSession[]): ExtractedPrompt[] {
  const prompts: ExtractedPrompt[] = [];

  for (const session of sessions) {
    let isFirst = true;
    for (const msg of session.messages) {
      if (msg.role === 'user' && msg.content.trim()) {
        prompts.push({
          content: msg.content,
          timestamp: msg.timestamp,
          isFirstInSession: isFirst,
        });
        isFirst = false;
      }
    }
  }

  return prompts;
}

function scorePrompt(content: string): {
  contextScore: number;
  specificityScore: number;
  constraintScore: number;
  totalScore: number;
  positiveReasons: string[];
  negativeReasons: string[];
} {
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  // Context Score (0-100)
  let contextScore = 30; // Base score

  // Length contributes to context
  if (content.length > 200) {
    contextScore += 20;
    positiveReasons.push('Good length - provides context');
  } else if (content.length < 50) {
    negativeReasons.push('Too short - lacks context');
  }

  // Mentions files or paths
  if (/\b(src\/|\.ts|\.js|\.py|file|function|class)\b/i.test(content)) {
    contextScore += 15;
    positiveReasons.push('References specific files/code');
  }

  // Mentions existing patterns
  if (/\b(existing|current|like|similar to|follow|pattern|style)\b/i.test(content)) {
    contextScore += 15;
    positiveReasons.push('References existing patterns');
  }

  // Explains the problem/goal
  if (/\b(because|so that|in order to|need to|want to|goal is)\b/i.test(content)) {
    contextScore += 10;
    positiveReasons.push('Explains the goal');
  }

  // Specificity Score (0-100)
  let specificityScore = 20;

  // Has numbered steps
  if (/\b(1\.|first|step\s*1|then|next|finally)\b/i.test(content)) {
    specificityScore += 30;
    positiveReasons.push('Uses structured steps');
  }

  // Has specific technical terms
  if (
    /\b(api|endpoint|component|hook|state|props|async|await|promise|type|interface)\b/i.test(
      content
    )
  ) {
    specificityScore += 20;
  }

  // Has specific requirements
  if (/\b(must|should|needs to|ensure|make sure|requirement)\b/i.test(content)) {
    specificityScore += 15;
    positiveReasons.push('Specifies requirements');
  }

  // Vague words reduce score
  if (/\b(stuff|thing|somehow|maybe|kind of|sort of)\b/i.test(content)) {
    specificityScore -= 20;
    negativeReasons.push('Uses vague language');
  }

  // Too short = unspecific
  if (content.length < 30) {
    specificityScore -= 30;
    negativeReasons.push('Not specific enough');
  }

  // Constraint Score (0-100)
  let constraintScore = 20;

  // Mentions specific constraints
  const constraintPatterns = [
    /\b(don't|do not|avoid|never|without)\b/i,
    /\b(use only|must use|prefer)\b/i,
    /\b(max|min|limit|within|under|over)\b/i,
    /\b(format|style|convention)\b/i,
    /\b(return|output|expect)\b/i,
  ];

  for (const pattern of constraintPatterns) {
    if (pattern.test(content)) {
      constraintScore += 15;
    }
  }

  if (constraintScore > 20) {
    positiveReasons.push('Includes constraints');
  }

  // Asks for explanation before implementation
  if (/\b(explain|before you|first explain|approach)\b/i.test(content)) {
    constraintScore += 10;
    positiveReasons.push('Asks for approach first');
  }

  // Cap scores at 100
  contextScore = Math.min(100, Math.max(0, contextScore));
  specificityScore = Math.min(100, Math.max(0, specificityScore));
  constraintScore = Math.min(100, Math.max(0, constraintScore));

  const totalScore = Math.round(
    contextScore * 0.4 + specificityScore * 0.35 + constraintScore * 0.25
  );

  return {
    contextScore,
    specificityScore,
    constraintScore,
    totalScore,
    positiveReasons,
    negativeReasons,
  };
}

function calculateIterationEfficiency(sessions: ParsedSession[]): number {
  if (sessions.length === 0) return 50;

  // Calculate average turns per session
  // Fewer turns for same result = more efficient first prompts
  const avgTurns =
    sessions.reduce((sum, s) => {
      const userMessages = s.messages.filter((m) => m.role === 'user').length;
      return sum + userMessages;
    }, 0) / sessions.length;

  // Ideal is 3-5 turns, more than 8 is inefficient
  if (avgTurns <= 3) return 90;
  if (avgTurns <= 5) return 80;
  if (avgTurns <= 8) return 60;
  if (avgTurns <= 12) return 40;
  return 20;
}

function calculateFirstTrySuccess(sessions: ParsedSession[]): number {
  if (sessions.length === 0) return 50;

  // Look for patterns that indicate first-try success:
  // - Short sessions (1-2 turns)
  // - No correction patterns
  // - Positive feedback early

  let successfulSessions = 0;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const firstFewMessages = userMessages.slice(0, 3);

    // Check for correction patterns in first few messages
    const hasCorrection = firstFewMessages.some((m) =>
      /\b(wrong|no|fix|error|incorrect|that's not|actually)\b/i.test(m.content)
    );

    // Check for positive feedback
    const hasPositive = firstFewMessages.some((m) =>
      /\b(great|perfect|thanks|good|nice|excellent|yes)\b/i.test(m.content)
    );

    // Short session or positive feedback without corrections = success
    if ((userMessages.length <= 2 && !hasCorrection) || (hasPositive && !hasCorrection)) {
      successfulSessions++;
    }
  }

  return Math.round((successfulSessions / sessions.length) * 100);
}

function generateTips(
  contextScore: number,
  specificityScore: number,
  constraintScore: number,
  prompts: ScoredPrompt[]
): string[] {
  const tips: string[] = [];
  const avgLength =
    prompts.reduce((sum, p) => sum + p.content.length, 0) / prompts.length;

  if (avgLength < 150) {
    tips.push(
      `Your prompts average ${Math.round(avgLength)} chars. Top performers average 280 chars.`
    );
  }

  if (constraintScore < 50) {
    const constraintRate =
      prompts.filter((p) => p.constraintScore > 50).length / prompts.length;
    tips.push(
      `You include constraints in ${Math.round(constraintRate * 100)}% of prompts (vs 78% for top 10%).`
    );
  }

  if (specificityScore < 60) {
    tips.push('Try: "Before implementing, explain your approach in 2-3 sentences"');
  }

  if (contextScore < 60) {
    tips.push('Try: Reference existing code files when asking for new features.');
  }

  return tips.slice(0, 3); // Max 3 tips
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function createDefaultResult(): PromptScoreResult {
  return {
    score: 50,
    breakdown: {
      contextProvision: 50,
      specificity: 50,
      iterationEfficiency: 50,
      firstTrySuccess: 50,
      constraintClarity: 50,
    },
    bestPrompt: null,
    worstPrompt: null,
    tips: ['Complete more sessions for personalized tips.'],
    avgPromptLength: 0,
    constraintUsageRate: 0,
  };
}
