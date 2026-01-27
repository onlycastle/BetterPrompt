/**
 * Analysis Orchestrator - Main orchestrator for the analysis pipeline
 *
 * Coordinates 5 phases of analysis (7-8 LLM calls total):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 5 insight workers in parallel (5 LLM calls)
 * - Phase 2.5: TypeClassifier (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, always English)
 * - Phase 4: Translator (1 LLM call, conditional — only for non-English users)
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
import type { TranslatorOutput } from '../../models/translator-output';
import { ContentGateway, type Tier } from '../content-gateway';
import { BaseWorker } from '../workers/base-worker';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';
import { matchKnowledgeResources } from '../stages/knowledge-resource-matcher';
import type {
  WorkerResult,
  WorkerContext,
  OrchestratorConfig,
  Phase1Results,
  AggregatedTokenUsage,
  Phase1Output,
  AnalysisResult,
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
 * const result = await orchestrator.analyze(sessions, metrics, 'premium');
 * ```
 */
export class AnalysisOrchestrator {
  private config: Required<Omit<OrchestratorConfig, 'knowledgeRepo' | 'professionalInsightRepo'>> & Pick<OrchestratorConfig, 'knowledgeRepo' | 'professionalInsightRepo'>;
  private phase1Workers: BaseWorker<unknown>[] = [];
  private phase2Workers: BaseWorker<unknown>[] = [];
  private phase2Point5Workers: BaseWorker<unknown>[] = []; // Type Synthesis workers
  private contentWriter: ContentWriterStage;
  private translator: TranslatorStage;
  private contentGateway: ContentGateway;

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
    tier: Tier
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const stageUsages: StageTokenUsage[] = [];

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
    const phase1Results = await this.runPhase1(baseContext);

    // Validate Phase 1 output before proceeding (No Fallback Policy)
    if (!phase1Results.dataExtractor.data) {
      throw new Error('Phase 1 DataExtractor produced no output. Analysis cannot proceed.');
    }

