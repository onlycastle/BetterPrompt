/**
 * Phase 2 Local Test Script (v3 Unified Workers)
 *
 * Tests the Phase 2 Workers (ThinkingQuality, LearningBehavior, Efficiency + TypeClassifier)
 * with a specific JSONL file. Runs the same code that executes in Lambda, allowing local debugging.
 *
 * Usage:
 *   npx tsx scripts/test-phase2.ts
 *   npx tsx scripts/test-phase2.ts /path/to/custom.jsonl
 *   npx tsx scripts/test-phase2.ts --worker=ThinkingQuality
 *   npx tsx scripts/test-phase2.ts --worker=LearningBehavior
 *   npx tsx scripts/test-phase2.ts --worker=ContextEfficiency
 *   npx tsx scripts/test-phase2.ts --worker=TypeClassifier
 *   npx tsx scripts/test-phase2.ts --use-cache                    # Use cached Phase 1 output
 *   npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality
 *
 * Environment:
 *   Requires GOOGLE_GEMINI_API_KEY in .env for LLM analysis
 */

import 'dotenv/config';

import { SessionParser } from '../src/lib/parser';
import type { Phase1Output } from '../src/lib/models/phase1-output';
import type { ParsedSession } from '../src/lib/models/session';
import { DataExtractorWorker } from '../src/lib/analyzer/workers/data-extractor-worker';
import { ThinkingQualityWorker } from '../src/lib/analyzer/workers/thinking-quality-worker';
import { LearningBehaviorWorker } from '../src/lib/analyzer/workers/learning-behavior-worker';
import { ContextEfficiencyWorker } from '../src/lib/analyzer/workers/context-efficiency-worker';
import { TypeClassifierWorker } from '../src/lib/analyzer/workers/type-classifier-worker';
import type { Phase2WorkerContext } from '../src/lib/analyzer/orchestrator/types';
import type { ThinkingQualityOutput } from '../src/lib/models/thinking-quality-data';
import type { LearningBehaviorOutput } from '../src/lib/models/learning-behavior-data';
import type {
  ContextEfficiencyOutput,
  TypeClassifierOutput,
  AgentOutputs,
} from '../src/lib/models/agent-outputs';
import type { TokenUsage } from '../src/lib/analyzer/clients/gemini-client';
import type { WorkerStrength, WorkerGrowth } from '../src/lib/models/worker-insights';

// Import shared utilities
import {
  loadPhase1Cache,
  createMockMetrics,
  createOrchestratorConfig,
  printTokenUsage,
  truncateText,
  toTitleCase,
  formatEvidence,
  calculateActualCost,
  GEMINI_PRICING,
  type WorkerName,
  VALID_WORKERS,
} from './utils/test-utils';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_JSONL_PATH = process.env.NOSLOP_TEST_JSONL_PATH || '';

function printWorkerStrengths(strengths: WorkerStrength[] | undefined, workerName: string): void {
  if (!strengths || strengths.length === 0) {
    console.log(`[${workerName}] Strengths: None identified`);
    return;
  }

  console.log(`[${workerName}] Strengths (${strengths.length}):`);
  for (const s of strengths) {
    console.log(`  ✓ ${s.title ?? 'Untitled'}`);
    console.log(`    Description: ${truncateText(s.description ?? '')}`);
    if (s.evidence && s.evidence.length > 0) {
      console.log(`    Evidence (${s.evidence.length} quotes):`);
      for (const e of s.evidence.slice(0, 4)) {
        const quote = formatEvidence(e);
        if (quote) console.log(`      - "${truncateText(quote, 80)}"`);
      }
    }
  }
}

function printWorkerGrowthAreas(growthAreas: WorkerGrowth[] | undefined, workerName: string): void {
  if (!growthAreas || growthAreas.length === 0) {
    console.log(`[${workerName}] Growth Areas: None identified`);
    return;
  }

  console.log(`[${workerName}] Growth Areas (${growthAreas.length}):`);
  for (const g of growthAreas) {
    const severityBadge = g.severity ? `[${g.severity.toUpperCase()}]` : '';
    console.log(`  ⚠ ${g.title ?? 'Untitled'} ${severityBadge}`);
    console.log(`    Description: ${truncateText(g.description ?? '')}`);
    if (g.recommendation) {
      console.log(`    Recommendation: ${truncateText(g.recommendation)}`);
    }
    if (g.evidence && g.evidence.length > 0) {
      console.log(`    Evidence (${g.evidence.length} quotes):`);
      for (const e of g.evidence.slice(0, 4)) {
        const quote = formatEvidence(e);
        if (quote) console.log(`      - "${truncateText(quote, 80)}"`);
      }
    }
  }
}

