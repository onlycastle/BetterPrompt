/**
 * Context Engineering Score Dimension
 *
 * Measures how effectively a developer manages AI context.
 * Score 0-100: Higher is better.
 *
 * Based on the 4 core strategies from industry research:
 * - WRITE (Preserve) - Preserve information for AI (30%)
 * - SELECT (Retrieve) - Retrieve relevant context (25%)
 * - COMPRESS (Reduce) - Reduce token usage efficiently (25%)
 * - ISOLATE (Partition) - Partition work across agents (20%)
 *
 * Sources:
 * - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
 * - https://blog.langchain.dev/context-engineering-for-agents/
 * - Andrej Karpathy: "The delicate art and science of filling the context window with just the right information"
 */

import { type ParsedSession } from '../../models/index';
import { countMatches, filterPascalCaseMatches, PATTERNS } from './pattern-utils';

export interface ContextEngineeringResult {
  score: number; // 0-100, higher is better
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  breakdown: {
    // WRITE (Preserve) - 30% weight
    write: {
      score: number;
      fileReferences: number;
      codeElementReferences: number;
      constraintsMentioned: number;
      patternReferences: number;
    };
    // SELECT (Retrieve) - 25% weight
    select: {
      score: number;
      specificity: number;
      codebaseNavigation: number; // file:line references
      existingPatternUsage: number;
    };
    // COMPRESS (Reduce) - 25% weight
    compress: {
      score: number;
      compactUsageCount: number;
      iterationEfficiency: number;
      avgTurnsPerSession: number;
    };
    // ISOLATE (Partition) - 20% weight
    isolate: {
      score: number;
      taskToolUsage: number;
      multiAgentDelegation: number;
      focusedPrompts: number;
    };
  };
  bestExample: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  worstExample: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  tips: string[];
  interpretation: string;
}

/**
 * Calculate Context Engineering Score
 */
export function calculateContextEngineering(sessions: ParsedSession[]): ContextEngineeringResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const metrics = extractContextMetrics(sessions);
  const prompts = extractPrompts(sessions);

  if (prompts.length === 0) {
    return createDefaultResult();
  }

  // Score each prompt for best/worst examples
  const scoredPrompts = prompts.map((prompt) => ({
    ...prompt,
    ...scorePrompt(prompt.content),
  }));

  // Calculate category scores (0-100 each)
  const writeScore = calculateWriteScore(metrics);
  const selectScore = calculateSelectScore(metrics, scoredPrompts);
  const compressScore = calculateCompressScore(metrics, sessions);
  const isolateScore = calculateIsolateScore(metrics, scoredPrompts);

  // Weighted average: WRITE 30%, SELECT 25%, COMPRESS 25%, ISOLATE 20%
  const score = Math.round(
    writeScore * 0.30 +
    selectScore * 0.25 +
    compressScore * 0.25 +
    isolateScore * 0.20
  );

  // Find best and worst prompts
  const sortedPrompts = [...scoredPrompts].sort((a, b) => b.totalScore - a.totalScore);
  const bestPrompt = sortedPrompts[0];
  const worstPrompt = sortedPrompts[sortedPrompts.length - 1];

  // Generate tips
  const tips = generateTips(writeScore, selectScore, compressScore, isolateScore, metrics);

  return {
    score,
    level: getLevel(score),
    breakdown: {
      write: {
        score: writeScore,
        fileReferences: metrics.fileReferences,
        codeElementReferences: metrics.codeElementReferences,
        constraintsMentioned: metrics.constraintsMentioned,
        patternReferences: metrics.patternReferences,
      },
      select: {
        score: selectScore,
        specificity: Math.round(
          scoredPrompts.reduce((sum, p) => sum + p.specificityScore, 0) / scoredPrompts.length
        ),
        codebaseNavigation: metrics.fileLineReferences,
        existingPatternUsage: metrics.patternReferences,
      },
      compress: {
        score: compressScore,
        compactUsageCount: metrics.compactUsageCount,
        iterationEfficiency: calculateIterationEfficiency(sessions),
        avgTurnsPerSession: calculateAvgTurns(sessions),
      },
      isolate: {
        score: isolateScore,
        taskToolUsage: metrics.taskToolUsage,
        multiAgentDelegation: metrics.multiAgentSessions,
        focusedPrompts: countFocusedPrompts(scoredPrompts),
      },
    },
    bestExample: bestPrompt
      ? {
          content: truncate(bestPrompt.content, 300),
          score: bestPrompt.totalScore,
          reasons: bestPrompt.positiveReasons,
        }
      : null,
    worstExample:
      worstPrompt && worstPrompt.totalScore < 50
        ? {
            content: truncate(worstPrompt.content, 300),
            score: worstPrompt.totalScore,
            reasons: worstPrompt.negativeReasons,
          }
        : null,
    tips,
    interpretation: getInterpretation(score, { writeScore, selectScore, compressScore, isolateScore }),
  };
}

