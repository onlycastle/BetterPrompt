/**
 * Evaluation Assembly + Translation Overlay Test Script
 *
 * Tests the final pipeline stages: Evaluation Assembly and Translation Overlay.
 * Uses Phase 3 cache (preferred) or Phase 2 cache to avoid re-running earlier phases.
 *
 * Pipeline tested:
 *   Phase 3 Cache (NarrativeLLMResponse)
 *       ↓
 *   assembleEvaluation() - deterministic assembly
 *       ↓
 *   Phase 4 Translator (conditional - non-English only)
 *       ↓
 *   mergeTranslatedFields() - translation overlay
 *       ↓
 *   VerboseEvaluation (final output)
 *
 * Usage:
 *   npx tsx scripts/test-evaluation-assembly.ts                         # Use Phase 3 cache, auto-detect lang
 *   npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache      # Explicit Phase 3 cache (default)
 *   npx tsx scripts/test-evaluation-assembly.ts --use-phase2-cache      # Run Phase 3 first
 *   npx tsx scripts/test-evaluation-assembly.ts --lang=ko               # Force Korean translation
 *   npx tsx scripts/test-evaluation-assembly.ts --skip-translation      # Skip Phase 4
 *
 * Environment:
 *   Requires GOOGLE_GEMINI_API_KEY in .env for translation (if not skipped)
 */

import 'dotenv/config';

import {
  loadPhase2Cache,
  loadPhase3Cache,
  createOrchestratorConfig,
  printTokenUsage,
  printCostSummary,
  printSectionHeader,
  truncateText,
  wrapText,
  toTitleCase,
} from './utils/test-utils';

import { ContentWriterStage } from '../src/lib/analyzer/stages/content-writer';
import { TranslatorStage } from '../src/lib/analyzer/stages/translator';
import {
  assembleEvaluation,
  mergeTranslatedFields,
} from '../src/lib/analyzer/stages/evaluation-assembler';
import {
  detectPrimaryLanguage,
  type SupportedLanguage,
} from '../src/lib/analyzer/stages/content-writer-prompts';
import type { Phase1Output } from '../src/lib/models/phase1-output';
import type { AgentOutputs } from '../src/lib/models/agent-outputs';
import type { NarrativeLLMResponse } from '../src/lib/models/verbose-evaluation';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';

// ============================================================================
// Configuration
// ============================================================================

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
  usePhase3Cache: boolean;
  usePhase2Cache: boolean;
  forceLang: SupportedLanguage | null;
  skipTranslation: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let usePhase3Cache = true; // Default
  let usePhase2Cache = false;
  let forceLang: SupportedLanguage | null = null;
  let skipTranslation = false;

  for (const arg of args) {
    if (arg === '--use-phase3-cache') {
      usePhase3Cache = true;
      usePhase2Cache = false;
    } else if (arg === '--use-phase2-cache') {
      usePhase2Cache = true;
      usePhase3Cache = false;
    } else if (arg === '--skip-translation') {
      skipTranslation = true;
    } else if (arg.startsWith('--lang=')) {
      const lang = arg.replace('--lang=', '') as SupportedLanguage;
      if (['en', 'ko', 'ja', 'zh'].includes(lang)) {
        forceLang = lang;
      } else {
        console.error(`Invalid language: ${lang}`);
        console.error('Supported languages: en, ko, ja, zh');
        process.exit(1);
      }
    }
  }

  return { usePhase3Cache, usePhase2Cache, forceLang, skipTranslation };
}

// ============================================================================
// Output Display
// ============================================================================

