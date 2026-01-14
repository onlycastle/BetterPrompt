#!/usr/bin/env node
import 'dotenv/config';

/**
 * AI Coding Style Analyzer - v3.0
 *
 * Analyzes ~/.claude session logs to determine your AI Coding Style type.
 * Generates LLM-powered verbose analysis and opens the React SPA report.
 *
 * Options:
 *   --dry-run    Show cost estimate without running analysis
 *   --yes        Skip cost confirmation prompts
 *   --no-open    Don't open browser automatically
 */

import { spawn } from 'node:child_process';
import { SessionParser } from '../src/parser/index.js';
import { aggregateMetrics } from '../src/analyzer/type-detector.js';
import { selectOptimalSessions } from '../src/parser/session-selector.js';
import { estimateAnalysisCost, countTokensAccurate } from '../src/analyzer/cost-estimator.js';
import { confirmCost } from '../src/cli/output/components/cost-confirmation.js';
import { VerboseAnalyzer } from '../src/analyzer/verbose-analyzer.js';
import { saveAnalysisLocally } from '../src/utils/local-analysis.js';
import type { ParsedSession } from '../src/models/session.js';
import pc from 'picocolors';

/** React SPA development server URL */
const WEB_UI_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

/** Get platform-specific browser open command */
function getBrowserCommand(): string {
  switch (process.platform) {
    case 'darwin':
      return 'open';
    case 'win32':
      return 'start';
    default:
      return 'xdg-open';
  }
}

/** Open URL in the default browser */
function openBrowser(url: string): void {
  const cmd = getBrowserCommand();
  spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
}

/** Check if a server is running at the given URL */
async function isServerRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Session statistics for display */
interface SessionStats {
  sessionCount: number;
  totalMessages: number;
  totalChars: number;
  estimatedTokens: number;
}

/** Calculate statistics from parsed sessions */
function calculateSessionStats(sessions: ParsedSession[]): SessionStats {
  let totalMessages = 0;
  let totalChars = 0;

  for (const session of sessions) {
    totalMessages += session.messages.length;
    for (const msg of session.messages) {
      if (msg.content) {
        totalChars += msg.content.length;
      }
    }
  }

  const allContent = sessions
    .map((s) => s.messages.map((m) => m.content ?? '').join('\n'))
    .join('\n');
  const estimatedTokens = countTokensAccurate(allContent);

  return {
    sessionCount: sessions.length,
    totalMessages,
    totalChars,
    estimatedTokens,
  };
}

