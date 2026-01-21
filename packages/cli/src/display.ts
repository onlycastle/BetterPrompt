/**
 * CLI Display
 *
 * Formats and displays analysis results in the terminal
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type { AnalysisResult } from './uploader.js';
import type { SessionWithParsed } from './scanner.js';
import type { CostEstimate } from './cost-estimator.js';
import { generateCelebrationBanner } from './animations/index.js';

const TYPE_COLORS: Record<string, (s: string) => string> = {
  architect: pc.blue,
  scientist: pc.green,
  collaborator: pc.yellow,
  speedrunner: pc.red,
  craftsman: pc.magenta,
};

const TYPE_EMOJIS: Record<string, string> = {
  architect: '🏛️',
  scientist: '🔬',
  collaborator: '🤝',
  speedrunner: '⚡',
  craftsman: '🔧',
};

const LEVEL_COLORS: Record<string, (s: string) => string> = {
  explorer: pc.yellow,
  navigator: pc.cyan,
  cartographer: pc.green,
};

/**
 * Matrix names for each Style × Control combination
 * Mirrors the MATRIX_NAMES from coding-style.ts
 */
const MATRIX_NAMES: Record<string, Record<string, string>> = {
  architect: {
    explorer: 'Visionary',
    navigator: 'Strategist',
    cartographer: 'Systems Architect',
  },
  scientist: {
    explorer: 'Questioner',
    navigator: 'Analyst',
    cartographer: 'Research Lead',
  },
  collaborator: {
    explorer: 'Conversationalist',
    navigator: 'Team Player',
    cartographer: 'Facilitator',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  craftsman: {
    explorer: 'Detail Lover',
    navigator: 'Quality Crafter',
    cartographer: 'Master Artisan',
  },
};

/**
 * Create a progress bar with optional color function
 */
function progressBar(value: number, width: number = 10, colorFn: (s: string) => string = pc.green): string {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  return colorFn('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
}

/**
 * Compute matrix distribution for a type from controlScore
 * Uses same logic as deriveMatrixDistribution in coding-style.ts
 * Returns percentages that sum to the type's distribution percentage
 */
function computeMatrixDistribution(
  typeDistribution: number,
  controlScore: number
): { explorer: number; navigator: number; cartographer: number } {
  const score = Math.max(0, Math.min(100, controlScore));
  let explorerWeight: number;
  let navigatorWeight: number;
  let cartographerWeight: number;

  if (score <= 34) {
    explorerWeight = 0.6 + (34 - score) / 85;
    navigatorWeight = (1 - explorerWeight) * 0.7;
    cartographerWeight = (1 - explorerWeight) * 0.3;
  } else if (score <= 64) {
    const distFromCenter = Math.abs(score - 50) / 15;
    navigatorWeight = 0.5 + (1 - distFromCenter) * 0.3;
    if (score < 50) {
      explorerWeight = (1 - navigatorWeight) * 0.6;
      cartographerWeight = (1 - navigatorWeight) * 0.4;
    } else {
      explorerWeight = (1 - navigatorWeight) * 0.4;
      cartographerWeight = (1 - navigatorWeight) * 0.6;
    }
  } else {
    cartographerWeight = 0.6 + (score - 65) / 87.5;
    navigatorWeight = (1 - cartographerWeight) * 0.7;
    explorerWeight = (1 - cartographerWeight) * 0.3;
  }

  const total = explorerWeight + navigatorWeight + cartographerWeight;
  const calcPct = (weight: number): number =>
    Math.round(typeDistribution * (weight / total) * 10) / 10;

  return {
    explorer: calcPct(explorerWeight),
    navigator: calcPct(navigatorWeight),
    cartographer: calcPct(cartographerWeight),
  };
}

/**
 * Format control level for display
 */
function formatControlLevel(level: string): string {
  switch (level) {
    case 'explorer': return 'Explorer';
    case 'navigator': return 'Navigator';
    case 'cartographer': return 'Cartographer';
    default: return level;
  }
}

/**
 * Format the type name for display
 */
function formatTypeName(type: string): string {
  const colorFn = TYPE_COLORS[type.toLowerCase()] || pc.white;
  const emoji = TYPE_EMOJIS[type.toLowerCase()] || '🎯';
  return `${emoji} ${colorFn(type.toUpperCase())}`;
}

/**
 * Display the analysis results
 */
export function displayResults(result: AnalysisResult): void {
  const lines: string[] = [];

  // Header - show matrix name (5×3 combination)
  const emoji = result.matrixEmoji || TYPE_EMOJIS[result.primaryType.toLowerCase()] || '🎯';
  lines.push(pc.bold(`Your AI Collaboration Type: ${emoji} ${pc.cyan(result.matrixName.toUpperCase())}`));
  lines.push(pc.dim(`(${result.primaryType.charAt(0).toUpperCase() + result.primaryType.slice(1)} × ${formatControlLevel(result.controlLevel)})`));
  lines.push('');

  // Distribution bars with matrix sub-types under primary type
  const types = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'] as const;

  for (const type of types) {
    const value = result.distribution[type];
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const bar = progressBar(value);
    lines.push(`${pc.dim(label.padEnd(12))} ${bar} ${pc.dim(`${value}%`)}`);

    // Add matrix sub-type bars under the primary type only
    if (type === result.primaryType.toLowerCase()) {
      const matrixDist = computeMatrixDistribution(value, result.controlScore);
      const levels = ['explorer', 'navigator', 'cartographer'] as const;

      // Find the highest percentage level for this type
      let highestLevel: typeof levels[number] = levels[0];
      let highestPct = matrixDist[levels[0]];
      for (const level of levels) {
        if (matrixDist[level] > highestPct) {
          highestPct = matrixDist[level];
          highestLevel = level;
        }
      }

      for (const level of levels) {
        const levelValue = matrixDist[level];
        const matrixName = MATRIX_NAMES[type][level];
        const colorFn = LEVEL_COLORS[level];
        // Scale bar to type's max percentage for better visualization
        const barScale = value > 0 ? Math.min((levelValue / value) * 100, 100) : 0;
        const levelBar = progressBar(barScale, 10, colorFn);

        // Highlight the highest percentage matrix combo
        const isHighest = level === highestLevel;
        const marker = isHighest ? pc.cyan(' ← Your Type') : '';

        lines.push(`  └ ${pc.dim(matrixName.padEnd(16))} ${levelBar} ${pc.dim(`${levelValue.toFixed(1)}%`)}${marker}`);
      }
      lines.push(''); // Blank line after matrix bars
    }
  }

  lines.push(pc.dim('─'.repeat(45)));
  lines.push('');

  // Summary (truncated for CLI)
  const summaryLines = result.personalitySummary.split('\n');
  const truncatedSummary = summaryLines.slice(0, 3).join('\n');
  lines.push(pc.italic(truncatedSummary));
  if (summaryLines.length > 3) {
    lines.push(pc.dim('...'));
  }

  lines.push('');
  lines.push(pc.dim('─'.repeat(45)));
  lines.push('');

  // Report link
  lines.push(`📊 ${pc.bold('Detailed Report:')} ${pc.cyan(pc.underline(result.reportUrl))}`);

  const box = boxen(lines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
  });

  console.log(box);
}

/**
 * Display privacy notice
 */
export function displayPrivacyNotice(): void {
  console.log('');
  console.log(pc.dim('🔒 Your data is analyzed and immediately deleted.'));
  console.log(pc.dim('   We only keep the results, never your conversations.'));
  console.log('');
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.log('');
  console.log(pc.red(`❌ Error: ${message}`));
  console.log('');
}

/**
 * Display no sessions found message
 */
export function displayNoSessions(): void {
  console.log('');
  console.log(pc.yellow('⚠️  No Claude Code sessions found.'));
  console.log('');
  console.log(pc.dim('   Make sure you have used Claude Code and have sessions in:'));
  console.log(pc.dim('   ~/.claude/projects/'));
  console.log('');
}

/**
 * Estimate cost for a single session based on message count
 * Uses approximation based on average truncated message size
 */
function estimateSingleSessionCost(messageCount: number): number {
  const inputPrice = 0.5 / 1_000_000; // Gemini 3 Flash input
  const outputPrice = 3.0 / 1_000_000; // Gemini 3 Flash output

  // Average truncated message: ~500 tokens (2000 chars / 4)
  // 3 stages with different message counts
  const avgTokensPerMessage = 500;
  const dataAnalystTokens = messageCount * avgTokensPerMessage;
  const personalityTokens = Math.ceil(messageCount / 2) * avgTokensPerMessage; // Only user messages
  const stageOverhead = (2500 + 1500) * 3; // System prompt + schema per stage

  const totalInput = dataAnalystTokens + personalityTokens + 16000 + stageOverhead;
  const totalOutput = 8000 + 4000 + 12000; // Per stage output

  return totalInput * inputPrice + totalOutput * outputPrice;
}

/**
 * Display session list for selection
 */
export function displaySessionList(sessions: SessionWithParsed[]): void {
  console.log('');
  console.log(pc.bold(pc.cyan('  📋 Available Sessions (sorted by size)')));
  console.log('');

  // Header
  console.log(
    pc.dim('  #'.padEnd(6)) +
    pc.dim('Project'.padEnd(22)) +
    pc.dim('Session'.padEnd(14)) +
    pc.dim('Messages'.padStart(10)) +
    pc.dim('Est. Cost'.padStart(12))
  );
  console.log(pc.dim('  ' + '─'.repeat(60)));

  // Rows
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const num = pc.bold(pc.white(`${i + 1}.`.padEnd(6)));
    const project = s.metadata.projectName.slice(0, 20).padEnd(22);
    const sessionId = s.metadata.sessionId.slice(0, 12).padEnd(14);
    const messages = s.parsed.messages.length.toLocaleString().padStart(10);
    const cost = `$${estimateSingleSessionCost(s.parsed.messages.length).toFixed(4)}`.padStart(12);

    console.log(`  ${num}${project}${sessionId}${pc.cyan(messages)}${pc.yellow(cost)}`);
  }

  console.log('');
}

