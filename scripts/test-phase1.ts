/**
 * Phase 1 Local Test Script
 *
 * Tests the DataExtractorWorker (Phase 1) with a specific JSONL file.
 * Runs the same code that executes in Lambda, allowing local debugging.
 *
 * Usage:
 *   npx tsx scripts/test-phase1.ts
 *   npx tsx scripts/test-phase1.ts /path/to/session.jsonl
 *   npx tsx scripts/test-phase1.ts /path/to/session1.jsonl /path/to/session2.jsonl
 *   npx tsx scripts/test-phase1.ts -n=10                    # Latest 10 sessions from ~/.claude/projects
 *   npx tsx scripts/test-phase1.ts -n=30 --utterances-only  # Latest 30, utterances only
 *   npx tsx scripts/test-phase1.ts --utterances-only
 *
 * Environment:
 *   Requires GOOGLE_GEMINI_API_KEY in .env for LLM filtering
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { SessionParser } from '../src/lib/parser';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import type { WorkerContext, OrchestratorConfig } from '../src/lib/analyzer/orchestrator/types';
import type { SessionMetrics } from '../src/lib/domain/models/analysis';
import type { Phase1Output, UserUtterance } from '../src/lib/models/phase1-output';
import type { ParsedSession } from '../src/lib/models/session';
import { calculateActualCost, GEMINI_PRICING } from '../src/lib/analyzer/cost-estimator';

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const DEFAULT_JSONL_PATH = '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-nomoreaislop/e3988e3b-3c6c-4fe5-bd90-99b93009c4cb.jsonl';

// ============================================================================
// Helper Functions
// ============================================================================

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) return '?';
  return value ? '✓' : '✗';
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

/**
 * Find the latest N session files from ~/.claude/projects
 */
function findLatestSessions(count: number): string[] {
  const allJsonlFiles: { path: string; mtime: number }[] = [];

  // Recursively find all .jsonl files
  function scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          try {
            const stat = fs.statSync(fullPath);
            allJsonlFiles.push({ path: fullPath, mtime: stat.mtimeMs });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scanDir(CLAUDE_PROJECTS_DIR);

  // Sort by modification time (newest first) and take top N
  allJsonlFiles.sort((a, b) => b.mtime - a.mtime);
  return allJsonlFiles.slice(0, count).map(f => f.path);
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

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let jsonlPaths: string[] = [];
  let utterancesOnly = false;
  let latestCount: number | null = null;

  for (const arg of args) {
    if (arg === '--utterances-only') {
      utterancesOnly = true;
    } else if (arg.startsWith('-n=')) {
      latestCount = parseInt(arg.replace('-n=', ''), 10);
      if (isNaN(latestCount) || latestCount <= 0) {
        console.error('❌ Invalid -n value. Must be a positive integer.');
        process.exit(1);
      }
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      jsonlPaths.push(arg);
    }
  }

  // If -n flag is used, find latest sessions
  if (latestCount !== null) {
    console.log(`Finding latest ${latestCount} sessions from ${CLAUDE_PROJECTS_DIR}...`);
    jsonlPaths = findLatestSessions(latestCount);
    if (jsonlPaths.length === 0) {
      console.error('❌ No .jsonl files found in Claude projects directory');
      process.exit(1);
    }
    console.log(`Found ${jsonlPaths.length} session files`);
    console.log('');
  }

  // Use default path if none provided
  if (jsonlPaths.length === 0) {
    jsonlPaths.push(DEFAULT_JSONL_PATH);
  }

  console.log('='.repeat(80));
  console.log('Phase 1 Test - DataExtractor');
  console.log('='.repeat(80));
  console.log(`Sessions: ${jsonlPaths.length} file(s)`);

  // Show first 10 files, then summarize if more
  const displayPaths = jsonlPaths.slice(0, 10);
  for (const p of displayPaths) {
    console.log(`  - ${p.split('/').pop()}`);
  }
  if (jsonlPaths.length > 10) {
    console.log(`  ... and ${jsonlPaths.length - 10} more`);
  }

  if (utterancesOnly) {
    console.log(`Mode: utterances-only`);
  }
  console.log('');

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.warn('⚠️  GOOGLE_GEMINI_API_KEY not set. LLM filtering will be skipped.');
  }

  // Step 1: Parse all JSONL files
  console.log('Parsing JSONL files...');
  const parser = new SessionParser();
  const sessions: ParsedSession[] = [];
  let totalMessages = 0;
  let successCount = 0;
  let failCount = 0;

  for (const p of jsonlPaths) {
    try {
      const session = await parser.parseSessionFile(p);
      sessions.push(session);
      totalMessages += session.messages.length;
      successCount++;
      // Only log individual files if <= 10 sessions
      if (jsonlPaths.length <= 10) {
        console.log(`  ✓ ${p.split('/').pop()}: ${session.messages.length} messages`);
      }
    } catch (error) {
      failCount++;
      if (jsonlPaths.length <= 10) {
        console.error(`  ✗ ${p.split('/').pop()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const cachedTokens = result.usage.cachedTokens ?? 0;
      const cachedInfo = cachedTokens > 0 ? `, ${cachedTokens} cached` : '';
      console.log('LLM Token Usage:');
      console.log(`- Prompt tokens: ${result.usage.promptTokens}`);
      console.log(`- Completion tokens: ${result.usage.completionTokens}`);
      console.log(`- Total tokens: ${result.usage.totalTokens}${cachedInfo}`);

      // Cost Estimation
      const pricing = GEMINI_PRICING['gemini-3-flash-preview'];
      const cost = calculateActualCost({
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        cachedTokens,
      });
      console.log('');
      console.log('Estimated Cost (Gemini 3 Flash):');
      console.log(`  Input:  $${cost.inputCost.toFixed(6)} (${result.usage.promptTokens - cachedTokens} tokens × $${(pricing.input * 1_000_000).toFixed(2)}/1M)`);
      if (cachedTokens > 0) {
        console.log(`  Cached: $${cost.cachedCost.toFixed(6)} (${cachedTokens} tokens × $${(pricing.cached * 1_000_000).toFixed(2)}/1M)`);
      }
      console.log(`  Output: $${cost.outputCost.toFixed(6)} (${result.usage.completionTokens} tokens × $${(pricing.output * 1_000_000).toFixed(2)}/1M)`);
      console.log(`  TOTAL:  $${cost.totalCost.toFixed(6)}`);
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
