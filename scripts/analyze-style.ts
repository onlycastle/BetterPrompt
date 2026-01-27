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
 *   --no-server  Don't start/wait for servers
 */

import { spawn, type ChildProcess } from 'node:child_process';
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

/** Check if web UI is running */
async function isWebUIRunning(): Promise<boolean> {
  try {
    const response = await fetch(WEB_UI_URL, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Store server processes for cleanup */
const serverProcesses: ChildProcess[] = [];

/** Start the API server */
function startAPIServer(): ChildProcess {
  const proc = spawn('npm', ['run', 'api'], {
    cwd: import.meta.dirname ? `${import.meta.dirname}/..` : process.cwd(),
    stdio: 'pipe',
    shell: true,
  });
  serverProcesses.push(proc);
  return proc;
}

/** Start the Web UI server */
function startWebUIServer(): ChildProcess {
  const cwd = import.meta.dirname ? `${import.meta.dirname}/../web-ui` : `${process.cwd()}/web-ui`;
  const proc = spawn('npm', ['run', 'dev'], {
    cwd,
    stdio: 'pipe',
    shell: true,
  });
  serverProcesses.push(proc);
  return proc;
}

/** Wait for a server to become available */
async function waitForServer(checkFn: () => Promise<boolean>, name: string, maxWaitMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < maxWaitMs) {
    if (await checkFn()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
    process.stdout.write(pc.dim('.'));
  }
  console.log('');
  console.log(pc.yellow(`  ⚠️  ${name} did not start within ${maxWaitMs / 1000}s`));
  return false;
}

/** Cleanup server processes on exit */
function setupCleanup(): void {
  const cleanup = () => {
    for (const proc of serverProcesses) {
      proc.kill();
    }
  };

  process.on('SIGINT', () => {
    console.log(pc.dim('\n  👋 Shutting down servers...'));
    cleanup();
    process.exit(0);
  });

  process.on('exit', cleanup);
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
  const noServer = args.includes('--no-server');

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
  const sessionsToAnalyze = selectOptimalSessions(sessions, { maxSessions: 30 });
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
  const analysisResult = await analyzer.analyzeVerbose(parsedSessions, metrics);
  const verboseResult = analysisResult.evaluation;

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

  // Step 6: Start servers and open React SPA
  const reportUrl = `${WEB_UI_URL}/analysis?local=${analysisId}`;

  // Check if servers are running, start them if needed
  let serversStartedByUs = false;

  if (!noServer && !noOpen) {
    const apiRunning = await isServerRunning(API_URL);
    const webRunning = await isWebUIRunning();

    if (!apiRunning || !webRunning) {
      console.log(pc.dim('  🚀 Starting servers...'));
      setupCleanup();

      if (!apiRunning) {
        process.stdout.write(pc.dim('     Starting API server'));
        startAPIServer();
        await waitForServer(() => isServerRunning(API_URL), 'API server');
        console.log(pc.green(' ✓'));
      }

      if (!webRunning) {
        process.stdout.write(pc.dim('     Starting Web UI server'));
        startWebUIServer();
        await waitForServer(isWebUIRunning, 'Web UI server');
        console.log(pc.green(' ✓'));
      }

      serversStartedByUs = true;
      console.log('');
    }
  }

  if (!noOpen) {
    console.log(pc.dim('  🌐 Opening report in browser...'));
    openBrowser(reportUrl);
    console.log(pc.green(`  ✓ Report URL: ${reportUrl}`));
  } else {
    console.log(pc.dim('  Report URL:'));
    console.log(pc.cyan(`     ${reportUrl}`));
  }

  console.log('');

  // If we started the servers, keep running and show instructions
  if (serversStartedByUs) {
    console.log(pc.bold('  ════════════════════════════════════════════════'));
    console.log(pc.green('  ✓ Servers running. Report is ready!'));
    console.log('');
    console.log(pc.dim('  Press Ctrl+C to stop servers and exit.'));
    console.log(pc.dim(`  Report URL: ${reportUrl}`));
    console.log(pc.bold('  ════════════════════════════════════════════════'));

    // Keep the process alive
    await new Promise(() => {
      // This promise never resolves, keeping the process running
      // The setupCleanup() handler will catch Ctrl+C
    });
  } else {
    console.log(pc.dim('  To view this report later:'));
    console.log(pc.dim(`     Open ${reportUrl}`));
    console.log(pc.dim('     Or run: npm run ui'));
  }
}

main().catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
