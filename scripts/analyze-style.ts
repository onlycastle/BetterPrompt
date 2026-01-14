#!/usr/bin/env node
import 'dotenv/config';

/**
 * AI Coding Style Analyzer - v2.2
 *
 * Analyzes ~/.claude session logs to determine your AI Coding Style type.
 * Generates both CLI output and a local web report with deep analysis dimensions.
 *
 * Runs LLM-powered verbose analysis with token stats and cost estimate.
 *
 * Options:
 *   --dry-run    Show cost estimate without running analysis
 *   --yes        Skip cost confirmation prompts
 */

import { SessionParser } from '../src/parser/index.js';
import { aggregateMetrics } from '../src/analyzer/type-detector.js';
import { startVerboseReportServer } from '../src/web/index.js';
import { selectOptimalSessions } from '../src/parser/session-selector.js';
import { estimateAnalysisCost, countTokensAccurate } from '../src/analyzer/cost-estimator.js';
import { confirmCost } from '../src/cli/output/components/cost-confirmation.js';
import { VerboseAnalyzer } from '../src/analyzer/verbose-analyzer.js';
import pc from 'picocolors';

async function main() {
  // Parse CLI flags
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');

  console.log('');
  console.log(pc.bold('  ╔═══════════════════════════════════════════════════╗'));
  console.log(pc.bold('  ║') + pc.cyan('  NO MORE AI SLOP') + pc.bold('                    v1.0.0  ') + pc.bold('║'));
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
    } catch (err) {
      // Skip invalid sessions
    }
  }

  if (parsedSessions.length === 0) {
    console.error(pc.red('  ✗ Could not parse any sessions'));
    process.exit(1);
  }

  console.log(pc.dim(`     Parsed ${parsedSessions.length} sessions successfully`));
  console.log('');

  // Calculate session statistics
  let totalMessages = 0;
  let totalChars = 0;
  for (const session of parsedSessions) {
    totalMessages += session.messages.length;
    for (const msg of session.messages) {
      if (msg.content) {
        totalChars += msg.content.length;
      }
    }
  }
  const estimatedTokens = countTokensAccurate(
    parsedSessions.map(s => s.messages.map(m => m.content || '').join('\n')).join('\n')
  );

  console.log(pc.bold('  📊 Session Statistics:'));
  console.log(pc.dim(`     Sessions analyzed: ${parsedSessions.length}`));
  console.log(pc.dim(`     Total messages: ${totalMessages.toLocaleString()}`));
  console.log(pc.dim(`     Total characters: ${totalChars.toLocaleString()}`));
  console.log(pc.dim(`     Estimated tokens: ~${estimatedTokens.toLocaleString()}`));
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

  // Step 5: Start web server with verbose results
  console.log(pc.dim('  🌐 Starting web report...'));
  const { url } = await startVerboseReportServer(verboseResult, {
    port: 3000,
    autoOpen: true,
  });
  console.log(pc.green(`  ✓ Report ready at ${url}`));
  console.log(pc.dim('  Press Ctrl+C to stop'));
  // Server runs until user presses Ctrl+C
}

main().catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