// ============================================================================
// Worker-Specific Print Functions (v3 Unified Workers)
// ============================================================================

function printThinkingQualityOutput(output: ThinkingQualityOutput): void {
  console.log('\n' + '─'.repeat(60));
  console.log('ThinkingQuality Worker Output');
  console.log('─'.repeat(60));

  console.log(`Overall Thinking Quality Score: ${output.overallThinkingQualityScore}/100`);
  console.log(`Plan Quality Score: ${output.planQualityScore}/100`);
  console.log(`Confidence: ${(output.confidenceScore * 100).toFixed(1)}%`);

  // Verification Behavior
  if (output.verificationBehavior) {
    console.log(`\nVerification Level: ${toTitleCase(output.verificationBehavior.level)}`);
    if (output.verificationBehavior.recommendation) {
      console.log(`Recommendation: ${truncateText(output.verificationBehavior.recommendation, 150)}`);
    }
    if (output.verificationBehavior.examples && output.verificationBehavior.examples.length > 0) {
      console.log(`Examples:`);
      for (const ex of output.verificationBehavior.examples.slice(0, 3)) {
        console.log(`  - "${truncateText(ex, 80)}"`);
      }
    }
  }

  // Verification Anti-patterns
  if (output.verificationAntiPatterns && output.verificationAntiPatterns.length > 0) {
    console.log(`\nVerification Anti-Patterns (${output.verificationAntiPatterns.length}):`);
    for (const ap of output.verificationAntiPatterns) {
      const severity = ap.severity ? `[${ap.severity.toUpperCase()}]` : '';
      console.log(`  - ${toTitleCase(ap.type)} ${severity}`);
      console.log(`    Frequency: ${ap.frequency} | Session %: ${ap.sessionPercentage ?? 'N/A'}%`);
      if (ap.improvement) {
        console.log(`    Improvement: ${truncateText(ap.improvement, 100)}`);
      }
      if (ap.examples && ap.examples.length > 0) {
        console.log(`    Examples (${ap.examples.length}):`);
        for (const ex of ap.examples.slice(0, 4)) {
          console.log(`      - "${truncateText(ex.quote, 60)}" (${ex.utteranceId})`);
        }
      }
    }
  }

  // Planning Habits
  if (output.planningHabits && output.planningHabits.length > 0) {
    console.log(`\nPlanning Habits (${output.planningHabits.length}):`);
    for (const ph of output.planningHabits) {
      const effectiveness = ph.effectiveness ? `(${ph.effectiveness})` : '';
      console.log(`  - ${toTitleCase(ph.type)}: ${ph.frequency} ${effectiveness}`);
    }
  }

  // Critical Thinking Moments
  if (output.criticalThinkingMoments && output.criticalThinkingMoments.length > 0) {
    console.log(`\nCritical Thinking Moments (${output.criticalThinkingMoments.length}):`);
    for (const ct of output.criticalThinkingMoments.slice(0, 5)) {
      console.log(`  - [${toTitleCase(ct.type)}] "${truncateText(ct.quote, 60)}"`);
      if (ct.result) console.log(`    Result: ${ct.result}`);
    }
  }

  // Communication Patterns
  if (output.communicationPatterns && output.communicationPatterns.length > 0) {
    console.log(`\nCommunication Patterns (${output.communicationPatterns.length}):`);
    for (const p of output.communicationPatterns) {
      console.log(`  - ${p.patternName}: ${p.frequency}, ${p.effectiveness}`);
      if (p.tip) {
        console.log(`    Tip: ${truncateText(p.tip, 80)}`);
      }
    }
  }

  // Summary
  if (output.summary) {
    console.log(`\nSummary: ${output.summary}`);
  }

  // Strengths & Growth Areas
  console.log('');
  printWorkerStrengths(output.strengths, 'ThinkingQuality');
  console.log('');
  printWorkerGrowthAreas(output.growthAreas, 'ThinkingQuality');
}

