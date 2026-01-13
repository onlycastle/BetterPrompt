/**
 * AI Collaboration Mastery Dimension
 *
 * Measures how effectively a developer collaborates with AI assistants.
 * Score 0-100: Higher is better (more skilled collaboration).
 *
 * Based on 2025 research on essential AI collaboration skills:
 * - Structured Planning (Addy Osmani, Simon Willison) - 33%
 * - AI Orchestration (Andrej Karpathy, RedMonk) - 33%
 * - Critical Verification (Google Cloud) - 33%
 *
 * Note: Context Engineering is now a separate top-level dimension.
 *
 * Sources:
 * - https://www.technologyreview.com/2025/11/05/1127477/from-vibe-coding-to-context-engineering-2025-in-software-development/
 * - https://redmonk.com/kholterhoff/2025/12/22/10-things-developers-want-from-their-agentic-ides-in-2025/
 */

import { type ParsedSession } from '../../models/index.js';
import { countMatches, PATTERNS } from './pattern-utils.js';

export interface AICollaborationResult {
  score: number; // 0-100, higher is better
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  breakdown: {
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
  // Note: Context Engineering is now a separate dimension
  const planningScore = calculateStructuredPlanningScore(metrics);
  const orchestrationScore = calculateOrchestrationScore(metrics);
  const verificationScore = calculateVerificationScore(metrics);

  // Weighted average (33% each for 3 categories)
  const score = Math.round(
    planningScore * 0.33 +
    orchestrationScore * 0.34 +
    verificationScore * 0.33
  );

  const strengths = identifyStrengths(metrics, {
    planningScore,
    orchestrationScore,
    verificationScore,
  });

  const growthAreas = identifyGrowthAreas(metrics, {
    planningScore,
    orchestrationScore,
    verificationScore,
  });

  return {
    score,
    level: getLevel(score),
    breakdown: {
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
  // General
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

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');
    totalUserMessages += userMessages.length;

    // Analyze user messages
    for (const msg of userMessages) {
      const content = msg.content;
      const lowerContent = content.toLowerCase();

      // Structured Planning
      const stepCount = countMatches(content, PATTERNS.steps);
      if (stepCount >= 2) stepByStepPlans++;

      specFileReferences += countMatches(lowerContent, PATTERNS.specs);

      // Critical Verification
      codeReviewRequests += countMatches(lowerContent, PATTERNS.review);
      testRequests += countMatches(lowerContent, PATTERNS.test);
      outputModifications += countMatches(lowerContent, PATTERNS.modification);
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
  planningScore: number;
  orchestrationScore: number;
  verificationScore: number;
}

function identifyStrengths(metrics: CollaborationMetrics, scores: CategoryScores): string[] {
  const strengths: string[] = [];

  if (scores.planningScore >= 70) {
    strengths.push('Strong structured planning - you break down tasks effectively');
  }
  if (scores.orchestrationScore >= 70) {
    strengths.push('Advanced AI orchestration - you leverage multi-agent capabilities well');
  }
  if (scores.verificationScore >= 70) {
    strengths.push('Rigorous verification - you validate AI outputs thoroughly');
  }

  if (metrics.todoWriteUsage > 5) {
    strengths.push('Effective task tracking - you use structured todo management');
  }
  if (metrics.taskToolUsage > 3) {
    strengths.push('Strong delegation - you leverage specialized agents effectively');
  }
  if (metrics.parallelWorkflows > 0) {
    strengths.push('Parallel execution - you run multiple agents concurrently');
  }
  if (metrics.testRequests > 3) {
    strengths.push('Test-driven mindset - you ensure code quality through testing');
  }

  return strengths.slice(0, 4); // Max 4 strengths
}

function identifyGrowthAreas(metrics: CollaborationMetrics, scores: CategoryScores): string[] {
  const growthAreas: string[] = [];

  if (scores.planningScore < 40) {
    growthAreas.push('Use step-by-step plans or TodoWrite to structure complex tasks');
  }
  if (scores.orchestrationScore < 40) {
    growthAreas.push('Explore using Task tool to delegate to specialized agents');
  }
  if (scores.verificationScore < 40) {
    growthAreas.push('Request code reviews and test runs to verify AI output');
  }

  if (metrics.specFileReferences === 0) {
    growthAreas.push('Consider creating spec files (requirements.md) for complex features');
  }
  if (metrics.taskToolUsage === 0 && metrics.totalUserMessages > 5) {
    growthAreas.push('Try delegating subtasks to specialized agents using Task tool');
  }

  return growthAreas.slice(0, 4); // Max 4 growth areas
}

function getInterpretation(score: number, metrics: CollaborationMetrics): string {
  if (score >= 80) {
    return `Expert-level AI collaboration! You excel at structured planning (${metrics.todoWriteUsage} todo uses), orchestration (${metrics.taskToolUsage} delegations), and verification. You're leveraging AI as a true force multiplier.`;
  }
  if (score >= 60) {
    return `Proficient AI collaborator. You understand the importance of planning and verification. Keep developing your orchestration skills to unlock even more productivity.`;
  }
  if (score >= 40) {
    return `Developing AI collaboration skills. Focus on structuring tasks with clear steps and delegating to specialized agents. These habits will significantly improve your AI-assisted output.`;
  }
  return `Room for growth in AI collaboration. Start by breaking complex tasks into numbered steps, and try using TodoWrite for task tracking. Small changes yield big improvements!`;
}

function createDefaultResult(): AICollaborationResult {
  return {
    score: 50,
    level: 'developing',
    breakdown: {
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
