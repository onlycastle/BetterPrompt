/**
 * CLI Display
 *
 * Formats and displays analysis results in the terminal
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type { AnalysisResult, PipelineTokenUsage } from './uploader.js';
import type { SessionWithParsed } from './scanner.js';
import type { CostEstimate } from './cost-estimator.js';
import { generateCelebrationBanner } from './animations/index.js';

const TYPE_COLORS: Record<string, (s: string) => string> = {
  architect: pc.blue,
  analyst: pc.magenta,
  conductor: pc.yellow,
  speedrunner: pc.red,
  trendsetter: pc.cyan,
};

const TYPE_EMOJIS: Record<string, string> = {
  architect: '🏛️',
  analyst: '🔬',
  conductor: '🎼',
  speedrunner: '⚡',
  trendsetter: '🚀',
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
  analyst: {
    explorer: 'Questioner',
    navigator: 'Research Lead',
    cartographer: 'Quality Sentinel',
  },
  conductor: {
    explorer: 'Improviser',
    navigator: 'Arranger',
    cartographer: 'Maestro',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  trendsetter: {
    explorer: 'Early Adopter',
    navigator: 'Tech Radar',
    cartographer: 'Innovation Lead',
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

  const weights = calculateWeights(score);
  const total = weights.explorer + weights.navigator + weights.cartographer;
  const calcPct = (weight: number): number =>
    Math.round(typeDistribution * (weight / total) * 10) / 10;

  return {
    explorer: calcPct(weights.explorer),
    navigator: calcPct(weights.navigator),
    cartographer: calcPct(weights.cartographer),
  };
}

/**
 * Calculate weight distribution based on control score
 */
function calculateWeights(score: number): { explorer: number; navigator: number; cartographer: number } {
  if (score <= 34) {
    // Explorer-dominant zone
    const explorerWeight = 0.6 + (34 - score) / 85;
    const navigatorWeight = (1 - explorerWeight) * 0.7;
    const cartographerWeight = (1 - explorerWeight) * 0.3;
    return { explorer: explorerWeight, navigator: navigatorWeight, cartographer: cartographerWeight };
  }

  if (score <= 64) {
    // Navigator-dominant zone
    const distFromCenter = Math.abs(score - 50) / 15;
    const navigatorWeight = 0.5 + (1 - distFromCenter) * 0.3;
    const remainingWeight = 1 - navigatorWeight;
    const explorerBias = score < 50 ? 0.6 : 0.4;
    const explorerWeight = remainingWeight * explorerBias;
    const cartographerWeight = remainingWeight * (1 - explorerBias);
    return { explorer: explorerWeight, navigator: navigatorWeight, cartographer: cartographerWeight };
  }

  // Cartographer-dominant zone
  const cartographerWeight = 0.6 + (score - 65) / 87.5;
  const navigatorWeight = (1 - cartographerWeight) * 0.7;
  const explorerWeight = (1 - cartographerWeight) * 0.3;
  return { explorer: explorerWeight, navigator: navigatorWeight, cartographer: cartographerWeight };
}

/**
 * Format control level for display (capitalize first letter)
 */
function formatControlLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
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

  // Distribution bars with matrix sub-types under ALL types (5×3 matrix)
  const types = ['architect', 'analyst', 'conductor', 'speedrunner', 'trendsetter'] as const;
  const levels = ['explorer', 'navigator', 'cartographer'] as const;
  const userType = result.primaryType.toLowerCase();
  const userLevel = result.controlLevel.toLowerCase();

  for (const type of types) {
    const value = result.distribution[type];
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const isPrimaryType = type === userType;
    const colorFn = TYPE_COLORS[type] || pc.white;
    const bar = isPrimaryType ? progressBar(value, 10, colorFn) : progressBar(value);

    // PRIMARY marker for the main type
    const primaryMarker = isPrimaryType ? pc.magenta(' ← PRIMARY') : '';
    const typeLabel = isPrimaryType
      ? colorFn(label.padEnd(12))
      : pc.dim(label.padEnd(12));

    lines.push(`${typeLabel} ${bar} ${pc.dim(`${value}%`)}${primaryMarker}`);

    // Add matrix sub-type bars under ALL types
    const matrixDist = computeMatrixDistribution(value, result.controlScore);

    for (const level of levels) {
      const levelValue = matrixDist[level];
      const matrixName = MATRIX_NAMES[type][level];
      const levelColorFn = LEVEL_COLORS[level];
      // Scale bar to type's max percentage for better visualization
      const barScale = value > 0 ? Math.min((levelValue / value) * 100, 100) : 0;
      const levelBar = progressBar(barScale, 10, levelColorFn);

      // YOU ARE HERE marker for the user's exact position (type + level combination)
      const isUserPosition = isPrimaryType && level === userLevel;
      const marker = isUserPosition ? pc.cyan(' ← YOU ARE HERE') : '';

      lines.push(`  └ ${pc.dim(matrixName.padEnd(16))} ${levelBar} ${pc.dim(`${levelValue.toFixed(1)}%`)}${marker}`);
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
 * Uses approximation based on Phase1Output size and 7-8 LLM stage pipeline
 */
function estimateSingleSessionCost(messageCount: number): number {
  const inputPrice = 0.5 / 1_000_000; // Gemini 3 Flash input
  const outputPrice = 3.0 / 1_000_000; // Gemini 3 Flash output

  // Estimate Phase1Output tokens from message count
  const userMessages = Math.ceil(messageCount * 0.6);
  const assistantMessages = messageCount - userMessages;
  const sampledUtterances = Math.min(userMessages, 500); // PHASE1_MAX_UTTERANCES
  const sampledAiResponses = Math.min(assistantMessages, 350); // PHASE1_MAX_AI_RESPONSES
  const phase1OutputTokens = (sampledUtterances * 250) + (sampledAiResponses * 100) + 500;

  const stageOverhead = (2500 + 1500); // System prompt + schema per stage

  // Phase 2: 4 workers × (Phase1Output + overhead)
  const phase2Input = 4 * (phase1OutputTokens + stageOverhead);
  // Phase 2.5 + Phase 3 + Phase 4
  const laterStagesInput = (6000 + stageOverhead) + (9500 + stageOverhead) + (14000 + stageOverhead);

  const totalInput = phase2Input + laterStagesInput;
  // 4 workers + TypeClassifier + ContentWriter + Translator
  const totalOutput = 8000 + 8000 + 4000 + 4000 + 2000 + 12000 + 10000;

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
 * Render actual token usage from LLM pipeline
 */
export function renderActualTokenUsage(usage: PipelineTokenUsage): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold(pc.green('  💰 Actual LLM Token Usage')));
  lines.push('');
  lines.push(`  ${pc.dim('Model:')} ${pc.white(usage.modelName)}`);
  lines.push('');
  lines.push(`  ${pc.dim('Per-Stage Breakdown:')}`);

  for (const stage of usage.stages) {
    lines.push(`    ${pc.dim('├─')} ${stage.stage}`);
    lines.push(`    ${pc.dim('│  ')} Input:  ${pc.cyan(stage.promptTokens.toLocaleString())} tokens`);
    lines.push(`    ${pc.dim('│  ')} Output: ${pc.cyan(stage.completionTokens.toLocaleString())} tokens`);
  }

  lines.push('');
  lines.push(`  ${pc.dim('Totals:')}`);
  lines.push(`    ${pc.dim('Input Tokens: ')} ${pc.white(usage.totals.promptTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('Output Tokens:')} ${pc.white(usage.totals.completionTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('Total Tokens: ')} ${pc.white(usage.totals.totalTokens.toLocaleString())}`);
  lines.push('');

  // Cost box
  const inputCostStr = `$${usage.cost.inputCost.toFixed(6)}`;
  const outputCostStr = `$${usage.cost.outputCost.toFixed(6)}`;
  const totalCostStr = `$${usage.cost.totalCost.toFixed(6)}`;

  lines.push(pc.green(`  ╔══════════════════════════════════════╗`));
  lines.push(pc.green(`  ║  ${pc.dim('Input Cost: ')} ${pc.white(inputCostStr.padEnd(20))}  ║`));
  lines.push(pc.green(`  ║  ${pc.dim('Output Cost:')} ${pc.white(outputCostStr.padEnd(20))}  ║`));
  lines.push(pc.green(`  ║  ${pc.bold('Total Cost: ')} ${pc.bold(pc.yellow(totalCostStr.padEnd(20)))}  ║`));
  lines.push(pc.green(`  ╚══════════════════════════════════════╝`));
  lines.push('');

  return lines.join('\n');
}

/**
 * Display results with celebration animation
 */
export function displayResultsWithCelebration(result: AnalysisResult): void {
  // Show celebration banner
  console.log(generateCelebrationBanner());

  // Show regular results
  displayResults(result);

  // Show actual token usage if NOSLOP_DEBUG is enabled and tokenUsage is available
  if (process.env.NOSLOP_DEBUG === '1' && result.tokenUsage) {
    console.log(renderActualTokenUsage(result.tokenUsage));
  }
}
