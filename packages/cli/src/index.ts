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
} from './display.js';
import { estimateAnalysisCost, renderCostEstimate } from './cost-estimator.js';
import { saveCache, loadCache, displayCacheHelp } from './cache.js';

/**
 * Parse CLI arguments
 */
function parseArgs(): { saveCache: boolean; useCache: boolean; help: boolean } {
  const args = process.argv.slice(2);
  return {
    saveCache: args.includes('--save-cache'),
    useCache: args.includes('--use-cache'),
    help: args.includes('--help') || args.includes('-h'),
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
  console.log('  --save-cache    Save scanned sessions to local cache');
  console.log('  --use-cache     Use cached sessions (skip scanning)');
  console.log('  --help, -h      Show this help message');
  console.log('');
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

  // Check if Claude projects directory exists
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions();
    process.exit(1);
  }

  let scanResult;

  // Try to use cache if requested
  if (args.useCache) {
    console.log(pc.dim('  Checking cache...'));
    const cached = await loadCache();
    if (cached) {
      scanResult = cached;
    } else {
      console.log(pc.dim('  Cache miss, scanning...'));
    }
  }

  // Scan if we don't have cached data
  if (!scanResult) {
    const scanSpinner = ora('Scanning Claude Code sessions...').start();

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
      `Found ${pc.bold(String(scanResult.sessions.length))} sessions ` +
      `(${pc.dim(`${scanResult.totalMessages} interactions`)})`
    );

    // Save to cache if requested
    if (args.saveCache) {
      await saveCache(scanResult);
    }
  } else {
    // Display cached session info
    console.log(
      pc.green('✔') + ` Loaded ${pc.bold(String(scanResult.sessions.length))} sessions from cache ` +
      `(${pc.dim(`${scanResult.totalMessages} interactions`)})`
    );
  }

  // Estimate and display cost
  const costEstimate = estimateAnalysisCost(scanResult);
  console.log(renderCostEstimate(costEstimate, scanResult.sessions.length));

  // Show privacy notice and ask for consent
  displayPrivacyNotice();

  const consent = await confirm('Proceed with analysis?');
  if (!consent) {
    console.log(pc.dim('\nAnalysis cancelled.'));
    process.exit(0);
  }

  // Upload and analyze with streaming progress
  const analyzeSpinner = ora('Analyzing your AI collaboration style...').start();

  try {
    const result = await uploadForAnalysis(scanResult, (stage, progress, message) => {
      // Update spinner text with progress
      analyzeSpinner.text = `${message} (${progress}%)`;
    });
    analyzeSpinner.succeed('Analysis complete!');

    // Display results
    displayResults(result);
  } catch (error) {
    analyzeSpinner.fail('Analysis failed');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  displayError(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
