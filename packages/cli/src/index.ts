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
import { scanSessions, scanActivitySessions, hasClaudeProjects, getSourceStatus } from './scanner.js';
import { uploadForAnalysis } from './uploader.js';
import {
  displayError,
  displayNoSessions,
  confirmWithPrivacy,
  displayResultsWithCelebration,
} from './display.js';
import { estimateAnalysisCost, renderCostEstimate } from './cost-estimator.js';
import { createChatDisplay } from './chat-display.js';
import { buildScanPreviewMessages, buildProgressiveDiscoveryMessages } from './chat-message.js';
import { computeSessionInsights } from './animations/index.js';
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
import {
  generateWelcomeBanner,
  getChippyFull,
  getWaitingMessage,
} from './animations/index.js';

/**
 * Web app base URL for dashboard links
 */
const WEB_APP_URL = 'https://www.nomoreaislop.app';

// ============================================================================
// Tool Selection Types
// ============================================================================

type ToolChoice = 'claude-code' | 'cursor' | 'both';

interface ToolSelectionResult {
  choice: ToolChoice;
  includeSources: string[];
  displayLabel: string;
}

const TOOL_CHOICES: Record<ToolChoice, ToolSelectionResult> = {
  'claude-code': { choice: 'claude-code', includeSources: ['claude-code'], displayLabel: 'Claude Code' },
  'cursor':      { choice: 'cursor', includeSources: ['cursor', 'cursor-composer'], displayLabel: 'Cursor' },
  'both':        { choice: 'both', includeSources: ['claude-code', 'cursor', 'cursor-composer'], displayLabel: 'Claude Code + Cursor' },
};

interface UserAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    sessionsAnalyzed?: number;
  } | null;
  isPaid: boolean;
  claimedAt: string;
}

/**
 * Display device flow code and URL with Chippy
 */
