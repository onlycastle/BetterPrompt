/**
 * Verbose Analyzer - Hyper-personalized multi-session analysis
 *
 * Supports two analysis modes:
 * 1. Single-stage (legacy): One LLM call with Anthropic Claude (requires ANTHROPIC_API_KEY)
 * 2. Three-stage pipeline: Module A + Module B + Stage 2 with Gemini 3 Flash (requires GOOGLE_GEMINI_API_KEY)
 *
 * Three-stage pipeline:
 * - Module A (Data Analyst): Extract structured behavioral data
 * - Module B (Personality Analyst): Extract personality profile
 * - Stage 2 (Content Writer): Transform into engaging narrative using both outputs
 *
 * Single-stage legacy mode uses Anthropic's Structured Outputs.
 */

import Anthropic from '@anthropic-ai/sdk';
import { type ParsedSession, type SessionMetrics } from '../domain/models/analysis';
import {
  type VerboseEvaluation,
  type VerboseLLMResponse,
  VerboseLLMResponseSchema,
  type AnalyzedSessionInfo,
} from '../models/verbose-evaluation';
import {
  VERBOSE_SYSTEM_PROMPT,
  buildVerboseUserPrompt,
  getVerboseToolDefinition,
} from './verbose-prompts';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DataAnalystStage, type DataAnalystConfig } from './stages/data-analyst';
import { PersonalityAnalystStage, type PersonalityAnalystConfig } from './stages/personality-analyst';
import { ProductivityAnalystStage, type ProductivityAnalystConfig } from './stages/productivity-analyst';
import { ContentWriterStage, type ContentWriterConfig } from './stages/content-writer';
import { ContentGateway, type Tier } from './content-gateway';
import { createDefaultPersonalityProfile } from '../models/personality';
import { createDefaultProductivityAnalysisData } from '../models/productivity-data';
import {
  type StageTokenUsage,
  type PipelineTokenUsage,
  aggregateTokenUsage,
  formatActualUsage,
} from './cost-estimator';

// ============================================================================
// STRING SANITIZATION - Truncate long strings from LLM responses
// ============================================================================

/**
 * Field-specific max length constraints from the schema
 */
const STRING_LIMITS = {
  personalitySummary: 800,
  patternName: 50,
  description: 300,
  tip: 200,
  quote: 300, // Default for PromptPattern examples
  analysis: 200,
  context: 200,
  title: 50,
  recommendation: 200,
  dimensionDisplayName: 50,
} as const;

/** Quote limit for evidence (larger than pattern examples) */
const EVIDENCE_QUOTE_LIMIT = 800;

/**
 * Truncate string with ellipsis if exceeds max length
 */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

/**
 * Sanitize PromptPattern examples
 */
function sanitizePatternExamples(
  examples: Array<{ quote: string; analysis: string }>
): Array<{ quote: string; analysis: string }> {
  return examples.map((ex) => ({
    quote: truncate(ex.quote, STRING_LIMITS.quote),
    analysis: truncate(ex.analysis, STRING_LIMITS.analysis),
  }));
}

/**
 * Sanitize evidence array (now string array, not object array)
 * NOTE: Evidence was flattened from {quote, sessionDate, context} objects to simple quote strings
 * to reduce nesting depth for Gemini API compatibility.
 */
function sanitizeEvidence(evidence: string[]): string[] {
  return evidence.map((quote) => truncate(quote, EVIDENCE_QUOTE_LIMIT));
}

/**
 * Sanitize DimensionStrength
 * Note: evidence may be undefined when using LLMDimensionStrengthSchema (no evidence field)
 */
function sanitizeStrength(strength: {
  title: string;
  description: string;
  evidence?: string[];
}): { title: string; description: string; evidence: string[] } {
  return {
    title: truncate(strength.title, STRING_LIMITS.title),
    description: truncate(strength.description, STRING_LIMITS.description),
    evidence: strength.evidence ? sanitizeEvidence(strength.evidence) : [],
  };
}

/**
 * Sanitize DimensionGrowthArea
 * Note: evidence may be undefined when using LLMDimensionGrowthAreaSchema (no evidence field)
 */
function sanitizeGrowthArea(area: {
  title: string;
  description: string;
  evidence?: string[];
  recommendation: string;
}): { title: string; description: string; evidence: string[]; recommendation: string } {
  return {
    title: truncate(area.title, STRING_LIMITS.title),
    description: truncate(area.description, STRING_LIMITS.description),
    evidence: area.evidence ? sanitizeEvidence(area.evidence) : [],
    recommendation: truncate(area.recommendation, STRING_LIMITS.recommendation),
  };
}

