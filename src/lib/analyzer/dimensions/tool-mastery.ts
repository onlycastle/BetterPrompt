/**
 * Tool Mastery Profile Dimension
 *
 * Analyzes how effectively a developer uses Claude Code's tools.
 *
 * Source: https://docs.github.com/en/copilot/concepts/copilot-metrics
 * "GitHub Copilot metrics dashboard shows tool usage patterns"
 */

import { type ParsedSession } from '../../models/index';

export type MasteryLevel = 'novice' | 'basic' | 'adept' | 'expert';

export interface ToolMasteryResult {
  overallScore: number; // 0-100
  toolUsage: Record<
    string,
    {
      count: number;
      percentage: number;
      level: MasteryLevel;
      assessment: string;
    }
  >;
  topTools: string[];
  underutilizedTools: string[];
  tips: string[];
}

// Tool categories and their descriptions
const TOOL_INFO: Record<
  string,
  { category: string; description: string; advancedUsage: string }
> = {
  Read: {
    category: 'exploration',
    description: 'Review code before changes',
    advancedUsage: 'Check multiple related files before making changes',
  },
  Grep: {
    category: 'exploration',
    description: 'Search for patterns in codebase',
    advancedUsage: 'Find all usages before refactoring',
  },
  Glob: {
    category: 'exploration',
    description: 'Find files by pattern',
    advancedUsage: 'Explore unfamiliar codebases efficiently',
  },
  Edit: {
    category: 'modification',
    description: 'Targeted code edits',
    advancedUsage: 'Make precise changes with good context',
  },
  Write: {
    category: 'modification',
    description: 'Create new files',
    advancedUsage: 'Generate complete modules with proper structure',
  },
  Bash: {
    category: 'execution',
    description: 'Run commands and scripts',
    advancedUsage: 'Chain commands for complex workflows',
  },
  Task: {
    category: 'orchestration',
    description: 'Parallel agent execution',
    advancedUsage: 'Launch multiple agents for complex tasks',
  },
  TodoWrite: {
    category: 'planning',
    description: 'Track task progress',
    advancedUsage: 'Break down complex work into steps',
  },
  WebSearch: {
    category: 'research',
    description: 'Search for documentation',
    advancedUsage: 'Check docs before implementing new APIs',
  },
  WebFetch: {
    category: 'research',
    description: 'Fetch web content',
    advancedUsage: 'Read documentation directly',
  },
};

/**
 * Calculate Tool Mastery Profile
 */
export function calculateToolMastery(sessions: ParsedSession[]): ToolMasteryResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const toolCounts = countToolUsage(sessions);
  const totalToolCalls = Object.values(toolCounts).reduce((a, b) => a + b, 0);

  if (totalToolCalls === 0) {
    return createDefaultResult();
  }

  // Calculate usage percentages and levels
  const toolUsage: ToolMasteryResult['toolUsage'] = {};
  const expectedUsage: Record<string, number> = {
    Read: 0.20,
    Edit: 0.20,
    Grep: 0.10,
    Glob: 0.10,
    Bash: 0.15,
    Write: 0.10,
    Task: 0.05,
    TodoWrite: 0.05,
    WebSearch: 0.03,
    WebFetch: 0.02,
  };

  for (const [tool, count] of Object.entries(toolCounts)) {
    const percentage = count / totalToolCalls;
    const expected = expectedUsage[tool] || 0.05;

    toolUsage[tool] = {
      count,
      percentage: Math.round(percentage * 100),
      level: calculateLevel(percentage, expected),
      assessment: generateAssessment(tool, percentage, expected),
    };
  }

  // Identify top and underutilized tools
  const sortedTools = Object.entries(toolUsage).sort(
    (a, b) => b[1].count - a[1].count
  );
  const topTools = sortedTools.slice(0, 3).map(([tool]) => tool);

  const underutilized = Object.entries(expectedUsage)
    .filter(([tool, expected]) => {
      const actual = (toolCounts[tool] || 0) / totalToolCalls;
      return actual < expected * 0.3 && expected > 0.03;
    })
    .map(([tool]) => tool);

  // Generate tips
  const tips = generateTips(toolUsage, underutilized);

  // Calculate overall score
  const overallScore = calculateOverallScore(toolUsage, expectedUsage);

  return {
    overallScore,
    toolUsage,
    topTools,
    underutilizedTools: underutilized,
    tips,
  };
}

