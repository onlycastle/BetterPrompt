#!/usr/bin/env node
/**
 * no-ai-slop CLI
 *
 * Analyze your AI collaboration style with Claude Code
 *
 * Usage:
 *   npx no-ai-slop          # Analyze sessions (login required)
 *   npx no-ai-slop logout   # Sign out
 *   npx no-ai-slop status   # Check login status
 */

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
import { createProgressDisplay } from './progress.js';
import {
  storeTokens,
  getStoredAccessToken,
  getStoredUserEmail,
  clearTokens,
  hasStoredTokens,
} from './auth/token-store.js';
import {
  startDeviceFlow,
  pollForToken,
  getUserInfo,
} from './auth/device-flow.js';

/**
 * Display device flow code and URL
 */
function displayDeviceCode(userCode: string, verificationUri: string): void {
  console.log('');
  console.log(pc.bold(pc.cyan('  📱 Visit: ')) + pc.underline(verificationUri));
  console.log(pc.bold(pc.cyan('     Enter code: ')) + pc.bold(pc.white(userCode)));
  console.log('');
}

/**
 * Parse session selection string into indices
 */
function parseSessionSelection(input: string, max: number): number[] {
  const indices = new Set<number>();
  const parts = input.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= max) indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= max) {
        indices.add(num - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Prompt user for session selection
 */
async function promptSessionSelection(maxSessions: number): Promise<number[] | 'all'> {
  const { createInterface } = await import('node:readline');
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
 * Prompt for yes/no confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const { createInterface } = await import('node:readline');
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
 * Handle logout command
 */
async function handleLogout(): Promise<void> {
  const spinner = ora('Signing out...').start();

  try {
    await clearTokens();
    spinner.succeed('Signed out successfully');
  } catch {
    spinner.fail('Failed to sign out');
  }
}

/**
 * Handle status command
 */
async function handleStatus(): Promise<void> {
  const hasTokens = await hasStoredTokens();

  if (!hasTokens) {
    console.log('');
    console.log(pc.yellow('  Not signed in'));
    console.log(pc.dim('  Run "npx no-ai-slop" to sign in and analyze your sessions'));
    console.log('');
    return;
  }

  const email = await getStoredUserEmail();
  console.log('');
  console.log(pc.green('  ✓ Signed in') + (email ? pc.dim(` as ${email}`) : ''));
  console.log('');
}

/**
 * Perform device flow authentication
 */
async function performDeviceFlowAuth(): Promise<string> {
  console.log(pc.bold(pc.yellow('🔐 Sign in required')));

  const spinner = ora('Starting authentication...').start();

  try {
    const deviceFlow = await startDeviceFlow();
    spinner.stop();

    displayDeviceCode(deviceFlow.userCode, deviceFlow.verificationUri);

    const pollSpinner = ora('Waiting for authorization...').start();
    let pollCount = 0;

    while (true) {
      await sleep(deviceFlow.interval * 1000);
      pollCount++;

      // Update spinner text
      pollSpinner.text = `Waiting for authorization${'.'.repeat(pollCount % 4)}`;

      const result = await pollForToken(deviceFlow.deviceCode);

      if (result.status === 'success') {
        pollSpinner.succeed('Authorized!');

        // Get user info and store tokens
        const userInfo = await getUserInfo(result.tokens.accessToken);
        await storeTokens({
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          email: userInfo.email,
        });

        console.log(pc.dim(`  Signed in as ${userInfo.email}`));
        console.log('');

        return result.tokens.accessToken;
      }

      if (result.status === 'error') {
        pollSpinner.fail('Authorization failed');
        throw new Error(result.message);
      }

      // Check timeout (15 minutes)
      if (pollCount * deviceFlow.interval > 900) {
        pollSpinner.fail('Authorization timed out');
        throw new Error('Device authorization timed out. Please try again.');
      }
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Main analysis flow
 */
async function runAnalysis(): Promise<void> {
  console.log('');
  console.log(pc.bold(pc.cyan('🚀 no-ai-slop')) + pc.dim(' - AI Collaboration Style Analyzer'));
  console.log('');

  // 1. Check for existing token
  let accessToken = await getStoredAccessToken();

  if (accessToken) {
    const email = await getStoredUserEmail();
    console.log(pc.green('✓ Signed in') + (email ? pc.dim(` as ${email}`) : ''));
    console.log('');
  } else {
    // 2. Perform device flow authentication
    accessToken = await performDeviceFlowAuth();
  }

  // 3. Check if Claude projects directory exists
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions();
    process.exit(1);
  }

  // 4. Scan sessions
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

  // 5. Display session list for selection
  displaySessionList(scanResult.sessions);
  displaySelectionHelp();

  // 6. Prompt for selection
  const selection = await promptSessionSelection(scanResult.sessions.length);

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

  // 7. Estimate and display cost
  const parsedSessions = selectedSessions.map(s => s.parsed);
  const costEstimate = estimateAnalysisCost(parsedSessions);
  console.log(renderCostEstimate(costEstimate, selectedSessions.length));

  // 8. Create filtered ScanResult for upload
  const filteredResult = {
    sessions: selectedSessions,
    totalMessages: selectedSessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
    totalDurationMinutes: selectedSessions.reduce(
      (sum, s) => sum + Math.round(s.metadata.durationSeconds / 60),
      0
    ),
  };

  // 9. Show privacy notice and ask for consent
  displayPrivacyNotice();

  const consent = await confirm('Proceed with analysis?');
  if (!consent) {
    console.log(pc.dim('\nAnalysis cancelled.'));
    process.exit(0);
  }

  // 10. Upload and analyze with progress display
  const progressDisplay = createProgressDisplay();
  progressDisplay.start();

  try {
    const result = await uploadForAnalysis(filteredResult, accessToken, (stage, progress, message) => {
      progressDisplay.update(stage, progress, message);
    });
    progressDisplay.succeed('Analysis complete!');

    // 11. Display results
    displayResults(result);
  } catch (error) {
    progressDisplay.fail('Analysis failed');

    // If auth error, clear tokens and suggest re-login
    if (error instanceof Error && error.message.includes('401')) {
      await clearTokens();
      console.log(pc.dim('\n  Session expired. Please run again to re-authenticate.'));
    } else {
      displayError(error instanceof Error ? error.message : 'Unknown error');
    }

    process.exit(1);
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'logout':
      await handleLogout();
      break;

    case 'status':
      await handleStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log('');
      console.log(pc.bold(pc.cyan('Usage:')) + ' npx no-ai-slop [command]');
      console.log('');
      console.log(pc.bold('Commands:'));
      console.log('  (default)    Analyze your Claude Code sessions');
      console.log('  logout       Sign out from NoMoreAISlop');
      console.log('  status       Check your login status');
      console.log('  help         Show this help message');
      console.log('');
      break;

    default:
      await runAnalysis();
      break;
  }
}

// Run
main().catch((error) => {
  displayError(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