function printLearningBehaviorOutput(output: LearningBehaviorOutput): void {
  console.log('\n' + '─'.repeat(60));
  console.log('LearningBehavior Worker Output');
  console.log('─'.repeat(60));

  console.log(`Overall Learning Score: ${output.overallLearningScore}/100`);
  console.log(`Confidence: ${(output.confidenceScore * 100).toFixed(1)}%`);

  // Top Insights
  if (output.topInsights && output.topInsights.length > 0) {
    console.log(`\nTop Insights (${output.topInsights.length}):`);
    for (const insight of output.topInsights) {
      console.log(`  - ${truncateText(insight, 100)}`);
    }
  }

  // Knowledge Gaps (IMPROVED with description)
  if (output.knowledgeGaps && output.knowledgeGaps.length > 0) {
    console.log(`\nKnowledge Gaps (${output.knowledgeGaps.length}):`);
    for (let i = 0; i < Math.min(output.knowledgeGaps.length, 5); i++) {
      const gap = output.knowledgeGaps[i];
      const depthEmoji = gap.depth === 'deep' ? '🔴' : gap.depth === 'moderate' ? '🟡' : '🟢';
      console.log(`  ${i + 1}. ${gap.topic}`);
      console.log(`     │ Depth: ${depthEmoji} ${gap.depth} (${gap.questionCount} questions)`);
      if (gap.description) {
        console.log(`     │ ${truncateText(gap.description, 100)}`);
      }
      if (gap.example) {
        console.log(`     │ Example: "${truncateText(gap.example, 60)}"`);
      }
    }
  }

  // Learning Progress (IMPROVED with description)
  if (output.learningProgress && output.learningProgress.length > 0) {
    const levelOrder = ['novice', 'shallow', 'moderate', 'deep', 'expert'];
    console.log(`\nLearning Progress (${output.learningProgress.length}):`);
    for (let i = 0; i < Math.min(output.learningProgress.length, 5); i++) {
      const p = output.learningProgress[i];
      const startIdx = levelOrder.indexOf(p.startLevel);
      const currentIdx = levelOrder.indexOf(p.currentLevel);
      const progressEmoji = currentIdx > startIdx ? '⬆️' : currentIdx === startIdx ? '➡️' : '⬇️';
      console.log(`  ${i + 1}. ${p.topic}`);
      console.log(`     │ Progress: ${p.startLevel} → ${p.currentLevel} ${progressEmoji}`);
      if (p.description) {
        console.log(`     │ ${truncateText(p.description, 100)}`);
      }
      if (p.evidence) {
        console.log(`     │ Evidence: "${truncateText(p.evidence, 60)}"`);
      }
    }
  }

  // Repeated Mistake Patterns (FIXED: use correct field names + description)
  if (output.repeatedMistakePatterns && output.repeatedMistakePatterns.length > 0) {
    console.log(`\nRepeated Mistake Patterns (${output.repeatedMistakePatterns.length}):`);
    for (const mp of output.repeatedMistakePatterns) {
      const percentage = mp.sessionPercentage ? ` (${mp.sessionPercentage}% of sessions)` : '';
      console.log(`  - [${mp.category}] ${mp.mistakeType}: ${mp.occurrenceCount}x${percentage}`);
      if (mp.description) {
        console.log(`    │ ${truncateText(mp.description, 100)}`);
      }
      console.log(`    │ Recommendation: ${truncateText(mp.recommendation, 80)}`);
      if (mp.exampleUtteranceIds && mp.exampleUtteranceIds.length > 0) {
        console.log(`    │ Examples: ${mp.exampleUtteranceIds.slice(0, 3).join(', ')}`);
      }
    }
  }

  // Summary
  if (output.summary) {
    console.log(`\nSummary: ${output.summary}`);
  }

  // Strengths & Growth Areas
  console.log('');
  printWorkerStrengths(output.strengths, 'LearningBehavior');
  console.log('');
  printWorkerGrowthAreas(output.growthAreas, 'LearningBehavior');
}

