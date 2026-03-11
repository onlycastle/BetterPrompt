/**
 * Phase 3 Cache Generator
 *
 * Runs Phase 3 (ContentWriter) and caches the NarrativeLLMResponse output.
 * This enables fast testing of Phase 4 (Translator) and Evaluation Assembly
 * without re-running earlier pipeline stages.
 *
 * Usage:
 *   npx tsx scripts/generate-phase3-cache.ts              # Generate from Phase 2 cache
 *   npx tsx scripts/generate-phase3-cache.ts --force      # Overwrite existing cache
 *   npx tsx scripts/generate-phase3-cache.ts --fresh      # Run Phase 1+2 from scratch
 *
 * Output:
 *   scripts/fixtures/phase3-cache/phase3-cache.json
 *
 * Prerequisites:
 *   - Phase 2 cache must exist (run generate-phase2-cache.ts first), OR use --fresh
 *   - GOOGLE_GEMINI_API_KEY environment variable
 */

import 'dotenv/config';
import * as fs from 'fs';

import {
  loadPhase1Cache,
  loadPhase2Cache,
  createMockMetrics,
  createOrchestratorConfig,
  printTokenUsage,
  printCostSummary,
  PHASE2_CACHE_FILE,
  PHASE3_CACHE_DIR,
  PHASE3_CACHE_FILE,
  type Phase3Cache,
  type Phase3CacheMetadata,
} from './utils/test-utils';

import { SessionParser } from '../src/lib/parser';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import { ThinkingQualityWorker } from '../src/lib/analyzer/workers/thinking-quality-worker';
import { LearningBehaviorWorker } from '../src/lib/analyzer/workers/learning-behavior-worker';
import { ContextEfficiencyWorker } from '../src/lib/analyzer/workers/context-efficiency-worker';
import { TypeClassifierWorker } from '../src/lib/analyzer/workers/type-classifier-worker';
import { ContentWriterStage } from '../src/lib/analyzer/stages/content-writer';
import type { Phase1Output } from '../src/lib/models/phase1-output';
import type { Phase2WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { AgentOutputs } from '../src/lib/models/agent-outputs';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';

// ============================================================================
// Configuration
// ============================================================================

/** Version for cache invalidation. Bump when Phase3 output schema changes. */
const GENERATOR_VERSION = '1.0.0';

const DEFAULT_JSONL_PATH = process.env.NOSLOP_TEST_JSONL_PATH || '';

// ============================================================================
// Argument Parsing
// ============================================================================

interface CLIArgs {
  force: boolean;
  fresh: boolean;
  jsonlPath: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let force = false;
  let fresh = false;
  let jsonlPath = DEFAULT_JSONL_PATH;

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
    } else if (arg === '--fresh') {
      fresh = true;
    } else if (!arg.startsWith('--')) {
      jsonlPath = arg;
    }
  }

  return { force, fresh, jsonlPath };
}

// ============================================================================
// Phase 2 Worker Execution
// ============================================================================

