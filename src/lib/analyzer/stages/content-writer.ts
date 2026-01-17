/**
 * Content Writer Stage Implementation
 *
 * Stage 2 of the three-stage pipeline.
 * Uses Gemini 3 Flash for high-quality content writing.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * Input: Module A output (StructuredAnalysisData) + Module B output (PersonalityProfile)
 * Output: VerboseLLMResponse
 *
 * @module analyzer/stages/content-writer
 */

import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import type { ParsedSession } from '../../domain/models/analysis';
import {
  VerboseLLMResponseSchema,
  DIMENSION_NAMES,
  DIMENSION_DISPLAY_NAMES,
  type VerboseLLMResponse,
} from '../../models/verbose-evaluation';
import type { StructuredAnalysisData } from '../../models/analysis-data';
import type { PersonalityProfile } from '../../models/personality';
import {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
  detectKoreanContent,
} from './content-writer-prompts';

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
 *
 * maxOutputTokens increased to 16384 for consistency with Stage 1.
 * Stage 2 generates personalized narrative with dimension insights.
 */
const DEFAULT_CONFIG: Required<Omit<ContentWriterConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 16384,
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
   *
   * @param analysisData - Module A output (behavioral analysis)
   * @param personalityProfile - Module B output (personality analysis)
   * @param sessions - Raw parsed sessions
   */
  async transform(
    analysisData: StructuredAnalysisData,
    personalityProfile: PersonalityProfile,
    sessions: ParsedSession[]
  ): Promise<VerboseLLMResponse> {
    const structuredDataJson = JSON.stringify(analysisData, null, 2);
    const personalityDataJson = JSON.stringify(personalityProfile, null, 2);

    // Detect if user's quotes are primarily in Korean
    const quotes = analysisData.extractedQuotes.map((q) => q.quote);
    const useKorean = detectKoreanContent(quotes);

    const userPrompt = buildContentWriterUserPrompt(
      structuredDataJson,
      personalityDataJson,
      sessions.length,
      useKorean
    );

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
      sanitized.dimensionInsights = DIMENSION_NAMES.map((dim) => {
        const existing = sanitized.dimensionInsights?.find((d) => d.dimension === dim);
        return (
          existing || {
            dimension: dim,
            dimensionDisplayName: DIMENSION_DISPLAY_NAMES[dim],
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

    // Sanitize Premium/Enterprise sections (Anti-Patterns, Critical Thinking, Planning)
    this.sanitizePremiumSections(sanitized, analysisData);

    return sanitized;
  }

  /**
   * Sanitize Premium/Enterprise sections and provide defaults if missing
   */
  private sanitizePremiumSections(
    response: VerboseLLMResponse,
    analysisData: StructuredAnalysisData
  ): void {
    // Anti-Patterns Analysis
    const hasAntiPatterns =
      analysisData.detectedAntiPatterns && analysisData.detectedAntiPatterns.length > 0;

    if (hasAntiPatterns) {
      if (!response.antiPatternsAnalysis) {
        response.antiPatternsAnalysis = {
          detected: [],
          summary:
            'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
          overallHealthScore: 80,
        };
      }
      // Ensure required fields
      if (!Array.isArray(response.antiPatternsAnalysis.detected)) {
        response.antiPatternsAnalysis.detected = [];
      }
      if (typeof response.antiPatternsAnalysis.overallHealthScore !== 'number') {
        response.antiPatternsAnalysis.overallHealthScore = 80;
      }
    }

    // Critical Thinking Analysis
    const hasCriticalThinking =
      analysisData.criticalThinkingMoments && analysisData.criticalThinkingMoments.length > 0;

    if (hasCriticalThinking) {
      if (!response.criticalThinkingAnalysis) {
        response.criticalThinkingAnalysis = {
          strengths: [],
          opportunities: [],
          summary:
            'Shows signs of critical evaluation when working with AI-generated content.',
          overallScore: 70,
        };
      }
      // Ensure required fields
      if (!Array.isArray(response.criticalThinkingAnalysis.strengths)) {
        response.criticalThinkingAnalysis.strengths = [];
      }
      if (!Array.isArray(response.criticalThinkingAnalysis.opportunities)) {
        response.criticalThinkingAnalysis.opportunities = [];
      }
      if (typeof response.criticalThinkingAnalysis.overallScore !== 'number') {
        response.criticalThinkingAnalysis.overallScore = 70;
      }
    }

    // Planning Analysis
    const hasPlanningBehaviors =
      analysisData.planningBehaviors && analysisData.planningBehaviors.length > 0;

    if (hasPlanningBehaviors) {
      if (!response.planningAnalysis) {
        // Determine maturity level from Stage 1 data
        const hasSlashPlan = analysisData.planningBehaviors?.some(
          (b) => b.behaviorType === 'slash_plan_usage'
        );
        const hasTodoWrite = analysisData.planningBehaviors?.some(
          (b) => b.behaviorType === 'todowrite_usage'
        );

        let maturityLevel: 'reactive' | 'emerging' | 'structured' | 'expert' = 'emerging';
        if (hasSlashPlan) {
          // Check if /plan has detailed decomposition
          const slashPlanBehavior = analysisData.planningBehaviors?.find(
            (b) => b.behaviorType === 'slash_plan_usage'
          );
          if (
            slashPlanBehavior?.planDetails?.problemDecomposition &&
            (slashPlanBehavior?.planDetails?.stepsCount ?? 0) >= 3
          ) {
            maturityLevel = 'expert';
          } else {
            maturityLevel = 'structured';
          }
        } else if (hasTodoWrite) {
          maturityLevel = 'emerging';
        } else {
          maturityLevel = 'reactive';
        }

        response.planningAnalysis = {
          strengths: [],
          opportunities: [],
          summary:
            'Shows planning awareness in development workflow.',
          planningMaturityLevel: maturityLevel,
        };
      }

      // Ensure required fields
      if (!Array.isArray(response.planningAnalysis.strengths)) {
        response.planningAnalysis.strengths = [];
      }
      if (!Array.isArray(response.planningAnalysis.opportunities)) {
        response.planningAnalysis.opportunities = [];
      }

      // Add slashPlanStats from Stage 1 data if available
      if (!response.planningAnalysis.slashPlanStats) {
        const slashPlanBehaviors = analysisData.planningBehaviors?.filter(
          (b) => b.behaviorType === 'slash_plan_usage'
        );
        if (slashPlanBehaviors && slashPlanBehaviors.length > 0) {
          const totalUsage = slashPlanBehaviors.length;
          const stepsArray = slashPlanBehaviors
            .map((b) => b.planDetails?.stepsCount)
            .filter((s): s is number => typeof s === 'number');
          const avgSteps =
            stepsArray.length > 0
              ? stepsArray.reduce((a, b) => a + b, 0) / stepsArray.length
              : undefined;
          const decompositionCount = slashPlanBehaviors.filter(
            (b) => b.planDetails?.problemDecomposition
          ).length;
          const decompositionRate =
            totalUsage > 0 ? decompositionCount / totalUsage : undefined;

          response.planningAnalysis.slashPlanStats = {
            totalUsage,
            avgStepsPerPlan: avgSteps,
            problemDecompositionRate: decompositionRate,
          };
        }
      }
    }

    // Top Focus Areas (from personalizedPriorities)
    const hasPersonalizedPriorities =
      analysisData.personalizedPriorities &&
      analysisData.personalizedPriorities.topPriorities.length > 0;

    if (hasPersonalizedPriorities && !response.topFocusAreas) {
      // Fallback: Convert Stage 1 data directly if LLM didn't generate
      const priorities = analysisData.personalizedPriorities!;
      response.topFocusAreas = {
        areas: priorities.topPriorities.map((p) => ({
          rank: p.rank,
          dimension: p.dimension,
          title: p.focusArea,
          narrative: p.rationale,
          expectedImpact: p.expectedImpact,
          priorityScore: p.priorityScore,
        })),
        summary: priorities.selectionRationale,
      };
    }
  }

  /**
   * Add evidence quotes from Stage 1 data to dimension insights
   * Uses clusterId-based matching to ensure unique quotes per section
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

      // Group quotes by clusterId
      const quotesByCluster = new Map<string, typeof dimensionQuotes>();
      for (const quote of dimensionQuotes) {
        const key = quote.clusterId || `${quote.dimension}_${quote.signal}_default`;
        if (!quotesByCluster.has(key)) {
          quotesByCluster.set(key, []);
        }
        quotesByCluster.get(key)!.push(quote);
      }

      // Get cluster definitions from Stage 1
      const dimSignal = analysisData.dimensionSignals.find(
        (s) => s.dimension === insight.dimension
      );
      const clusterDefs = dimSignal?.clusters || [];
      const strengthClusters = clusterDefs.filter((c) => c.signal === 'strength');
      const growthClusters = clusterDefs.filter((c) => c.signal === 'growth');

      // Match quotes to strengths by cluster order
      if (Array.isArray(insight.strengths)) {
        for (let i = 0; i < insight.strengths.length; i++) {
          const cluster = strengthClusters[i];
          const clusterQuotes = cluster
            ? quotesByCluster.get(cluster.clusterId) || []
            : [];

          // Sort by confidence and take up to 6 quotes
          (insight.strengths[i] as any).evidence = clusterQuotes
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 6)
            .map((q) => q.quote);
        }
      }

      // Match quotes to growthAreas by cluster order
      if (Array.isArray(insight.growthAreas)) {
        for (let i = 0; i < insight.growthAreas.length; i++) {
          const cluster = growthClusters[i];
          const clusterQuotes = cluster
            ? quotesByCluster.get(cluster.clusterId) || []
            : [];

          // Sort by confidence and take up to 4 quotes
          (insight.growthAreas[i] as any).evidence = clusterQuotes
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 4)
            .map((q) => q.quote);
        }
      }
    }
  }
}