function printContextEfficiencyOutput(output: ContextEfficiencyOutput): void {
  console.log('\n' + '─'.repeat(60));
  console.log('ContextEfficiency Worker Output');
  console.log('─'.repeat(60));

  console.log(`Efficiency Score: ${output.overallEfficiencyScore}/100`);
  console.log(`Avg Context Fill: ${output.avgContextFillPercent}%`);
  console.log(`Confidence: ${(output.confidenceScore * 100).toFixed(1)}%`);

  // Top Insights
  console.log(`\nTop Insights (${output.topInsights.length}):`);
  for (const insight of output.topInsights) {
    console.log(`  - ${truncateText(insight, 100)}`);
  }

  // Context Usage Patterns
  if (output.contextUsagePatterns && output.contextUsagePatterns.length > 0) {
    console.log(`\nContext Usage Patterns (${output.contextUsagePatterns.length}):`);
    for (const p of output.contextUsagePatterns.slice(0, 5)) {
      console.log(`  - Session ${p.sessionId}: avg ${p.avgFillPercent}%`);
    }
  }

  // Inefficiency Patterns
  if (output.inefficiencyPatterns && output.inefficiencyPatterns.length > 0) {
    console.log(`\nInefficiency Patterns (${output.inefficiencyPatterns.length}):`);
    for (const p of output.inefficiencyPatterns.slice(0, 5)) {
      console.log(`  - ${p.pattern}: ${p.frequency}x (impact: ${p.impact})`);
      if (p.description) console.log(`    Description: ${truncateText(p.description, 60)}`);
    }
  }

  // Strengths & Growth Areas
  console.log('');
  printWorkerStrengths(output.strengths, 'ContextEfficiency');
  console.log('');
  printWorkerGrowthAreas(output.growthAreas, 'ContextEfficiency');
}

