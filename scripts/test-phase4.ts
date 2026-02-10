/**
 * Phase 4 Local Test Script (Translator)
 *
 * Tests the Phase 4 Translator stage with various cache and language options.
 * Translates English ContentWriter output into the target language.
 *
 * Usage:
 *   npx tsx scripts/test-phase4.ts                          # Full pipeline (auto-detect lang)
 *   npx tsx scripts/test-phase4.ts --lang=ko                # Force Korean translation
 *   npx tsx scripts/test-phase4.ts --lang=ja                # Force Japanese translation
 *   npx tsx scripts/test-phase4.ts --use-phase2-cache       # Use Phase 2 cache
 *   npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko
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
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import { ThinkingQualityWorker } from '../src/lib/analyzer/workers/thinking-quality-worker';
import { LearningBehaviorWorker } from '../src/lib/analyzer/workers/learning-behavior-worker';
import { ContextEfficiencyWorker } from '../src/lib/analyzer/workers/context-efficiency-worker';
import { TypeClassifierWorker } from '../src/lib/analyzer/workers/type-classifier-worker';
import { ContentWriterStage } from '../src/lib/analyzer/stages/content-writer';
import { TranslatorStage } from '../src/lib/analyzer/stages/translator';
import { detectPrimaryLanguage, type SupportedLanguage } from '../src/lib/analyzer/stages/content-writer-prompts';
import type { Phase2WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { AgentOutputs } from '../src/lib/models/agent-outputs';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';
import type { NarrativeLLMResponse } from '../src/lib/models/verbose-evaluation';
import type { TranslatorOutput } from '../src/lib/models/translator-output';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_JSONL_PATH =
  '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-nomoreaislop/e3988e3b-3c6c-4fe5-bd90-99b93009c4cb.jsonl';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

// ============================================================================
// Argument Parsing
// ============================================================================

interface CLIArgs {
  jsonlPath: string;
  useCache: boolean;
  usePhase2Cache: boolean;
  forceLang: SupportedLanguage | null;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let jsonlPath = DEFAULT_JSONL_PATH;
  let useCache = false;
  let usePhase2Cache = false;
  let forceLang: SupportedLanguage | null = null;

  for (const arg of args) {
    if (arg === '--use-cache') {
      useCache = true;
    } else if (arg === '--use-phase2-cache') {
      usePhase2Cache = true;
    } else if (arg.startsWith('--lang=')) {
      const lang = arg.replace('--lang=', '') as SupportedLanguage;
      if (['en', 'ko', 'ja', 'zh'].includes(lang)) {
        forceLang = lang;
      } else {
        console.error(`Invalid language: ${lang}`);
        console.error('Supported languages: en, ko, ja, zh');
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      jsonlPath = arg;
    }
  }

  return { jsonlPath, useCache, usePhase2Cache, forceLang };
}

// ============================================================================
// Output Display
// ============================================================================

function printTranslationComparison(
  englishResponse: NarrativeLLMResponse,
  translatedOutput: TranslatorOutput,
  targetLang: SupportedLanguage
): void {
  printSectionHeader(`Phase 4 Translation Comparison (English → ${LANGUAGE_NAMES[targetLang]})`);

  // Personality Summary comparison
  console.log('\n📝 Personality Summary:');
  console.log('-'.repeat(80));

  console.log('\n[ENGLISH]');
  const englishLines = wrapText(truncateText(englishResponse.personalitySummary, 500), 78).split('\n');
  for (const line of englishLines) {
    console.log(`  ${line}`);
  }

  console.log(`\n[${LANGUAGE_NAMES[targetLang].toUpperCase()}]`);
  const translatedLines = wrapText(truncateText(translatedOutput.personalitySummary, 500), 78).split('\n');
  for (const line of translatedLines) {
    console.log(`  ${line}`);
  }

  console.log('-'.repeat(80));
  console.log(`English length: ${englishResponse.personalitySummary.length} chars`);
  console.log(`Translated length: ${translatedOutput.personalitySummary.length} chars`);

  // Top Focus Areas comparison
  if (translatedOutput.topFocusAreas && translatedOutput.topFocusAreas.areas.length > 0) {
    console.log('\n🎯 Top Focus Areas:');
    console.log('-'.repeat(80));

    for (let i = 0; i < translatedOutput.topFocusAreas.areas.length; i++) {
      const translated = translatedOutput.topFocusAreas.areas[i];
      const english = englishResponse.topFocusAreas?.areas?.[i];

      console.log(`\n  #${translated.rank}`);
      if (english?.title) {
        console.log(`     [EN] ${truncateText(english.title, 60)}`);
      }
      console.log(`     [${targetLang.toUpperCase()}] ${truncateText(translated.title, 60)}`);

      if (english?.narrative) {
        console.log(`     [EN Narrative] ${truncateText(english.narrative, 80)}`);
      }
      console.log(`     [${targetLang.toUpperCase()} Narrative] ${truncateText(translated.narrative, 80)}`);
    }
  }

  // Prompt Patterns comparison (first 2)
  if (translatedOutput.promptPatterns && translatedOutput.promptPatterns.length > 0) {
    console.log('\n💬 Prompt Patterns (first 2):');
    console.log('-'.repeat(80));

    for (let i = 0; i < Math.min(2, translatedOutput.promptPatterns.length); i++) {
      const translated = translatedOutput.promptPatterns[i];
      const english = englishResponse.promptPatterns?.[i];

      console.log(`\n  ${i + 1}. Pattern Name:`);
      if (english?.patternName) {
        console.log(`     [EN] ${english.patternName}`);
      }
      console.log(`     [${targetLang.toUpperCase()}] ${translated.patternName}`);

      console.log(`     Description:`);
      if (english?.description) {
        console.log(`     [EN] ${truncateText(english.description, 60)}`);
      }
      console.log(`     [${targetLang.toUpperCase()}] ${truncateText(translated.description, 60)}`);
    }
  }

  // Agent Insights comparison (Phase 2 workers)
  if (translatedOutput.translatedAgentInsights) {
    console.log('\n🧠 Agent Insights (Phase 2 Workers):');
    console.log('-'.repeat(80));

    const insights = translatedOutput.translatedAgentInsights;

    // ThinkingQuality
    if (insights.thinkingQuality) {
      console.log('\n  [ThinkingQuality]');
      if (insights.thinkingQuality.strengthsData) {
        console.log(`     Strengths: ${truncateText(insights.thinkingQuality.strengthsData, 100)}`);
      }
      if (insights.thinkingQuality.growthAreasData) {
        console.log(`     Growth Areas: ${truncateText(insights.thinkingQuality.growthAreasData, 100)}`);
      }
    }

    // LearningBehavior
    if (insights.learningBehavior) {
      console.log('\n  [LearningBehavior]');
      if (insights.learningBehavior.strengthsData) {
        console.log(`     Strengths: ${truncateText(insights.learningBehavior.strengthsData, 100)}`);
      }
      if (insights.learningBehavior.growthAreasData) {
        console.log(`     Growth Areas: ${truncateText(insights.learningBehavior.growthAreasData, 100)}`);
      }
    }

    // ContextEfficiency
    if (insights.contextEfficiency) {
      console.log('\n  [ContextEfficiency]');
      if (insights.contextEfficiency.strengthsData) {
        console.log(`     Strengths: ${truncateText(insights.contextEfficiency.strengthsData, 100)}`);
      }
      if (insights.contextEfficiency.growthAreasData) {
        console.log(`     Growth Areas: ${truncateText(insights.contextEfficiency.growthAreasData, 100)}`);
      }
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { jsonlPath, useCache, usePhase2Cache, forceLang } = parseArgs();

  console.log('='.repeat(80));
  console.log('Phase 4 Test - Translator');
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
  // Data Loading / Generation (same as test-phase3.ts)
  // ─────────────────────────────────────────────────────────────────────────

  if (usePhase2Cache) {
    console.log('Mode: PHASE 2 CACHE (fastest)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase2Cache = loadPhase2Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase2Cache.phase1Output;
    agentOutputs = phase2Cache.agentOutputs;
    sessionCount = phase2Cache.metadata.stats.totalUtterances > 0 ? 1 : 0;

    console.log(`Phase 2 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Utterances: ${phase2Cache.phase1Output.developerUtterances.length}`);
    console.log('');

    timings.push({ label: 'Cache Load', ms: cacheLoadTime });
  } else if (useCache) {
    console.log('Mode: PHASE 1 CACHE (run Phase 2)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase1Cache = loadPhase1Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase1Cache.phase1Output;
    sessionCount = phase1Cache.metadata.sessions.length;

    console.log(`Phase 1 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Sessions: ${phase1Cache.metadata.sessions.length}`);
    console.log('');

    timings.push({ label: 'Phase 1 Cache Load', ms: cacheLoadTime });

    agentOutputs = await runPhase2Workers(config, phase1Output, tokenUsages, timings);
  } else {
    const fileName = jsonlPath.split('/').pop() ?? 'unknown';
    console.log('Mode: FRESH (full pipeline)');
    console.log(`File: ${fileName}`);
    console.log('');

    // Parse JSONL
    const parseStartTime = Date.now();
    const parser = new SessionParser();
    const session = await parser.parseSessionFile(jsonlPath);
    const parseTime = Date.now() - parseStartTime;
    console.log(`Parsed ${session.messages.length} messages in ${parseTime}ms`);
    console.log('');

    timings.push({ label: 'JSONL Parse', ms: parseTime });

    // Run Phase 1
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
    timings.push({ label: 'Phase 1', ms: phase1Time });
    if (phase1Result.usage) {
      tokenUsages.push({ label: 'Phase 1', usage: phase1Result.usage });
    }

    agentOutputs = await runPhase2Workers(config, phase1Output, tokenUsages, timings);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Language Detection
  // ─────────────────────────────────────────────────────────────────────────

  let targetLanguage: SupportedLanguage;

  if (forceLang) {
    targetLanguage = forceLang;
    console.log(`Language: ${LANGUAGE_NAMES[targetLanguage]} (forced via --lang=${forceLang})`);
  } else {
    // Detect from utterances
    const utteranceTexts = phase1Output.developerUtterances.map((u) => u.text);
    const langResult = detectPrimaryLanguage(utteranceTexts);

    targetLanguage = langResult.primary;
    console.log(`Language Detection:`);
    console.log(`  Primary: ${LANGUAGE_NAMES[targetLanguage]} (confidence: ${(langResult.confidence * 100).toFixed(1)}%)`);
    console.log(`  Korean chars: ${langResult.charCounts.korean}`);
    console.log(`  Japanese chars: ${langResult.charCounts.japanese}`);
    console.log(`  Chinese chars: ${langResult.charCounts.chinese}`);
    console.log(`  Total analyzed: ${langResult.charCounts.total}`);
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

  const phase3Result = await contentWriter.transformV3(sessionCount, agentOutputs, phase1Output);
  const phase3Time = Date.now() - phase3StartTime;

  console.log(`Phase 3 completed in ${phase3Time}ms`);
  timings.push({ label: 'Phase 3', ms: phase3Time });
  tokenUsages.push({ label: 'Phase 3', usage: phase3Result.usage });

  const englishResponse = phase3Result.data as NarrativeLLMResponse;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Translator (conditional)
  // ─────────────────────────────────────────────────────────────────────────

  if (targetLanguage === 'en') {
    console.log('\n⏭️  Target language is English - skipping Phase 4 Translator');
    console.log('');

    // Show Phase 3 output summary
    printSectionHeader('Phase 3 ContentWriter Output (English - no translation)');
    console.log('\n📝 Personality Summary:');
    console.log('-'.repeat(60));
    const wrappedSummary = wrapText(truncateText(englishResponse.personalitySummary, 500), 78);
    console.log(wrappedSummary);
    console.log('-'.repeat(60));
    console.log(`[Length: ${englishResponse.personalitySummary.length} chars]`);
  } else {
    console.log(`\nRunning Phase 4 (Translator → ${LANGUAGE_NAMES[targetLanguage]})...`);
    const phase4StartTime = Date.now();

    const translator = new TranslatorStage({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    });

    const phase4Result = await translator.translate(englishResponse, targetLanguage, agentOutputs);
    const phase4Time = Date.now() - phase4StartTime;

    console.log(`Phase 4 completed in ${phase4Time}ms`);
    timings.push({ label: 'Phase 4', ms: phase4Time });
    tokenUsages.push({ label: 'Phase 4', usage: phase4Result.usage });

    // Show translation comparison
    printTranslationComparison(englishResponse, phase4Result.data, targetLanguage);
  }

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
  console.log('Phase 4 Test Complete');
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
