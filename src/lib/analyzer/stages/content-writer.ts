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
  type DimensionNameEnum,
  parseStrengthsData,
  parseGrowthAreasData,
  parseExamplesData,
  parseActionsData,
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
 * maxOutputTokens set to maximum (65536) to prevent truncation.
 * Gemini 3 Flash supports up to 65536 output tokens.
 */
const DEFAULT_CONFIG: Required<Omit<ContentWriterConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 65536,
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
   *
   * @returns VerboseLLMResponse with nested arrays (converted from flattened LLM format)
   *          The LLM returns flattened strings, which are parsed back to nested arrays.
   *          Return type is 'any' due to this runtime conversion.
   */
  async transform(
    analysisData: StructuredAnalysisData,
    personalityProfile: PersonalityProfile,
    sessions: ParsedSession[]
  ): Promise<any> {
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
   *
   * This method also converts flattened LLM response format back to nested format:
   * - strengthsData (string) -> strengths (array)
   * - growthAreasData (string) -> growthAreas (array)
   * - examplesData (string) -> examples (array)
   * - actionsData (string) -> actions (object)
   */
  private sanitizeResponse(
    input: VerboseLLMResponse,
    analysisData: StructuredAnalysisData
  ): any {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as any;

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

    // Convert flattened dimensionInsights to nested format
    if (Array.isArray(sanitized.dimensionInsights)) {
      sanitized.dimensionInsights = sanitized.dimensionInsights.map((insight: any) => ({
        dimension: insight.dimension,
        dimensionDisplayName: insight.dimensionDisplayName,
        // Parse flattened strings back to arrays
        strengths: insight.strengthsData
          ? parseStrengthsData(insight.strengthsData)
          : (insight.strengths || []),
        growthAreas: insight.growthAreasData
          ? parseGrowthAreasData(insight.growthAreasData)
          : (insight.growthAreas || []),
      }));
    }

    // Ensure dimensionInsights has exactly 6 items
    if (!Array.isArray(sanitized.dimensionInsights) || sanitized.dimensionInsights.length !== 6) {
      sanitized.dimensionInsights = DIMENSION_NAMES.map((dim) => {
        const existing = sanitized.dimensionInsights?.find((d: any) => d.dimension === dim);
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

    // Convert flattened promptPatterns to nested format
    if (Array.isArray(sanitized.promptPatterns)) {
      sanitized.promptPatterns = sanitized.promptPatterns.map((pattern: any) => ({
        patternName: pattern.patternName,
        description: pattern.description,
        frequency: pattern.frequency,
        // Parse flattened examplesData back to array
        examples: pattern.examplesData
          ? parseExamplesData(pattern.examplesData)
          : (pattern.examples || []),
        effectiveness: pattern.effectiveness,
        tip: pattern.tip,
      }));
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

    // Convert flattened topFocusAreas to nested format
    if (sanitized.topFocusAreas && Array.isArray(sanitized.topFocusAreas.areas)) {
      sanitized.topFocusAreas.areas = sanitized.topFocusAreas.areas.map((area: any) => ({
        rank: area.rank,
        dimension: area.dimension,
        title: area.title,
        narrative: area.narrative,
        expectedImpact: area.expectedImpact,
        priorityScore: area.priorityScore,
        // Parse flattened actionsData back to object
        actions: area.actionsData
          ? parseActionsData(area.actionsData)
          : area.actions,
      }));
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
    response: any,
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
            slashPlanBehavior?.planHasDecomposition &&
            (slashPlanBehavior?.planStepsCount ?? 0) >= 3
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
            .map((b) => b.planStepsCount)
            .filter((s): s is number => typeof s === 'number');
          const avgSteps =
            stepsArray.length > 0
              ? stepsArray.reduce((a, b) => a + b, 0) / stepsArray.length
              : undefined;
          const decompositionCount = slashPlanBehaviors.filter(
            (b) => b.planHasDecomposition
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

    // Top Focus Areas (from personalizedPriorities - FLATTENED structure)
    const priorities = analysisData.personalizedPriorities;
    const hasPersonalizedPriorities =
      priorities && priorities.priority1Dimension;

    if (hasPersonalizedPriorities && !response.topFocusAreas) {
      // Fallback: Convert Stage 1 flattened data directly if LLM didn't generate
      const areas: Array<{
        rank: number;
        dimension: DimensionNameEnum;
        title: string;
        narrative: string;
        expectedImpact: string;
        priorityScore: number;
      }> = [];

      // Priority 1
      if (priorities.priority1Dimension && priorities.priority1FocusArea) {
        areas.push({
          rank: 1,
          dimension: priorities.priority1Dimension,
          title: priorities.priority1FocusArea,
          narrative: priorities.priority1Rationale || '',
          expectedImpact: priorities.priority1ExpectedImpact || '',
          priorityScore: priorities.priority1Score || 0,
        });
      }

      // Priority 2
      if (priorities.priority2Dimension && priorities.priority2FocusArea) {
        areas.push({
          rank: 2,
          dimension: priorities.priority2Dimension,
          title: priorities.priority2FocusArea,
          narrative: priorities.priority2Rationale || '',
          expectedImpact: priorities.priority2ExpectedImpact || '',
          priorityScore: priorities.priority2Score || 0,
        });
      }

      // Priority 3
      if (priorities.priority3Dimension && priorities.priority3FocusArea) {
        areas.push({
          rank: 3,
          dimension: priorities.priority3Dimension,
          title: priorities.priority3FocusArea,
          narrative: priorities.priority3Rationale || '',
          expectedImpact: priorities.priority3ExpectedImpact || '',
          priorityScore: priorities.priority3Score || 0,
        });
      }

      response.topFocusAreas = {
        areas,
        summary: priorities.selectionRationale,
      };
    }
  }

  /**
   * Add evidence quotes from Stage 1 data to dimension insights
   * Uses clusterId-based matching to ensure unique quotes per section
   *
   * @param response - Converted response with nested arrays (strengths/growthAreas)
   * @param analysisData - Stage 1 structured analysis data
   */
  private addEvidenceFromStage1(
    response: any,
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

      // Get cluster themes from Stage 1 (FLATTENED format: "clusterId:theme")
      const dimSignal = analysisData.dimensionSignals.find(
        (s) => s.dimension === insight.dimension
      );

      // Parse flattened cluster themes into {clusterId, theme} pairs
      const parseClusterThemes = (themes: string[] | undefined): Array<{ clusterId: string; theme: string }> => {
        if (!themes) return [];
        return themes.map((t) => {
          const colonIndex = t.indexOf(':');
          if (colonIndex > 0) {
            return { clusterId: t.slice(0, colonIndex), theme: t.slice(colonIndex + 1) };
          }
          return { clusterId: t, theme: '' };
        });
      };

      const strengthClusters = parseClusterThemes(dimSignal?.strengthClusterThemes);
      const growthClusters = parseClusterThemes(dimSignal?.growthClusterThemes);

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
