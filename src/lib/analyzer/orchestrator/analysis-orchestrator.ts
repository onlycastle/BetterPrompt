/**
 * Analysis Orchestrator - Main orchestrator for the analysis pipeline
 *
 * Coordinates 4 phases of analysis (5-6 LLM calls total):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 3 insight workers in parallel (3 LLM calls)
 *            ThinkingQuality, LearningBehavior, ContextEfficiency
 *            Each worker outputs domain-specific strengths/growthAreas
 * - Phase 2.5: TypeClassifier only (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, always English)
 * - Phase 4: Translator (0-1 LLM call, conditional — only for non-English users)
 *
 * v3 Architecture (2026-02):
 * - ThinkingQuality: Planning + Critical Thinking + Communication (consolidated)
 * - LearningBehavior: Knowledge Gaps + Repeated Mistakes (redesigned)
 * - ContextEfficiency: Token efficiency patterns (retained)
 *
 * @module analyzer/orchestrator/analysis-orchestrator
 */

import type { ParsedSession, SessionMetrics } from '../../domain/models/analysis';
import type { VerboseEvaluation } from '../../models/verbose-evaluation';
import type { AgentOutputs } from '../../models/agent-outputs';
import { createEmptyAgentOutputs } from '../../models/agent-outputs';
import { ContentWriterStage } from '../stages/content-writer';
import { TranslatorStage } from '../stages/translator';
import { detectPrimaryLanguage, LANGUAGE_DISPLAY_NAMES, type LanguageDetectionResult } from '../stages/content-writer-prompts';
import { assembleEvaluation, mergeTranslatedFields } from '../stages/evaluation-assembler';
import type { TranslatorOutput } from '../../models/translator-output';
import { ContentGateway, type Tier } from '../content-gateway';
import { BaseWorker } from '../workers/base-worker';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';
import { matchKnowledgeResources } from '../stages/knowledge-resource-matcher';
import { EvidenceVerifierStage, type EvidenceVerifierResult } from '../stages/evidence-verifier';
import type {
  WorkerResult,
  WorkerContext,
  OrchestratorConfig,
  Phase1Results,
  AggregatedTokenUsage,
  Phase1Output,
  AnalysisResult,
  DebugPhaseOutput,
  ProgressCallback,
} from './types';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  aggregateWorkerTokenUsage,
  aggregateConfidenceScores,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './types';
import {
  type StageTokenUsage,
  type PipelineTokenUsage,
  formatActualUsage,
  aggregateTokenUsage,
} from '../cost-estimator';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a progress reporter function
 */
function createProgressReporter(
  onProgress: ProgressCallback | undefined,
  progressStart: number,
  step: number,
  getCompletedStages: () => number
): (stage: string, message: string) => void {
  return (stage: string, message: string) => {
    if (!onProgress) return;
    const progress = progressStart + getCompletedStages() * step;
    onProgress(stage, progress, message);
  };
}

// ============================================================================
// Analysis Orchestrator
// ============================================================================

/**
 * AnalysisOrchestrator - Coordinates the entire analysis pipeline
 *
 * Replaces the monolithic verbose-analyzer.ts with a clean separation:
 * - Orchestrator manages flow and dependencies
 * - Workers perform the actual analysis
 *
 * @example
 * ```typescript
 * const orchestrator = new AnalysisOrchestrator({
 *   geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY!,
 *   verbose: true,
 * });
 *
 * // Register workers
 * orchestrator.registerPhase1Worker(createDataExtractorWorker(config));
 * orchestrator.registerPhase2Worker(createStrengthGrowthWorker(config));
 * // ... more workers
 *
 * // Run analysis
 * const result = await orchestrator.analyze(sessions, metrics, 'pro');
 * ```
 */
export class AnalysisOrchestrator {
  private config: Required<Omit<OrchestratorConfig, 'knowledgeRepo' | 'professionalInsightRepo'>> & Pick<OrchestratorConfig, 'knowledgeRepo' | 'professionalInsightRepo'>;
  private phase1Workers: BaseWorker<unknown>[] = [];
  private phase2Workers: BaseWorker<unknown>[] = [];
  private phase2Point5Workers: BaseWorker<unknown>[] = []; // Type Synthesis workers
  private contentWriter: ContentWriterStage;
  private translator: TranslatorStage;
  private evidenceVerifier: EvidenceVerifierStage;
  private contentGateway: ContentGateway;
  private debugOutputs: DebugPhaseOutput[] = [];