function displayDeviceCode(userCode: string, verificationUri: string): void {
  const chippy = getChippyFull('neutral');
  console.log('');
  chippy.forEach(line => console.log(line));
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
 * Prompt user to choose between new analysis or dashboard
 */
async function promptExistingAnalysis(analyses: UserAnalysis[]): Promise<'new' | 'dashboard'> {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(pc.bold(pc.cyan('📊 You have existing analyses!')));
  console.log('');

  // Show summary of most recent analysis
  const latest = analyses[0];
  const latestType = latest.evaluation?.primaryType || 'Analysis';
  const latestDate = new Date(latest.claimedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  console.log(pc.dim(`  Latest: ${latestType} (${latestDate})`));
  console.log(pc.dim(`  Total: ${analyses.length} analysis${analyses.length > 1 ? 'es' : ''}`));
  console.log('');

  console.log('  ' + pc.bold('1)') + ' 🔄 Run a new analysis');
  console.log('  ' + pc.bold('2)') + ' 📊 Open dashboard in browser');
  console.log('');

  return new Promise((resolve) => {
    rl.question(pc.cyan('Choose an option (1 or 2): '), (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '2') {
        resolve('dashboard');
      } else {
        resolve('new');
      }
    });
  });
}

/**
 * Prompt user to select their AI coding tool.
 * Auto-selects if only one source is available.
 */
async function promptToolSelection(): Promise<ToolSelectionResult> {
  const sourceStatus = await getSourceStatus();

  const hasClaudeCode = sourceStatus.get('claude-code') ?? false;
  const hasCursor = (sourceStatus.get('cursor') ?? false)
    || (sourceStatus.get('cursor-composer') ?? false);

  // Auto-select when only one source (or none) is available
  if (!hasClaudeCode || !hasCursor) {
    if (hasClaudeCode) {
      console.log(pc.dim('  Detected: Claude Code'));
      return TOOL_CHOICES['claude-code'];
    }
    if (hasCursor) {
      console.log(pc.dim('  Detected: Cursor'));
      return TOOL_CHOICES['cursor'];
    }
    // No sources detected — default to both, let later checks handle the error
    return TOOL_CHOICES['both'];
  }

  // Both available — prompt user
  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(pc.bold(pc.cyan('  🛠️  Which AI coding tool do you use?')));
  console.log('');
  console.log('  ' + pc.bold('1)') + ' Claude Code');
  console.log('  ' + pc.bold('2)') + ' Cursor');
  console.log('  ' + pc.bold('3)') + ' Both');
  console.log('');

  const CHOICE_MAP: Record<string, ToolChoice> = { '1': 'claude-code', '2': 'cursor' };

  return new Promise((resolve) => {
    rl.question(pc.cyan('  Select (1, 2, or 3): '), (answer) => {
      rl.close();
      const mapped = CHOICE_MAP[answer.trim()];
      // Default to 'both' for "3", empty input, or any other input
      resolve(TOOL_CHOICES[mapped ?? 'both']);
    });
  });
}

/**
 * Fetch user's existing analyses from the API
 */
async function fetchUserAnalyses(accessToken: string): Promise<UserAnalysis[]> {
  try {
    const response = await fetch(`${WEB_APP_URL}/api/analysis/user?limit=5`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Silently fail - don't block the user if API is down
      return [];
    }

    const data = await response.json() as { analyses?: UserAnalysis[] };
    return data.analyses || [];
  } catch {
    // Network error - silently fail
    return [];
  }
}

/**
 * Open URL in user's default browser
 */
async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  try {
    await execAsync(command);
  } catch {
    // If browser open fails, just print the URL
    console.log(pc.cyan(`  Open in browser: ${url}`));
  }
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
 * Get a valid access token.
 * Returns null if no stored token or token is invalid (caller should re-authenticate).
 *
 * CLI tokens (cli_*) are long-lived (30 days) and don't need refreshing.
 * Legacy Supabase JWTs (eyJ*) are detected and cleared to trigger re-authentication.
 */
async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await getStoredAccessToken();
  if (!accessToken) return null;

  // Detect legacy Supabase JWT — prompt upgrade to CLI token
  if (accessToken.startsWith('eyJ')) {
    console.log('');
    console.log(pc.yellow('  ⚠ Authentication upgrade required'));
    console.log(pc.dim('  Your session format has been upgraded for better reliability.'));
    console.log(pc.dim('  Please sign in again (one-time only).'));
    console.log('');
    await clearTokens();
    return null;
  }

  // Verify CLI token is still valid
  try {
    await getUserInfo(accessToken);
    return accessToken;
  } catch {
    // Token expired or invalid — caller should re-authenticate
    return null;
  }
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

    displayDeviceCode(deviceFlow.userCode, deviceFlow.verificationUriComplete || deviceFlow.verificationUri);

    const pollSpinner = ora('Waiting for authorization...').start();
    let pollCount = 0;

    while (true) {
      await sleep(deviceFlow.interval * 1000);
      pollCount++;

      // Update spinner with animated message
      pollSpinner.text = getWaitingMessage(pollCount);

      const result = await pollForToken(deviceFlow.deviceCode);

      if (result.status === 'success') {
        pollSpinner.succeed('Authorized!');

        // Get user info and store token
        const userInfo = await getUserInfo(result.tokens.accessToken);
        await storeTokens({
          accessToken: result.tokens.accessToken,
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
    spinner.fail('Authentication failed');
    throw error;
  }
}

/**
 * Options for the analysis flow
 */
interface RunAnalysisOptions {
  noTranslate?: boolean;
}

/**
 * Main analysis flow - Simplified 3-step UX
 */
async function runAnalysis(options: RunAnalysisOptions = {}): Promise<void> {
  // Step 1: Welcome banner with Chippy mascot
  console.log(generateWelcomeBanner());

  // Step 2: Auth check (validates token, refreshes if expired)
  let accessToken = await getValidAccessToken();

  if (accessToken) {
    const email = await getStoredUserEmail();
    console.log(pc.green('✓ Welcome back') + (email ? pc.dim(` ${email}`) : ''));
    console.log('');

    // Check for existing analyses
    const existingAnalyses = await fetchUserAnalyses(accessToken);
    if (existingAnalyses.length > 0) {
      const choice = await promptExistingAnalysis(existingAnalyses);

      if (choice === 'dashboard') {
        console.log('');
        console.log(pc.bold(pc.green('📊 Opening your dashboard...')));
        console.log(pc.dim(`  ${WEB_APP_URL}/dashboard/personal`));
        console.log('');
        await openBrowser(`${WEB_APP_URL}/dashboard/personal`);
        process.exit(0);
      }
      // Continue with new analysis if choice === 'new'
      console.log('');
    }
  } else {
    // Perform device flow authentication
    accessToken = await performDeviceFlowAuth();
  }

  // Tool selection: detect installed tools or prompt user
  const toolSelection = await promptToolSelection();
  console.log('');

  // Check if any session sources are available
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions(toolSelection.displayLabel);
    process.exit(1);
  }

  // Step 3: Auto-scan sessions and show summary
  const scanSpinner = ora(`Scanning ${toolSelection.displayLabel} sessions...`).start();

  let scanResult;
  try {
    scanResult = await scanSessions(50, toolSelection.includeSources);
  } catch (error) {
    scanSpinner.fail('Failed to scan sessions');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  if (scanResult.sessions.length === 0) {
    scanSpinner.stop();
    displayNoSessions(toolSelection.displayLabel);
    process.exit(1);
  }

  // Scan activity sessions (all recent sessions, lightweight metadata)
  let activitySessions;
  try {
    activitySessions = await scanActivitySessions(30, toolSelection.includeSources);
  } catch {
    // Activity scanning is non-critical — continue without it
    activitySessions = undefined;
  }

  scanSpinner.succeed('Sessions loaded');

  // Debug mode: allow manual session selection
  let selectedSessions = scanResult.sessions;
  const isDebugMode = process.env.NOSLOP_DEBUG === '1';

  if (isDebugMode && scanResult.sessions.length > 1) {
    console.log('');
    console.log(pc.bold(pc.yellow('🐛 DEBUG MODE: Session Selection')));
    console.log('');

    // Display session list with numbers
    scanResult.sessions.forEach((session, idx) => {
      const date = new Date(session.metadata.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const project = session.metadata.projectName;
      const msgs = session.metadata.messageCount;
      const sessionId = session.metadata.sessionId;
      const filePath = session.metadata.filePath;
      console.log(pc.dim(`  ${idx + 1}) `) + `${project} - ${msgs} msgs (${date})`);
      console.log(pc.dim(`     ID: ${sessionId}`));
      console.log(pc.dim(`     ${filePath}`));
    });
    console.log('');
    console.log(pc.dim('  Enter: all | 1 | 1,3 | 1-5'));

    const selection = await promptSessionSelection(scanResult.sessions.length);

    if (selection === 'all') {
      console.log(pc.dim('  → Using all sessions'));
    } else if (selection.length === 0) {
      console.log(pc.dim('  → Using all sessions (no valid selection)'));
    } else {
      selectedSessions = selection.map(idx => scanResult.sessions[idx]);
      console.log(pc.dim(`  → Selected ${selectedSessions.length} session(s)`));
    }
    console.log('');
  }

  // Estimate cost (displayed when NOSLOP_DEBUG=1)
  const parsedSessions = selectedSessions.map(s => s.parsed);
  const costEstimate = estimateAnalysisCost(parsedSessions);

  // Display cost estimate for developers when NOSLOP_DEBUG is set
  if (process.env.NOSLOP_DEBUG === '1') {
    console.log(renderCostEstimate(costEstimate, selectedSessions.length));
  }

  // Create filtered ScanResult for upload
  const filteredResult = {
    sessions: selectedSessions,
    totalMessages: selectedSessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
    totalDurationMinutes: selectedSessions.reduce(
      (sum, s) => sum + Math.round(s.metadata.durationSeconds / 60),
      0
    ),
    activitySessions,
  };

  // Single confirmation with inline privacy notice
  const consent = await confirmWithPrivacy();
  if (!consent) {
    console.log(pc.dim('\nAnalysis cancelled.'));
    process.exit(0);
  }

  console.log('');

  // Step 4: Analysis with Chippy chat display (live results)
  const chatDisplay = createChatDisplay({ sessions: selectedSessions });
  chatDisplay.start();

  // Inject scan insights as early chat messages (before server responds)
  const scanInsights = computeSessionInsights(selectedSessions);
  const scanMessages = buildScanPreviewMessages(scanInsights);
  for (const msg of scanMessages) {
    chatDisplay.addPhasePreview(msg.phase, msg.snippets);
  }

  // Schedule progressive discovery messages (~7s apart during wait)
  const discoveryMsgs = buildProgressiveDiscoveryMessages(scanInsights);
  chatDisplay.scheduleProgressiveMessages(discoveryMsgs, 7000);

  try {
    const result = await uploadForAnalysis(
      filteredResult,
      accessToken,
      (stage, progress, message) => {
        chatDisplay.update(stage, progress, message);
      },
      (phase, snippets) => {
        chatDisplay.addPhasePreview(phase, snippets);
      },
      { noTranslate: options.noTranslate }
    );
    chatDisplay.succeed('Analysis complete!');

    // Step 5: Results with celebration
    displayResultsWithCelebration(result);
  } catch (error) {
    chatDisplay.fail('Analysis failed');

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
      console.log(pc.bold('Options:'));
      console.log('  --no-translate   Skip translation (Phase 4), keep results in English');
      console.log('');
      break;

    default: {
      const noTranslate = process.argv.includes('--no-translate');
      await runAnalysis({ noTranslate });
      break;
    }
  }
}

// Run
main().catch((error) => {
  displayError(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