/**
 * Sanitize entire LLM response to ensure all strings are within schema limits.
 * This prevents schema validation failures from overly verbose LLM outputs.
 */
function sanitizeLLMResponse(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;

  const data = input as Record<string, unknown>;
  const result: Record<string, unknown> = { ...data };

  // Sanitize personalitySummary
  if (typeof result.personalitySummary === 'string') {
    result.personalitySummary = truncate(result.personalitySummary, STRING_LIMITS.personalitySummary);
  }

  // Sanitize promptPatterns
  if (Array.isArray(result.promptPatterns)) {
    result.promptPatterns = result.promptPatterns.map((pattern: Record<string, unknown>) => ({
      ...pattern,
      patternName:
        typeof pattern.patternName === 'string'
          ? truncate(pattern.patternName, STRING_LIMITS.patternName)
          : pattern.patternName,
      description:
        typeof pattern.description === 'string'
          ? truncate(pattern.description, STRING_LIMITS.description)
          : pattern.description,
      tip: typeof pattern.tip === 'string' ? truncate(pattern.tip, STRING_LIMITS.tip) : pattern.tip,
      examples: Array.isArray(pattern.examples)
        ? sanitizePatternExamples(pattern.examples as Array<{ quote: string; analysis: string }>)
        : pattern.examples,
    }));
  }

  // Sanitize dimensionInsights
  if (Array.isArray(result.dimensionInsights)) {
    result.dimensionInsights = result.dimensionInsights.map((insight: Record<string, unknown>) => ({
      ...insight,
      dimensionDisplayName:
        typeof insight.dimensionDisplayName === 'string'
          ? truncate(insight.dimensionDisplayName, STRING_LIMITS.dimensionDisplayName)
          : insight.dimensionDisplayName,
      strengths: Array.isArray(insight.strengths) ? insight.strengths.map(sanitizeStrength) : insight.strengths,
      growthAreas: Array.isArray(insight.growthAreas)
        ? insight.growthAreas.map(sanitizeGrowthArea)
        : insight.growthAreas,
    }));
  }

  return result;
}

/**
 * Extract session info from ParsedSession array for display purposes
 */
function extractAnalyzedSessions(sessions: ParsedSession[]): AnalyzedSessionInfo[] {
  return sessions.map((session) => ({
    fileName: `${session.sessionId}.jsonl`,
    sessionId: session.sessionId,
    projectName: session.projectPath.split('/').pop() || 'Unknown',
    startTime: session.startTime.toISOString(),
    messageCount: session.messages.length,
    durationMinutes: Math.round(session.durationSeconds / 60),
  }));
}

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
 * Pipeline mode for analysis
 */
export type PipelineMode = 'single' | 'two-stage';

/**
 * Three-stage pipeline configuration
 *
 * - stage1 (Module A): Data Analyst - behavioral data extraction
 * - moduleB: Personality Analyst - personality profile extraction
 * - moduleC: Productivity Analyst - productivity/efficiency metrics extraction
 * - stage2: Content Writer - narrative generation
 */
export interface PipelineConfig {
  mode: PipelineMode;
  stage1?: DataAnalystConfig;
  moduleB?: PersonalityAnalystConfig;
  moduleC?: ProductivityAnalystConfig;
  stage2?: ContentWriterConfig;
}

/**
 * Configuration for the verbose analyzer
 */
export interface VerboseAnalyzerConfig {
  apiKey?: string;
  /** Gemini API key for two-stage pipeline (overrides GOOGLE_GEMINI_API_KEY env) */
  geminiApiKey?: string;
  model?: string;
  maxRetries?: number;
  maxTokens?: number;
  /** Pipeline mode: 'single' (legacy) or 'two-stage' (default) */
  pipeline?: PipelineConfig;
  /** User tier for content filtering */
  tier?: Tier;
  /** Fallback to legacy mode if two-stage fails */
  fallbackToLegacy?: boolean;
}

/**
 * Default configuration
 *
 * Two-stage pipeline (default):
 * - Uses Gemini 3 Flash for both stages
 * - Requires GOOGLE_GEMINI_API_KEY
 *
 * Single-stage legacy mode:
 * - Uses Anthropic Claude Sonnet
 * - Requires ANTHROPIC_API_KEY
 */
