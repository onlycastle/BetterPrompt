/**
 * AI Collaboration Mastery Dimension
 *
 * Measures how effectively a developer collaborates with AI assistants.
 * Score 0-100: Higher is better (more skilled collaboration).
 *
 * Based on 2025 research on essential AI collaboration skills:
 * - Context Engineering (Anthropic, MIT Technology Review)
 * - Structured Planning (Addy Osmani, Simon Willison)
 * - AI Orchestration (Andrej Karpathy, RedMonk)
 * - Critical Verification (Google Cloud)
 *
 * Sources:
 * - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
 * - https://www.technologyreview.com/2025/11/05/1127477/from-vibe-coding-to-context-engineering-2025-in-software-development/
 * - https://redmonk.com/kholterhoff/2025/12/22/10-things-developers-want-from-their-agentic-ides-in-2025/
 */

import { type ParsedSession } from '../../models/index.js';

export interface AICollaborationResult {
  score: number; // 0-100, higher is better
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  breakdown: {
    contextEngineering: {
      score: number;
      fileReferences: number;
      constraintsMentioned: number;
      patternReferences: number;
    };
    structuredPlanning: {
      score: number;
      todoWriteUsage: number;
      stepByStepPlans: number;
      specFileReferences: number;
    };
    aiOrchestration: {
      score: number;
      taskToolUsage: number;
      multiAgentSessions: number;
      parallelWorkflows: number;
    };
    criticalVerification: {
      score: number;
      codeReviewRequests: number;
      testRequests: number;
      outputModifications: number;
    };
  };
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

/**
 * Calculate AI Collaboration Mastery Score
 */
export function calculateAICollaboration(sessions: ParsedSession[]): AICollaborationResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const metrics = extractCollaborationMetrics(sessions);

  // Calculate category scores (0-100 each)
  const contextScore = calculateContextEngineeringScore(metrics);
  const planningScore = calculateStructuredPlanningScore(metrics);
  const orchestrationScore = calculateOrchestrationScore(metrics);
  const verificationScore = calculateVerificationScore(metrics);

  // Weighted average (25% each)
  const score = Math.round(
    contextScore * 0.25 +
    planningScore * 0.25 +
    orchestrationScore * 0.25 +
    verificationScore * 0.25
  );

  const strengths = identifyStrengths(metrics, {
    contextScore,
    planningScore,
    orchestrationScore,
    verificationScore,
  });

  const growthAreas = identifyGrowthAreas(metrics, {
    contextScore,
    planningScore,
    orchestrationScore,
    verificationScore,
  });

  return {
    score,
    level: getLevel(score),
    breakdown: {
      contextEngineering: {
        score: contextScore,
        fileReferences: metrics.fileReferences,
        constraintsMentioned: metrics.constraintsMentioned,
        patternReferences: metrics.patternReferences,
      },
      structuredPlanning: {
        score: planningScore,
        todoWriteUsage: metrics.todoWriteUsage,
        stepByStepPlans: metrics.stepByStepPlans,
        specFileReferences: metrics.specFileReferences,
      },
      aiOrchestration: {
        score: orchestrationScore,
        taskToolUsage: metrics.taskToolUsage,
        multiAgentSessions: metrics.multiAgentSessions,
        parallelWorkflows: metrics.parallelWorkflows,
      },
      criticalVerification: {
        score: verificationScore,
        codeReviewRequests: metrics.codeReviewRequests,
        testRequests: metrics.testRequests,
        outputModifications: metrics.outputModifications,
      },
    },
    strengths,
    growthAreas,
    interpretation: getInterpretation(score, metrics),
  };
}

interface CollaborationMetrics {
  // Context Engineering
  fileReferences: number;
  constraintsMentioned: number;
  patternReferences: number;
  totalUserMessages: number;

  // Structured Planning
  todoWriteUsage: number;
  stepByStepPlans: number;
  specFileReferences: number;

  // AI Orchestration
  taskToolUsage: number;
  multiAgentSessions: number;
  parallelWorkflows: number;

  // Critical Verification
  codeReviewRequests: number;
  testRequests: number;
  outputModifications: number;
}

