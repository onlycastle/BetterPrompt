/**
 * Verbose Analyzer - Hyper-personalized multi-session analysis
 *
 * Multi-phase pipeline using Gemini 3 Flash (requires GOOGLE_GEMINI_API_KEY):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 4 parallel workers (TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * - Phase 2.5: StrengthGrowthSynthesizer → TypeClassifier (2 sequential LLM calls)
 * - Phase 3: ContentWriter (1 LLM call)
 */

import { type ParsedSession, type SessionMetrics } from '../domain/models/analysis';
import { type VerboseEvaluation } from '../models/verbose-evaluation';
import type { Tier } from './content-gateway';
import { AnalysisOrchestrator, createAnalysisOrchestrator } from './orchestrator';
import type { AnalysisResult, OrchestratorConfig, ProgressCallback } from './orchestrator/types';
import type { IKnowledgeRepository, IProfessionalInsightRepository } from '../application/ports/storage';
import {
  // Phase 1: Pure extraction (produces Phase1Output for Phase 2 workers)
  createDataExtractorWorker,
  // Phase 2: Semantic analysis (receives Phase1Output) — 4 parallel workers
  createTrustVerificationWorker,
  createWorkflowHabitWorker,
  createKnowledgeGapWorker,
  createContextEfficiencyWorker,
  // Phase 2.5: Sequential — Synthesizer then TypeClassifier
  createStrengthGrowthWorker,
  createTypeClassifierWorker,
} from './workers';

// Stage types for pipeline configuration
import type { ContentWriterConfig } from './stages/content-writer';

/**
 * Error types for verbose analysis failures
 */
export class VerboseAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VerboseAnalysisError';
  }
}

/**
 * Pipeline configuration
 *
 * - stage1: Gemini model config for Phase 1-2 workers
 * - stage2: Content Writer - narrative generation
 */
export interface PipelineConfig {
  stage1?: ContentWriterConfig;
  stage2?: ContentWriterConfig;
}

/**
 * Configuration for the verbose analyzer
 */
export interface VerboseAnalyzerConfig {
  /** Gemini API key for pipeline (overrides GOOGLE_GEMINI_API_KEY env) */
  geminiApiKey?: string;
  maxRetries?: number;
  /** Pipeline stage configuration */
  pipeline?: PipelineConfig;
  /** User tier for content filtering */
  tier?: Tier;
  /** Collect intermediate phase outputs for debugging (default: false) */
  debug?: boolean;
  /** Knowledge repository for Phase 2.75 resource matching (optional) */
  knowledgeRepo?: IKnowledgeRepository;
  /** Professional insight repository for Phase 2.75 resource matching (optional) */
  professionalInsightRepo?: IProfessionalInsightRepository;
}

/**
 * Default configuration
 *
 * Uses Gemini 3 Flash for all workers.
 * Requires GOOGLE_GEMINI_API_KEY.
 */
const DEFAULT_CONFIG: Required<Omit<VerboseAnalyzerConfig, 'geminiApiKey' | 'knowledgeRepo' | 'professionalInsightRepo'>> & { geminiApiKey: string } = {
  geminiApiKey: '',
  maxRetries: 1,
  pipeline: {
    stage1: {
      model: 'gemini-3-flash-preview',
      temperature: 1.0, // Gemini 3 strongly recommends 1.0
      maxOutputTokens: 65536,
    },
    stage2: {
      model: 'gemini-3-flash-preview',
      temperature: 1.0, // Gemini 3 strongly recommends 1.0
      maxOutputTokens: 65536,
    },
  },
  tier: 'enterprise', // Generate full content by default
  debug: false,
};

/**
 * VerboseAnalyzer - Hyper-personalized multi-session analysis
 *
 * Uses AnalysisOrchestrator with registered workers for a multi-phase
 * Gemini 3 Flash pipeline (GOOGLE_GEMINI_API_KEY required).
 */
export class VerboseAnalyzer {
  private config: Required<Omit<VerboseAnalyzerConfig, 'geminiApiKey' | 'knowledgeRepo' | 'professionalInsightRepo'>> & { geminiApiKey: string };
  private orchestrator: AnalysisOrchestrator;