interface ContextMetrics {
  // WRITE metrics
  fileReferences: number;
  codeElementReferences: number;
  constraintsMentioned: number;
  patternReferences: number;
  totalUserMessages: number;

  // SELECT metrics
  fileLineReferences: number;

  // COMPRESS metrics
  compactUsageCount: number;

  // ISOLATE metrics
  taskToolUsage: number;
  multiAgentSessions: number;
}

function extractContextMetrics(sessions: ParsedSession[]): ContextMetrics {
  let fileReferences = 0;
  let fileLineReferences = 0;
  let codeElementReferences = 0;
  let constraintsMentioned = 0;
  let patternReferences = 0;
  let totalUserMessages = 0;
  let compactUsageCount = 0;
  let taskToolUsage = 0;
  let multiAgentSessions = 0;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
    totalUserMessages += userMessages.length;

    // Analyze user messages
    for (const msg of userMessages) {
      const content = msg.content;
      const lowerContent = content.toLowerCase();

      // WRITE metrics
      fileReferences += countMatches(content, PATTERNS.filePath);
      codeElementReferences += countMatches(content, PATTERNS.codeElement);

      // PascalCase identifiers (SessionParser, ContentBlock, etc.)
      const pascalMatches = content.match(PATTERNS.pascalCase);
      if (pascalMatches) {
        codeElementReferences += filterPascalCaseMatches(pascalMatches).length;
      }

      constraintsMentioned += countMatches(lowerContent, PATTERNS.constraints);
      patternReferences += countMatches(lowerContent, PATTERNS.patterns);

      // SELECT metrics
      fileLineReferences += countMatches(content, PATTERNS.fileLine);

      // COMPRESS metrics
      compactUsageCount += countMatches(content, PATTERNS.compactCommand);
    }

    // Analyze assistant tool usage for ISOLATE metrics
    for (const msg of assistantMessages) {
      if (msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          const name = tool.name.toLowerCase();

          if (name === 'task') {
            taskToolUsage++;

            // Check for subagent type in input
            const input = JSON.stringify(tool.input || {}).toLowerCase();
            if (input.includes('subagent') || input.includes('agent')) {
              multiAgentSessions++;
            }
          }
        }
      }
    }
  }

  return {
    fileReferences,
    fileLineReferences,
    codeElementReferences,
    constraintsMentioned,
    patternReferences,
    totalUserMessages,
    compactUsageCount,
    taskToolUsage,
    multiAgentSessions,
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
  isFocused: boolean;
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
  isFocused: boolean;
} {
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  // Context Score (0-100) - for WRITE
  let contextScore = 30;

  if (content.length > 200) {
    contextScore += 20;
    positiveReasons.push('Good length - provides context');
  } else if (content.length < 50) {
    negativeReasons.push('Too short - lacks context');
  }

  if (/\b(src\/|\.ts|\.js|\.py|file|function|class)\b/i.test(content)) {
    contextScore += 15;
    positiveReasons.push('References specific files/code');
  }

  if (/\b(existing|current|like|similar to|follow|pattern|style)\b/i.test(content)) {
    contextScore += 15;
    positiveReasons.push('References existing patterns');
  }

  if (/\b(because|so that|in order to|need to|want to|goal is)\b/i.test(content)) {
    contextScore += 10;
    positiveReasons.push('Explains the goal');
  }

  // Specificity Score (0-100) - for SELECT
  let specificityScore = 20;

  if (/\b(1\.|first|step\s*1|then|next|finally)\b/i.test(content)) {
    specificityScore += 30;
    positiveReasons.push('Uses structured steps');
  }

  if (/\b(api|endpoint|component|hook|state|props|async|await|promise|type|interface)\b/i.test(content)) {
    specificityScore += 20;
  }

  if (/\b(must|should|needs to|ensure|make sure|requirement)\b/i.test(content)) {
    specificityScore += 15;
    positiveReasons.push('Specifies requirements');
  }

  if (/\b(stuff|thing|somehow|maybe|kind of|sort of)\b/i.test(content)) {
    specificityScore -= 20;
    negativeReasons.push('Uses vague language');
  }

  if (content.length < 30) {
    specificityScore -= 30;
    negativeReasons.push('Not specific enough');
  }

  // Constraint Score (0-100)
  let constraintScore = 20;

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

  if (/\b(explain|before you|first explain|approach)\b/i.test(content)) {
    constraintScore += 10;
    positiveReasons.push('Asks for approach first');
  }

  // Cap scores
  contextScore = Math.min(100, Math.max(0, contextScore));
  specificityScore = Math.min(100, Math.max(0, specificityScore));
  constraintScore = Math.min(100, Math.max(0, constraintScore));

  const totalScore = Math.round(
    contextScore * 0.4 + specificityScore * 0.35 + constraintScore * 0.25
  );

  // Determine if prompt is focused (single concern vs multiple)
  const hasSingleConcern = !(/\b(also|and also|additionally|plus|another thing)\b/i.test(content));
  const isFocused = hasSingleConcern || content.length < 150;

  return {
    contextScore,
    specificityScore,
    constraintScore,
    totalScore,
    positiveReasons,
    negativeReasons,
    isFocused,
  };
}

