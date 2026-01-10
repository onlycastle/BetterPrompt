#!/usr/bin/env npx tsx
/**
 * Local test script for NoMoreAISlop
 *
 * Usage: npx tsx scripts/test-local.ts [command] [args] [options]
 *
 * Commands:
 *   sessions    - List available sessions
 *   analyze     - Analyze a session (requires ANTHROPIC_API_KEY)
 *   history     - View past analyses
 *
 * Options:
 *   --summary   - Show only ratings and assessment
 *   --verbose   - Show all evidence details
 *   --json      - Output raw JSON
 *   --no-color  - Disable colors
 */

// Load .env file if present
import 'dotenv/config';

import pc from 'picocolors';
import { sessionParser } from '../src/parser/index.js';
import { storageManager } from '../src/utils/storage.js';
import { generateSessionsTable, generateHistoryList } from '../src/utils/reporter.js';
import { createAnalyzer } from '../src/analyzer/index.js';
import {
  createSpinner,
  renderReport,
  renderJson,
  renderError,
  type RenderOptions,
} from '../src/cli/index.js';

/**
 * Parse command line options
 */
function parseOptions(args: string[]): {
  positional: string[];
  options: Partial<RenderOptions> & { json?: boolean };
} {
  const positional: string[] = [];
  const options: Partial<RenderOptions> & { json?: boolean } = {};

  for (const arg of args) {
    if (arg === '--summary' || arg === '-s') {
      options.mode = 'summary';
    } else if (arg === '--verbose' || arg === '-v') {
      options.mode = 'verbose';
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--no-color') {
      options.noColor = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { positional, options };
}

async function main() {
  const [command, ...restArgs] = process.argv.slice(2);
  const { positional, options } = parseOptions(restArgs);

  switch (command) {
    case 'sessions':
      await listSessions();
      break;

    case 'analyze':
      await analyzeSession(positional[0], options);
      break;

    case 'history':
      await showHistory();
      break;

    default:
      showHelp();
  }
}

function showHelp() {
  console.log(`
${pc.bold('NoMoreAISlop')} - AI Collaboration Analyzer

${pc.dim('Usage:')} npx tsx scripts/test-local.ts [command] [args] [options]

${pc.bold('Commands:')}
  sessions              List available Claude Code sessions
  analyze [session-id]  Analyze a session (uses most recent if no ID)
  history               View past analysis results

${pc.bold('Options:')}
  --summary, -s   Show only ratings and assessment
  --verbose, -v   Show all evidence details
  --json          Output raw JSON (for piping)
  --no-color      Disable colored output

${pc.bold('Environment:')}
  ANTHROPIC_API_KEY     Required for 'analyze' command

${pc.bold('Examples:')}
  npx tsx scripts/test-local.ts sessions
  npx tsx scripts/test-local.ts analyze
  npx tsx scripts/test-local.ts analyze e0c35da6... --summary
  npx tsx scripts/test-local.ts analyze --json | jq .
`);
}

async function listSessions() {
  console.log(`\n${pc.bold('Available Sessions')}\n`);

  const sessions = await sessionParser.listSessions();

  if (sessions.length === 0) {
    console.log(pc.dim('No sessions found.'));
    return;
  }

  // Show first 20 sessions
  const table = generateSessionsTable(sessions.slice(0, 20));
  console.log(table);

  if (sessions.length > 20) {
    console.log(pc.dim(`\n... and ${sessions.length - 20} more sessions`));
  }

  console.log(pc.dim(`\nTotal: ${sessions.length} sessions`));
}

async function analyzeSession(
  sessionId?: string,
  options: Partial<RenderOptions> & { json?: boolean } = {}
) {
  const spinner = createSpinner();

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    renderError(
      'Missing API Key',
      'ANTHROPIC_API_KEY environment variable is required',
      [
        'Set it with: export ANTHROPIC_API_KEY=your-api-key',
        'Or add it to .env file',
      ]
    );
    process.exit(1);
  }

  // Get session ID
  const targetId = sessionId || (await sessionParser.getCurrentSessionId());
  if (!targetId) {
    renderError('No Session Found', 'Could not find a session to analyze', [
      'Run: npx tsx scripts/test-local.ts sessions',
      'Specify a session ID: analyze <session-id>',
    ]);
    process.exit(1);
  }

  try {
    // Parse session
    spinner.start(`Analyzing session ${targetId.slice(0, 8)}...`);

    const session = await sessionParser.parseSession(targetId);
    const duration = Math.round(session.durationSeconds / 60);
    spinner.succeed('Parsed session');
    console.log(
      pc.dim(
        `   ${session.messages.length} messages, ${duration} min, ${session.stats.toolCallCount} tool calls`
      )
    );

    // Analyze
    spinner.start('Sending to Claude for analysis...');
    const analyzer = createAnalyzer();
    const evaluation = await analyzer.analyze(session);
    spinner.succeed('Analysis complete');

    // Save
    spinner.start('Saving results...');
    const savePath = await storageManager.saveAnalysis(evaluation, session);
    spinner.succeed('Saved');
    console.log(pc.dim(`   ${savePath}`));

    // Render output
    console.log('');

    if (options.json) {
      renderJson(evaluation, session, savePath);
    } else {
      renderReport(evaluation, session, savePath, options);
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    renderError('Analysis Error', (error as Error).message, [
      'Check your API key is valid',
      'Ensure the session ID exists',
      'Check your network connection',
    ]);
    process.exit(1);
  }
}

async function showHistory() {
  console.log(`\n${pc.bold('Analysis History')}\n`);

  const analyses = await storageManager.listAnalyses();

  if (analyses.length === 0) {
    console.log(pc.dim('No past analyses found.'));
    console.log(pc.dim('Run: npx tsx scripts/test-local.ts analyze'));
    return;
  }

  const table = generateHistoryList(analyses);
  console.log(table);

  console.log(pc.dim(`\nTotal: ${analyses.length} analyses`));
  console.log(pc.dim(`Storage: ${storageManager.getAnalysesPath()}`));
}

main().catch(console.error);
