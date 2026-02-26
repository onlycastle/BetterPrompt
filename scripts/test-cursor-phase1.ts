/**
 * Cursor Session Phase 1 Test Script
 *
 * Tests the DataExtractorWorker (Phase 1) with Cursor session data.
 * Verifies that Cursor sessions produce the same Phase 1 output format
 * as Claude Code sessions (developerUtterances, sessionMetrics).
 *
 * Usage:
 *   npx tsx scripts/test-cursor-phase1.ts                    # Default: latest 3 sessions
 *   npx tsx scripts/test-cursor-phase1.ts -n=5               # Latest 5 sessions
 *   npx tsx scripts/test-cursor-phase1.ts --utterances-only  # Only show utterances
 *   npx tsx scripts/test-cursor-phase1.ts /path/to/store.db  # Specific file
 *
 * Environment:
 *   Requires GOOGLE_GEMINI_API_KEY in .env for LLM filtering
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import {
  CursorSource,
  CURSOR_CHATS_DIR,
} from '../packages/cli/src/lib/scanner/sources/cursor';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import type { WorkerContext, OrchestratorConfig } from '../src/lib/analyzer/orchestrator/types';
import type { SessionMetrics } from '../src/lib/domain/models/analysis';
import type { Phase1Output, UserUtterance } from '../src/lib/models/phase1-output';
import type { ParsedSession } from '../src/lib/models/session';
import type { SourcedParsedSession } from '../packages/cli/src/lib/scanner/sources/base';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SESSION_COUNT = 3;

// ============================================================================
// Helper Functions
// ============================================================================

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) return '?';
  return value ? '✓' : '✗';
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * Create configuration for DataExtractorWorker with verbose logging enabled
 */
function createConfig(): OrchestratorConfig {
  return {
    geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '',
    verbose: true,
  };
}

function createMockMetrics(): SessionMetrics {
  return {
    avgPromptLength: 0,
    avgFirstPromptLength: 0,
    maxPromptLength: 0,
    avgTurnsPerSession: 0,
    totalTurns: 0,
    questionFrequency: 0,
    whyHowWhatCount: 0,
    toolUsage: {
      read: 0,
      grep: 0,
      glob: 0,
      task: 0,
      plan: 0,
      bash: 0,
      write: 0,
      edit: 0,
      total: 0,
    },
    modificationRequestCount: 0,
    modificationRate: 0,
    refactorKeywordCount: 0,
    styleKeywordCount: 0,
    qualityTermCount: 0,
    positiveFeedbackCount: 0,
    negativeFeedbackCount: 0,
    avgCycleTimeSeconds: 0,
    sessionDurationSeconds: 0,
  };
}

interface StoreDbFile {
  path: string;
  mtime: Date;
  size: number;
  workspaceHash: string;
  sessionId: string;
}

/**
 * Find store.db files in Cursor chats directory
 */
function findStoreDbFiles(baseDir: string, count: number): StoreDbFile[] {
  const files: StoreDbFile[] = [];

  try {
    const workspaceDirs = fs.readdirSync(baseDir);

    for (const workspaceHash of workspaceDirs) {
      const workspacePath = path.join(baseDir, workspaceHash);
      const stat = fs.statSync(workspacePath);
      if (!stat.isDirectory()) continue;

      try {
        const sessionDirs = fs.readdirSync(workspacePath);

        for (const sessionId of sessionDirs) {
          const sessionPath = path.join(workspacePath, sessionId);
          const sessionStat = fs.statSync(sessionPath);
          if (!sessionStat.isDirectory()) continue;

          const storeDbPath = path.join(sessionPath, 'store.db');
          try {
            const dbStat = fs.statSync(storeDbPath);
            if (dbStat.isFile()) {
              files.push({
                path: storeDbPath,
                mtime: dbStat.mtime,
                size: dbStat.size,
                workspaceHash,
                sessionId,
              });
            }
          } catch {
            // store.db doesn't exist
          }
        }
      } catch {
        // Can't read workspace directory
      }
    }
  } catch {
    // Can't read base directory
  }

  // Sort by modification time (newest first)
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.slice(0, count);
}

