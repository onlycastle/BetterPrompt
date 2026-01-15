/**
 * Content Writer Stage Implementation
 *
 * Stage 2 of the two-stage pipeline.
 * Uses Gemini 3 Flash for high-quality content writing.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * @module analyzer/stages/content-writer
 */

import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client.js';
import type { ParsedSession } from '../../domain/models/analysis.js';
import { VerboseLLMResponseSchema, type VerboseLLMResponse } from '../../models/verbose-evaluation.js';
import type { StructuredAnalysisData } from '../../models/analysis-data.js';
import {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
} from './content-writer-prompts.js';

/**
 * Configuration for the Content Writer stage
 */
export interface ContentWriterConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<ContentWriterConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 8192,
  maxRetries: 2,
};

/**
 * Content Writer Stage - Transforms structured data into engaging narrative
 *
 * Uses Gemini 3 Flash with structured JSON output for personalized content generation.
 */
export class ContentWriterStage {
  private client: GeminiClient;
  private config: Required<Omit<ContentWriterConfig, 'apiKey'>>;

  constructor(config: ContentWriterConfig = {}) {
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
   * Transform structured analysis data into engaging content
   */
  async transform(
    analysisData: StructuredAnalysisData,
    sessions: ParsedSession[]
  ): Promise<VerboseLLMResponse> {
    const structuredDataJson = JSON.stringify(analysisData, null, 2);
    const userPrompt = buildContentWriterUserPrompt(structuredDataJson, sessions.length);

    const result = await this.client.generateStructured({
      systemPrompt: CONTENT_WRITER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: VerboseLLMResponseSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    // Sanitize and merge with Stage 1 data
    return this.sanitizeResponse(result, analysisData);
  }

  /**
   * Sanitize response and ensure consistency with Stage 1 data
   */
  private sanitizeResponse(
    input: VerboseLLMResponse,
    analysisData: StructuredAnalysisData
  ): VerboseLLMResponse {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as VerboseLLMResponse;

    // Ensure type classification matches Stage 1 (Stage 1 is authoritative)
    sanitized.primaryType = analysisData.typeAnalysis.primaryType;
    sanitized.controlLevel = analysisData.typeAnalysis.controlLevel;
    sanitized.distribution = analysisData.typeAnalysis.distribution;

    // Truncate strings that exceed limits (preserving bold markers)
    if (sanitized.personalitySummary && typeof sanitized.personalitySummary === 'string') {
      if (sanitized.personalitySummary.length > 800) {
        let truncated = sanitized.personalitySummary.slice(0, 797);
        // Avoid breaking a bold marker mid-way by checking for unclosed **
        const lastBoldStart = truncated.lastIndexOf('**');
        const beforeLastBold = truncated.slice(0, lastBoldStart).lastIndexOf('**');
        // If there's an unclosed bold marker (odd number of ** before truncation point)
        if (lastBoldStart > beforeLastBold && lastBoldStart > 0) {
          truncated = truncated.slice(0, lastBoldStart).trimEnd();
        }
        sanitized.personalitySummary = truncated + '...';
      }
    }

    // Ensure dimensionInsights has exactly 6 items
    if (!Array.isArray(sanitized.dimensionInsights) || sanitized.dimensionInsights.length !== 6) {
      const dimensions = [
        { key: 'aiCollaboration', name: 'AI Collaboration Mastery' },
        { key: 'contextEngineering', name: 'Context Engineering' },
        { key: 'toolMastery', name: 'Tool Mastery' },
        { key: 'burnoutRisk', name: 'Burnout Risk Assessment' },
        { key: 'aiControl', name: 'AI Control Index' },
        { key: 'skillResilience', name: 'Skill Resilience' },
      ] as const;

      sanitized.dimensionInsights = dimensions.map((dim) => {
        const existing = sanitized.dimensionInsights?.find((d) => d.dimension === dim.key);
        return (
          existing || {
            dimension: dim.key,
            dimensionDisplayName: dim.name,
            strengths: [],
            growthAreas: [],
          }
        );
      });
    }

    // Ensure promptPatterns has at least 3 items
    if (!Array.isArray(sanitized.promptPatterns) || sanitized.promptPatterns.length < 3) {
      const existing = sanitized.promptPatterns || [];
      while (existing.length < 3) {
        existing.push({
          patternName: `Pattern ${existing.length + 1}`,
          description: 'A detected pattern in your prompting style.',
          frequency: 'occasional',
          examples: [{ quote: 'Example quote', analysis: 'Pattern analysis' }],
          effectiveness: 'effective',
          tip: 'Continue developing this pattern through practice.',
        });
      }
      sanitized.promptPatterns = existing;
    }

    // Add evidence from Stage 1 data to dimension insights
    // NOTE: VerboseLLMResponse doesn't include evidence to reduce nesting depth
    // We add evidence here by matching quotes from Stage 1's extractedQuotes
    this.addEvidenceFromStage1(sanitized, analysisData);

    return sanitized;
  }

  /**
   * Add evidence quotes from Stage 1 data to dimension insights
   * This post-processing step adds the evidence that was omitted from LLM schema
   */
  private addEvidenceFromStage1(
    response: VerboseLLMResponse,
    analysisData: StructuredAnalysisData
  ): void {
    if (!Array.isArray(response.dimensionInsights)) return;

    for (const insight of response.dimensionInsights) {
      // Find quotes for this dimension from Stage 1
      const dimensionQuotes = analysisData.extractedQuotes.filter(
        (q) => q.dimension === insight.dimension
      );
      const strengthQuotes = dimensionQuotes.filter((q) => q.signal === 'strength');
      const growthQuotes = dimensionQuotes.filter((q) => q.signal === 'growth');

      // Add evidence to strengths
      if (Array.isArray(insight.strengths)) {
        for (const strength of insight.strengths) {
          // Get up to 3 quotes per strength, prefer high confidence
          const quotes = strengthQuotes
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3)
            .map((q) => q.quote);
          (strength as any).evidence = quotes;
        }
      }

      // Add evidence to growth areas
      if (Array.isArray(insight.growthAreas)) {
        for (const area of insight.growthAreas) {
          // Get up to 2 quotes per growth area, prefer high confidence
          const quotes = growthQuotes
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 2)
            .map((q) => q.quote);
          (area as any).evidence = quotes;
        }
      }
    }
  }
}