async function main() {
  // Parse CLI flags
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');
  const noOpen = args.includes('--no-open');

  console.log('');
  console.log(pc.bold('  ╔═══════════════════════════════════════════════════╗'));
  console.log(pc.bold('  ║') + pc.cyan('  NO MORE AI SLOP') + pc.bold('                    v3.0.0  ') + pc.bold('║'));
  console.log(pc.bold('  ║') + pc.dim('  Discover your AI Coding Style') + pc.bold('                ') + pc.bold('║'));
  console.log(pc.bold('  ╚═══════════════════════════════════════════════════╝'));
  console.log('');

  const parser = new SessionParser();

  // Step 1: List available sessions
  console.log(pc.dim('  📊 Scanning ~/.claude/projects...'));
  const sessions = await parser.listSessions();

  if (sessions.length === 0) {
    console.error(pc.red('  ✗ No sessions found in ~/.claude/projects/'));
    console.error(pc.dim('    Make sure you have used Claude Code before.'));
    process.exit(1);
  }

  console.log(pc.dim(`     Found ${sessions.length} sessions`));
  console.log('');

  // Step 2: Select optimal sessions based on duration
  console.log(pc.dim('  ⏳ Selecting optimal sessions for analysis...'));
  const sessionsToAnalyze = selectOptimalSessions(sessions, { maxSessions: 10 });
  console.log(pc.dim(`     Selected ${sessionsToAnalyze.length} sessions (duration-based)`));

  const parsedSessions = [];
  for (const metadata of sessionsToAnalyze) {
    try {
      const parsed = await parser.parseSessionFile(metadata.filePath);
      parsedSessions.push(parsed);
    } catch {
      // Skip invalid sessions
    }
  }

  if (parsedSessions.length === 0) {
    console.error(pc.red('  ✗ Could not parse any sessions'));
    process.exit(1);
  }

  console.log(pc.dim(`     Parsed ${parsedSessions.length} sessions successfully`));
  console.log('');

  // Calculate and display session statistics
  const stats = calculateSessionStats(parsedSessions);

  console.log(pc.bold('  📊 Session Statistics:'));
  console.log(pc.dim(`     Sessions analyzed: ${stats.sessionCount}`));
  console.log(pc.dim(`     Total messages: ${stats.totalMessages.toLocaleString()}`));
  console.log(pc.dim(`     Total characters: ${stats.totalChars.toLocaleString()}`));
  console.log(pc.dim(`     Estimated tokens: ~${stats.estimatedTokens.toLocaleString()}`));
  console.log('');

  // Step 3: Calculate cost estimate
  console.log(pc.dim('  💰 Calculating cost estimate...'));
  const costEstimate = estimateAnalysisCost(parsedSessions);

  console.log('');
  console.log(pc.bold('  Cost Estimate:'));
  console.log(pc.dim(`     Sessions: ${parsedSessions.length}`));
  console.log(pc.dim(`     Model: ${costEstimate.modelName}`));
  console.log(pc.dim(`     Input tokens: ~${costEstimate.totalInputTokens.toLocaleString()}`));
  console.log(pc.dim(`     Output tokens: ~${costEstimate.estimatedOutputTokens.toLocaleString()}`));
  console.log(pc.cyan(`     Estimated cost: $${costEstimate.totalCost.toFixed(4)}`));
  console.log('');

  if (dryRun) {
    console.log(pc.yellow('  ℹ️  Dry run mode - exiting without analysis'));
    process.exit(0);
  }

  // Get user confirmation unless --yes flag is set
  if (!skipConfirm) {
    const confirmed = await confirmCost(costEstimate, parsedSessions.length);
    if (!confirmed) {
      console.log(pc.yellow('  ℹ️  Analysis cancelled by user'));
      process.exit(0);
    }
  }

  // Step 4: Run verbose analysis
  console.log(pc.dim('  🔬 Running verbose analysis (this may take a few minutes)...'));
  const metrics = aggregateMetrics(parsedSessions);
  const analyzer = new VerboseAnalyzer();
  const verboseResult = await analyzer.analyzeVerbose(parsedSessions, metrics);

  console.log(pc.green('  ✓ Verbose analysis complete!'));
  console.log('');

  // Step 5: Save analysis locally
  console.log(pc.dim('  💾 Saving analysis...'));
  const analysisId = await saveAnalysisLocally(verboseResult, {
    type: 'verbose',
    metadata: {
      sessionCount: parsedSessions.length,
      version: '3.0.0',
    },
  });

  console.log(pc.green(`  ✓ Saved analysis: ${analysisId}`));
  console.log('');

  // Step 6: Open React SPA
  const reportUrl = `${WEB_UI_URL}/analysis?local=${analysisId}`;

  if (!noOpen) {
    // Check if API server is running
    const apiRunning = await isServerRunning(API_URL);
    if (!apiRunning) {
      console.log(pc.yellow('  ⚠️  API server not running'));
      console.log(pc.dim('     Start it with: npm run api'));
      console.log('');
    }

    console.log(pc.dim('  🌐 Opening report in browser...'));
    openBrowser(reportUrl);
    console.log(pc.green(`  ✓ Report URL: ${reportUrl}`));
  } else {
    console.log(pc.dim('  Report URL:'));
    console.log(pc.cyan(`     ${reportUrl}`));
  }

  console.log('');
  console.log(pc.dim('  To view this report later:'));
  console.log(pc.dim(`     Open ${reportUrl}`));
  console.log(pc.dim('     Or run: npm run ui'));
}

main().catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