/**
 * WRITE Score: How well you preserve information for AI
 */
function calculateWriteScore(metrics: ContextMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // Normalize per message
  const fileRefRate = Math.min(metrics.fileReferences / metrics.totalUserMessages, 2);
  const codeElementRate = Math.min(metrics.codeElementReferences / metrics.totalUserMessages, 1.5);
  const constraintRate = Math.min(metrics.constraintsMentioned / metrics.totalUserMessages, 1.5);
  const patternRate = Math.min(metrics.patternReferences / metrics.totalUserMessages, 1);

  // Weighted scoring
  const rawScore =
    fileRefRate * 0.30 +
    codeElementRate * 0.25 +
    constraintRate * 0.30 +
    patternRate * 0.15;

  // Scale to 0-100
  return Math.min(Math.round(rawScore * 30), 100);
}

/**
 * SELECT Score: How precisely you retrieve and navigate
 */
function calculateSelectScore(metrics: ContextMetrics, prompts: ScoredPrompt[]): number {
  if (metrics.totalUserMessages === 0 || prompts.length === 0) return 50;

  // Average specificity from prompts
  const avgSpecificity = prompts.reduce((sum, p) => sum + p.specificityScore, 0) / prompts.length;

  // File:line references (precise navigation)
  const fileLineRate = Math.min(metrics.fileLineReferences / metrics.totalUserMessages, 0.5);
  const fileLineScore = fileLineRate * 2 * 100; // 0.5 rate = 100

  // Pattern references (using existing code)
  const patternRate = Math.min(metrics.patternReferences / metrics.totalUserMessages, 0.5);
  const patternScore = patternRate * 2 * 100;

  // Weighted: specificity 50%, file:line 30%, patterns 20%
  return Math.round(
    avgSpecificity * 0.50 +
    fileLineScore * 0.30 +
    patternScore * 0.20
  );
}

/**
 * COMPRESS Score: How efficiently you manage context/tokens
 */
function calculateCompressScore(metrics: ContextMetrics, sessions: ParsedSession[]): number {
  // /compact usage bonus
  const compactBonus = Math.min(metrics.compactUsageCount * 15, 30);

  // Iteration efficiency (fewer turns = better first prompts = less token waste)
  const iterationEfficiency = calculateIterationEfficiency(sessions);

  // Weighted: iteration 70%, compact 30%
  return Math.round(iterationEfficiency * 0.70 + compactBonus + 20);
}

/**
 * ISOLATE Score: How well you partition work across agents
 */
function calculateIsolateScore(metrics: ContextMetrics, prompts: ScoredPrompt[]): number {
  // Task tool usage
  const taskScore = Math.min(metrics.taskToolUsage * 10, 40);

  // Multi-agent delegation
  const multiAgentScore = Math.min(metrics.multiAgentSessions * 15, 30);

  // Focused prompts (single concern)
  const focusedCount = prompts.filter((p) => p.isFocused).length;
  const focusedRate = prompts.length > 0 ? focusedCount / prompts.length : 0.5;
  const focusedScore = focusedRate * 30;

  return Math.min(Math.round(taskScore + multiAgentScore + focusedScore), 100);
}