function countToolUsage(sessions: ParsedSession[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          // Normalize tool name
          const name = normalizeTool(tool.name);
          counts[name] = (counts[name] || 0) + 1;
        }
      }
    }
  }

  return counts;
}

function normalizeTool(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes('read')) return 'Read';
  if (lower.includes('grep')) return 'Grep';
  if (lower.includes('glob')) return 'Glob';
  if (lower.includes('edit')) return 'Edit';
  if (lower.includes('write') && !lower.includes('todo')) return 'Write';
  if (lower.includes('bash')) return 'Bash';
  if (lower.includes('task')) return 'Task';
  if (lower.includes('todo')) return 'TodoWrite';
  if (lower.includes('websearch')) return 'WebSearch';
  if (lower.includes('webfetch')) return 'WebFetch';

  // Return capitalized version for unknown tools
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function calculateLevel(actual: number, expected: number): MasteryLevel {
  const ratio = actual / expected;

  if (ratio < 0.3) return 'novice';
  if (ratio < 0.7) return 'basic';
  if (ratio < 1.5) return 'adept';
  return 'expert';
}

function generateAssessment(tool: string, actual: number, expected: number): string {
  const info = TOOL_INFO[tool];
  const ratio = actual / expected;

  if (ratio < 0.3) {
    return info
      ? `Try: ${info.advancedUsage}`
      : 'Consider using this tool more';
  }
  if (ratio < 0.7) {
    return info ? info.description : 'Basic usage';
  }
  if (ratio < 1.5) {
    return info ? `Good: ${info.description}` : 'Good usage level';
  }
  return info ? `You effectively ${info.description.toLowerCase()}` : 'Heavy user';
}

function calculateOverallScore(
  usage: ToolMasteryResult['toolUsage'],
  expected: Record<string, number>
): number {
  // Score based on diversity and effectiveness

  // 1. Diversity score (using multiple tools)
  const toolsUsed = Object.keys(usage).length;
  const diversityScore = Math.min(toolsUsed / 6, 1) * 30; // Up to 30 points

  // 2. Balance score (using tools in good proportions)
  let balanceScore = 0;
  for (const [tool, exp] of Object.entries(expected)) {
    const actual = usage[tool]?.percentage || 0;
    const expPct = exp * 100;
    const diff = Math.abs(actual - expPct);
    // Less difference = more points
    balanceScore += Math.max(0, 5 - diff / 4);
  }
  balanceScore = Math.min(balanceScore, 40); // Up to 40 points

  // 3. Advanced usage score (using orchestration/research tools)
  const advancedTools = ['Task', 'WebSearch', 'WebFetch', 'TodoWrite'];
  const advancedUsage = advancedTools.filter((t) => (usage[t]?.count || 0) > 0).length;
  const advancedScore = advancedUsage * 7.5; // Up to 30 points

  return Math.round(diversityScore + balanceScore + advancedScore);
}

function generateTips(
  usage: ToolMasteryResult['toolUsage'],
  underutilized: string[]
): string[] {
  const tips: string[] = [];

  if (underutilized.includes('Task')) {
    tips.push(
      'You\'re underutilizing the Task tool! Users who leverage parallel agents complete complex tasks 40% faster.'
    );
  }

  if (underutilized.includes('Grep') || underutilized.includes('Glob')) {
    tips.push('Try: Search existing patterns before implementing new code.');
  }

  if (underutilized.includes('WebSearch')) {
    tips.push('Check docs before implementing new APIs with WebSearch.');
  }

  // Check for exploration before modification ratio
  const explorationTools = ['Read', 'Grep', 'Glob'];
  const modificationTools = ['Edit', 'Write'];

  const explorationCount = explorationTools.reduce(
    (sum, t) => sum + (usage[t]?.count || 0),
    0
  );
  const modificationCount = modificationTools.reduce(
    (sum, t) => sum + (usage[t]?.count || 0),
    0
  );

  if (modificationCount > explorationCount * 2) {
    tips.push('Consider reading more code before editing - exploration leads to better changes.');
  }

  return tips.slice(0, 3);
}

function createDefaultResult(): ToolMasteryResult {
  return {
    overallScore: 0,
    toolUsage: {},
    topTools: [],
    underutilizedTools: [],
    tips: ['Complete more sessions to see your tool mastery profile.'],
  };
}