function printEvaluationSummary(evaluation: Record<string, unknown>): void {
  printSectionHeader('Evaluation Assembly Result');

  // Personality Summary
  console.log('\n📝 Personality Summary:');
  console.log('-'.repeat(70));
  const summary = evaluation.personalitySummary as string;
  if (summary) {
    const lines = wrapText(truncateText(summary, 600), 68).split('\n');
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    console.log(`  [Length: ${summary.length} chars]`);
  } else {
    console.log('  (not available)');
  }

  // Type Classification
  console.log('\n🎭 Type Classification:');
  console.log('-'.repeat(70));
  console.log(`  Primary Type: ${evaluation.primaryType || 'N/A'}`);
  console.log(`  Control Level: ${evaluation.controlLevel || 'N/A'}`);
  console.log(`  Control Score: ${evaluation.controlScore || 'N/A'}`);

  const distribution = evaluation.distribution as Record<string, number> | undefined;
  if (distribution) {
    console.log('  Distribution:');
    for (const [type, value] of Object.entries(distribution)) {
      const bar = '█'.repeat(Math.round(value / 5));
      console.log(`    ${type.padEnd(12)}: ${bar} ${value}%`);
    }
  }

  // Worker Insights
  const workerInsights = evaluation.workerInsights as Record<string, any> | undefined;
  if (workerInsights && Object.keys(workerInsights).length > 0) {
    console.log('\n💡 Worker Insights:');
    console.log('-'.repeat(70));

    for (const [domain, insights] of Object.entries(workerInsights)) {
      if (!insights) continue;

      const displayName = toTitleCase(domain);
      const strengthCount = insights.strengths?.length ?? 0;
      const growthCount = insights.growthAreas?.length ?? 0;
      const score = insights.domainScore ?? 'N/A';

      console.log(`\n  ${displayName}:`);
      console.log(`    Score: ${score}`);
      console.log(`    Strengths: ${strengthCount}, Growth Areas: ${growthCount}`);

      // Show first strength
      if (insights.strengths?.[0]) {
        const s = insights.strengths[0];
        console.log(`    Top Strength: ${s.title}`);
        console.log(`      ${truncateText(s.description, 80)}`);
      }

      // Show first growth area
      if (insights.growthAreas?.[0]) {
        const g = insights.growthAreas[0];
        console.log(`    Top Growth: ${g.title}`);
        console.log(`      ${truncateText(g.description, 80)}`);
      }
    }
  }

  // Prompt Patterns
  const promptPatterns = evaluation.promptPatterns as any[] | undefined;
  if (promptPatterns && promptPatterns.length > 0) {
    console.log('\n💬 Prompt Patterns:');
    console.log('-'.repeat(70));

    for (let i = 0; i < Math.min(3, promptPatterns.length); i++) {
      const pattern = promptPatterns[i];
      console.log(`\n  ${i + 1}. ${pattern.patternName}`);
      console.log(`     Frequency: ${pattern.frequency}, Effectiveness: ${pattern.effectiveness}`);
      console.log(`     ${truncateText(pattern.description, 100)}`);

      if (pattern.examples?.length > 0) {
        console.log(`     Examples: ${pattern.examples.length} quotes`);
        const firstExample = pattern.examples[0];
        if (firstExample.quote) {
          console.log(`       "${truncateText(firstExample.quote, 60)}"`);
        }
      }
    }
  }

  // Top Focus Areas
  const topFocusAreas = evaluation.topFocusAreas as any | undefined;
  if (topFocusAreas?.areas?.length > 0) {
    console.log('\n🎯 Top Focus Areas:');
    console.log('-'.repeat(70));

    for (const area of topFocusAreas.areas) {
      console.log(`\n  #${area.rank}: ${area.title}`);
      console.log(`     Dimension: ${area.dimension}`);
      console.log(`     Priority Score: ${area.priorityScore}`);
      console.log(`     ${truncateText(area.narrative, 100)}`);
    }

    if (topFocusAreas.summary) {
      console.log(`\n  Summary: ${truncateText(topFocusAreas.summary, 120)}`);
    }
  }

  // Premium Sections
  console.log('\n🔒 Premium Sections:');
  console.log('-'.repeat(70));
  console.log(`  Anti-Patterns Analysis: ${evaluation.antiPatternsAnalysis ? 'Present' : 'Not available'}`);
  console.log(`  Critical Thinking: ${evaluation.criticalThinkingAnalysis ? 'Present' : 'Not available'}`);
  console.log(`  Planning Analysis: ${evaluation.planningAnalysis ? 'Present' : 'Not available'}`);
}

