#!/usr/bin/env node
/**
 * betterprompt CLI
 *
 * See your AI anti-patterns in Claude Code sessions
 *
 * Usage:
 *   npx betterprompt          # Analyze sessions
 *   npx betterprompt help     # Show help
 */

import pc from 'picocolors';
import ora from 'ora';
import { scanSessions, scanActivitySessions, hasClaudeProjects } from './scanner.js';
import { discoverProjects, promptProjectSelection } from './project-picker.js';
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
import { computeSessionInsights, generateWelcomeBanner } from './animations/index.js';

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
 * Prompt user to select their AI coding tool.
 */
async function promptToolSelection(): Promise<ToolSelectionResult> {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log(pc.bold(pc.cyan('  Which AI coding tool do you use?')));
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
 * Options for the analysis flow
 */
interface RunAnalysisOptions {
  noTranslate?: boolean;
}

/**
 * Main analysis flow - no authentication required
 */
async function runAnalysis(options: RunAnalysisOptions = {}): Promise<void> {
  // Step 1: Welcome banner with Chippy mascot
  console.log(generateWelcomeBanner());

  // Tool selection: detect installed tools or prompt user
  const toolSelection = await promptToolSelection();
  console.log('');

  // Check if any session sources are available
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions(toolSelection.displayLabel);
    process.exit(1);
  }

  // Step 2: Discover and select projects
  const discoverySpinner = ora(`Discovering ${toolSelection.displayLabel} projects...`).start();
  let allProjects;
  try {
    allProjects = await discoverProjects(toolSelection.includeSources);
  } catch (error) {
    discoverySpinner.fail('Failed to discover projects');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  discoverySpinner.succeed(`Found ${allProjects.length} projects`);

  const projectSelection = await promptProjectSelection(allProjects);
  const projectFilter = projectSelection.mode === 'selected'
    ? projectSelection.encodedNames
    : undefined;

  console.log('');

  // Step 3: Scan sessions from selected projects
  const scanSpinner = ora(`Scanning ${toolSelection.displayLabel} sessions...`).start();

  let scanResult;
  try {
    scanResult = await scanSessions(50, toolSelection.includeSources, projectFilter);
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
    // Activity scanning is non-critical -- continue without it
    activitySessions = undefined;
  }

  scanSpinner.succeed('Sessions loaded');

  // Debug mode: allow manual session selection
  let selectedSessions = scanResult.sessions;
  const isDebugMode = process.env.BETTERPROMPT_DEBUG === '1';

  if (isDebugMode && scanResult.sessions.length > 1) {
    console.log('');
    console.log(pc.bold(pc.yellow('DEBUG MODE: Session Selection')));
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
      console.log(pc.dim('  -> Using all sessions'));
    } else if (selection.length === 0) {
      console.log(pc.dim('  -> Using all sessions (no valid selection)'));
    } else {
      selectedSessions = selection.map(idx => scanResult.sessions[idx]);
      console.log(pc.dim(`  -> Selected ${selectedSessions.length} session(s)`));
    }
    console.log('');
  }

  // Estimate cost (displayed when BETTERPROMPT_DEBUG=1)
  const parsedSessions = selectedSessions.map(s => s.parsed);
  const costEstimate = estimateAnalysisCost(parsedSessions);

  // Display cost estimate for developers when BETTERPROMPT_DEBUG is set
  if (process.env.BETTERPROMPT_DEBUG === '1') {
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

  // Schedule progressive discovery messages (~20s apart during wait)
  const discoveryMsgs = buildProgressiveDiscoveryMessages(scanInsights);
  chatDisplay.scheduleProgressiveMessages(discoveryMsgs, 20000);

  try {
    const result = await uploadForAnalysis(
      filteredResult,
      '',
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
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log('');
      console.log(pc.bold(pc.cyan('Usage:')) + ' npx betterprompt [command]');
      console.log('');
      console.log(pc.bold('Commands:'));
      console.log('  (default)    See anti-patterns in your Claude Code sessions');
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