function calculateIterationEfficiency(sessions: ParsedSession[]): number {
  if (sessions.length === 0) return 50;

  const avgTurns = calculateAvgTurns(sessions);

  // Ideal is 3-5 turns, more than 8 is inefficient
  if (avgTurns <= 3) return 90;
  if (avgTurns <= 5) return 80;
  if (avgTurns <= 8) return 60;
  if (avgTurns <= 12) return 40;
  return 20;
}

function calculateAvgTurns(sessions: ParsedSession[]): number {
  if (sessions.length === 0) return 0;

  const totalTurns = sessions.reduce((sum, s) => {
    const userMessages = s.messages.filter((m) => m.role === 'user').length;
    return sum + userMessages;
  }, 0);

  return Math.round((totalTurns / sessions.length) * 10) / 10;
}

function countFocusedPrompts(prompts: ScoredPrompt[]): number {
  return prompts.filter((p) => p.isFocused).length;
}

function getLevel(score: number): 'novice' | 'developing' | 'proficient' | 'expert' {
  if (score >= 80) return 'expert';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'developing';
  return 'novice';
}

interface CategoryScores {
  writeScore: number;
  selectScore: number;
  compressScore: number;
  isolateScore: number;
}

function generateTips(
  writeScore: number,
  selectScore: number,
  compressScore: number,
  isolateScore: number,
  metrics: ContextMetrics
): string[] {
  const tips: string[] = [];

  if (writeScore < 50) {
    tips.push('WRITE: Reference specific files and constraints when describing tasks');
  }

  if (selectScore < 50) {
    tips.push('SELECT: Use file:line references (e.g., src/foo.ts:123) for precise navigation');
  }

  if (compressScore < 50 && metrics.compactUsageCount === 0) {
    tips.push('COMPRESS: Use /compact command to manage long sessions efficiently');
  }

  if (isolateScore < 50 && metrics.taskToolUsage === 0) {
    tips.push('ISOLATE: Delegate complex subtasks to specialized agents using Task tool');
  }

  if (metrics.constraintsMentioned < 3) {
    tips.push('Specify constraints explicitly (must, should not, required, etc.)');
  }

  return tips.slice(0, 3);
}

function getInterpretation(score: number, scores: CategoryScores): string {
  const { writeScore, selectScore, compressScore, isolateScore } = scores;

  // Find strongest and weakest
  const categories = [
    { name: 'WRITE', score: writeScore },
    { name: 'SELECT', score: selectScore },
    { name: 'COMPRESS', score: compressScore },
    { name: 'ISOLATE', score: isolateScore },
  ];
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  if (score >= 80) {
    return `Expert context engineer! Your ${strongest.name} skills are exceptional (${strongest.score}). You understand how to fill the context window with the right information at the right time.`;
  }
  if (score >= 60) {
    return `Proficient context management. Strong in ${strongest.name} (${strongest.score}), consider improving ${weakest.name} (${weakest.score}) to level up further.`;
  }
  if (score >= 40) {
    return `Developing context skills. Focus on ${weakest.name} (${weakest.score}) - this is your biggest growth opportunity. Your ${strongest.name} (${strongest.score}) is a good foundation.`;
  }
  return `Early in your context engineering journey. Start with ${weakest.name}: learn to provide rich context that helps AI understand your codebase and intentions.`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function createDefaultResult(): ContextEngineeringResult {
  return {
    score: 50,
    level: 'developing',
    breakdown: {
      write: {
        score: 50,
        fileReferences: 0,
        codeElementReferences: 0,
        constraintsMentioned: 0,
        patternReferences: 0,
      },
      select: {
        score: 50,
        specificity: 50,
        codebaseNavigation: 0,
        existingPatternUsage: 0,
      },
      compress: {
        score: 50,
        compactUsageCount: 0,
        iterationEfficiency: 50,
        avgTurnsPerSession: 0,
      },
      isolate: {
        score: 50,
        taskToolUsage: 0,
        multiAgentDelegation: 0,
        focusedPrompts: 0,
      },
    },
    bestExample: null,
    worstExample: null,
    tips: ['Complete more sessions for personalized tips.'],
    interpretation: 'Not enough data to calculate context engineering score. Complete more sessions for accurate analysis.',
  };
}
