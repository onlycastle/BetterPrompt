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
  console.log('');
  console.log(pc.bold(pc.cyan('🚀 no-ai-slop')) + pc.dim(' - AI Collaboration Style Analyzer'));
  console.log('');

  // Check if Claude projects directory exists
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions();
    process.exit(1);
  }

  // Scan for sessions
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
    `Found ${pc.bold(String(scanResult.sessions.length))} sessions ` +
    `(${pc.dim(`${scanResult.totalMessages} interactions`)})`
  );

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