function extractCollaborationMetrics(sessions: ParsedSession[]): CollaborationMetrics {
  let fileReferences = 0;
  let constraintsMentioned = 0;
  let patternReferences = 0;
  let totalUserMessages = 0;

  let todoWriteUsage = 0;
  let stepByStepPlans = 0;
  let specFileReferences = 0;

  let taskToolUsage = 0;
  let multiAgentSessions = 0;
  let parallelWorkflows = 0;

  let codeReviewRequests = 0;
  let testRequests = 0;
  let outputModifications = 0;

  // Pattern detection regexes
  const filePathPattern = /(?:src\/|\.\/|\/[\w-]+\/|[\w-]+\.[tj]sx?|[\w-]+\.(?:md|json|yaml|yml|py|go|rs|java|kt|swift|rb))\b/gi;
  const constraintKeywords = /\b(must|should not|shouldn't|cannot|can't|required|constraint|limit|maximum|minimum|only|never|always|ensure|avoid)\b/gi;
  const patternKeywords = /\b(pattern|similar to|like the|existing|same as|follow|consistent with|based on|matching|mimic|replicate)\b/gi;
  const stepKeywords = /\b(step\s*\d|first[,:]|second[,:]|then[,:]|next[,:]|finally[,:]|1\.|2\.|3\.|\d\)\s)/gi;
  const specKeywords = /\b(requirements?\.md|design\.md|spec\.md|plan\.md|todo\.md|tasks\.md|readme\.md|architecture\.md)\b/gi;
  const reviewKeywords = /\b(review|check|verify|double.?check|look at|examine|inspect|validate|ensure|confirm)\b/gi;
  const testKeywords = /\b(test|npm test|yarn test|pytest|jest|vitest|run tests|unit test|integration test)\b/gi;
  const modificationKeywords = /\b(change|fix|update|modify|wrong|error|incorrect|doesn't|don't|not right|actually|wait|no,|but |instead)\b/gi;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
    totalUserMessages += userMessages.length;

    // Analyze user messages
    for (const msg of userMessages) {
      const content = msg.content;
      const lowerContent = content.toLowerCase();

      // Context Engineering
      const fileMatches = content.match(filePathPattern);
      if (fileMatches) fileReferences += fileMatches.length;

      const constraintMatches = lowerContent.match(constraintKeywords);
      if (constraintMatches) constraintsMentioned += constraintMatches.length;

      const patternMatches = lowerContent.match(patternKeywords);
      if (patternMatches) patternReferences += patternMatches.length;

      // Structured Planning
      const stepMatches = content.match(stepKeywords);
      if (stepMatches && stepMatches.length >= 2) stepByStepPlans++;

      const specMatches = lowerContent.match(specKeywords);
      if (specMatches) specFileReferences += specMatches.length;

      // Critical Verification
      const reviewMatches = lowerContent.match(reviewKeywords);
      if (reviewMatches) codeReviewRequests += reviewMatches.length;

      const testMatches = lowerContent.match(testKeywords);
      if (testMatches) testRequests += testMatches.length;

      const modMatches = lowerContent.match(modificationKeywords);
      if (modMatches) outputModifications += modMatches.length;
    }

    // Analyze assistant tool usage
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

          if (name === 'todowrite') {
            todoWriteUsage++;
          }
        }
      }
    }

    // Detect parallel workflows (multiple Task calls in a single message)
    for (const msg of assistantMessages) {
      if (msg.toolCalls) {
        const taskCalls = msg.toolCalls.filter((t) => t.name.toLowerCase() === 'task');
        if (taskCalls.length >= 2) {
          parallelWorkflows++;
        }
      }
    }
  }

  return {
    fileReferences,
    constraintsMentioned,
    patternReferences,
    totalUserMessages,
    todoWriteUsage,
    stepByStepPlans,
    specFileReferences,
    taskToolUsage,
    multiAgentSessions,
    parallelWorkflows,
    codeReviewRequests,
    testRequests,
    outputModifications,
  };
}

function calculateContextEngineeringScore(metrics: CollaborationMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // Normalize per message (higher is better)
  const fileRefRate = Math.min(metrics.fileReferences / metrics.totalUserMessages, 2);
  const constraintRate = Math.min(metrics.constraintsMentioned / metrics.totalUserMessages, 1.5);
  const patternRate = Math.min(metrics.patternReferences / metrics.totalUserMessages, 1);

  // Weight: file references most important (40%), constraints (35%), patterns (25%)
  const rawScore = fileRefRate * 0.4 + constraintRate * 0.35 + patternRate * 0.25;

  // Scale to 0-100 (max raw score ~3.5 maps to 100)
  return Math.min(Math.round(rawScore * 30), 100);
}

function calculateStructuredPlanningScore(metrics: CollaborationMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // Normalize
  const todoRate = Math.min(metrics.todoWriteUsage / 10, 1); // Cap at 10 uses
  const stepRate = Math.min(metrics.stepByStepPlans / metrics.totalUserMessages, 0.5);
  const specRate = Math.min(metrics.specFileReferences / 5, 1); // Cap at 5 references

  // Weight: TodoWrite (40%), step-by-step (35%), spec files (25%)
  const rawScore = todoRate * 0.4 + stepRate * 0.35 * 2 + specRate * 0.25;

  // Scale to 0-100
  return Math.min(Math.round(rawScore * 100), 100);
}

function calculateOrchestrationScore(metrics: CollaborationMetrics): number {
  // Normalize
  const taskRate = Math.min(metrics.taskToolUsage / 10, 1); // Cap at 10 uses
  const multiAgentRate = Math.min(metrics.multiAgentSessions / 5, 1); // Cap at 5
  const parallelRate = Math.min(metrics.parallelWorkflows / 3, 1); // Cap at 3

  // Weight: Task tool (40%), multi-agent (35%), parallel (25%)
  const rawScore = taskRate * 0.4 + multiAgentRate * 0.35 + parallelRate * 0.25;

  // Scale to 0-100
  return Math.min(Math.round(rawScore * 100), 100);
}