async function runPhase2Workers(
  config: ReturnType<typeof createOrchestratorConfig>,
  phase1Output: Phase1Output,
  tokenUsages: Map<string, TokenUsage>,
  timings: Map<string, number>
): Promise<AgentOutputs> {
  const agentOutputs: AgentOutputs = {};

  const phase2Context: Phase2WorkerContext = {
    sessions: [],
    metrics: createMockMetrics(),
    tier: 'pro' as const,
    phase1Output,
  };

  console.log('Running Phase 2 Workers...');
  const phase2StartTime = Date.now();

  // ThinkingQuality
  {
    const startTime = Date.now();
    const worker = new ThinkingQualityWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`ThinkingQuality failed: ${result.error}`);
    agentOutputs.thinkingQuality = result.data;
    timings.set('ThinkingQuality', Date.now() - startTime);
    if (result.usage) tokenUsages.set('ThinkingQuality', result.usage);
  }

  // LearningBehavior
  {
    const startTime = Date.now();
    const worker = new LearningBehaviorWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`LearningBehavior failed: ${result.error}`);
    agentOutputs.learningBehavior = result.data;
    timings.set('LearningBehavior', Date.now() - startTime);
    if (result.usage) tokenUsages.set('LearningBehavior', result.usage);
  }

  // ContextEfficiency
  {
    const startTime = Date.now();
    const worker = new ContextEfficiencyWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`ContextEfficiency failed: ${result.error}`);
    agentOutputs.efficiency = result.data;
    timings.set('ContextEfficiency', Date.now() - startTime);
    if (result.usage) tokenUsages.set('ContextEfficiency', result.usage);
  }

  // TypeClassifier (Phase 2.5)
  {
    const startTime = Date.now();
    const worker = new TypeClassifierWorker(config);
    const result = await worker.execute({ ...phase2Context, agentOutputs });
    if (result.error) throw new Error(`TypeClassifier failed: ${result.error}`);
    agentOutputs.typeClassifier = result.data;
    timings.set('TypeClassifier', Date.now() - startTime);
    if (result.usage) tokenUsages.set('TypeClassifier', result.usage);
  }

  timings.set('Phase2Total', Date.now() - phase2StartTime);
  console.log(`Phase 2 completed in ${timings.get('Phase2Total')}ms`);

  return agentOutputs;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { force, fresh, jsonlPath } = parseArgs();

  console.log('='.repeat(70));
  console.log('Phase 3 Cache Generator');
  console.log('='.repeat(70));
  console.log(`Force overwrite: ${force}`);
  console.log(`Fresh mode: ${fresh}`);
  console.log('');

  // Check if cache already exists
  if (fs.existsSync(PHASE3_CACHE_FILE) && !force) {
    console.log('Cache file already exists at:');
    console.log(`  ${PHASE3_CACHE_FILE}`);
    console.log('');
    console.log('Use --force to overwrite, or delete the file manually.');
    process.exit(0);
  }

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('❌ GOOGLE_GEMINI_API_KEY is required for ContentWriter');
    process.exit(1);
  }

  const config = createOrchestratorConfig();
  const tokenUsages = new Map<string, TokenUsage>();
  const timings = new Map<string, number>();

  // Variables to be populated
  let phase1Output: Phase1Output;
  let agentOutputs: AgentOutputs;
  let sessionCount: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading / Generation
  // ─────────────────────────────────────────────────────────────────────────

  if (fresh) {
    if (!jsonlPath) {
      throw new Error('Provide a JSONL path or set NOSLOP_TEST_JSONL_PATH when using --fresh.');
    }
    console.log('Mode: FRESH (running Phase 1 + Phase 2)');
    console.log(`JSONL: ${jsonlPath.split('/').pop()}`);
    console.log('');

    // Parse JSONL
    const parseStartTime = Date.now();
    const parser = new SessionParser();
    const session = await parser.parseSessionFile(jsonlPath);
    timings.set('JSONLParse', Date.now() - parseStartTime);
    console.log(`Parsed ${session.messages.length} messages in ${timings.get('JSONLParse')}ms`);

    // Run Phase 1
    const phase1StartTime = Date.now();
    const dataExtractor = new DataExtractorWorker(config);
    const phase1Result = await dataExtractor.execute({
      sessions: [session],
      metrics: createMockMetrics(),
      tier: 'pro' as const,
    });
    timings.set('Phase1', Date.now() - phase1StartTime);

    if (phase1Result.error) {
      console.error('❌ Phase 1 Failed:', phase1Result.error);
      process.exit(1);
    }

    phase1Output = phase1Result.data;
    sessionCount = 1;
    console.log(`Phase 1 completed in ${timings.get('Phase1')}ms`);
    console.log(`  Utterances: ${phase1Output.developerUtterances.length}`);

    // Run Phase 2
    agentOutputs = await runPhase2Workers(config, phase1Output, tokenUsages, timings);
  } else {
    // Use Phase 2 cache (default)
    console.log('Mode: PHASE 2 CACHE (default)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase2Cache = loadPhase2Cache();
    timings.set('CacheLoad', Date.now() - cacheStartTime);

    phase1Output = phase2Cache.phase1Output;
    agentOutputs = phase2Cache.agentOutputs;
    sessionCount = phase2Cache.metadata.stats.totalUtterances > 0 ? 1 : 0;

    console.log(`Phase 2 cache loaded in ${timings.get('CacheLoad')}ms`);
    console.log(`  Generated at: ${phase2Cache.metadata.generatedAt}`);
    console.log(`  Utterances: ${phase2Cache.phase1Output.developerUtterances.length}`);
  }

  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Content Writer
  // ─────────────────────────────────────────────────────────────────────────

  console.log('Running Phase 3 (ContentWriter)...');
  const phase3StartTime = Date.now();

  const contentWriter = new ContentWriterStage({
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    verbose: true,
  });

  // Verify Phase 2 worker examples before ContentWriter
  contentWriter.verifyPhase2WorkerExamples(agentOutputs, phase1Output);

  const phase3Result = await contentWriter.transformV3(sessionCount, agentOutputs, phase1Output);
  const phase3Time = Date.now() - phase3StartTime;
  timings.set('Phase3', phase3Time);
  tokenUsages.set('ContentWriter', phase3Result.usage);

  console.log(`Phase 3 completed in ${phase3Time}ms`);
  printTokenUsage(phase3Result.usage, 'ContentWriter');

  // ─────────────────────────────────────────────────────────────────────────
  // Build and Save Cache
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n' + '-'.repeat(70));
  console.log('Saving Phase 3 cache...');

  const cacheMetadata: Phase3CacheMetadata = {
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
    phase2CacheSource: fresh ? 'fresh-generation' : PHASE2_CACHE_FILE,
    stats: {
      totalUtterances: phase1Output.developerUtterances.length,
      phase3ExecutionMs: phase3Time,
      tokenUsage: phase3Result.usage,
    },
  };

  const cache: Phase3Cache = {
    metadata: cacheMetadata,
    phase1Output,
    agentOutputs,
    narrativeResponse: phase3Result.data,
  };

  // Ensure directory exists
  if (!fs.existsSync(PHASE3_CACHE_DIR)) {
    fs.mkdirSync(PHASE3_CACHE_DIR, { recursive: true });
  }

  fs.writeFileSync(PHASE3_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  const fileSizeKb = (fs.statSync(PHASE3_CACHE_FILE).size / 1024).toFixed(1);
  console.log(`Cache saved to: ${PHASE3_CACHE_FILE}`);
  console.log(`File size: ${fileSizeKb} KB`);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  console.log('='.repeat(70));
  console.log('Phase 3 Cache Generation Complete');
  console.log('='.repeat(70));

  console.log('\nExecution Times:');
  for (const [label, time] of timings.entries()) {
    console.log(`  ${label}: ${time}ms`);
  }

  console.log('\nToken Usage:');
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalTokens = 0;
  let totalCached = 0;

  for (const [label, usage] of tokenUsages.entries()) {
    const cachedInfo = usage.cachedTokens ? `, ${usage.cachedTokens} cached` : '';
    console.log(
      `  ${label}: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion${cachedInfo})`
    );
    totalPrompt += usage.promptTokens;
    totalCompletion += usage.completionTokens;
    totalTokens += usage.totalTokens;
    totalCached += usage.cachedTokens ?? 0;
  }

  const cachedTotalInfo = totalCached > 0 ? `, ${totalCached} cached` : '';
  console.log(
    `  TOTAL: ${totalTokens} tokens (${totalPrompt} prompt, ${totalCompletion} completion${cachedTotalInfo})`
  );

  printCostSummary(totalPrompt, totalCompletion, totalCached);

  // Content Preview
  console.log('\nContent Preview:');
  console.log('-'.repeat(70));

  const narrative = phase3Result.data;
  console.log('\n📝 Personality Summary (first 300 chars):');
  console.log(`  "${narrative.personalitySummary.slice(0, 300)}..."`);

  if (narrative.promptPatterns && narrative.promptPatterns.length > 0) {
    console.log(`\n💬 Prompt Patterns: ${narrative.promptPatterns.length} patterns`);
    for (const pattern of narrative.promptPatterns.slice(0, 2)) {
      console.log(`  - ${pattern.patternName}: ${pattern.description.slice(0, 60)}...`);
    }
  }

  if (narrative.topFocusAreas && narrative.topFocusAreas.areas.length > 0) {
    console.log(`\n🎯 Top Focus Areas: ${narrative.topFocusAreas.areas.length} areas`);
    for (const area of narrative.topFocusAreas.areas) {
      console.log(`  #${area.rank}: ${area.title}`);
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log('');
  console.log('To use this cache in test-evaluation-assembly.ts:');
  console.log('  npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache');
  console.log('  npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache --lang=ko');
  console.log('');
  console.log('To regenerate the cache:');
  console.log('  npx tsx scripts/generate-phase3-cache.ts --force');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