function printUtterance(index: number, utterance: UserUtterance): void {
  const code = formatBoolean(utterance.hasCodeBlock);
  const question = formatBoolean(utterance.hasQuestion);

  console.log(
    `#${String(index + 1).padStart(3)} | ` +
    `chars: ${String(utterance.characterCount).padStart(5)} | ` +
    `words: ${String(utterance.wordCount).padStart(4)} | ` +
    `code: ${code} | ` +
    `question: ${question}`
  );

  // Show displayText (full, no truncation for debugging)
  const displayText = utterance.displayText ?? utterance.text;
  console.log(`      | displayText: "${displayText}"`);

  // Show machine content ratio if significant
  if (utterance.machineContentRatio !== undefined && utterance.machineContentRatio > 0.1) {
    console.log(`      | machineContentRatio: ${(utterance.machineContentRatio * 100).toFixed(1)}%`);
  }
}

function printSessionMetrics(metrics: Phase1Output['sessionMetrics']): void {
  console.log(`- totalSessions: ${metrics.totalSessions}`);
  console.log(`- totalMessages: ${metrics.totalMessages}`);
  console.log(`- totalDeveloperUtterances: ${metrics.totalDeveloperUtterances}`);
  console.log(`- totalAIResponses: ${metrics.totalAIResponses}`);
  console.log(`- avgMessagesPerSession: ${metrics.avgMessagesPerSession.toFixed(2)}`);
  console.log(`- avgDeveloperMessageLength: ${metrics.avgDeveloperMessageLength.toFixed(2)}`);
  console.log(`- questionRatio: ${(metrics.questionRatio * 100).toFixed(1)}%`);
  console.log(`- codeBlockRatio: ${(metrics.codeBlockRatio * 100).toFixed(1)}%`);
  console.log(`- dateRange: ${metrics.dateRange.earliest} ~ ${metrics.dateRange.latest}`);

  // Context Fill Metrics (deterministic, calculated from token data)
  console.log('- contextFillMetrics:');
  if (metrics.avgContextFillPercent !== undefined) {
    console.log(`    avgContextFillPercent: ${metrics.avgContextFillPercent}%`);
    console.log(`    maxContextFillPercent: ${metrics.maxContextFillPercent}%`);
    console.log(`    contextFillExceeded90Count: ${metrics.contextFillExceeded90Count}`);
  } else {
    console.log('    (no token data available)');
  }

}

/**
 * Convert SourcedParsedSession to ParsedSession
 * (Simply removes the 'source' field which isn't needed for Phase 1)
 */