  constructor(config: VerboseAnalyzerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      pipeline: { ...DEFAULT_CONFIG.pipeline, ...config.pipeline },
    };

    const geminiApiKey = config.geminiApiKey || process.env.GOOGLE_GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new VerboseAnalysisError(
        'GOOGLE_GEMINI_API_KEY required for analysis pipeline.',
        'NO_API_KEY'
      );
    }

    // Create orchestrator config
    // DEBUG=1 env var enables verbose mode for all pipeline stages
    const orchestratorConfig: OrchestratorConfig = {
      geminiApiKey,
      model: this.config.pipeline.stage1?.model ?? 'gemini-3-flash-preview',
      temperature: this.config.pipeline.stage1?.temperature ?? 1.0,
      maxOutputTokens: this.config.pipeline.stage1?.maxOutputTokens ?? 65536,
      maxRetries: this.config.maxRetries,
      verbose: !!process.env.DEBUG,
      debug: config.debug ?? false,
      knowledgeRepo: config.knowledgeRepo,
      professionalInsightRepo: config.professionalInsightRepo,
    };

    // Create and configure orchestrator
    this.orchestrator = createAnalysisOrchestrator(orchestratorConfig);

    // =========================================================================
    // PHASE 1: Data Extraction (1 worker, deterministic - no LLM)
    // =========================================================================
    this.orchestrator.registerPhase1Worker(createDataExtractorWorker(orchestratorConfig));

    // =========================================================================
    // PHASE 2: Insight Generation (4 workers, parallel LLM calls)
    // =========================================================================
    this.orchestrator.registerPhase2Worker(createTrustVerificationWorker(orchestratorConfig));
    this.orchestrator.registerPhase2Worker(createWorkflowHabitWorker(orchestratorConfig));
    this.orchestrator.registerPhase2Worker(createKnowledgeGapWorker(orchestratorConfig));
    this.orchestrator.registerPhase2Worker(createContextEfficiencyWorker(orchestratorConfig));

    // =========================================================================
    // PHASE 2.5: Synthesizer → TypeClassifier (2 sequential LLM calls)
    // Order matters: Synthesizer runs first, TypeClassifier uses its output.
    // =========================================================================
    this.orchestrator.registerPhase2Point5Worker(createStrengthGrowthWorker(orchestratorConfig));
    this.orchestrator.registerPhase2Point5Worker(createTypeClassifierWorker(orchestratorConfig));
  }

  /**
   * Analyze multiple sessions and return an analysis result
   *
   * Multi-phase pipeline:
   * - Phase 1: DataExtractor (deterministic)
   * - Phase 2: 4 workers in parallel
   * - Phase 2.5: StrengthGrowthSynthesizer → TypeClassifier (sequential)
   * - Phase 3: ContentWriter
   *
   * Returns AnalysisResult containing both the VerboseEvaluation and raw Phase1Output.
   * Phase1Output is preserved for:
   * - DB storage (evidence auditing)
   * - Deterministic evidence verification
   * - Frontend source tracking
   *
   * NO FALLBACK: Errors are thrown immediately to identify root causes.
   */
  async analyzeVerbose(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    options: { tier?: Tier; onProgress?: ProgressCallback } = {}
  ): Promise<AnalysisResult> {
    if (sessions.length === 0) {
      throw new VerboseAnalysisError(
        'At least one session is required for verbose analysis',
        'NO_SESSIONS'
      );
    }

    const tier = options.tier ?? this.config.tier;

    // Delegate to orchestrator - it handles everything
    return await this.orchestrator.analyze(sessions, metrics, tier, options.onProgress);
  }
}

/**
 * Export factory function for convenience
 */
export function createVerboseAnalyzer(config?: VerboseAnalyzerConfig): VerboseAnalyzer {
  return new VerboseAnalyzer(config);
}

// Re-export types and utilities
export { type Tier, ContentGateway, createContentGateway } from './content-gateway';
export { ContentWriterStage, type ContentWriterConfig } from './stages/content-writer';
