/**
 * Pattern to Knowledge Base Mapping
 *
 * Maps prompt pattern types to relevant professional insights from the KB.
 * Used by Content Writer to inject expert advice into tip generation.
 *
 * @module analyzer/stages/pattern-knowledge-mapping
 */

import type { KnowledgeContextItem, PatternKnowledgeContext } from './content-writer-prompts';

/**
 * Professional insights from the Knowledge Base
 * Curated expert advice for each pattern type
 */
export const INITIAL_PROFESSIONAL_INSIGHTS: Array<{
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  source: { author: string };
  applicablePatterns: string[];
}> = [
  {
    id: 'pi-001',
    title: 'Skill Atrophy Self-Diagnosis',
    keyTakeaway:
      'Monitor your ability to code without AI assistance. Regular "cold starts" help maintain fundamental skills.',
    actionableAdvice: [
      'Try coding a small feature without AI once a week',
      'Time yourself on basic tasks to track skill maintenance',
      'Review AI suggestions critically before accepting',
    ],
    source: { author: 'VCP Research Team' },
    applicablePatterns: ['verification_habit', 'ai_interaction'],
  },
  {
    id: 'pi-002',
    title: 'The 50% Modification Test',
    keyTakeaway:
      'Professional developers typically modify about 50% of AI-generated code. Low modification rates may indicate over-reliance.',
    actionableAdvice: [
      'Track how much AI code you modify vs accept as-is',
      'Aim to understand every line before accepting',
      'Use AI output as a starting point, not final answer',
    ],
    source: { author: 'Industry Survey 2024' },
    applicablePatterns: ['verification_habit', 'ai_interaction'],
  },
  {
    id: 'pi-003',
    title: 'The 80% Planning Rule',
    keyTakeaway:
      'Spending 80% of time on planning and 20% on execution leads to better AI collaboration outcomes.',
    actionableAdvice: [
      'Write detailed specifications before starting',
      'Break complex tasks into small, testable pieces',
      'Plan validation criteria upfront',
    ],
    source: { author: 'Simon Willison' },
    applicablePatterns: ['communication_style', 'problem_solving'],
  },
  {
    id: 'pi-004',
    title: 'Context Engineering Techniques',
    keyTakeaway:
      'Master compaction, sub-agents, and JIT context loading for optimal Claude interactions.',
    actionableAdvice: [
      'Use /compact to summarize long conversations',
      'Delegate specialized tasks to sub-agents',
      'Load context just-in-time, not all upfront',
    ],
    source: { author: 'Anthropic' },
    applicablePatterns: ['communication_style', 'tool_usage', 'ai_interaction'],
  },
  {
    id: 'pi-005',
    title: 'Effective Context Engineering',
    keyTakeaway:
      'The most critical skill for AI collaboration is providing the right context at the right time.',
    actionableAdvice: [
      'Include relevant code snippets directly in prompts',
      'State your constraints and requirements explicitly',
      'Provide examples of desired output format',
    ],
    source: { author: 'Anthropic Engineering Blog' },
    applicablePatterns: ['communication_style', 'ai_interaction'],
  },
  {
    id: 'pi-006',
    title: 'Inverted TDD with AI',
    keyTakeaway:
      'Write tests first, then ask AI to implement. This reversal leverages AI strengths while maintaining code quality.',
    actionableAdvice: [
      'Start by writing comprehensive test cases',
      'Let AI implement code to pass your tests',
      'Tests become your specification and safety net',
    ],
    source: { author: 'Kent Beck' },
    applicablePatterns: ['verification_habit', 'problem_solving'],
  },
  {
    id: 'pi-007',
    title: 'Tool Composition Patterns',
    keyTakeaway:
      'Chain tools effectively: Read → Glob → Grep → Edit. Master the tool composition for complex tasks.',
    actionableAdvice: [
      'Use Glob to find files, Grep to search content',
      'Always Read before Edit to understand context',
      'Prefer Edit over Write for existing files',
    ],
    source: { author: 'Claude Code Documentation' },
    applicablePatterns: ['tool_usage'],
  },
  {
    id: 'pi-008',
    title: 'From Vibe Coding to Context Engineering',
    keyTakeaway:
      'Move beyond casual prompting to structured context engineering for professional results.',
    actionableAdvice: [
      'Learn the WRITE framework for context',
      'Structure prompts with clear sections',
      'Provide examples of desired output format',
    ],
    source: { author: 'MIT Technology Review' },
    applicablePatterns: ['communication_style', 'ai_interaction'],
  },
  {
    id: 'pi-009',
    title: 'Debugging with AI Effectively',
    keyTakeaway:
      'Share error messages, stack traces, and reproduction steps. AI excels at pattern matching known issues.',
    actionableAdvice: [
      'Copy full error messages, not summaries',
      'Include relevant code context around the error',
      'Describe what you expected vs what happened',
    ],
    source: { author: 'Developer Productivity Research' },
    applicablePatterns: ['problem_solving', 'communication_style'],
  },
  {
    id: 'pi-010',
    title: 'Iterative Refinement Strategy',
    keyTakeaway:
      'Start with a rough solution and iterate. Three small prompts often beat one complex prompt.',
    actionableAdvice: [
      'Begin with the core functionality, add features incrementally',
      'Review and adjust after each AI response',
      'Build a shared context through conversation history',
    ],
    source: { author: 'LangChain Blog' },
    applicablePatterns: ['ai_interaction', 'problem_solving'],
  },
];

/**
 * Pattern type to KB category mapping
 */
const PATTERN_TYPE_CATEGORIES: Record<string, string[]> = {
  communication_style: ['prompt-engineering', 'best-practices'],
  problem_solving: ['context-engineering', 'workflow-automation'],
  ai_interaction: ['claude-code-skills', 'tool-use'],
  verification_habit: ['best-practices'],
  tool_usage: ['tool-use', 'subagents'],
};

/**
 * Build pattern knowledge context from professional insights
 * Groups insights by applicable pattern types
 */
export function buildPatternKnowledgeContext(
  detectedPatternTypes: string[]
): PatternKnowledgeContext {
  const context: PatternKnowledgeContext = {};

  // Get unique pattern types
  const uniqueTypes = [...new Set(detectedPatternTypes)];

  for (const patternType of uniqueTypes) {
    // Find insights applicable to this pattern type
    const applicableInsights = INITIAL_PROFESSIONAL_INSIGHTS.filter((insight) =>
      insight.applicablePatterns.includes(patternType)
    );

    // Convert to KnowledgeContextItem format
    context[patternType] = applicableInsights.slice(0, 3).map((insight) => ({
      title: insight.title,
      author: insight.source.author,
      keyTakeaway: insight.keyTakeaway,
      actionableAdvice: insight.actionableAdvice,
    }));
  }

  return context;
}

/**
 * Get all unique pattern types from detected patterns
 */
export function extractPatternTypes(
  detectedPatterns: Array<{ patternType: string }>
): string[] {
  return [...new Set(detectedPatterns.map((p) => p.patternType))];
}
