/**
 * CLI Display
 *
 * Formats and displays analysis results in the terminal
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type { AnalysisResult } from './uploader.js';

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