const DEFAULT_CONFIG: Required<Omit<VerboseAnalyzerConfig, 'apiKey' | 'geminiApiKey'>> & { apiKey: string; geminiApiKey: string } = {
  apiKey: '',
  geminiApiKey: '',
  model: 'claude-sonnet-4-20250514', // For legacy single-stage mode
  maxRetries: 1,
  maxTokens: 65536,
  pipeline: {
    mode: 'two-stage',
    stage1: {
      model: 'gemini-3-flash-preview',
      temperature: 1.0, // Gemini 3 strongly recommends 1.0
      maxOutputTokens: 65536,
    },
    moduleB: {
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
  fallbackToLegacy: true,
};

/**
 * VerboseAnalyzer - Hyper-personalized multi-session analysis
 *
 * Supports two modes:
 * 1. Single-stage (legacy): One LLM call with Claude Sonnet (ANTHROPIC_API_KEY)
 * 2. Two-stage pipeline: Gemini 3 Flash for both stages (GOOGLE_GEMINI_API_KEY)
 *
 * Two-stage pipeline uses Gemini's structured JSON output.
 * Single-stage uses Anthropic's Structured Outputs feature.
 */
export class VerboseAnalyzer {
  private client: Anthropic;
  private config: Required<Omit<VerboseAnalyzerConfig, 'apiKey' | 'geminiApiKey'>> & { apiKey: string; geminiApiKey: string };
  private dataAnalyst: DataAnalystStage | null = null;
  private personalityAnalyst: PersonalityAnalystStage | null = null;
  private productivityAnalyst: ProductivityAnalystStage | null = null;
  private contentWriter: ContentWriterStage | null = null;
  private contentGateway: ContentGateway;

  constructor(config: VerboseAnalyzerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      pipeline: { ...DEFAULT_CONFIG.pipeline, ...config.pipeline },
    };

    this.contentGateway = new ContentGateway();

    // Initialize stages for three-stage pipeline (Module A + Module B + Stage 2)
    if (this.config.pipeline.mode === 'two-stage') {
      // Use provided geminiApiKey or fall back to environment variable
      const geminiApiKey = config.geminiApiKey || process.env.GOOGLE_GEMINI_API_KEY;

      // Module A: Data Analyst - behavioral data extraction
      this.dataAnalyst = new DataAnalystStage({
        ...this.config.pipeline.stage1,
        apiKey: geminiApiKey,
      });

      // Module B: Personality Analyst - personality profile extraction
      this.personalityAnalyst = new PersonalityAnalystStage({
        ...this.config.pipeline.moduleB,
        apiKey: geminiApiKey,
      });

      // Module C: Productivity Analyst - productivity/efficiency metrics extraction
      this.productivityAnalyst = new ProductivityAnalystStage({
        ...this.config.pipeline.moduleC,
        apiKey: geminiApiKey,
      });

      // Stage 2: Content Writer - narrative generation
      this.contentWriter = new ContentWriterStage({
        ...this.config.pipeline.stage2,
        apiKey: geminiApiKey,
      });
    }

    // Get Anthropic API key for legacy single-stage mode (or fallback)
    const anthropicApiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;

    // Only require Anthropic key if single-stage mode or fallback is enabled
    if (this.config.pipeline.mode === 'single' || this.config.fallbackToLegacy) {
      if (!anthropicApiKey) {
        const message = this.config.pipeline.mode === 'single'
          ? 'ANTHROPIC_API_KEY required for single-stage mode.'
          : 'ANTHROPIC_API_KEY required for fallback. Set fallbackToLegacy: false to disable.';
        throw new VerboseAnalysisError(message, 'NO_API_KEY');
      }
    }

    // Initialize Anthropic client for legacy mode (may be unused in two-stage)
    this.client = new Anthropic({ apiKey: anthropicApiKey || '' });
  }

  /**
   * Analyze multiple sessions and return a verbose evaluation
   *
   * Uses two-stage pipeline by default:
   * 1. Stage 1 (Gemini 3 Flash): Extract structured behavioral data
   * 2. Stage 2 (Gemini 3 Flash): Transform into engaging narrative
   *
   * Falls back to single-stage (legacy with Claude) if two-stage fails and fallbackToLegacy is true.
   */
  async analyzeVerbose(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    options: { tier?: Tier } = {}
  ): Promise<VerboseEvaluation> {
    if (sessions.length === 0) {
      throw new VerboseAnalysisError(
        'At least one session is required for verbose analysis',
        'NO_SESSIONS'
      );
    }

    const tier = options.tier ?? this.config.tier;

    // Try two-stage pipeline if configured
    if (this.config.pipeline.mode === 'two-stage' && this.dataAnalyst && this.contentWriter) {
      try {
        return await this.analyzeTwoStage(sessions, metrics, tier);
      } catch (error) {
        if (this.config.fallbackToLegacy) {
          console.warn('Two-stage pipeline failed, falling back to legacy mode:', error);
          return await this.analyzeSingleStage(sessions, metrics, tier);
        }
        throw error;
      }
    }

    // Use single-stage (legacy) mode
    return await this.analyzeSingleStage(sessions, metrics, tier);
  }

  /**
   * Three-stage analysis pipeline using Gemini 3 Flash
   *
   * Module A (Stage 1): Data Analyst - Extract structured behavioral data
   * Module B: Personality Analyst - Extract personality profile (parallel with C)
   * Module C: Productivity Analyst - Extract productivity metrics (parallel with B)
   * Stage 2: Content Writer - Transform into engaging narrative using all outputs
   */
  private async analyzeTwoStage(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    tier: Tier
  ): Promise<VerboseEvaluation> {
    if (!this.dataAnalyst || !this.personalityAnalyst || !this.productivityAnalyst || !this.contentWriter) {
      throw new VerboseAnalysisError(
        'Pipeline not initialized (requires Module A, B, C, and Stage 2)',
        'PIPELINE_NOT_INITIALIZED'
      );
    }

    // Track token usage across all stages
    const stageUsages: StageTokenUsage[] = [];

    // Module A (Stage 1): Extract structured behavioral data
    const dataAnalystResult = await this.dataAnalyst.analyze(sessions, metrics);
    const analysisData = dataAnalystResult.data;
    stageUsages.push({
      stage: 'Data Analyst (Module A)',
      promptTokens: dataAnalystResult.usage.promptTokens,
      completionTokens: dataAnalystResult.usage.completionTokens,
      totalTokens: dataAnalystResult.usage.totalTokens,
    });

    // Module B + Module C: Run in parallel (both depend on Module A, not each other)
    const [personalityResult, productivityResult] = await Promise.all([
      // Module B: Extract personality profile
      this.personalityAnalyst.analyze(sessions, analysisData).catch((error) => {
        console.warn('Module B (Personality Analyst) failed, using default profile:', error);
        return { data: createDefaultPersonalityProfile(), usage: null };
      }),
      // Module C: Extract productivity metrics
      this.productivityAnalyst.analyze(sessions, analysisData).catch((error) => {
        console.warn('Module C (Productivity Analyst) failed, using default data:', error);
        return { data: createDefaultProductivityAnalysisData(), usage: null };
      }),
    ]);

    // Track personality analyst usage if available
    if (personalityResult.usage) {
      stageUsages.push({
        stage: 'Personality Analyst (Module B)',
        promptTokens: personalityResult.usage.promptTokens,
        completionTokens: personalityResult.usage.completionTokens,
        totalTokens: personalityResult.usage.totalTokens,
      });
    }

    // Track productivity analyst usage if available
    if (productivityResult.usage) {
      stageUsages.push({
        stage: 'Productivity Analyst (Module C)',
        promptTokens: productivityResult.usage.promptTokens,
        completionTokens: productivityResult.usage.completionTokens,
        totalTokens: productivityResult.usage.totalTokens,
      });
    }

    // Stage 2: Transform into narrative using Module A + Module B + Module C outputs
    const contentWriterResult = await this.contentWriter.transform(
      analysisData,
      personalityResult.data,
      sessions,
      productivityResult.data
    );
    stageUsages.push({
      stage: 'Content Writer (Stage 2)',
      promptTokens: contentWriterResult.usage.promptTokens,
      completionTokens: contentWriterResult.usage.completionTokens,
      totalTokens: contentWriterResult.usage.totalTokens,
    });

    // Aggregate and log token usage
    const pipelineUsage = aggregateTokenUsage(
      stageUsages,
      this.config.pipeline.stage1?.model || 'gemini-3-flash-preview'
    );
    this.logTokenUsage(pipelineUsage);

    // Extract session file info for display
    const analyzedSessions = extractAnalyzedSessions(sessions);

    // Create full evaluation with metadata
    const evaluation: VerboseEvaluation = {
      sessionId: sessions[sessions.length - 1].sessionId,
      analyzedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      avgPromptLength: Math.round(metrics.avgPromptLength),
      avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
      analyzedSessions,
      ...contentWriterResult.data,
    };

    // Apply tier-based content filtering
    return this.contentGateway.filter(evaluation, tier);
  }

  /**
   * Log token usage summary to console
   */
  private logTokenUsage(usage: PipelineTokenUsage): void {
    console.log('\n' + formatActualUsage(usage));
  }

  /**
   * Single-stage analysis (legacy mode)
   *
   * One LLM call that does both data extraction and content writing.
   */
  private async analyzeSingleStage(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    tier: Tier
  ): Promise<VerboseEvaluation> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.callLLM(sessions, metrics);
        const parsed = this.parseResponse(response);

        // Extract session file info for display
        const analyzedSessions = extractAnalyzedSessions(sessions);

        // Add metadata to create full VerboseEvaluation
        // NOTE: Type assertion needed because legacy mode uses nested arrays while
        // VerboseLLMResponseSchema was updated to flattened format for Gemini.
        // TODO: Create separate schemas for Gemini vs Anthropic legacy mode.
        const evaluation: VerboseEvaluation = {
          sessionId: sessions[sessions.length - 1].sessionId,
          analyzedAt: new Date().toISOString(),
          sessionsAnalyzed: sessions.length,
          avgPromptLength: Math.round(metrics.avgPromptLength),
          avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
          analyzedSessions,
          ...(parsed as any),
        };

        // Apply tier-based content filtering
        return this.contentGateway.filter(evaluation, tier);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof VerboseAnalysisError && !error.retryable) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new VerboseAnalysisError(
      `Verbose analysis failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED'
    );
  }

  /**
   * Call the Anthropic API with structured output
   */
  private async callLLM(
    sessions: ParsedSession[],
    metrics: SessionMetrics
  ): Promise<Anthropic.Message> {
    const userPrompt = buildVerboseUserPrompt(sessions, metrics);
    const toolDef = getVerboseToolDefinition();
    const schema = this.getVerboseJsonSchema();

    try {
      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: 0.4, // Slightly higher for more creative personalization
          system: VERBOSE_SYSTEM_PROMPT,
          tools: [
            {
              name: toolDef.name,
              description: toolDef.description,
              input_schema: schema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: toolDef.name },
          messages: [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'anthropic-beta': 'structured-outputs-2025-11-13',
          },
        }
      );

      return response;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new VerboseAnalysisError(
          'Rate limit exceeded. Please try again later.',
          'RATE_LIMIT',
          true
        );
      }

      if (error instanceof Anthropic.AuthenticationError) {
        throw new VerboseAnalysisError(
          'Invalid API key. Please check your ANTHROPIC_API_KEY.',
          'AUTH_ERROR'
        );
      }

      if (error instanceof Anthropic.APIError) {
        throw new VerboseAnalysisError(
          `API error: ${error.message}`,
          'API_ERROR',
          error.status === 500 || error.status === 503
        );
      }

      throw error;
    }
  }

  /**
   * Parse the API response and validate against schema
   */
  private parseResponse(response: Anthropic.Message): VerboseLLMResponse {
    // Find the tool use block
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      throw new VerboseAnalysisError('No tool use found in response', 'PARSE_ERROR');
    }

    // Sanitize LLM response to truncate strings that exceed schema limits
    const sanitized = sanitizeLLMResponse(toolUse.input);

    // Validate against schema
    const result = VerboseLLMResponseSchema.safeParse(sanitized);

    if (!result.success) {
      throw new VerboseAnalysisError(
        `Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`,
        'VALIDATION_ERROR'
      );
    }

    return result.data;
  }

  /**
   * Convert the VerboseLLMResponse schema to JSON Schema format
   * for use with Anthropic's structured outputs
   */
  private getVerboseJsonSchema(): Record<string, unknown> {
    const fullSchema = zodToJsonSchema(VerboseLLMResponseSchema, {
      $refStrategy: 'none', // Inline all refs
    });

    // Remove $schema as Anthropic doesn't need it
    const { $schema: _$schema, ...schema } = fullSchema as Record<string, unknown>;

    return schema;
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Export factory function for convenience
 */
export function createVerboseAnalyzer(config?: VerboseAnalyzerConfig): VerboseAnalyzer {
  return new VerboseAnalyzer(config);
}

// Re-export types and utilities
export { buildVerboseUserPrompt } from './verbose-prompts';
export { type Tier, ContentGateway, createContentGateway } from './content-gateway';
export { DataAnalystStage, type DataAnalystConfig } from './stages/data-analyst';
export { PersonalityAnalystStage, type PersonalityAnalystConfig } from './stages/personality-analyst';
export { ProductivityAnalystStage, type ProductivityAnalystConfig } from './stages/productivity-analyst';
export { ContentWriterStage, type ContentWriterConfig } from './stages/content-writer';
