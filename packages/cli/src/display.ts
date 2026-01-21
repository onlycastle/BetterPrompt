/**
 * CLI Display
 *
 * Formats and displays analysis results in the terminal
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type { AnalysisResult } from './uploader.js';
import type { SessionWithParsed } from './scanner.js';

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

/**
 * Create a progress bar
 */
function progressBar(value: number, width: number = 10): string {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  return pc.green('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
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

  // Header
  lines.push(pc.bold(`Your AI Collaboration Type: ${formatTypeName(result.primaryType)}`));
  lines.push('');

  // Distribution bars
  const types = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'] as const;
  for (const type of types) {
    const value = result.distribution[type];
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const bar = progressBar(value);
    lines.push(`${pc.dim(label.padEnd(12))} ${bar} ${pc.dim(`${value}%`)}`);
  }

  lines.push('');
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