/**
 * Display selection prompt instructions
 */
export function displaySelectionHelp(): void {
  console.log(pc.dim('  Selection options:'));
  console.log(pc.dim('    • Enter numbers: 1,3,5 or 1-5 or 1-3,5,7-10'));
  console.log(pc.dim('    • "all" to select all sessions'));
  console.log(pc.dim('    • Press Enter for default (all)'));
  console.log('');
}

/**
 * Display compact analysis summary (replaces session table)
 */
export function displayAnalysisSummary(
  sessions: SessionWithParsed[],
  cost: CostEstimate
): void {
  const totalMessages = sessions.reduce(
    (sum, s) => sum + s.parsed.messages.length,
    0
  );
  const costStr = `$${cost.totalCost.toFixed(2)}`;

  console.log('');
  console.log(
    pc.dim('  📊 ') +
    pc.white(`${sessions.length} sessions`) +
    pc.dim(' · ') +
    pc.white(`${totalMessages.toLocaleString()} messages`) +
    pc.dim(' · Est. ') +
    pc.yellow(costStr)
  );
  console.log('');
}

/**
 * Display privacy notice box and prompt for confirmation
 */
export async function confirmWithPrivacy(): Promise<boolean> {
  // Privacy notice box
  const privacyBox = boxen(
    pc.green('🔒 Your data is analyzed then immediately\n') +
    pc.green('   deleted. ') + pc.green(pc.bold('We never store your conversations.')),
    {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 1, right: 0 },
      borderStyle: 'round',
      borderColor: 'green',
    }
  );
  console.log(privacyBox);
  console.log('');

  // Prompt for confirmation
  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      pc.cyan('Ready to discover your AI style? ') + pc.dim('(Y/n): '),
      (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
      }
    );
  });
}

/**
 * Display results with celebration animation
 */
export function displayResultsWithCelebration(result: AnalysisResult): void {
  // Show celebration banner
  console.log(generateCelebrationBanner());

  // Show regular results
  displayResults(result);
}
