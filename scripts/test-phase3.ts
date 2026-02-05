/**
 * Phase 3 Local Test Script (Content Writer)
 *
 * Tests the Phase 3 ContentWriter stage with various cache options.
 * Generates personalized narrative content from Phase 2 worker outputs.
 *
 * Usage:
 *   npx tsx scripts/test-phase3.ts                      # Full pipeline (Phase 1 → 2 → 3)
 *   npx tsx scripts/test-phase3.ts --use-cache          # Use Phase 1 cache
 *   npx tsx scripts/test-phase3.ts --use-phase2-cache   # Use Phase 2 cache (fastest)
 *   npx tsx scripts/test-phase3.ts /path/to/file.jsonl  # Custom JSONL file
 *
 * Environment:
 *   Requires GOOGLE_GEMINI_API_KEY in .env for LLM analysis
 */

import 'dotenv/config';

import {
  loadPhase1Cache,
  loadPhase2Cache,
  createMockMetrics,
  createOrchestratorConfig,
  printTokenUsage,
  printCostSummary,
  wrapText,
  printSectionHeader,
  truncateText,
  toTitleCase,
} from './utils/test-utils';

import { SessionParser } from '../src/lib/parser';
import type { Phase1Output } from '../src/lib/models/phase1-output';
import type { ParsedSession } from '../src/lib/models/session';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import { ThinkingQualityWorker } from '../src/lib/analyzer/workers/thinking-quality-worker';
import { LearningBehaviorWorker } from '../src/lib/analyzer/workers/learning-behavior-worker';
import { ContextEfficiencyWorker } from '../src/lib/analyzer/workers/context-efficiency-worker';
import { TypeClassifierWorker } from '../src/lib/analyzer/workers/type-classifier-worker';
import { ContentWriterStage } from '../src/lib/analyzer/stages/content-writer';
import type { Phase2WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { AgentOutputs } from '../src/lib/models/agent-outputs';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';
import type { NarrativeLLMResponse } from '../src/lib/models/verbose-evaluation';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_JSONL_PATH =
  '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-nomoreaislop/e3988e3b-3c6c-4fe5-bd90-99b93009c4cb.jsonl';

// ============================================================================
// Argument Parsing
// ============================================================================

interface CLIArgs {
  jsonlPath: string;
  useCache: boolean;
  usePhase2Cache: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let jsonlPath = DEFAULT_JSONL_PATH;
  let useCache = false;
  let usePhase2Cache = false;

  for (const arg of args) {
    if (arg === '--use-cache') {
      useCache = true;
    } else if (arg === '--use-phase2-cache') {
      usePhase2Cache = true;
    } else if (!arg.startsWith('--')) {
      jsonlPath = arg;
    }
  }

  return { jsonlPath, useCache, usePhase2Cache };
}

// ============================================================================
// Output Display
// ============================================================================

function printNarrativeOutput(output: NarrativeLLMResponse): void {
  printSectionHeader('Phase 3 ContentWriter Output');

  // Personality Summary
  console.log('\n📝 Personality Summary:');
  console.log('-'.repeat(60));
  const wrappedSummary = wrapText(output.personalitySummary, 80);
  console.log(wrappedSummary);
  console.log('-'.repeat(60));
  console.log(`[Length: ${output.personalitySummary.length} chars]`);

  // Top Focus Areas
  if (output.topFocusAreas) {
    console.log('\n🎯 Top Focus Areas:');
    console.log('-'.repeat(60));

    if (output.topFocusAreas.areas && output.topFocusAreas.areas.length > 0) {
      for (const area of output.topFocusAreas.areas) {
        console.log(`\n  #${area.rank} ${area.title}`);
        console.log(`     Dimension: ${toTitleCase(area.dimension)}`);
        console.log(`     Priority Score: ${area.priorityScore}/100`);
        console.log(`     Narrative:`);
        const narrativeLines = wrapText(area.narrative, 70).split('\n');
        for (const line of narrativeLines) {
          console.log(`       ${line}`);
        }
        console.log(`     Expected Impact: ${truncateText(area.expectedImpact, 100)}`);

        // Actions (if available)
        if (area.actionsData) {
          const [start, stop, cont] = area.actionsData.split('|');
          console.log(`     Actions:`);
          if (start) console.log(`       START: ${truncateText(start, 80)}`);
          if (stop) console.log(`       STOP:  ${truncateText(stop, 80)}`);
          if (cont) console.log(`       CONTINUE: ${truncateText(cont, 80)}`);
        }
      }
    } else {
      console.log('  No focus areas generated');
    }

    if (output.topFocusAreas.summary) {
      console.log(`\n  Summary: ${truncateText(output.topFocusAreas.summary, 200)}`);
    }
  }

  // Prompt Patterns (optional fallback)
  if (output.promptPatterns && output.promptPatterns.length > 0) {
    console.log('\n💬 Prompt Patterns (fallback - prefer Phase 2 CommunicationPatterns):');
    console.log('-'.repeat(60));

    for (let i = 0; i < output.promptPatterns.length; i++) {
      const pattern = output.promptPatterns[i];
      console.log(`\n  ${i + 1}. "${pattern.patternName}"`);
      console.log(`     Frequency: ${pattern.frequency} | Effectiveness: ${pattern.effectiveness}`);
      console.log(`     Description: ${truncateText(pattern.description, 150)}`);
      if (pattern.tip) {
        console.log(`     Tip: ${truncateText(pattern.tip, 100)}`);
      }
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { jsonlPath, useCache, usePhase2Cache } = parseArgs();

  console.log('='.repeat(80));
  console.log('Phase 3 Test - ContentWriter');
  console.log('='.repeat(80));

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('❌ GOOGLE_GEMINI_API_KEY is required');
    process.exit(1);
  }

  const config = createOrchestratorConfig();

  // Variables to be populated
  let phase1Output: Phase1Output;
  let agentOutputs: AgentOutputs;
  let sessionCount: number;

  // Token tracking
  const tokenUsages: { label: string; usage: TokenUsage }[] = [];
  const timings: { label: string; ms: number }[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading / Generation
  // ─────────────────────────────────────────────────────────────────────────

  if (usePhase2Cache) {
    // FASTEST: Use Phase 2 cache (skip Phase 1 and Phase 2)
    console.log('Mode: PHASE 2 CACHE (fastest)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase2Cache = loadPhase2Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase2Cache.phase1Output;
    agentOutputs = phase2Cache.agentOutputs;
    sessionCount = phase2Cache.metadata.stats.totalUtterances > 0 ? 1 : 0; // Simplified

    console.log(`Phase 2 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Generated at: ${phase2Cache.metadata.generatedAt}`);
    console.log(`  Utterances: ${phase2Cache.phase1Output.developerUtterances.length}`);
    console.log(`  TypeClassifier: ${agentOutputs.typeClassifier?.matrixName ?? 'N/A'}`);
    console.log('');

    timings.push({ label: 'Cache Load', ms: cacheLoadTime });
  } else if (useCache) {
    // MEDIUM: Use Phase 1 cache, run Phase 2
    console.log('Mode: PHASE 1 CACHE (run Phase 2)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase1Cache = loadPhase1Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase1Cache.phase1Output;
    sessionCount = phase1Cache.metadata.sessions.length;

    console.log(`Phase 1 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Generated at: ${phase1Cache.metadata.generatedAt}`);
    console.log(`  Sessions: ${phase1Cache.metadata.sessions.length}`);
    console.log(`  Utterances: ${phase1Output.developerUtterances.length}`);
    console.log('');

    timings.push({ label: 'Phase 1 Cache Load', ms: cacheLoadTime });

    // Run Phase 2
    agentOutputs = await runPhase2Workers(config, phase1Output, tokenUsages, timings);
  } else {
    // FULL: Parse JSONL, run Phase 1, run Phase 2
    const fileName = jsonlPath.split('/').pop() ?? 'unknown';
    console.log('Mode: FRESH (full pipeline)');
    console.log(`File: ${fileName}`);
    console.log('');

    // Parse JSONL
    console.log('Parsing JSONL...');
    const parseStartTime = Date.now();
    const parser = new SessionParser();
    const session = await parser.parseSessionFile(jsonlPath);
    const parseTime = Date.now() - parseStartTime;
    console.log(`Parsed ${session.messages.length} messages in ${parseTime}ms`);
    console.log('');

    timings.push({ label: 'JSONL Parse', ms: parseTime });

    // Run Phase 1
    console.log('Running Phase 1 (DataExtractor)...');
    const phase1StartTime = Date.now();
    const dataExtractor = new DataExtractorWorker(config);
    const phase1Result = await dataExtractor.execute({
      sessions: [session],
      metrics: createMockMetrics(),
      tier: 'pro' as const,
    });
    const phase1Time = Date.now() - phase1StartTime;

    if (phase1Result.error) {
      console.error('❌ Phase 1 Failed:', phase1Result.error);
      process.exit(1);
    }

    phase1Output = phase1Result.data;
    sessionCount = 1;

    console.log(`Phase 1 completed in ${phase1Time}ms`);
    console.log(`  Utterances: ${phase1Output.developerUtterances.length}`);
    console.log(`  AI responses: ${phase1Output.sessionMetrics.totalAIResponses}`);
    console.log('');

    timings.push({ label: 'Phase 1', ms: phase1Time });
    if (phase1Result.usage) {
      tokenUsages.push({ label: 'Phase 1', usage: phase1Result.usage });
    }

    // Run Phase 2
    agentOutputs = await runPhase2Workers(config, phase1Output, tokenUsages, timings);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Content Writer
  // ─────────────────────────────────────────────────────────────────────────

  console.log('Running Phase 3 (ContentWriter)...');
  const phase3StartTime = Date.now();

  const contentWriter = new ContentWriterStage({
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    verbose: true,
  });

  const phase3Result = await contentWriter.transformV3(
    sessionCount,
    agentOutputs,
    phase1Output
  );
  const phase3Time = Date.now() - phase3StartTime;

  console.log(`Phase 3 completed in ${phase3Time}ms`);
  timings.push({ label: 'Phase 3', ms: phase3Time });
  tokenUsages.push({ label: 'Phase 3', usage: phase3Result.usage });

  // ─────────────────────────────────────────────────────────────────────────
  // Output Display
  // ─────────────────────────────────────────────────────────────────────────

  printNarrativeOutput(phase3Result.data as NarrativeLLMResponse);

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));

  console.log('\nExecution Times:');
  let totalTime = 0;
  for (const { label, ms } of timings) {
    console.log(`  ${label}: ${ms}ms`);
    totalTime += ms;
  }
  console.log(`  TOTAL: ${totalTime}ms`);

  console.log('\nToken Usage:');
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalTokens = 0;
  let totalCached = 0;

  for (const { label, usage } of tokenUsages) {
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

  console.log('\n' + '='.repeat(80));
  console.log('Phase 3 Test Complete');
  console.log('='.repeat(80));
}

// ============================================================================
// Phase 2 Helper
// ============================================================================

async function runPhase2Workers(
  config: ReturnType<typeof createOrchestratorConfig>,
  phase1Output: Phase1Output,
  tokenUsages: { label: string; usage: TokenUsage }[],
  timings: { label: string; ms: number }[]
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
    const worker = new ThinkingQualityWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`ThinkingQuality failed: ${result.error}`);
    agentOutputs.thinkingQuality = result.data;
    if (result.usage) tokenUsages.push({ label: 'ThinkingQuality', usage: result.usage });
  }

  // LearningBehavior
  {
    const worker = new LearningBehaviorWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`LearningBehavior failed: ${result.error}`);
    agentOutputs.learningBehavior = result.data;
    if (result.usage) tokenUsages.push({ label: 'LearningBehavior', usage: result.usage });
  }

  // ContextEfficiency
  {
    const worker = new ContextEfficiencyWorker(config);
    const result = await worker.execute(phase2Context);
    if (result.error) throw new Error(`ContextEfficiency failed: ${result.error}`);
    agentOutputs.efficiency = result.data;
    if (result.usage) tokenUsages.push({ label: 'ContextEfficiency', usage: result.usage });
  }

  // TypeClassifier (Phase 2.5)
  {
    const worker = new TypeClassifierWorker(config);
    const result = await worker.execute({ ...phase2Context, agentOutputs });
    if (result.error) throw new Error(`TypeClassifier failed: ${result.error}`);
    agentOutputs.typeClassifier = result.data;
    if (result.usage) tokenUsages.push({ label: 'TypeClassifier', usage: result.usage });
  }

  const phase2Time = Date.now() - phase2StartTime;
  console.log(`Phase 2 completed in ${phase2Time}ms`);
  console.log('');

  timings.push({ label: 'Phase 2 (all workers)', ms: phase2Time });

  return agentOutputs;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
