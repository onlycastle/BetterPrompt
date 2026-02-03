/**
 * Phase 1 Cache Generator
 *
 * Scans sessions using the CLI scanner, runs Phase 1 (DataExtractorWorker),
 * and caches the output for faster test-phase2.ts execution.
 *
 * Usage:
 *   npx tsx scripts/generate-phase1-cache.ts
 *   npx tsx scripts/generate-phase1-cache.ts --max-sessions=30
 *   npx tsx scripts/generate-phase1-cache.ts --force  # Overwrite existing cache
 *
 * Output:
 *   scripts/fixtures/phase1-cache/phase1-cache.json
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { scanSessions } from '../packages/cli/src/scanner.js';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import type { WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { SessionMetrics } from '../src/lib/domain/models/analysis';
import type { Phase1Output } from '../src/lib/models/phase1-output';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';
import type { ParsedSession } from '../src/lib/models/session';
import { calculateActualCost, GEMINI_PRICING } from '../src/lib/analyzer/cost-estimator';

// ============================================================================
// Configuration
// ============================================================================

const CACHE_DIR = path.join(__dirname, 'fixtures', 'phase1-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'phase1-cache.json');

/** Version for cache invalidation. Bump when Phase1Output schema changes. */
const GENERATOR_VERSION = '1.0.0';

const DEFAULT_MAX_SESSIONS = 200;

// ============================================================================
// Types
// ============================================================================

interface SessionCacheEntry {
  sessionId: string;
  projectPath: string;
  projectName: string;
  messageCount: number;
  filePath: string;
  source?: 'claude-code' | 'cursor';
}

interface Phase1CacheMetadata {
  generatedAt: string;
  generatorVersion: string;
  scannerConfig: {
    maxSessions: number;
  };
  sessions: SessionCacheEntry[];
  stats: {
    totalSessions: number;
    totalMessages: number;
    phase1ExecutionMs: number;
    tokenUsage?: TokenUsage;
  };
}

interface Phase1Cache {
  metadata: Phase1CacheMetadata;
  phase1Output: Phase1Output;
}

// ============================================================================
// Helper Functions
// ============================================================================

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

function createConfig() {
  return {
    geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '',
    verbose: true,
  };
}

function parseArgs(): { maxSessions: number; force: boolean } {
  const args = process.argv.slice(2);
  let maxSessions = DEFAULT_MAX_SESSIONS;
  let force = false;

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--max-sessions=')) {
      const value = parseInt(arg.replace('--max-sessions=', ''), 10);
      if (!isNaN(value) && value > 0) {
        maxSessions = value;
      }
    }
  }

  return { maxSessions, force };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { maxSessions, force } = parseArgs();

  console.log('='.repeat(70));
  console.log('Phase 1 Cache Generator');
  console.log('='.repeat(70));
  console.log(`Max sessions: ${maxSessions}`);
  console.log(`Force overwrite: ${force}`);
  console.log('');

  // Check if cache already exists
  if (fs.existsSync(CACHE_FILE) && !force) {
    console.log('Cache file already exists at:');
    console.log(`  ${CACHE_FILE}`);
    console.log('');
    console.log('Use --force to overwrite, or delete the file manually.');
    process.exit(0);
  }

  // Step 1: Scan sessions
  console.log('Step 1: Scanning sessions...');
  const scanStartTime = Date.now();
  const scanResult = await scanSessions(maxSessions);
  const scanElapsed = Date.now() - scanStartTime;

  console.log(`Scan completed in ${scanElapsed}ms`);

  if (scanResult.sessions.length === 0) {
    console.error('No sessions found. Check that Claude projects exist in ~/.claude/projects/');
    process.exit(1);
  }

  console.log(`Found ${scanResult.sessions.length} sessions`);
  console.log(`Total messages: ${scanResult.totalMessages}`);

  // Show source distribution
  if (scanResult.sourceStats && scanResult.sourceStats.size > 0) {
    console.log('Sources:');
    for (const [source, count] of scanResult.sourceStats) {
      console.log(`  - ${source}: ${count} sessions`);
    }
  }
  console.log('');

  // Step 2: Prepare ParsedSession[] for DataExtractorWorker
  const parsedSessions: ParsedSession[] = scanResult.sessions.map(s => s.parsed);

  // Build session metadata for cache
  const sessionEntries: SessionCacheEntry[] = scanResult.sessions.map(s => ({
    sessionId: s.metadata.sessionId,
    projectPath: s.metadata.projectPath,
    projectName: s.metadata.projectName,
    messageCount: s.metadata.messageCount,
    filePath: s.metadata.filePath,
    source: s.metadata.source as 'claude-code' | 'cursor' | undefined,
  }));

  // Print session list
  console.log('Sessions to cache:');
  for (let i = 0; i < Math.min(sessionEntries.length, 10); i++) {
    const entry = sessionEntries[i]!;
    const sourceLabel = entry.source ? ` [${entry.source}]` : '';
    console.log(`  ${i + 1}. ${entry.projectName} - ${entry.messageCount} msgs${sourceLabel}`);
  }
  if (sessionEntries.length > 10) {
    console.log(`  ... and ${sessionEntries.length - 10} more`);
  }
  console.log('');

  // Step 3: Run Phase 1 (DataExtractorWorker)
  console.log('Step 2: Running Phase 1 (DataExtractorWorker)...');

  const context: WorkerContext = {
    sessions: parsedSessions,
    metrics: createMockMetrics(),
    tier: 'pro',
  };

  const worker = new DataExtractorWorker(createConfig());
  const startTime = Date.now();
  const result = await worker.execute(context);
  const executionMs = Date.now() - startTime;

  if (result.error) {
    console.error('Phase 1 failed:', result.error);
    process.exit(1);
  }

  console.log(`Phase 1 completed in ${executionMs}ms`);
  console.log(`Extracted ${result.data.developerUtterances.length} utterances`);
  console.log(`Total AI responses: ${result.data.sessionMetrics.totalAIResponses}`);

  if (result.usage) {
    const cachedTokens = result.usage.cachedTokens ?? 0;
    const cachedInfo = cachedTokens > 0 ? `, ${cachedTokens} cached` : '';
    console.log(`Token usage: ${result.usage.totalTokens} total (${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion${cachedInfo})`);

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
  }
  console.log('');

  // Step 4: Build cache object
  const cache: Phase1Cache = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      scannerConfig: {
        maxSessions,
      },
      sessions: sessionEntries,
      stats: {
        totalSessions: scanResult.sessions.length,
        totalMessages: scanResult.totalMessages,
        phase1ExecutionMs: executionMs,
        tokenUsage: result.usage ?? undefined,
      },
    },
    phase1Output: result.data,
  };

  // Step 5: Save cache
  console.log('Step 3: Saving cache...');

  // Ensure directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  const fileSizeKb = (fs.statSync(CACHE_FILE).size / 1024).toFixed(1);
  console.log(`Cache saved to: ${CACHE_FILE}`);
  console.log(`File size: ${fileSizeKb} KB`);
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('Cache Generation Complete');
  console.log('='.repeat(70));
  console.log('');
  console.log('To use this cache in test-phase2.ts:');
  console.log('  npx tsx scripts/test-phase2.ts --use-cache');
  console.log('');
  console.log('To regenerate the cache:');
  console.log('  npx tsx scripts/generate-phase1-cache.ts --force');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
