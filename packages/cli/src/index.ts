#!/usr/bin/env node
/**
 * no-ai-slop CLI
 *
 * Analyze your AI collaboration style with Claude Code
 */

import { createInterface } from 'node:readline';
import pc from 'picocolors';
import ora from 'ora';
import { scanSessions, hasClaudeProjects } from './scanner.js';
import { uploadForAnalysis } from './uploader.js';
import {
  displayResults,
  displayPrivacyNotice,
  displayError,
  displayNoSessions,
  displaySessionList,
  displaySelectionHelp,
} from './display.js';
import { estimateAnalysisCost, renderCostEstimate } from './cost-estimator.js';
import { saveCache, loadCache, displayCacheHelp } from './cache.js';
import { createProgressDisplay } from './progress.js';

/**
 * Parse CLI arguments
 */
function parseArgs(): { saveCache: boolean; useCache: boolean; help: boolean; apiKey?: string } {
  const args = process.argv.slice(2);

  // Parse --api-key flag
  let apiKey: string | undefined;
  const apiKeyIndex = args.findIndex(arg => arg === '--api-key' || arg.startsWith('--api-key='));
  if (apiKeyIndex !== -1) {
    const arg = args[apiKeyIndex];
    if (arg.includes('=')) {
      apiKey = arg.split('=')[1];
    } else if (args[apiKeyIndex + 1] && !args[apiKeyIndex + 1].startsWith('-')) {
      apiKey = args[apiKeyIndex + 1];
    }
  }

  // Also check environment variable
  if (!apiKey) {
    apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  }

  return {
    saveCache: args.includes('--save-cache'),
    useCache: args.includes('--use-cache'),
    help: args.includes('--help') || args.includes('-h'),
    apiKey,
  };
}

/**
 * Display help message
 */
function displayHelp(): void {
  console.log('');
  console.log(pc.bold(pc.cyan('Usage:')) + ' npx no-ai-slop [options]');
  console.log('');
  console.log(pc.bold('Options:'));
  console.log('  --api-key KEY   Your Google Gemini API key (or set GOOGLE_GEMINI_API_KEY env)');
  console.log('  --save-cache    Run analysis and save result to local cache');
  console.log('  --use-cache     Use cached analysis result (skip API call)');
  console.log('  --help, -h      Show this help message');
  console.log('');
  console.log(pc.bold('Environment Variables:'));
  console.log('  GOOGLE_GEMINI_API_KEY    Your Gemini API key (alternative to --api-key)');
  console.log('');
  console.log(pc.dim('Get your API key at: https://aistudio.google.com/app/apikey'));
  console.log('');
}

/**
 * Prompt user for API key
 */
async function promptApiKey(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(pc.yellow('⚠️  No API key found.'));
  console.log(pc.dim('  Get your free Gemini API key at: https://aistudio.google.com/app/apikey'));
  console.log('');

  return new Promise((resolve) => {
    rl.question(pc.cyan('Enter your Gemini API key: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (Y/n): `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Parse session selection string into indices
 * Supports: "1,3,5", "1-5", "1-3,5,7-10"
 */
function parseSessionSelection(input: string, max: number): number[] {
  const indices = new Set<number>();

  // Split by comma
  const parts = input.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Range: "1-5"
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= max) indices.add(i - 1); // Convert to 0-based
        }
      }
    } else {
      // Single number
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= max) {
        indices.add(num - 1); // Convert to 0-based
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Prompt user for session selection
 */
async function promptSessionSelection(maxSessions: number): Promise<number[] | 'all'> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(pc.cyan('Select sessions to analyze: '), (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();

      if (normalized === '' || normalized === 'all') {
        resolve('all');
        return;
      }

      resolve(parseSessionSelection(normalized, maxSessions));
    });
  });
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // Handle help flag
  if (args.help) {
    displayHelp();
    process.exit(0);
  }

  console.log('');
  console.log(pc.bold(pc.cyan('🚀 no-ai-slop')) + pc.dim(' - AI Collaboration Style Analyzer'));
  console.log('');

  // Try to use cached analysis result if requested
  if (args.useCache) {
    console.log(pc.dim('  Checking analysis cache...'));
    const cachedResult = await loadCache();
    if (cachedResult) {
      displayResults(cachedResult);
      return;
    }
    console.log(pc.dim('  No cached analysis found, running fresh analysis...'));
  }

  // Check if Claude projects directory exists
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions();
    process.exit(1);
  }

  // Scan sessions
  const scanSpinner = ora('Scanning Claude Code sessions...').start();

  let scanResult;
  try {
    scanResult = await scanSessions(10);
  } catch (error) {
    scanSpinner.fail('Failed to scan sessions');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  if (scanResult.sessions.length === 0) {
    scanSpinner.stop();
    displayNoSessions();
    process.exit(1);
  }

  scanSpinner.succeed(
    `Found ${pc.bold(String(scanResult.sessions.length))} sessions`
  );

  // Display session list for selection
  displaySessionList(scanResult.sessions);
  displaySelectionHelp();

  // Prompt for selection
  const selection = await promptSessionSelection(scanResult.sessions.length);

  // Filter sessions based on selection
  let selectedSessions;
  if (selection === 'all') {
    selectedSessions = scanResult.sessions;
    console.log(pc.dim(`  Selected all ${selectedSessions.length} sessions\n`));
  } else if (selection.length === 0) {
    console.log(pc.yellow('\n  No valid sessions selected.\n'));
    process.exit(0);
  } else {
    selectedSessions = selection.map(i => scanResult.sessions[i]);
    console.log(pc.dim(`  Selected ${selectedSessions.length} session(s)\n`));
  }

  // Extract parsed sessions for cost estimation
  const parsedSessions = selectedSessions.map(s => s.parsed);

  // Estimate and display cost using parsed sessions
  const costEstimate = estimateAnalysisCost(parsedSessions);
  console.log(renderCostEstimate(costEstimate, selectedSessions.length));

  // Create filtered ScanResult for upload
  const filteredResult = {
    sessions: selectedSessions,
    totalMessages: selectedSessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
    totalDurationMinutes: selectedSessions.reduce(
      (sum, s) => sum + Math.round(s.metadata.durationSeconds / 60),
      0
    ),
  };

  // Show privacy notice and ask for consent
  displayPrivacyNotice();

  const consent = await confirm('Proceed with analysis?');
  if (!consent) {
    console.log(pc.dim('\nAnalysis cancelled.'));
    process.exit(0);
  }

  // Get API key (from args, env, or prompt)
  let apiKey = args.apiKey;
  if (!apiKey) {
    apiKey = await promptApiKey();
    if (!apiKey) {
      console.log(pc.red('\n❌ API key is required for analysis.'));
      process.exit(1);
    }
  }

  // Upload and analyze with rich progress display
  const progressDisplay = createProgressDisplay();
  progressDisplay.start();

  try {
    const result = await uploadForAnalysis(filteredResult, apiKey, (stage, progress, message) => {
      // Update progress display with detailed info
      progressDisplay.update(stage, progress, message);
    });
    progressDisplay.succeed('Analysis complete!');

    // Save to cache if requested
    if (args.saveCache) {
      await saveCache(result);
    }

    // Display results
    displayResults(result);
  } catch (error) {
    progressDisplay.fail('Analysis failed');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  displayError(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