function printTypeClassifierOutput(output: TypeClassifierOutput): void {
  console.log('\n' + '─'.repeat(60));
  console.log('TypeClassifier Worker Output (Phase 2.5)');
  console.log('─'.repeat(60));

  console.log(`\n🎭 ${output.matrixEmoji} ${output.matrixName}`);
  console.log(`Primary Type: ${output.primaryType.toUpperCase()}`);
  console.log(`Control Level: ${output.controlLevel} (score: ${output.controlScore}/100)`);
  console.log(`Confidence: ${(output.confidenceScore * 100).toFixed(1)}%`);

  // Distribution
  console.log(`\nType Distribution:`);
  const dist = output.distribution;
  const types = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'] as const;
  for (const type of types) {
    const value = dist[type];
    const bar = '█'.repeat(Math.floor(value / 5)) + '░'.repeat(20 - Math.floor(value / 5));
    const isPrimary = type === output.primaryType ? ' ← PRIMARY' : '';
    console.log(`  ${type.padEnd(12)} ${bar} ${value}%${isPrimary}`);
  }

  // Collaboration Maturity
  if (output.collaborationMaturity) {
    const cm = output.collaborationMaturity;
    console.log(`\nCollaboration Maturity:`);
    console.log(`  Level: ${toTitleCase(cm.level)}`);
    console.log(`  Description: ${truncateText(cm.description, 150)}`);
    if (cm.indicators.length > 0) {
      console.log(`  Indicators:`);
      for (const ind of cm.indicators.slice(0, 3)) {
        console.log(`    - ${truncateText(ind, 80)}`);
      }
    }
  }

  // Reasoning
  if (output.reasoning) {
    console.log(`\nReasoning: ${output.reasoning}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let jsonlPath = DEFAULT_JSONL_PATH;
  let selectedWorker: WorkerName | null = null;
  let useCache = false;

  for (const arg of args) {
    if (arg === '--use-cache') {
      useCache = true;
    } else if (arg.startsWith('--worker=')) {
      const workerArg = arg.replace('--worker=', '') as WorkerName;
      if (!VALID_WORKERS.includes(workerArg)) {
        console.error(`Invalid worker: ${workerArg}`);
        console.error(`Valid workers: ${VALID_WORKERS.join(', ')}`);
        process.exit(1);
      }
      selectedWorker = workerArg;
    } else if (!arg.startsWith('--')) {
      jsonlPath = arg;
    }
  }

  console.log('='.repeat(80));
  console.log('Phase 2 Test - v3 Unified Workers');
  console.log('='.repeat(80));

  // Check for API key
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('❌ GOOGLE_GEMINI_API_KEY is required for Phase 2 workers');
    process.exit(1);
  }

  const config = createOrchestratorConfig();

  // Variables to be set by either cache or fresh execution
  let phase1Output: Phase1Output;
  let phase1Elapsed: number;
  let phase1Usage: TokenUsage | null = null;
  let sessions: ParsedSession[] = [];

  if (useCache) {
    // CACHE MODE: Load cached Phase 1 output
    console.log('Mode: CACHE (using cached Phase 1 output)');
    console.log(`Selected Worker: ${selectedWorker ?? 'ALL'}`);
    console.log('');

    console.log('Step 1: Loading cached Phase 1 output...');
    const cacheStartTime = Date.now();
    const cache = loadPhase1Cache();
    phase1Elapsed = Date.now() - cacheStartTime;

    phase1Output = cache.phase1Output;
    // NOTE: Cache mode means no LLM call for Phase 1, so token usage is 0 for this run
    // The cached tokenUsage represents the original Phase 1 generation cost, not this run's cost
    phase1Usage = null;

    console.log(`Cache loaded in ${phase1Elapsed}ms`);
    console.log(`Generated at: ${cache.metadata.generatedAt}`);
    console.log(`Sessions: ${cache.metadata.sessions.length}`);
    console.log(`Total messages: ${cache.metadata.stats.totalMessages}`);
    console.log(`Utterances: ${phase1Output.developerUtterances.length}`);
    console.log(`Total AI responses: ${phase1Output.sessionMetrics.totalAIResponses}`);
    console.log('');

    sessions = [];
  } else {
    if (!jsonlPath) {
      console.error('Provide a JSONL path or set NOSLOP_TEST_JSONL_PATH for fresh Phase 2 runs.');
      process.exit(1);
    }
    // FRESH MODE: Parse JSONL and run Phase 1
    const fileName = jsonlPath.split('/').pop() ?? 'unknown';
    console.log('Mode: FRESH (running Phase 1)');
    console.log(`File: ${fileName}`);
    console.log(`Path: ${jsonlPath}`);
    console.log(`Selected Worker: ${selectedWorker ?? 'ALL'}`);
    console.log('');

    // Step 1: Parse JSONL file
    console.log('Step 1: Parsing JSONL file...');
    const parser = new SessionParser();
    const session = await parser.parseSessionFile(jsonlPath);

    console.log(`Sessions: 1`);
    console.log(`Total Messages: ${session.messages.length}`);
    console.log('');

    sessions = [session];

    // Step 2: Run Phase 1 DataExtractor
    console.log('Step 2: Running Phase 1 (DataExtractor)...');
    const dataExtractor = new DataExtractorWorker(config);

    const phase1Context = {
      sessions,
      metrics: createMockMetrics(),
      tier: 'pro' as const,
    };

    const phase1StartTime = Date.now();
    const phase1Result = await dataExtractor.execute(phase1Context);
    phase1Elapsed = Date.now() - phase1StartTime;

    if (phase1Result.error) {
      console.error('❌ Phase 1 Failed:', phase1Result.error);
      process.exit(1);
    }

    phase1Output = phase1Result.data;
    phase1Usage = phase1Result.usage;

    console.log(`Phase 1 completed in ${phase1Elapsed}ms`);
    console.log(`Extracted ${phase1Output.developerUtterances.length} utterances`);
    console.log(`Extracted ${phase1Output.sessionMetrics.totalAIResponses} AI responses`);
    printTokenUsage(phase1Usage, 'Phase 1');
    console.log('');
  }

  // Step 3: Create Phase 2 context
  const phase2Context: Phase2WorkerContext = {
    sessions,
    metrics: createMockMetrics(),
    tier: 'pro' as const,
    phase1Output,
  };

  // Aggregated results for TypeClassifier
  const agentOutputs: AgentOutputs = {};

  // Execution timing and token tracking
  const workerTimes: Record<string, number> = {};
  const workerTokens: Record<string, TokenUsage> = {};

  // Step 4: Run Phase 2 Workers (v3 Unified)
  console.log('Step 3: Running Phase 2 Workers (v3 Unified)...');
  console.log('-'.repeat(80));

  // ThinkingQuality Worker
  if (!selectedWorker || selectedWorker === 'ThinkingQuality') {
    console.log('\n[1/3] ThinkingQuality Worker...');
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

    console.log(`\nCompleted in ${workerTimes['ThinkingQuality']}ms`);
    printThinkingQualityOutput(result.data);
  }

  // LearningBehavior Worker
  if (!selectedWorker || selectedWorker === 'LearningBehavior') {
    console.log('\n[2/3] LearningBehavior Worker...');
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

    console.log(`\nCompleted in ${workerTimes['LearningBehavior']}ms`);
    printLearningBehaviorOutput(result.data);
  }

  // ContextEfficiency Worker
  if (!selectedWorker || selectedWorker === 'ContextEfficiency') {
    console.log('\n[3/3] ContextEfficiency Worker...');
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

    console.log(`\nCompleted in ${workerTimes['ContextEfficiency']}ms`);
    printContextEfficiencyOutput(result.data);
  }

  // Step 5: Run Phase 2.5 TypeClassifier (needs all Phase 2 outputs)
  if (!selectedWorker || selectedWorker === 'TypeClassifier') {
    console.log('\n' + '─'.repeat(80));
    console.log('Step 4: Running Phase 2.5 (TypeClassifier)...');

    // TypeClassifier context extends with agentOutputs
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
    printTypeClassifierOutput(result.data);
  }

  // Step 6: Print Summary
  console.log('\n' + '='.repeat(80));
  console.log('Phase 2 Summary');
  console.log('='.repeat(80));

  console.log('\nExecution Times:');
  let totalTime = phase1Elapsed;
  console.log(`  Phase 1 (DataExtractor): ${phase1Elapsed}ms`);
  for (const [worker, time] of Object.entries(workerTimes)) {
    console.log(`  ${worker}: ${time}ms`);
    totalTime += time;
  }
  console.log(`  TOTAL: ${totalTime}ms`);

  console.log('\nToken Usage:');
  let totalPrompt = phase1Usage?.promptTokens ?? 0;
  let totalCompletion = phase1Usage?.completionTokens ?? 0;
  let totalTokens = phase1Usage?.totalTokens ?? 0;
  let totalCached = phase1Usage?.cachedTokens ?? 0;

  if (phase1Usage) {
    const cachedInfo = phase1Usage.cachedTokens ? `, ${phase1Usage.cachedTokens} cached` : '';
    console.log(`  Phase 1: ${phase1Usage.totalTokens} tokens (${phase1Usage.promptTokens} prompt, ${phase1Usage.completionTokens} completion${cachedInfo})`);
  }

  for (const [worker, usage] of Object.entries(workerTokens)) {
    const cachedInfo = usage.cachedTokens ? `, ${usage.cachedTokens} cached` : '';
    console.log(`  ${worker}: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion${cachedInfo})`);
    totalPrompt += usage.promptTokens;
    totalCompletion += usage.completionTokens;
    totalTokens += usage.totalTokens;
    totalCached += usage.cachedTokens ?? 0;
  }

  const cachedTotalInfo = totalCached > 0 ? `, ${totalCached} cached` : '';
  console.log(`  TOTAL: ${totalTokens} tokens (${totalPrompt} prompt, ${totalCompletion} completion${cachedTotalInfo})`);

  // Cost Estimation
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];
  const cost = calculateActualCost({ promptTokens: totalPrompt, completionTokens: totalCompletion, cachedTokens: totalCached });
  console.log('\nEstimated Cost (Gemini 3 Flash):');
  console.log(`  Input:  $${cost.inputCost.toFixed(6)} (${totalPrompt - totalCached} tokens × $${(pricing.input * 1_000_000).toFixed(2)}/1M)`);
  if (totalCached > 0) {
    console.log(`  Cached: $${cost.cachedCost.toFixed(6)} (${totalCached} tokens × $${(pricing.cached * 1_000_000).toFixed(2)}/1M)`);
  }
  console.log(`  Output: $${cost.outputCost.toFixed(6)} (${totalCompletion} tokens × $${(pricing.output * 1_000_000).toFixed(2)}/1M)`);
  console.log(`  TOTAL:  $${cost.totalCost.toFixed(6)}`);

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
    console.log(`  Type: ${agentOutputs.typeClassifier.matrixEmoji} ${agentOutputs.typeClassifier.matrixName}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Phase 2 Complete');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