function calculateVerificationScore(metrics: CollaborationMetrics): number {
  if (metrics.totalUserMessages === 0) return 50;

  // Normalize per message
  const reviewRate = Math.min(metrics.codeReviewRequests / metrics.totalUserMessages, 1);
  const testRate = Math.min(metrics.testRequests / metrics.totalUserMessages, 0.5);
  const modRate = Math.min(metrics.outputModifications / metrics.totalUserMessages, 0.5);

  // Weight: review (35%), test (35%), modifications (30%)
  const rawScore = reviewRate * 0.35 + testRate * 0.35 * 2 + modRate * 0.30 * 2;

  // Scale to 0-100
  return Math.min(Math.round(rawScore * 100), 100);
}

function getLevel(score: number): 'novice' | 'developing' | 'proficient' | 'expert' {
  if (score >= 80) return 'expert';
  if (score >= 60) return 'proficient';
  if (score >= 40) return 'developing';
  return 'novice';
}

interface CategoryScores {
  contextScore: number;
  planningScore: number;
  orchestrationScore: number;
  verificationScore: number;
}

function identifyStrengths(metrics: CollaborationMetrics, scores: CategoryScores): string[] {
  const strengths: string[] = [];

  if (scores.contextScore >= 70) {
    strengths.push('Excellent context engineering - you provide rich context for AI to work with');
  }
  if (scores.planningScore >= 70) {
    strengths.push('Strong structured planning - you break down tasks effectively');
  }
  if (scores.orchestrationScore >= 70) {
    strengths.push('Advanced AI orchestration - you leverage multi-agent capabilities well');
  }
  if (scores.verificationScore >= 70) {
    strengths.push('Rigorous verification - you validate AI outputs thoroughly');
  }

  if (metrics.fileReferences > 10) {
    strengths.push('Good file referencing - you guide AI to specific code locations');
  }
  if (metrics.todoWriteUsage > 5) {
    strengths.push('Effective task tracking - you use structured todo management');
  }
  if (metrics.testRequests > 3) {
    strengths.push('Test-driven mindset - you ensure code quality through testing');
  }

  return strengths.slice(0, 4); // Max 4 strengths
}

function identifyGrowthAreas(metrics: CollaborationMetrics, scores: CategoryScores): string[] {
  const growthAreas: string[] = [];

  if (scores.contextScore < 40) {
    growthAreas.push('Try referencing specific files and patterns when describing tasks');
  }
  if (scores.planningScore < 40) {
    growthAreas.push('Use step-by-step plans or TodoWrite to structure complex tasks');
  }
  if (scores.orchestrationScore < 40) {
    growthAreas.push('Explore using Task tool to delegate to specialized agents');
  }
  if (scores.verificationScore < 40) {
    growthAreas.push('Request code reviews and test runs to verify AI output');
  }

  if (metrics.constraintsMentioned < 3) {
    growthAreas.push('Specify constraints and requirements more explicitly');
  }
  if (metrics.specFileReferences === 0) {
    growthAreas.push('Consider creating spec files (requirements.md) for complex features');
  }

  return growthAreas.slice(0, 4); // Max 4 growth areas
}

function getInterpretation(score: number, metrics: CollaborationMetrics): string {
  if (score >= 80) {
    return `Expert-level AI collaboration! You excel at context engineering (${metrics.fileReferences} file references), structured planning, and verification. You're leveraging AI as a true force multiplier.`;
  }
  if (score >= 60) {
    return `Proficient AI collaborator. You understand the importance of context and verification. Keep developing your orchestration skills to unlock even more productivity.`;
  }
  if (score >= 40) {
    return `Developing AI collaboration skills. Focus on providing more context (file paths, constraints) and structuring tasks with clear steps. These habits will significantly improve your AI-assisted output.`;
  }
  return `Room for growth in AI collaboration. Start by referencing specific files when asking questions, and try breaking complex tasks into numbered steps. Small changes yield big improvements!`;
}

function createDefaultResult(): AICollaborationResult {
  return {
    score: 50,
    level: 'developing',
    breakdown: {
      contextEngineering: {
        score: 50,
        fileReferences: 0,
        constraintsMentioned: 0,
        patternReferences: 0,
      },
      structuredPlanning: {
        score: 50,
        todoWriteUsage: 0,
        stepByStepPlans: 0,
        specFileReferences: 0,
      },
      aiOrchestration: {
        score: 50,
        taskToolUsage: 0,
        multiAgentSessions: 0,
        parallelWorkflows: 0,
      },
      criticalVerification: {
        score: 50,
        codeReviewRequests: 0,
        testRequests: 0,
        outputModifications: 0,
      },
    },
    strengths: [],
    growthAreas: ['Complete more sessions to get personalized insights'],
    interpretation: 'Not enough data to calculate collaboration score. Complete more sessions for accurate analysis.',
  };
}