  constructor(config: OrchestratorConfig) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
      geminiApiKey: config.geminiApiKey,
    };

    // Initialize content writer (Phase 3)
    this.contentWriter = new ContentWriterStage({
      apiKey: this.config.geminiApiKey,
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      maxRetries: this.config.maxRetries,
      verbose: this.config.verbose,
    });

    // Initialize translator (Phase 4 - conditional)
    this.translator = new TranslatorStage({
      apiKey: this.config.geminiApiKey,
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      maxRetries: this.config.maxRetries,
    });

    // Initialize evidence verifier (Phase 2.8 - evidence quality verification)
    this.evidenceVerifier = new EvidenceVerifierStage({
      apiKey: this.config.geminiApiKey,
      model: this.config.model,
      verbose: this.config.verbose,
      maxRetries: this.config.maxRetries,
    });

    // Initialize content gateway (tier filtering)
    this.contentGateway = new ContentGateway();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Worker Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a Phase 1 worker (Data Extraction)
   */
  registerPhase1Worker(worker: BaseWorker<unknown>): this {
    if (worker.phase !== 1) {
      throw new Error(`Worker ${worker.name} has phase ${worker.phase}, expected 1`);
    }
    this.phase1Workers.push(worker);
    return this;
  }

  /**
   * Register a Phase 2 worker (Insight Generation)
   */
  registerPhase2Worker(worker: BaseWorker<unknown>): this {
    if (worker.phase !== 2) {
      throw new Error(`Worker ${worker.name} has phase ${worker.phase}, expected 2`);
    }
    this.phase2Workers.push(worker);
    return this;
  }

  /**
   * Register a Phase 2.5 worker (Type Synthesis - runs after Phase 2)
   *
   * Phase 2.5 workers receive all Phase 2 agent outputs and can refine
   * classifications based on semantic analysis from other agents.
   */
  registerPhase2Point5Worker(worker: BaseWorker<unknown>): this {
    // Phase 2.5 workers are marked as phase 2 but run separately after Phase 2
    if (worker.phase !== 2) {
      throw new Error(`Worker ${worker.name} has phase ${worker.phase}, expected 2 (for Phase 2.5)`);
    }
    this.phase2Point5Workers.push(worker);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Analysis Method
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run the complete analysis pipeline
   *
   * @param sessions - Parsed session data
   * @param metrics - Computed session metrics
   * @param tier - User tier level
   * @returns AnalysisResult with tier-filtered VerboseEvaluation and raw Phase1Output
   */
  async analyze(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    tier: Tier,
    onProgress?: ProgressCallback
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const stageUsages: StageTokenUsage[] = [];
    this.debugOutputs = [];

    // Progress tracking: 9 LLM stages total (5 Phase2 + 1 Phase2.5 + 1 Phase2.8 + Phase3 + Phase4)
    // Note: StrengthGrowth removed - workers output insights directly
    // Phase 2.8 added - Evidence Verifier validates evidence relevance
    // CommunicationPatterns added to Phase 2 (moved from Phase 3 ContentWriter)
    const TOTAL_LLM_STAGES = 9;
    const PROGRESS_START = 40;
    const PROGRESS_RANGE = 49; // 40% → 89%
    const STEP = Math.floor(PROGRESS_RANGE / TOTAL_LLM_STAGES); // 6 points per stage
    let completedLLMStages = 0;

    const reportProgress = createProgressReporter(onProgress, PROGRESS_START, STEP, () => completedLLMStages);

    this.log('Starting analysis pipeline...');
    this.log(`Sessions: ${sessions.length}, Tier: ${tier}`);

    // Create base context for Phase 1
    const baseContext: WorkerContext = {
      sessions,
      metrics,
      tier,
    };

    // ─────────────────────────────────────────────────────────────────────
    // Phase 1: Data Extraction (deterministic, no LLM)
    // ─────────────────────────────────────────────────────────────────────
    this.log('Phase 1: Data Extraction...');
    const phase1Start = Date.now();
    const phase1Results = await this.runPhase1(baseContext);

    // Validate Phase 1 output before proceeding (No Fallback Policy)
    if (!phase1Results.dataExtractor.data) {
      throw new Error('Phase 1 DataExtractor produced no output. Analysis cannot proceed.');
    }

    this.collectDebugOutput(
      'phase1', 'DataExtractor', phase1Start,
      phase1Results.dataExtractor.data,
      phase1Results.dataExtractor.usage
    );

    // Report Phase 1 completion (deterministic, no LLM — progress stays at 40%)
    reportProgress('phase1', 'Extracting session data...');

    // DataExtractor is deterministic — track token usage only if present
    if (phase1Results.dataExtractor.usage) {
      stageUsages.push({
        stage: 'DataExtractor (Phase 1)',
        ...phase1Results.dataExtractor.usage,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2: Insight Generation (parallel)
    // All workers run for all users. Tier-based filtering happens at ContentGateway.
    // NOTE: All Phase 2 workers operate in ENGLISH. Language translation
    // happens only in Phase 3 (Content Writer) based on user's quotes.
    // ─────────────────────────────────────────────────────────────────────
    let agentOutputs: AgentOutputs = createEmptyAgentOutputs();

    this.log(`Phase 2 workers registered: ${this.phase2Workers.length}`);
    this.log(`Worker names: ${this.phase2Workers.map(w => w.name).join(', ')}`);

    if (this.phase2Workers.length > 0) {
      this.log('Phase 2: Insight Generation...');

      // All Phase 2 workers receive Phase1Output (context isolation)
      const phase2Context: WorkerContext & { phase1Output?: Phase1Output } = {
        ...baseContext,
        phase1Output: phase1Results.dataExtractor.data,
        // outputLanguage intentionally NOT passed - Phase 2 workers always use English
      };

      this.log(`Phase 2 context - tier: ${phase2Context.tier}, sessions: ${phase2Context.sessions.length}, hasPhase1Output: ${!!phase2Context.phase1Output}`);

      const phase2Start = Date.now();
      const phase2WorkerCount = this.phase2Workers.length;
      const phase2Results = await this.runPhase2(phase2Context, (workerName, workerIndex) => {
        completedLLMStages++;
        const isLast = workerIndex === phase2WorkerCount;
        const message = isLast
          ? `Insight generation complete (${workerIndex}/${phase2WorkerCount})`
          : `Analyzing ${workerName}... (${workerIndex}/${phase2WorkerCount})`;
        reportProgress('phase2', message);
      });
      this.log(`Phase 2 results keys: ${Object.keys(phase2Results).join(', ')}`);

      // Collect debug output and token usage in a single pass
      for (const [workerName, result] of Object.entries(phase2Results)) {
        if (result) {
          this.collectDebugOutput(
            `phase2_${workerName}`, workerName, phase2Start,
            result.data, result.usage
          );
          if (result.usage) {
            stageUsages.push({
              stage: `${workerName} (Agent)`,
              ...result.usage,
            });
          }
        }
      }

      agentOutputs = this.mergeAgentOutputs(phase2Results);
      this.log(`Merged agentOutputs keys: ${Object.keys(agentOutputs).join(', ')}`);
    } else {
      this.log('Phase 2: Skipped (no workers registered)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2.5: TypeClassifier only (StrengthGrowth REMOVED)
    //
    // Each Phase 2 worker now outputs domain-specific strengths/growthAreas
    // directly, eliminating the need for a centralized StrengthGrowthSynthesizer.
    // TypeClassifier uses all Phase 2 data including worker-provided insights.
    //
    // NOTE: Phase 2.5 also operates in ENGLISH.
    // ─────────────────────────────────────────────────────────────────────
    this.log(`Phase 2.5 workers registered: ${this.phase2Point5Workers.length}`);
    if (this.phase2Point5Workers.length > 0) {
      this.log('Phase 2.5: TypeClassifier (sequential)...');
      const phase2Point5Start = Date.now();
      const phase2Point5Context: WorkerContext = {
        ...baseContext,
        // outputLanguage intentionally NOT passed - Phase 2.5 always uses English
      };

      const phase2Point5Results = await this.runPhase2Point5(
        phase2Point5Context,
        agentOutputs,
        phase1Results.dataExtractor.data
      );

      // TypeClassifier is REQUIRED for 15-type matrix classification
      // Fail the entire analysis if TypeClassifier fails
      const typeClassifierResult = phase2Point5Results['TypeClassifier'];
      if (!typeClassifierResult?.data) {
        const errorMessage = typeClassifierResult?.error?.message || 'Unknown error';
        throw new Error(`TypeClassifier failed: ${errorMessage}. Analysis cannot proceed without type classification.`);
      }

      // Collect debug output for each Phase 2.5 worker
      for (const [workerName, result] of Object.entries(phase2Point5Results)) {
        if (result) {
          this.collectDebugOutput(
            `phase2.5_${workerName}`, workerName, phase2Point5Start,
            result.data, result.usage
          );

          // Report progress per worker
          completedLLMStages++;
          const progressMessage = 'Classifying developer type...';
          reportProgress(`phase2.5_${workerName}`, progressMessage);
        }
      }

      // Merge all Phase 2.5 results into agentOutputs
      agentOutputs = this.mergePhase2Point5Outputs(agentOutputs, phase2Point5Results);

      // Track Phase 2.5 token usage
      for (const [workerName, result] of Object.entries(phase2Point5Results)) {
        if (result?.usage) {
          stageUsages.push({
            stage: `${workerName} (Classification)`,
            ...result.usage,
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2.8: Evidence Verification (LLM-based relevance check)
    //
    // Verifies that worker-selected evidence quotes actually support
    // their associated insights. Filters out low-relevance evidence.
    // ─────────────────────────────────────────────────────────────────────
    this.log('Phase 2.8: Evidence Verification...');
    const phase2Point8Start = Date.now();

    const verificationResult = await this.evidenceVerifier.verify(
      agentOutputs,
      phase1Results.dataExtractor.data
    );

    this.collectDebugOutput(
      'phase2.8', 'EvidenceVerifier', phase2Point8Start,
      { stats: verificationResult.stats }, verificationResult.usage
    );

    // Apply verified insights back to agentOutputs
    this.applyVerifiedInsights(agentOutputs, verificationResult.verifiedInsights);

    this.log(`Phase 2.8: Evidence verification complete - kept=${verificationResult.stats.kept}/${verificationResult.stats.total} (filtered=${verificationResult.stats.filtered})`);

    // Track Phase 2.8 token usage
    if (verificationResult.usage.totalTokens > 0) {
      stageUsages.push({
        stage: 'Evidence Verifier (Phase 2.8)',
        ...verificationResult.usage,
      });
      completedLLMStages++;
      reportProgress('phase2.8', 'Verifying evidence quality...');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2.75: Knowledge Resource Matching (deterministic, no LLM)
    // Two-level matching: dimension filter → keyword/style ranking
    // ─────────────────────────────────────────────────────────────────────
    let knowledgeResources: DimensionResourceMatch[] = [];
    if (this.config.knowledgeRepo && this.config.professionalInsightRepo) {
      this.log('Phase 2.75: Knowledge Resource Matching...');
      knowledgeResources = await matchKnowledgeResources(agentOutputs, {
        knowledgeRepo: this.config.knowledgeRepo,
        professionalInsightRepo: this.config.professionalInsightRepo,
      });
      this.log(`Phase 2.75: Matched resources for ${knowledgeResources.length} dimensions`);
    } else {
      this.log('Phase 2.75: Skipped (no knowledge repos configured)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 3: Content Generation (Phase1Output + AgentOutputs → narrative)
    // ─────────────────────────────────────────────────────────────────────
    this.log('Phase 3: Content Generation...');
    const phase3Start = Date.now();
    const sessionCount = phase1Results.dataExtractor.data.sessionMetrics.totalSessions;

    // Phase 2 evidence verification (must run BEFORE assembly)
    if (phase1Results.dataExtractor.data) {
      this.contentWriter.verifyPhase2WorkerExamples(agentOutputs, phase1Results.dataExtractor.data);
    }

    // Phase 3: LLM generates narrative only (personalitySummary, promptPatterns, topFocusAreas)
    const contentResult = await this.contentWriter.transformV3(
      sessionCount,
      agentOutputs,
      phase1Results.dataExtractor.data, // Phase1Output for evidence verification
      knowledgeResources
    );

    // Capture Phase 3 output BEFORE translation (pre-translation English)
    this.collectDebugOutput(
      'phase3', 'ContentWriter', phase3Start,
      contentResult.data, contentResult.usage
    );

    // Report Phase 3 completion
    completedLLMStages++;
    reportProgress('phase3', 'Generating personalized narrative...');

    stageUsages.push({
      stage: 'Content Writer (Stage 2)',
      ...contentResult.usage,
    });

    // ─────────────────────────────────────────────────────────────────────
    // Phase 4: Translation (conditional — only for non-English users)
    // Detects language from developer utterances.
    // If non-English, runs a dedicated translation LLM call.
    // ─────────────────────────────────────────────────────────────────────
    const utteranceTexts = phase1Results.dataExtractor.data.developerUtterances.map(u => u.text);
    const languageResult = detectPrimaryLanguage(utteranceTexts);
    this.logLanguageDetection(languageResult);

    // Always log language detection result for production debugging (not gated by verbose)
    console.log(`[PHASE:LANG] detected=${languageResult.primary}, confidence=${languageResult.confidence.toFixed(2)}, korean=${languageResult.charCounts.korean}/${languageResult.charCounts.total}, threshold=0.05, willTranslate=${languageResult.primary !== 'en'}`);

    // Hoist translator data to merge AFTER assembleEvaluation (fixes translation overwrite bug)
    let translatorData: TranslatorOutput | null = null;

    if (languageResult.primary !== 'en') {
      this.log(`Phase 4: Translation to ${languageResult.primary}...`);
      const phase4Start = Date.now();
      const translatorResult = await this.translator.translate(
        contentResult.data,
        languageResult.primary,
        agentOutputs
      );

      this.collectDebugOutput(
        'phase4', 'Translator', phase4Start,
        translatorResult.data, translatorResult.usage
      );

      stageUsages.push({
        stage: 'Translator (Phase 4)',
        ...translatorResult.usage,
      });

      // Report Phase 4 completion
      completedLLMStages++;
      reportProgress('phase4', `Translating to ${LANGUAGE_DISPLAY_NAMES[languageResult.primary] || languageResult.primary}...`);

      // Store translation data — DO NOT merge here, must merge AFTER assembleEvaluation
      translatorData = translatorResult.data;

      // Debug logging: Translator data flow tracking (dev only)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Orchestrator] translatorData.translatedAgentInsights present: ${!!translatorData?.translatedAgentInsights}`);
        if (translatorData?.translatedAgentInsights) {
          const keys = Object.keys(translatorData.translatedAgentInsights);
          console.log(`[Orchestrator] translatedAgentInsights keys: ${keys.join(', ')}`);
        }
      }

      this.log('Phase 4: Translation complete');
    } else {
      // Translation skipped — jump to 89% to match expected end of analysis range
      completedLLMStages++;
      reportProgress('phase4_skipped', 'Analysis complete');
      this.log('Phase 4: Skipped (English detected)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Build Final Evaluation
    // ─────────────────────────────────────────────────────────────────────
    const analyzedSessions = this.extractAnalyzedSessions(sessions);

    // Aggregate token usage for the pipeline
    const pipelineTokenUsage = aggregateTokenUsage(stageUsages, this.config.model);

    // Aggregate confidence scores from all agents
    const confidenceMetadata = aggregateConfidenceScores(
      agentOutputs as Record<string, unknown>,
      sessions,
      DEFAULT_CONFIDENCE_THRESHOLD
    );

    // Calculate date range
    const analysisDateRange = this.calculateDateRange(sessions);

    // Deterministic assembly: Phase 2 structural data + Phase 3 narrative → VerboseEvaluation
    const assembledData = assembleEvaluation(
      agentOutputs,
      contentResult.data,
      phase1Results.dataExtractor.data,
      sessionCount,
      knowledgeResources.length > 0 ? knowledgeResources : undefined
    );

    // Apply translations AFTER assembly so they overlay English defaults
    // (fixes bug where assembleEvaluation rebuilt fields from English agentOutputs)
    if (translatorData) {
      mergeTranslatedFields(assembledData, translatorData);
    }

    const evaluation = {
      sessionId: sessions[sessions.length - 1]?.sessionId ?? 'unknown',
      analyzedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      avgPromptLength: Math.round(metrics.avgPromptLength),
      avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
      analyzedSessions,
      ...assembledData,
      agentOutputs: agentOutputs,
      // Propagate translated agent insights for frontend hybrid fallback pattern
      ...(translatorData?.translatedAgentInsights
        ? { translatedAgentInsights: translatorData.translatedAgentInsights }
        : {}),
      knowledgeResources: knowledgeResources.length > 0 ? knowledgeResources : undefined,
      pipelineTokenUsage,
      analysisMetadata: {
        overallConfidence: confidenceMetadata.overallConfidence,
        agentConfidences: confidenceMetadata.agentConfidences,
        totalMessagesAnalyzed: confidenceMetadata.totalMessagesAnalyzed,
        analysisDateRange,
        dataQuality: confidenceMetadata.dataQuality,
        confidenceThreshold: confidenceMetadata.confidenceThreshold,
        insightsFiltered: confidenceMetadata.insightsFiltered,
      },
    } as VerboseEvaluation;

    // Debug logging: Final evaluation data flow tracking (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Orchestrator] Final evaluation.translatedAgentInsights present: ${!!evaluation.translatedAgentInsights}`);
      if (evaluation.translatedAgentInsights) {
        const keys = Object.keys(evaluation.translatedAgentInsights);
        console.log(`[Orchestrator] Final translatedAgentInsights keys: ${keys.join(', ')}`);
      }
    }

    this.log(`Final evaluation - hasAgentOutputs: ${!!evaluation.agentOutputs}`);
    this.log(`Final agentOutputs keys: ${evaluation.agentOutputs ? Object.keys(evaluation.agentOutputs).join(', ') : 'none'}`);
    this.log(`Final typeClassifier: ${evaluation.agentOutputs?.typeClassifier ? 'present' : 'null'}`);

    // Log pipeline summary
    const totalTime = Date.now() - startTime;
    this.logPipelineSummary(stageUsages, totalTime);

    // Apply tier-based filtering and return with Phase1Output
    const result: AnalysisResult = {
      evaluation: this.contentGateway.filter(evaluation, tier),
      phase1Output: phase1Results.dataExtractor.data,
    };

    if (this.config.debug && this.debugOutputs.length > 0) {
      result.debugOutputs = this.debugOutputs;
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase Execution Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run Phase 1 workers (Data Extraction)
   *
   * DataExtractor is a deterministic worker (no LLM call) that extracts
   * structured Phase1Output from raw sessions for Phase 2 workers.
   */
  private async runPhase1(context: WorkerContext): Promise<Phase1Results> {
    const dataExtractorWorker = this.phase1Workers.find((w) => w.name === 'DataExtractor');

    if (!dataExtractorWorker) {
      throw new Error('DataExtractor worker not registered. Cannot proceed without data extraction.');
    }

    const result = await dataExtractorWorker.execute(context);

    return {
      dataExtractor: result as WorkerResult<Phase1Output>,
    };
  }

  /**
   * Run Phase 2 workers (Insight Generation)
   *
   * Workers run in parallel. Results are keyed by worker name.
   * NO FALLBACK: Worker failures propagate as errors.
   */
  private async runPhase2(
    context: WorkerContext,
    onWorkerComplete?: (workerName: string, completedCount: number) => void
  ): Promise<Record<string, WorkerResult<unknown> | undefined>> {
    const results: Record<string, WorkerResult<unknown> | undefined> = {};
    let completedCount = 0;

    // Run all Phase 2 workers in parallel - errors will propagate
    const workerPromises = this.phase2Workers.map(async (worker) => {
      if (!worker.canRun(context)) {
        this.log(`Worker ${worker.name} skipped (cannot run)`);
        return;
      }

      // NO try-catch: let errors propagate to identify issues
      const result = await worker.execute(context);
      results[worker.name] = result;
      completedCount++;
      this.log(`Worker ${worker.name} completed`);
      onWorkerComplete?.(worker.name, completedCount);
    });

    // Use Promise.all instead of Promise.allSettled to propagate errors
    await Promise.all(workerPromises);

    return results;
  }

  /**
   * Run Phase 2.5 workers sequentially (Synthesis → Classification)
   *
   * Workers run in registration order. After each worker completes,
   * its result is merged into agentOutputs so the next worker sees
   * updated data. This allows StrengthGrowthSynthesizer to run first,
   * and TypeClassifier to use synthesized strengths/growth data.
   *
   * NO FALLBACK: Worker failures propagate as errors.
   */
  private async runPhase2Point5(
    context: WorkerContext,
    agentOutputs: AgentOutputs,
    phase1Output: Phase1Output
  ): Promise<Record<string, WorkerResult<unknown> | undefined>> {
    const results: Record<string, WorkerResult<unknown> | undefined> = {};
    let currentAgentOutputs = { ...agentOutputs };

    // Run Phase 2.5 workers SEQUENTIALLY — order matters!
    for (const worker of this.phase2Point5Workers) {
      // Create extended context with current agent outputs + phase1Output
      const extendedContext = {
        ...context,
        agentOutputs: currentAgentOutputs,
        phase1Output,
      };

      if (!worker.canRun(extendedContext)) {
        this.log(`Worker ${worker.name} skipped (cannot run)`);
        continue;
      }

      // NO try-catch: let errors propagate to identify issues
      const result = await worker.execute(extendedContext);
      results[worker.name] = result;
      this.log(`Worker ${worker.name} completed`);

      // Merge result into agentOutputs so next worker sees updated data
      currentAgentOutputs = this.mergePhase2Point5Outputs(currentAgentOutputs, { [worker.name]: result });
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  private mergeAgentOutputs(results: Record<string, WorkerResult<unknown> | undefined>): AgentOutputs {
    return {
      // v3 workers
      thinkingQuality: results['ThinkingQuality']?.data as AgentOutputs['thinkingQuality'],
      communicationPatterns: results['CommunicationPatterns']?.data as AgentOutputs['communicationPatterns'],
      learningBehavior: results['LearningBehavior']?.data as AgentOutputs['learningBehavior'],
      efficiency: results['ContextEfficiency']?.data as AgentOutputs['efficiency'],
      // Legacy workers (kept for cached data)
      knowledgeGap: results['KnowledgeGap']?.data as AgentOutputs['knowledgeGap'],
      contextEfficiency: results['ContextEfficiency']?.data as AgentOutputs['contextEfficiency'],
    };
  }

  private mergePhase2Point5Outputs(
    agentOutputs: AgentOutputs,
    phase2Point5Results: Record<string, WorkerResult<unknown> | undefined>
  ): AgentOutputs {
    const merged = { ...agentOutputs };

    if (phase2Point5Results['TypeClassifier']?.data) {
      merged.typeClassifier = phase2Point5Results['TypeClassifier'].data as AgentOutputs['typeClassifier'];
    }

    return merged;
  }

  /**
   * Apply verified insights from Phase 2.8 back to agentOutputs
   *
   * Updates the strengths/growthAreas in each worker's output with
   * filtered evidence from the verification stage.
   *
   * @param agentOutputs - Original agent outputs to update (mutated in place)
   * @param verifiedInsights - Insights with filtered evidence from verifier
   */
  private applyVerifiedInsights(
    agentOutputs: AgentOutputs,
    verifiedInsights: import('../../models/worker-insights').AggregatedWorkerInsights
  ): void {
    // v3 workers
    if (agentOutputs.thinkingQuality && verifiedInsights.thinkingQuality) {
      agentOutputs.thinkingQuality.strengths = verifiedInsights.thinkingQuality.strengths;
      agentOutputs.thinkingQuality.growthAreas = verifiedInsights.thinkingQuality.growthAreas;
    }

    if (agentOutputs.communicationPatterns && verifiedInsights.communicationPatterns) {
      agentOutputs.communicationPatterns.strengths = verifiedInsights.communicationPatterns.strengths;
      agentOutputs.communicationPatterns.growthAreas = verifiedInsights.communicationPatterns.growthAreas;
    }

    if (agentOutputs.learningBehavior && verifiedInsights.learningBehavior) {
      agentOutputs.learningBehavior.strengths = verifiedInsights.learningBehavior.strengths;
      agentOutputs.learningBehavior.growthAreas = verifiedInsights.learningBehavior.growthAreas;
    }

    // ContextEfficiency domain (legacy, kept for cached data)
    if (agentOutputs.contextEfficiency && verifiedInsights.contextEfficiency) {
      agentOutputs.contextEfficiency.strengths = verifiedInsights.contextEfficiency.strengths;
      agentOutputs.contextEfficiency.growthAreas = verifiedInsights.contextEfficiency.growthAreas;
    }

    // KnowledgeGap domain (legacy, kept for cached data)
    if (agentOutputs.knowledgeGap && verifiedInsights.knowledgeGap) {
      agentOutputs.knowledgeGap.strengths = verifiedInsights.knowledgeGap.strengths;
      agentOutputs.knowledgeGap.growthAreas = verifiedInsights.knowledgeGap.growthAreas;
    }
  }

  private logLanguageDetection(result: LanguageDetectionResult): void {
    if (!this.config.verbose) {
      return;
    }

    const { charCounts } = result;
    const total = charCounts.total || 1;
    const englishOther = total - charCounts.korean - charCounts.japanese - charCounts.chinese;
    const languageName = LANGUAGE_DISPLAY_NAMES[result.primary] || result.primary;
    const confidencePercent = (result.confidence * 100).toFixed(0);
    const willTranslate = result.primary !== 'en' ? 'Phase 4 Translator will run' : 'Skipped (English)';

    console.log('\n=== Language Detection ===');
    console.log(`Detected Language: ${languageName} (${result.primary})`);
    console.log(`Confidence: ${result.confidence.toFixed(2)} (${confidencePercent}%)`);
    console.log('Threshold: 5%');
    console.log('Character Breakdown:');
    console.log(`  Korean (Hangul):  ${charCounts.korean} chars (${((charCounts.korean / total) * 100).toFixed(1)}%)`);
    console.log(`  Japanese (Kana):  ${charCounts.japanese} chars (${((charCounts.japanese / total) * 100).toFixed(1)}%)`);
    console.log(`  Chinese (CJK):    ${charCounts.chinese} chars (${((charCounts.chinese / total) * 100).toFixed(1)}%)`);
    console.log(`  English/Other:    ${englishOther} chars (${((englishOther / total) * 100).toFixed(1)}%)`);
    console.log(`Total Meaningful:   ${total} chars`);
    console.log(`Translation: ${willTranslate}`);
    console.log('===========================\n');
  }

  private extractAnalyzedSessions(sessions: ParsedSession[]): VerboseEvaluation['analyzedSessions'] {
    return sessions.map((session) => ({
      sessionId: session.sessionId,
      fileName: `${session.sessionId.slice(0, 8)}.jsonl`,
      projectName: session.projectPath.split('/').pop() ?? 'unknown',
      startTime: session.startTime.toISOString(),
      messageCount: session.messages.length,
      durationMinutes: Math.round(session.durationSeconds / 60),
    }));
  }

  private calculateDateRange(sessions: ParsedSession[]): { earliest: string; latest: string } | undefined {
    const sessionDates = sessions
      .map((s) => {
        const ts = s.messages[0]?.timestamp;
        if (!ts) return null;
        return ts instanceof Date ? ts.toISOString() : String(ts);
      })
      .filter((d): d is string => d !== null && d.length > 0)
      .sort();

    if (sessionDates.length < 2) return undefined;

    return {
      earliest: sessionDates[0],
      latest: sessionDates[sessionDates.length - 1],
    };
  }

  private collectDebugOutput(
    phase: string,
    phaseName: string,
    startTime: number,
    data: unknown,
    tokenUsage: import('../clients/gemini-client').TokenUsage | null
  ): void {
    if (!this.config.debug) return;

    this.debugOutputs.push({
      phase,
      phaseName,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      data,
      tokenUsage,
    });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  private logPipelineSummary(stageUsages: StageTokenUsage[], totalTimeMs: number): void {
    if (!this.config.verbose) return;

    const totalTokens = stageUsages.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalPrompt = stageUsages.reduce((sum, s) => sum + s.promptTokens, 0);
    const totalCompletion = stageUsages.reduce((sum, s) => sum + s.completionTokens, 0);

    console.log('\n=== Pipeline Summary ===');
    console.log(`Total time: ${(totalTimeMs / 1000).toFixed(2)}s`);
    console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  Prompt: ${totalPrompt.toLocaleString()}`);
    console.log(`  Completion: ${totalCompletion.toLocaleString()}`);
    console.log('\nBy stage:');
    for (const stage of stageUsages) {
      console.log(`  ${stage.stage}: ${stage.totalTokens.toLocaleString()} tokens`);
    }
    console.log('========================\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AnalysisOrchestrator
 */
export function createAnalysisOrchestrator(config: OrchestratorConfig): AnalysisOrchestrator {
  return new AnalysisOrchestrator(config);
}