function printTranslationComparison(
  englishEval: Record<string, unknown>,
  translatedEval: Record<string, unknown>,
  targetLang: SupportedLanguage
): void {
  printSectionHeader(`Translation Overlay (English → ${LANGUAGE_NAMES[targetLang]})`);

  // Personality Summary comparison
  console.log('\n📝 Personality Summary:');
  console.log('-'.repeat(70));

  const englishSummary = englishEval.personalitySummary as string;
  const translatedSummary = translatedEval.personalitySummary as string;

  console.log('\n[ENGLISH]');
  const englishLines = wrapText(truncateText(englishSummary || '', 400), 66).split('\n');
  for (const line of englishLines) {
    console.log(`  ${line}`);
  }

  console.log(`\n[${LANGUAGE_NAMES[targetLang].toUpperCase()}]`);
  const translatedLines = wrapText(truncateText(translatedSummary || '', 400), 66).split('\n');
  for (const line of translatedLines) {
    console.log(`  ${line}`);
  }

  console.log('-'.repeat(70));
  console.log(`English length: ${englishSummary?.length ?? 0} chars`);
  console.log(`Translated length: ${translatedSummary?.length ?? 0} chars`);

  // Prompt Patterns comparison
  const englishPatterns = englishEval.promptPatterns as any[] | undefined;
  const translatedPatterns = translatedEval.promptPatterns as any[] | undefined;

  if (englishPatterns?.length && translatedPatterns?.length) {
    console.log('\n💬 Prompt Patterns (first 2):');
    console.log('-'.repeat(70));

    for (let i = 0; i < Math.min(2, translatedPatterns.length); i++) {
      const en = englishPatterns[i];
      const tr = translatedPatterns[i];

      console.log(`\n  ${i + 1}. Pattern Name:`);
      console.log(`     [EN] ${en?.patternName || 'N/A'}`);
      console.log(`     [${targetLang.toUpperCase()}] ${tr?.patternName || 'N/A'}`);

      console.log(`     Description:`);
      console.log(`     [EN] ${truncateText(en?.description || '', 60)}`);
      console.log(`     [${targetLang.toUpperCase()}] ${truncateText(tr?.description || '', 60)}`);
    }
  }

  // Translated Agent Insights
  const translatedInsights = translatedEval.translatedAgentInsights as any | undefined;
  if (translatedInsights) {
    console.log('\n🌐 Translated Agent Insights:');
    console.log('-'.repeat(70));

    const keys = Object.keys(translatedInsights).filter((k) => translatedInsights[k]);
    console.log(`  Available: ${keys.length > 0 ? keys.join(', ') : 'None'}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { usePhase3Cache, usePhase2Cache, forceLang, skipTranslation } = parseArgs();

  console.log('='.repeat(80));
  console.log('Evaluation Assembly + Translation Overlay Test');
  console.log('='.repeat(80));

  const config = createOrchestratorConfig();
  const tokenUsages: { label: string; usage: TokenUsage }[] = [];
  const timings: { label: string; ms: number }[] = [];

  // Variables to be populated
  let phase1Output: Phase1Output;
  let agentOutputs: AgentOutputs;
  let narrativeResponse: NarrativeLLMResponse;
  let sessionCount: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  if (usePhase3Cache) {
    console.log('Mode: PHASE 3 CACHE (fastest)');
    console.log('');

    const cacheStartTime = Date.now();
    const phase3Cache = loadPhase3Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase3Cache.phase1Output;
    agentOutputs = phase3Cache.agentOutputs;
    narrativeResponse = phase3Cache.narrativeResponse;
    sessionCount = phase3Cache.metadata.stats.totalUtterances > 0 ? 1 : 0;

    console.log(`Phase 3 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Generated at: ${phase3Cache.metadata.generatedAt}`);
    console.log(`  Utterances: ${phase3Cache.phase1Output.developerUtterances.length}`);
    console.log('');

    timings.push({ label: 'Cache Load', ms: cacheLoadTime });
  } else if (usePhase2Cache) {
    console.log('Mode: PHASE 2 CACHE (run Phase 3)');
    console.log('');

    // Check for API key (needed for Phase 3)
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('❌ GOOGLE_GEMINI_API_KEY is required for Phase 3');
      process.exit(1);
    }

    const cacheStartTime = Date.now();
    const phase2Cache = loadPhase2Cache();
    const cacheLoadTime = Date.now() - cacheStartTime;

    phase1Output = phase2Cache.phase1Output;
    agentOutputs = phase2Cache.agentOutputs;
    sessionCount = phase2Cache.metadata.stats.totalUtterances > 0 ? 1 : 0;

    console.log(`Phase 2 cache loaded in ${cacheLoadTime}ms`);
    console.log(`  Generated at: ${phase2Cache.metadata.generatedAt}`);
    console.log(`  Utterances: ${phase2Cache.phase1Output.developerUtterances.length}`);
    console.log('');

    timings.push({ label: 'Cache Load', ms: cacheLoadTime });

    // Run Phase 3
    console.log('Running Phase 3 (ContentWriter)...');
    const phase3StartTime = Date.now();

    const contentWriter = new ContentWriterStage({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      verbose: true,
    });

    contentWriter.verifyPhase2WorkerExamples(agentOutputs, phase1Output);
    const phase3Result = await contentWriter.transformV3(sessionCount, agentOutputs, phase1Output);

    const phase3Time = Date.now() - phase3StartTime;
    timings.push({ label: 'Phase 3', ms: phase3Time });
    tokenUsages.push({ label: 'ContentWriter', usage: phase3Result.usage });

    narrativeResponse = phase3Result.data;
    console.log(`Phase 3 completed in ${phase3Time}ms`);
    printTokenUsage(phase3Result.usage, 'ContentWriter');
    console.log('');
  } else {
    console.error('❌ Must specify --use-phase3-cache or --use-phase2-cache');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evaluation Assembly (Deterministic)
  // ─────────────────────────────────────────────────────────────────────────

  console.log('Running Evaluation Assembly...');
  const assemblyStartTime = Date.now();

  const assembledEvaluation = assembleEvaluation(
    agentOutputs,
    narrativeResponse,
    phase1Output,
    sessionCount
  );

  const assemblyTime = Date.now() - assemblyStartTime;
  timings.push({ label: 'Evaluation Assembly', ms: assemblyTime });
  console.log(`Evaluation Assembly completed in ${assemblyTime}ms`);
  console.log('');

  // Store English version for comparison
  const englishEvaluation = JSON.parse(JSON.stringify(assembledEvaluation));

  // ─────────────────────────────────────────────────────────────────────────
  // Language Detection
  // ─────────────────────────────────────────────────────────────────────────

  let targetLanguage: SupportedLanguage;

  if (forceLang) {
    targetLanguage = forceLang;
    console.log(`Language: ${LANGUAGE_NAMES[targetLanguage]} (forced via --lang=${forceLang})`);
  } else {
    const utteranceTexts = phase1Output.developerUtterances.map((u) => u.text);
    const langResult = detectPrimaryLanguage(utteranceTexts);

    targetLanguage = langResult.primary;
    console.log('Language Detection:');
    console.log(`  Primary: ${LANGUAGE_NAMES[targetLanguage]} (confidence: ${(langResult.confidence * 100).toFixed(1)}%)`);
    console.log(`  Korean chars: ${langResult.charCounts.korean}`);
    console.log(`  Japanese chars: ${langResult.charCounts.japanese}`);
    console.log(`  Chinese chars: ${langResult.charCounts.chinese}`);
    console.log(`  Total analyzed: ${langResult.charCounts.total}`);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Translation Overlay (conditional)
  // ─────────────────────────────────────────────────────────────────────────

  if (skipTranslation) {
    console.log('⏭️  Translation skipped (--skip-translation flag)');
    console.log('');

    // Show English evaluation
    printEvaluationSummary(assembledEvaluation);
  } else if (targetLanguage === 'en') {
    console.log('⏭️  Target language is English - skipping Phase 4 Translator');
    console.log('');

    // Show English evaluation
    printEvaluationSummary(assembledEvaluation);
  } else {
    // Check for API key
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('❌ GOOGLE_GEMINI_API_KEY is required for translation');
      process.exit(1);
    }

    console.log(`Running Phase 4 (Translator → ${LANGUAGE_NAMES[targetLanguage]})...`);
    const phase4StartTime = Date.now();

    const translator = new TranslatorStage({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    });

    const phase4Result = await translator.translate(
      narrativeResponse,
      targetLanguage,
      agentOutputs
    );

    const phase4Time = Date.now() - phase4StartTime;
    timings.push({ label: 'Phase 4 (Translator)', ms: phase4Time });
    tokenUsages.push({ label: 'Translator', usage: phase4Result.usage });

    console.log(`Phase 4 completed in ${phase4Time}ms`);
    printTokenUsage(phase4Result.usage, 'Translator');
    console.log('');

    // Apply Translation Overlay
    console.log('Applying Translation Overlay...');
    const mergeStartTime = Date.now();

    mergeTranslatedFields(assembledEvaluation, phase4Result.data, targetLanguage);

    const mergeTime = Date.now() - mergeStartTime;
    timings.push({ label: 'Translation Overlay', ms: mergeTime });
    console.log(`Translation Overlay completed in ${mergeTime}ms`);
    console.log('');

    // Show comparison
    printTranslationComparison(englishEvaluation, assembledEvaluation, targetLanguage);
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

  if (tokenUsages.length > 0) {
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
  }

  // Final output structure summary
  console.log('\nFinal VerboseEvaluation Fields:');
  console.log('-'.repeat(80));

  const fieldGroups = {
    'Core': ['personalitySummary', 'primaryType', 'controlLevel', 'controlScore', 'distribution'],
    'Insights': ['workerInsights', 'promptPatterns'],
    'Focus': ['topFocusAreas'],
    'Premium': ['antiPatternsAnalysis', 'criticalThinkingAnalysis', 'planningAnalysis'],
    'Data': ['utteranceLookup', 'transformationAudit'],
    'Translation': ['translatedAgentInsights'],
  };

  for (const [group, fields] of Object.entries(fieldGroups)) {
    const presentFields = fields.filter((f) => assembledEvaluation[f] !== undefined);
    console.log(`  ${group}: ${presentFields.length > 0 ? presentFields.join(', ') : '(none)'}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Evaluation Assembly Test Complete');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