    // DataExtractor is deterministic — track token usage only if present
    if (phase1Results.dataExtractor.usage) {
      stageUsages.push({
        stage: 'DataExtractor (Phase 1)',
        ...phase1Results.dataExtractor.usage,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2: Insight Generation (parallel)
    // Workers check their own minTier via canRun() - some workers may be free tier
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

      const phase2Results = await this.runPhase2(phase2Context);
      this.log(`Phase 2 results keys: ${Object.keys(phase2Results).join(', ')}`);

      agentOutputs = this.mergeAgentOutputs(phase2Results);
      this.log(`Merged agentOutputs keys: ${Object.keys(agentOutputs).join(', ')}`);

      // Track Phase 2 token usage
      for (const [workerName, result] of Object.entries(phase2Results)) {
        if (result?.usage) {
          stageUsages.push({
            stage: `${workerName} (Agent)`,
            ...result.usage,
          });
        }
      }
    } else {
      this.log('Phase 2: Skipped (no workers registered)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2.5: Type Synthesis (after Phase 2, uses agent outputs)
    // Refines type classification using insights from all Phase 2 agents
    // NOTE: Type Synthesis also operates in ENGLISH.
    // ─────────────────────────────────────────────────────────────────────
    this.log(`Phase 2.5 workers registered: ${this.phase2Point5Workers.length}`);
    if (this.phase2Point5Workers.length > 0) {
      this.log('Phase 2.5: Type Classification...');
      const phase2Point5Context: WorkerContext = {
        ...baseContext,
        // outputLanguage intentionally NOT passed - Phase 2.5 always uses English
      };

      const phase2Point5Results = await this.runPhase2Point5(
        phase2Point5Context,
        agentOutputs
      );

      // TypeClassifier is REQUIRED for 15-type matrix classification
      // Fail the entire analysis if TypeClassifier fails
      const typeClassifierResult = phase2Point5Results['TypeClassifier'];
      if (!typeClassifierResult?.data) {
        const errorMessage = typeClassifierResult?.error?.message || 'Unknown error';
        throw new Error(`TypeClassifier failed: ${errorMessage}. Analysis cannot proceed without type classification.`);
      }

      // Merge TypeClassifier results into agentOutputs
      agentOutputs = this.mergePhase2Point5Outputs(agentOutputs, phase2Point5Results);

      // Track Phase 2.5 token usage
      for (const [workerName, result] of Object.entries(phase2Point5Results)) {
        if (result?.usage) {
          stageUsages.push({
            stage: `${workerName} (Synthesis)`,
            ...result.usage,
          });
        }
      }
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
    const sessionCount = phase1Results.dataExtractor.data.sessionMetrics.totalSessions;
    const contentResult = await this.contentWriter.transformV3(
      sessionCount,
      agentOutputs,
      phase1Results.dataExtractor.data // Phase1Output for evidence verification
    );

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

    if (languageResult.primary !== 'en') {
      this.log(`Phase 4: Translation to ${languageResult.primary}...`);
      const translatorResult = await this.translator.translate(
        contentResult.data,
        languageResult.primary,
        agentOutputs
      );

      stageUsages.push({
        stage: 'Translator (Phase 4)',
        ...translatorResult.usage,
      });

      // Merge translated text fields into the English response
      this.mergeTranslatedFields(contentResult.data, translatorResult.data);
      this.log('Phase 4: Translation complete');
    } else {
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
    const sessionDates = sessions
      .map((s) => {
        const ts = s.messages[0]?.timestamp;
        if (!ts) return null;
        // Handle both Date objects and ISO strings
        return ts instanceof Date ? ts.toISOString() : String(ts);
      })
      .filter((d): d is string => d !== null && d.length > 0)
      .sort();
    const analysisDateRange =
      sessionDates.length >= 2
        ? {
            earliest: sessionDates[0],
            latest: sessionDates[sessionDates.length - 1],
          }
        : undefined;

    const evaluation: VerboseEvaluation = {
      sessionId: sessions[sessions.length - 1]?.sessionId ?? 'unknown',
      analyzedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      avgPromptLength: Math.round(metrics.avgPromptLength),
      avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
      analyzedSessions,
      ...contentResult.data,
      agentOutputs: agentOutputs,
      knowledgeResources: knowledgeResources.length > 0 ? knowledgeResources : undefined,
      pipelineTokenUsage,
      // NEW: Analysis metadata with confidence scores
      analysisMetadata: {
        overallConfidence: confidenceMetadata.overallConfidence,
        agentConfidences: confidenceMetadata.agentConfidences,
        totalMessagesAnalyzed: confidenceMetadata.totalMessagesAnalyzed,
        analysisDateRange,
        dataQuality: confidenceMetadata.dataQuality,
        confidenceThreshold: confidenceMetadata.confidenceThreshold,
        insightsFiltered: confidenceMetadata.insightsFiltered,
      },
    };

    this.log(`Final evaluation - hasAgentOutputs: ${!!evaluation.agentOutputs}`);
    this.log(`Final agentOutputs keys: ${evaluation.agentOutputs ? Object.keys(evaluation.agentOutputs).join(', ') : 'none'}`);
    this.log(`Final typeClassifier: ${evaluation.agentOutputs?.typeClassifier ? 'present' : 'null'}`);

    // Log pipeline summary
    const totalTime = Date.now() - startTime;
    this.logPipelineSummary(stageUsages, totalTime);

    // Apply tier-based filtering and return with Phase1Output
    return {
      evaluation: this.contentGateway.filter(evaluation, tier),
      phase1Output: phase1Results.dataExtractor.data,
    };
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
    context: WorkerContext
  ): Promise<Record<string, WorkerResult<unknown> | undefined>> {
    const results: Record<string, WorkerResult<unknown> | undefined> = {};

    // Run all Phase 2 workers in parallel - errors will propagate
    const workerPromises = this.phase2Workers.map(async (worker) => {
      if (!worker.canRun(context)) {
        this.log(`Worker ${worker.name} skipped (cannot run)`);
        return;
      }

      // NO try-catch: let errors propagate to identify issues
      const result = await worker.execute(context);
      results[worker.name] = result;
      this.log(`Worker ${worker.name} completed`);
    });

    // Use Promise.all instead of Promise.allSettled to propagate errors
    await Promise.all(workerPromises);

    return results;
  }

  /**
   * Run Phase 2.5 workers (Type Synthesis)
   *
   * These workers run AFTER Phase 2 completes and receive all agent outputs.
   * They refine type classification using semantic analysis from other agents.
   * NO FALLBACK: Worker failures propagate as errors.
   */
  private async runPhase2Point5(
    context: WorkerContext,
    agentOutputs: AgentOutputs
  ): Promise<Record<string, WorkerResult<unknown> | undefined>> {
    const results: Record<string, WorkerResult<unknown> | undefined> = {};

    // Create extended context with agent outputs
    const extendedContext = {
      ...context,
      agentOutputs,
    };

    // Run Phase 2.5 workers - errors will propagate
    const workerPromises = this.phase2Point5Workers.map(async (worker) => {
      if (!worker.canRun(extendedContext)) {
        this.log(`Worker ${worker.name} skipped (cannot run)`);
        return;
      }

      // NO try-catch: let errors propagate to identify issues
      const result = await worker.execute(extendedContext);
      results[worker.name] = result;
      this.log(`Worker ${worker.name} completed`);
    });

    // Use Promise.all instead of Promise.allSettled to propagate errors
    await Promise.all(workerPromises);

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Merge Phase 2 worker results into AgentOutputs
   *
   * Maps Phase 2 worker results by name to the AgentOutputs fields.
   * Only v2 workers are registered: StrengthGrowth, TrustVerification,
   * WorkflowHabit, KnowledgeGap, ContextEfficiency.
   * TypeClassifier runs at Phase 2.5 (merged separately).
   */
  private mergeAgentOutputs(results: Record<string, WorkerResult<unknown> | undefined>): AgentOutputs {
    return {
      strengthGrowth: results['StrengthGrowth']?.data as AgentOutputs['strengthGrowth'],
      trustVerification: results['TrustVerification']?.data as AgentOutputs['trustVerification'],
      workflowHabit: results['WorkflowHabit']?.data as AgentOutputs['workflowHabit'],
      knowledgeGap: results['KnowledgeGap']?.data as AgentOutputs['knowledgeGap'],
      contextEfficiency: results['ContextEfficiency']?.data as AgentOutputs['contextEfficiency'],
    };
  }

  /**
   * Merge Phase 2.5 results into AgentOutputs
   *
   * TypeClassifier at Phase 2.5 performs both classification and synthesis.
   */
  private mergePhase2Point5Outputs(
    agentOutputs: AgentOutputs,
    phase2Point5Results: Record<string, WorkerResult<unknown> | undefined>
  ): AgentOutputs {
    return {
      ...agentOutputs,
      // TypeClassifier now runs at Phase 2.5 (replaces TypeSynthesis)
      typeClassifier: phase2Point5Results['TypeClassifier']?.data as AgentOutputs['typeClassifier'],
    };
  }

  /**
   * Merge translated text fields into the English ContentWriter response
   *
   * The English response is the "source of truth" for all structural/numeric fields.
   * Only text fields from TranslatorOutput are overlaid.
   */
  private mergeTranslatedFields(englishResponse: any, translated: TranslatorOutput): void {
    // Personality summary
    if (translated.personalitySummary) {
      englishResponse.personalitySummary = translated.personalitySummary;
    }

    // Dimension insights — overlay text fields, preserve structure
    if (Array.isArray(translated.dimensionInsights) && Array.isArray(englishResponse.dimensionInsights)) {
      for (const translatedDim of translated.dimensionInsights) {
        const englishDim = englishResponse.dimensionInsights.find(
          (d: any) => d.dimension === translatedDim.dimension
        );
        if (englishDim) {
          englishDim.dimensionDisplayName = translatedDim.dimensionDisplayName;
          // Re-parse translated flattened strings into nested format
          if (translatedDim.strengthsData) {
            const translatedStrengths = translatedDim.strengthsData.split(';').filter(Boolean);
            if (Array.isArray(englishDim.strengths)) {
              for (let i = 0; i < Math.min(translatedStrengths.length, englishDim.strengths.length); i++) {
                const parts = translatedStrengths[i].split('|');
                if (parts.length >= 3) {
                  // clusterId preserved, title and description translated
                  englishDim.strengths[i].title = parts[1];
                  englishDim.strengths[i].description = parts.slice(2).join('|');
                }
              }
            }
          }
          if (translatedDim.growthAreasData) {
            const translatedGrowth = translatedDim.growthAreasData.split(';').filter(Boolean);
            if (Array.isArray(englishDim.growthAreas)) {
              for (let i = 0; i < Math.min(translatedGrowth.length, englishDim.growthAreas.length); i++) {
                const parts = translatedGrowth[i].split('|');
                if (parts.length >= 4) {
                  // clusterId preserved, title/description/recommendation translated
                  englishDim.growthAreas[i].title = parts[1];
                  englishDim.growthAreas[i].description = parts[2];
                  englishDim.growthAreas[i].recommendation = parts[3];
                  // frequency, severity, priorityScore remain from English
                }
              }
            }
          }
        }
      }
    }

    // Prompt patterns — overlay text fields, preserve structure
    if (Array.isArray(translated.promptPatterns) && Array.isArray(englishResponse.promptPatterns)) {
      for (let i = 0; i < Math.min(translated.promptPatterns.length, englishResponse.promptPatterns.length); i++) {
        const tp = translated.promptPatterns[i];
        const ep = englishResponse.promptPatterns[i];
        if (tp.patternName) ep.patternName = tp.patternName;
        if (tp.description) ep.description = tp.description;
        if (tp.tip) ep.tip = tp.tip;
        // Translate analysis in examples, keep quotes original
        if (tp.examplesData && Array.isArray(ep.examples)) {
          const translatedExamples = tp.examplesData.split(';').filter(Boolean);
          for (let j = 0; j < Math.min(translatedExamples.length, ep.examples.length); j++) {
            const parts = translatedExamples[j].split('|');
            if (parts.length >= 2) {
              // Quote stays original, analysis translated
              ep.examples[j].analysis = parts[1];
            }
          }
        }
      }
    }

    // Top focus areas
    if (translated.topFocusAreas && englishResponse.topFocusAreas) {
      if (translated.topFocusAreas.summary) {
        englishResponse.topFocusAreas.summary = translated.topFocusAreas.summary;
      }
      if (Array.isArray(translated.topFocusAreas.areas) && Array.isArray(englishResponse.topFocusAreas.areas)) {
        for (const ta of translated.topFocusAreas.areas) {
          const ea = englishResponse.topFocusAreas.areas.find((a: any) => a.rank === ta.rank);
          if (ea) {
            if (ta.title) ea.title = ta.title;
            if (ta.narrative) ea.narrative = ta.narrative;
            if (ta.expectedImpact) ea.expectedImpact = ta.expectedImpact;
            if (ta.actionsData && ea.actions) {
              const [start, stop, cont] = ta.actionsData.split('|');
              ea.actions = { start: start || '', stop: stop || '', continue: cont || '' };
            }
          }
        }
      }
    }

    // Anti-patterns analysis text fields
    if (translated.antiPatternsAnalysis && englishResponse.antiPatternsAnalysis) {
      if (translated.antiPatternsAnalysis.summary) {
        englishResponse.antiPatternsAnalysis.summary = translated.antiPatternsAnalysis.summary;
      }
      if (Array.isArray(translated.antiPatternsAnalysis.detected) && Array.isArray(englishResponse.antiPatternsAnalysis.detected)) {
        for (const td of translated.antiPatternsAnalysis.detected) {
          const ed = englishResponse.antiPatternsAnalysis.detected.find(
            (d: any) => d.antiPatternType === td.antiPatternType
          );
          if (ed) {
            if (td.displayName) ed.displayName = td.displayName;
            if (td.description) ed.description = td.description;
            if (td.growthOpportunity) ed.growthOpportunity = td.growthOpportunity;
            if (td.actionableTip) ed.actionableTip = td.actionableTip;
          }
        }
      }
    }

    // Critical thinking analysis text fields
    if (translated.criticalThinkingAnalysis && englishResponse.criticalThinkingAnalysis) {
      if (translated.criticalThinkingAnalysis.summary) {
        englishResponse.criticalThinkingAnalysis.summary = translated.criticalThinkingAnalysis.summary;
      }
      this.mergeHighlightTranslations(
        translated.criticalThinkingAnalysis.strengths,
        englishResponse.criticalThinkingAnalysis.strengths
      );
      this.mergeHighlightTranslations(
        translated.criticalThinkingAnalysis.opportunities,
        englishResponse.criticalThinkingAnalysis.opportunities
      );
    }

    // Planning analysis text fields
    if (translated.planningAnalysis && englishResponse.planningAnalysis) {
      if (translated.planningAnalysis.summary) {
        englishResponse.planningAnalysis.summary = translated.planningAnalysis.summary;
      }
      this.mergeHighlightTranslations(
        translated.planningAnalysis.strengths,
        englishResponse.planningAnalysis.strengths
      );
      this.mergeHighlightTranslations(
        translated.planningAnalysis.opportunities,
        englishResponse.planningAnalysis.opportunities
      );
    }

    // Translated agent insights — set directly on the response
    if (translated.translatedAgentInsights) {
      englishResponse.translatedAgentInsights = translated.translatedAgentInsights;
    }

    // Actionable practices text fields
    if (translated.actionablePractices && englishResponse.actionablePractices) {
      if (translated.actionablePractices.summary) {
        englishResponse.actionablePractices.summary = translated.actionablePractices.summary;
      }
      if (Array.isArray(translated.actionablePractices.practiced) && Array.isArray(englishResponse.actionablePractices.practiced)) {
        for (const tp of translated.actionablePractices.practiced) {
          const ep = englishResponse.actionablePractices.practiced.find(
            (p: any) => p.patternId === tp.patternId
          );
          if (ep && tp.feedback) ep.feedback = tp.feedback;
        }
      }
      if (Array.isArray(translated.actionablePractices.opportunities) && Array.isArray(englishResponse.actionablePractices.opportunities)) {
        for (const to of translated.actionablePractices.opportunities) {
          const eo = englishResponse.actionablePractices.opportunities.find(
            (o: any) => o.patternId === to.patternId
          );
          if (eo && to.tip) eo.tip = to.tip;
        }
      }
    }
  }

  /**
   * Helper to merge translated highlight arrays (critical thinking, planning)
   */
  private mergeHighlightTranslations(
    translated: Array<{ displayName: string; description: string; tip?: string }> | undefined,
    english: any[] | undefined
  ): void {
    if (!translated || !english) return;
    for (let i = 0; i < Math.min(translated.length, english.length); i++) {
      if (translated[i].displayName) english[i].displayName = translated[i].displayName;
      if (translated[i].description) english[i].description = translated[i].description;
      if (translated[i].tip) english[i].tip = translated[i].tip;
    }
  }

  /**
   * Log language detection results for debugging (when verbose/DEBUG=1)
   */
  private logLanguageDetection(result: LanguageDetectionResult): void {
    if (!this.config.verbose) return;

    const { charCounts } = result;
    const total = charCounts.total || 1; // avoid division by zero
    const englishOther = total - charCounts.korean - charCounts.japanese - charCounts.chinese;

    console.log('\n=== Language Detection ===');
    console.log(`Detected Language: ${LANGUAGE_DISPLAY_NAMES[result.primary] || result.primary} (${result.primary})`);
    console.log(`Confidence: ${result.confidence.toFixed(2)} (${(result.confidence * 100).toFixed(0)}%)`);
    console.log('Threshold: 5%');
    console.log('Character Breakdown:');
    console.log(`  Korean (Hangul):  ${charCounts.korean} chars (${((charCounts.korean / total) * 100).toFixed(1)}%)`);
    console.log(`  Japanese (Kana):  ${charCounts.japanese} chars (${((charCounts.japanese / total) * 100).toFixed(1)}%)`);
    console.log(`  Chinese (CJK):    ${charCounts.chinese} chars (${((charCounts.chinese / total) * 100).toFixed(1)}%)`);
    console.log(`  English/Other:    ${englishOther} chars (${((englishOther / total) * 100).toFixed(1)}%)`);
    console.log(`Total Meaningful:   ${total} chars`);
    console.log(`Translation: ${result.primary !== 'en' ? 'Phase 4 Translator will run' : 'Skipped (English)'}`);
    console.log('===========================\n');
  }

  /**
   * Extract session info for display
   */
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

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  /**
   * Log pipeline summary
   */
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