function toParseSession(sourced: SourcedParsedSession): ParsedSession {
  // SourcedParsedSession extends ParsedSession, so all fields are already there
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source, ...session } = sourced;
  return session as ParsedSession;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let specificFiles: string[] = [];
  let utterancesOnly = false;
  let sessionCount = DEFAULT_SESSION_COUNT;

  for (const arg of args) {
    if (arg === '--utterances-only') {
      utterancesOnly = true;
    } else if (arg.startsWith('-n=')) {
      const n = parseInt(arg.replace('-n=', ''), 10);
      if (!isNaN(n) && n > 0) {
        sessionCount = n;
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Cursor Session Phase 1 Test Script

Usage:
  npx tsx scripts/test-cursor-phase1.ts                    # Default: latest ${DEFAULT_SESSION_COUNT} sessions
  npx tsx scripts/test-cursor-phase1.ts -n=5               # Latest 5 sessions
  npx tsx scripts/test-cursor-phase1.ts --utterances-only  # Only show utterances
  npx tsx scripts/test-cursor-phase1.ts /path/to/store.db  # Specific file

Options:
  -n=N             Number of sessions to scan (default: ${DEFAULT_SESSION_COUNT})
  --utterances-only Only show developer utterances
  --help           Show this help
`);
      process.exit(0);
    } else if (!arg.startsWith('-') && arg.endsWith('.db')) {
      specificFiles.push(arg);
    }
  }

  console.log('='.repeat(80));
  console.log('Cursor Session Phase 1 Test - DataExtractor');
  console.log('='.repeat(80));

  // Check if Cursor directory exists
  console.log(`Cursor chats directory: ${CURSOR_CHATS_DIR}`);

  if (!fs.existsSync(CURSOR_CHATS_DIR)) {
    console.error(`\n✗ Cursor chats directory not found: ${CURSOR_CHATS_DIR}`);
    console.error('  Make sure Cursor IDE is installed and has session data.');
    process.exit(1);
  }

  // Create CursorSource instance
  const cursorSource = new CursorSource();

  // Check availability
  const isAvailable = await cursorSource.isAvailable();
  console.log(`CursorSource available: ${isAvailable ? '✓' : '✗'}`);

  if (!isAvailable) {
    console.error('\n✗ CursorSource is not available.');
    console.error('  Make sure better-sqlite3 is installed: npm install better-sqlite3');
    process.exit(1);
  }

  // Find files to process
  let filesToProcess: StoreDbFile[];

  if (specificFiles.length > 0) {
    filesToProcess = specificFiles.map((filePath) => {
      const stats = fs.statSync(filePath);
      const sessionDir = path.dirname(filePath);
      const workspaceDir = path.dirname(sessionDir);
      return {
        path: filePath,
        mtime: stats.mtime,
        size: stats.size,
        workspaceHash: path.basename(workspaceDir),
        sessionId: path.basename(sessionDir),
      };
    });
    console.log(`Processing ${filesToProcess.length} specific file(s)`);
  } else {
    filesToProcess = findStoreDbFiles(CURSOR_CHATS_DIR, sessionCount);
    console.log(`Found ${filesToProcess.length} store.db file(s)`);
  }

  if (filesToProcess.length === 0) {
    console.error('\n✗ No store.db files found');
    process.exit(1);
  }

  // Show files to process
  console.log('');
  console.log('Sessions to process:');
  const displayPaths = filesToProcess.slice(0, 10);
  for (const f of displayPaths) {
    console.log(`  - ${f.sessionId} (${formatDate(f.mtime)})`);
  }
  if (filesToProcess.length > 10) {
    console.log(`  ... and ${filesToProcess.length - 10} more`);
  }

  if (utterancesOnly) {
    console.log(`Mode: utterances-only`);
  }
  console.log('');

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.warn('⚠️  GOOGLE_GEMINI_API_KEY not set. LLM filtering will be skipped.');
  }

  // Step 1: Parse all Cursor sessions
  console.log('Parsing Cursor sessions...');
  const sessions: ParsedSession[] = [];
  let totalMessages = 0;
  let successCount = 0;
  let failCount = 0;

  for (const file of filesToProcess) {
    try {
      const sourcedSession = await cursorSource.parseFromFile(file.path);

      if (!sourcedSession) {
        failCount++;
        if (filesToProcess.length <= 10) {
          console.error(`  ✗ ${file.sessionId}: Failed to parse (returned null)`);
        }
        continue;
      }

      const session = toParseSession(sourcedSession);
      sessions.push(session);
      totalMessages += session.messages.length;
      successCount++;

      if (filesToProcess.length <= 10) {
        console.log(`  ✓ ${file.sessionId}: ${session.messages.length} messages, ${sourcedSession.stats.toolCallCount} tool calls`);
      }
    } catch (error) {
      failCount++;
      if (filesToProcess.length <= 10) {
        console.error(`  ✗ ${file.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  if (sessions.length === 0) {
    console.error('❌ No valid sessions found');
    process.exit(1);
  }

  console.log(`Parsed: ${successCount} sessions, ${totalMessages} messages${failCount > 0 ? ` (${failCount} failed)` : ''}`);
  console.log('');

  // Step 2: Create worker context
  const context: WorkerContext = {
    sessions,
    metrics: createMockMetrics(),
    tier: 'free',
  };

  // Step 3: Execute DataExtractorWorker
  console.log('Executing DataExtractorWorker...');
  console.log('-'.repeat(80));

  const worker = new DataExtractorWorker(createConfig());
  const startTime = Date.now();
  const result = await worker.execute(context);
  const elapsed = Date.now() - startTime;

  console.log(`Execution time: ${elapsed}ms`);
  console.log('');

  if (result.error) {
    console.error('❌ Phase 1 Failed:', result.error);
    process.exit(1);
  }

  const output = result.data;

  // Step 4: Print results
  console.log('-'.repeat(80));
  console.log('Phase 1 Result');
  console.log('-'.repeat(80));
  console.log('');

  // Developer Utterances
  console.log(`Developer Utterances (${output.developerUtterances.length} extracted):`);
  console.log('');
  for (let i = 0; i < output.developerUtterances.length; i++) {
    printUtterance(i, output.developerUtterances[i]!);
  }
  console.log('');

  if (!utterancesOnly) {
    // Session Metrics
    console.log('Session Metrics:');
    printSessionMetrics(output.sessionMetrics);
    console.log('');

    // Token usage (if any)
    if (result.usage) {
      console.log('LLM Token Usage:');
      console.log(`- Prompt tokens: ${result.usage.promptTokens}`);
      console.log(`- Completion tokens: ${result.usage.completionTokens}`);
      console.log(`- Total tokens: ${result.usage.totalTokens}`);
      console.log('');
    }
  }

  console.log('='.repeat(80));
  console.log('Phase 1 Complete');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
