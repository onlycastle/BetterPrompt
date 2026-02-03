/**
 * Phase 2 Cache Generator
 *
 * Runs all Phase 2 workers (ThinkingQuality, LearningBehavior, ContextEfficiency)
 * plus Phase 2.5 (TypeClassifier) and caches the combined output.
 *
 * Usage:
 *   npx tsx scripts/generate-phase2-cache.ts              # Generate from Phase 1 cache
 *   npx tsx scripts/generate-phase2-cache.ts --force      # Overwrite existing cache
 *
 * Output:
 *   scripts/fixtures/phase2-cache/phase2-cache.json
 *
 * Prerequisites:
 *   - Phase 1 cache must exist (run generate-phase1-cache.ts first)
 *   - GOOGLE_GEMINI_API_KEY environment variable
 */

import 'dotenv/config';
import * as fs from 'fs';

import {
  loadPhase1Cache,
  createMockMetrics,
  createOrchestratorConfig,
  printTokenUsage,
  printCostSummary,
  PHASE1_CACHE_FILE,
  PHASE2_CACHE_DIR,
  PHASE2_CACHE_FILE,
  type Phase2Cache,
  type Phase2CacheMetadata,
} from './utils/test-utils';

import { ThinkingQualityWorker } from '../src/lib/analyzer/workers/thinking-quality-worker';
import { LearningBehaviorWorker } from '../src/lib/analyzer/workers/learning-behavior-worker';
import { ContextEfficiencyWorker } from '../src/lib/analyzer/workers/context-efficiency-worker';
import { TypeClassifierWorker } from '../src/lib/analyzer/workers/type-classifier-worker';
import type { Phase2WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { AgentOutputs } from '../src/lib/models/agent-outputs';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';

// ============================================================================
// Configuration
// ============================================================================

/** Version for cache invalidation. Bump when Phase2 output schema changes. */
const GENERATOR_VERSION = '1.0.0';

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(): { force: boolean } {
  const args = process.argv.slice(2);
  let force = false;

  for (const arg of args) {
    if (arg === '--force') {
      force = true;
    }
  }

  return { force };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { force } = parseArgs();

  console.log('='.repeat(70));
  console.log('Phase 2 Cache Generator');
  console.log('='.repeat(70));
  console.log(`Force overwrite: ${force}`);
  console.log('');

  // Check if cache already exists
  if (fs.existsSync(PHASE2_CACHE_FILE) && !force) {
    console.log('Cache file already exists at:');
    console.log(`  ${PHASE2_CACHE_FILE}`);
    console.log('');
    console.log('Use --force to overwrite, or delete the file manually.');
    process.exit(0);
  }

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('❌ GOOGLE_GEMINI_API_KEY is required for Phase 2 workers');
    process.exit(1);
  }

  // Step 1: Load Phase 1 cache
  console.log('Step 1: Loading Phase 1 cache...');
  const phase1Cache = loadPhase1Cache();

  console.log(`Loaded Phase 1 cache:`);
  console.log(`  Generated at: ${phase1Cache.metadata.generatedAt}`);
  console.log(`  Sessions: ${phase1Cache.metadata.sessions.length}`);
  console.log(`  Utterances: ${phase1Cache.phase1Output.developerUtterances.length}`);
  console.log(`  AI responses: ${phase1Cache.phase1Output.sessionMetrics.totalAIResponses}`);
  console.log('');

  // Step 2: Create Phase 2 context
  const config = createOrchestratorConfig();
  const phase2Context: Phase2WorkerContext = {
    sessions: [], // Empty - we use cached Phase 1 output
    metrics: createMockMetrics(),
    tier: 'pro' as const,
    phase1Output: phase1Cache.phase1Output,
  };

  // Aggregated results
  const agentOutputs: AgentOutputs = {};
  const workerTimes: Record<string, number> = {};
  const workerTokens: Record<string, TokenUsage> = {};

  // Step 3: Run Phase 2 Workers
  console.log('Step 2: Running Phase 2 Workers...');
  console.log('-'.repeat(70));

  const phase2StartTime = Date.now();

  // ThinkingQuality Worker
  console.log('\n[1/4] ThinkingQuality Worker...');
  {
    const worker = new ThinkingQualityWorker(config);
    const startTime = Date.now();
    const result = await worker.execute(phase2Context);
    workerTimes['ThinkingQuality'] = Date.now() - startTime;

    if (result.error) {
      console.error('❌ ThinkingQuality Failed:', result.error);
      process.exit(1);
    }

    agentOutputs.thinkingQuality = result.data;
    if (result.usage) workerTokens['ThinkingQuality'] = result.usage;
    console.log(`Completed in ${workerTimes['ThinkingQuality']}ms`);
    printTokenUsage(result.usage, 'ThinkingQuality');
  }

  // LearningBehavior Worker
  console.log('\n[2/4] LearningBehavior Worker...');
  {
    const worker = new LearningBehaviorWorker(config);
    const startTime = Date.now();
    const result = await worker.execute(phase2Context);
    workerTimes['LearningBehavior'] = Date.now() - startTime;

    if (result.error) {
      console.error('❌ LearningBehavior Failed:', result.error);
      process.exit(1);
    }

    agentOutputs.learningBehavior = result.data;
    if (result.usage) workerTokens['LearningBehavior'] = result.usage;
    console.log(`Completed in ${workerTimes['LearningBehavior']}ms`);
    printTokenUsage(result.usage, 'LearningBehavior');
  }

  // ContextEfficiency Worker
  console.log('\n[3/4] ContextEfficiency Worker...');
  {
    const worker = new ContextEfficiencyWorker(config);
    const startTime = Date.now();
    const result = await worker.execute(phase2Context);
    workerTimes['ContextEfficiency'] = Date.now() - startTime;

    if (result.error) {
      console.error('❌ ContextEfficiency Failed:', result.error);
      process.exit(1);
    }

    agentOutputs.efficiency = result.data;
    if (result.usage) workerTokens['ContextEfficiency'] = result.usage;
    console.log(`Completed in ${workerTimes['ContextEfficiency']}ms`);
    printTokenUsage(result.usage, 'ContextEfficiency');
  }

  // TypeClassifier Worker (Phase 2.5)
  console.log('\n[4/4] TypeClassifier Worker (Phase 2.5)...');
  {
    const typeClassifierContext = {
      ...phase2Context,
      agentOutputs,
    };

    const worker = new TypeClassifierWorker(config);
    const startTime = Date.now();
    const result = await worker.execute(typeClassifierContext);
    workerTimes['TypeClassifier'] = Date.now() - startTime;

    if (result.error) {
      console.error('❌ TypeClassifier Failed:', result.error);
      process.exit(1);
    }

    agentOutputs.typeClassifier = result.data;
    if (result.usage) workerTokens['TypeClassifier'] = result.usage;
    console.log(`Completed in ${workerTimes['TypeClassifier']}ms`);
    printTokenUsage(result.usage, 'TypeClassifier');
  }

  const phase2ExecutionMs = Date.now() - phase2StartTime;

  // Step 4: Calculate totals
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalTokens = 0;
  let totalCached = 0;

  for (const usage of Object.values(workerTokens)) {
    totalPrompt += usage.promptTokens;
    totalCompletion += usage.completionTokens;
    totalTokens += usage.totalTokens;
    totalCached += usage.cachedTokens ?? 0;
  }

  // Step 5: Build cache object
  const cacheMetadata: Phase2CacheMetadata = {
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
    phase1CacheSource: PHASE1_CACHE_FILE,
    stats: {
      totalUtterances: phase1Cache.phase1Output.developerUtterances.length,
      phase2ExecutionMs,
      tokenUsage: {
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        totalTokens,
        cachedTokens: totalCached,
      },
    },
  };

  const cache: Phase2Cache = {
    metadata: cacheMetadata,
    phase1Output: phase1Cache.phase1Output,
    agentOutputs,
  };

  // Step 6: Save cache
  console.log('\n' + '-'.repeat(70));
  console.log('Step 3: Saving cache...');

  // Ensure directory exists
  if (!fs.existsSync(PHASE2_CACHE_DIR)) {
    fs.mkdirSync(PHASE2_CACHE_DIR, { recursive: true });
  }

  fs.writeFileSync(PHASE2_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  const fileSizeKb = (fs.statSync(PHASE2_CACHE_FILE).size / 1024).toFixed(1);
  console.log(`Cache saved to: ${PHASE2_CACHE_FILE}`);
  console.log(`File size: ${fileSizeKb} KB`);
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('Phase 2 Cache Generation Complete');
  console.log('='.repeat(70));

  console.log('\nExecution Times:');
  let totalTime = 0;
  for (const [worker, time] of Object.entries(workerTimes)) {
    console.log(`  ${worker}: ${time}ms`);
    totalTime += time;
  }
  console.log(`  TOTAL: ${totalTime}ms`);

  console.log('\nToken Usage:');
  for (const [worker, usage] of Object.entries(workerTokens)) {
    const cachedInfo = usage.cachedTokens ? `, ${usage.cachedTokens} cached` : '';
    console.log(
      `  ${worker}: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion${cachedInfo})`
    );
  }
  const cachedTotalInfo = totalCached > 0 ? `, ${totalCached} cached` : '';
  console.log(
    `  TOTAL: ${totalTokens} tokens (${totalPrompt} prompt, ${totalCompletion} completion${cachedTotalInfo})`
  );

  printCostSummary(totalPrompt, totalCompletion, totalCached);

  // Scores Summary
  console.log('\nScores Summary:');
  if (agentOutputs.thinkingQuality) {
    console.log(`  Thinking Quality: ${agentOutputs.thinkingQuality.overallThinkingQualityScore}/100`);
  }
  if (agentOutputs.learningBehavior) {
    console.log(`  Learning Behavior: ${agentOutputs.learningBehavior.overallLearningScore}/100`);
  }
  if (agentOutputs.efficiency) {
    console.log(`  Efficiency: ${agentOutputs.efficiency.overallEfficiencyScore}/100`);
  }
  if (agentOutputs.typeClassifier) {
    console.log(
      `  Type: ${agentOutputs.typeClassifier.matrixEmoji} ${agentOutputs.typeClassifier.matrixName}`
    );
  }

  console.log('');
  console.log('To use this cache in test-phase3.ts or test-phase4.ts:');
  console.log('  npx tsx scripts/test-phase3.ts --use-phase2-cache');
  console.log('  npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko');
  console.log('');
  console.log('To regenerate the cache:');
  console.log('  npx tsx scripts/generate-phase2-cache.ts --force');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
