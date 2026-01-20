/**
 * Data Analyst Stage Implementation
 *
 * Stage 1 of the two-stage pipeline.
 * Uses Gemini 3 Flash for fast, cost-effective data extraction.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * @module analyzer/stages/data-analyst
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import type { ParsedSession, SessionMetrics } from '../../domain/models/analysis';
import {
  StructuredAnalysisDataSchema,
  type StructuredAnalysisData,
} from '../../models/analysis-data';
import { DIMENSION_NAMES } from '../../models/verbose-evaluation';
import { DATA_ANALYST_SYSTEM_PROMPT, buildDataAnalystUserPrompt } from './data-analyst-prompts';
import { formatSessionsForAnalysis, DATA_ANALYST_FORMAT } from '../shared/session-formatter';

/**
 * Configuration for the Data Analyst stage
 */
export interface DataAnalystConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

/**
 * Result of data analyst stage including token usage
 */
export interface DataAnalystResult {
  data: StructuredAnalysisData;
  usage: TokenUsage;
}

/**
 * Default configuration values
 *
 * maxOutputTokens set to maximum (65536) to prevent truncation.
 * Gemini 3 Flash supports up to 65536 output tokens.
 * You only pay for tokens actually generated, not the limit.
 */
const DEFAULT_CONFIG: Required<Omit<DataAnalystConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 65536,
  maxRetries: 2,
};

/**
 * Data Analyst Stage - Extracts structured behavioral data from sessions
 *
 * Uses Gemini 3 Flash with structured JSON output for precise data extraction.
 */
export class DataAnalystStage {
  private client: GeminiClient;
  private config: Required<Omit<DataAnalystConfig, 'apiKey'>>;

  constructor(config: DataAnalystConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.config = {
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens || DEFAULT_CONFIG.maxOutputTokens,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };
  }

  /**
   * Analyze sessions and extract structured behavioral data
   * Returns both the analysis data and token usage metadata
   */
  async analyze(
    sessions: ParsedSession[],
    metrics: SessionMetrics
  ): Promise<DataAnalystResult> {
    if (sessions.length === 0) {
      throw new Error('At least one session is required for analysis');
    }

    const sessionsFormatted = this.formatSessions(sessions);
    const metricsFormatted = this.formatMetrics(metrics);
    const userPrompt = buildDataAnalystUserPrompt(sessionsFormatted, metricsFormatted);

    const result = await this.client.generateStructured({
      systemPrompt: DATA_ANALYST_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: StructuredAnalysisDataSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    // Sanitize the response to ensure schema compliance
    return {
      data: this.sanitizeResponse(result.data),
      usage: result.usage,
    };
  }

  /**
   * Format sessions for the prompt
   * Uses shared formatter for consistency with cost estimator
   */
  private formatSessions(sessions: ParsedSession[]): string {
    return formatSessionsForAnalysis(sessions, DATA_ANALYST_FORMAT);
  }

  /**
   * Format metrics for the prompt
   */
  private formatMetrics(metrics: SessionMetrics): string {
    return `Total Sessions: ${metrics.totalTurns}
Average Prompt Length: ${Math.round(metrics.avgPromptLength)} characters
Average First Prompt Length: ${Math.round(metrics.avgFirstPromptLength)} characters
Question Frequency: ${metrics.questionFrequency.toFixed(2)} per turn
Modification Rate: ${(metrics.modificationRate * 100).toFixed(1)}%
Average Turns Per Session: ${metrics.avgTurnsPerSession.toFixed(1)}
Tool Usage: Read=${metrics.toolUsage.read}, Grep=${metrics.toolUsage.grep}, Glob=${metrics.toolUsage.glob}, Edit=${metrics.toolUsage.edit}, Write=${metrics.toolUsage.write}, Bash=${metrics.toolUsage.bash}, Task=${metrics.toolUsage.task}`;
  }

  /**
   * Sanitize response to ensure schema compliance
   */
  private sanitizeResponse(input: StructuredAnalysisData): StructuredAnalysisData {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as StructuredAnalysisData;

    // Ensure extractedQuotes is an array with at least minimum items
    if (!Array.isArray(sanitized.extractedQuotes)) {
      sanitized.extractedQuotes = [];
    }

    // Filter out empty quotes only - no length constraints on user data
    sanitized.extractedQuotes = sanitized.extractedQuotes.filter(
      (q) => q.quote && q.quote.trim().length > 0
    );

    // Ensure dimensionSignals has exactly 6 items (one per dimension)
    if (!Array.isArray(sanitized.dimensionSignals) || sanitized.dimensionSignals.length !== 6) {
      sanitized.dimensionSignals = DIMENSION_NAMES.map((dim) => {
        const existing = sanitized.dimensionSignals?.find((s) => s.dimension === dim);
        return (
          existing || {
            dimension: dim,
            strengthSignals: [],
            growthSignals: [],
          }
        );
      });
    }

    // Ensure analysisMetadata.coverageScores has all 6 dimensions
    if (!sanitized.analysisMetadata?.coverageScores) {
      sanitized.analysisMetadata = {
        ...sanitized.analysisMetadata,
        totalQuotesAnalyzed: sanitized.analysisMetadata?.totalQuotesAnalyzed || 0,
        confidenceScore: sanitized.analysisMetadata?.confidenceScore || 0.5,
        coverageScores: DIMENSION_NAMES.map((dim) => ({
          dimension: dim,
          score: 0.5,
        })),
      };
    } else if (sanitized.analysisMetadata.coverageScores.length !== 6) {
      sanitized.analysisMetadata.coverageScores = DIMENSION_NAMES.map((dim) => {
        const existing = sanitized.analysisMetadata.coverageScores.find(
          (c) => c.dimension === dim
        );
        return existing || { dimension: dim, score: 0.5 };
      });
    }

    // Ensure detectedPatterns has at least 3 items
    if (!Array.isArray(sanitized.detectedPatterns) || sanitized.detectedPatterns.length < 3) {
      const existing = sanitized.detectedPatterns || [];
      while (existing.length < 3) {
        existing.push({
          patternId: `pattern-${existing.length + 1}`,
          patternType: 'communication_style',
          frequency: 1,
          examples: [],
          significance: 'Pattern detected from conversation analysis',
        });
      }
      sanitized.detectedPatterns = existing;
    }

    // Ensure new optional arrays exist (Premium/Enterprise features)
    if (!Array.isArray(sanitized.detectedAntiPatterns)) {
      sanitized.detectedAntiPatterns = [];
    }
    if (!Array.isArray(sanitized.criticalThinkingMoments)) {
      sanitized.criticalThinkingMoments = [];
    }
    if (!Array.isArray(sanitized.planningBehaviors)) {
      sanitized.planningBehaviors = [];
    }

    return sanitized;
  }
}
