#!/usr/bin/env node
/**
 * AI Coding Style Analyzer - v2.1
 *
 * Analyzes ~/.claude session logs to determine your AI Coding Style type.
 * Generates both CLI output and a local web report with deep analysis dimensions.
 */

import { SessionParser } from '../src/parser/index.js';
import { analyzeStyle } from '../src/analyzer/style-analyzer.js';
import { calculateAllDimensions } from '../src/analyzer/dimensions/index.js';
import { renderFullTypeResult, renderDimensionSummary } from '../src/cli/output/components/index.js';
import { startReportServer } from '../src/web/index.js';
import pc from 'picocolors';

async function main() {
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

  // Step 2: Parse recent sessions (last 30 for analysis)
  const recentSessions = sessions.slice(0, 30);
  console.log(pc.dim(`  ⏳ Analyzing ${recentSessions.length} recent sessions...`));

  const parsedSessions = [];
  for (const metadata of recentSessions) {
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

  // Step 3: Analyze style
  console.log(pc.dim('  🔬 Analyzing your AI collaboration patterns...'));
  const result = analyzeStyle(parsedSessions);

  // Step 3.5: Calculate extended dimensions
  console.log(pc.dim('  📈 Calculating deep analysis dimensions...'));
  const dimensions = calculateAllDimensions(parsedSessions);

  console.log(pc.green('  ✓ Analysis complete!'));
  console.log('');

  // Step 4: Display CLI output
  const cliOutput = renderFullTypeResult(result, {
    showEvidence: true,
    maxEvidence: 2,
    showLockedTeaser: true,
    webPort: 3000,
  });

  console.log(cliOutput);

  // Step 4.5: Display dimension summary
  const dimensionOutput = renderDimensionSummary(dimensions);
  console.log(dimensionOutput);

  // Step 5: Start web server with dimensions
  try {
    const { url } = await startReportServer(
      result,
      { port: 3000, autoOpen: true },
      dimensions
    );
    console.log(pc.dim(`  Server running at ${url}`));
    console.log(pc.dim('  Press Ctrl+C to stop'));
  } catch (err) {
    console.error(pc.yellow('  ⚠ Could not start web server'));
    console.error(pc.dim(`    ${(err as Error).message}`));
  }
}

main().catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
