/**
 * Content Writer Stage Implementation
 *
 * Stage 2 of the two-module pipeline.
 * Uses Gemini 3 Flash for high-quality content writing.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * Input: Module A output (StructuredAnalysisData) + Module C output (ProductivityAnalysisData)
 * Output: VerboseLLMResponse
 *
 * @module analyzer/stages/content-writer
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
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
import type { ProductivityAnalysisData } from '../../models/productivity-data';
import type { AgentOutputs } from '../../models/agent-outputs';
import {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
  detectPrimaryLanguage,
} from './content-writer-prompts';
import { buildPatternKnowledgeContext, extractPatternTypes } from './pattern-knowledge-mapping';

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
 * Result of content writer stage including token usage
 */
export interface ContentWriterResult {
  data: any; // VerboseLLMResponse with nested arrays
  usage: TokenUsage;
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
   * Returns both the response data and token usage metadata
   *
   * @param analysisData - Module A output (behavioral analysis)
   * @param sessions - Raw parsed sessions (for session count only)
   * @param productivityData - Module C output (productivity metrics) - optional
   * @param agentOutputs - Phase 2 agent outputs (insight generation) - optional
   *
   * @returns ContentWriterResult with VerboseLLMResponse (nested arrays) and token usage
   *          The LLM returns flattened strings, which are parsed back to nested arrays.
   *
   * @deprecated Use transformV2 for v2 architecture (no raw sessions access)
   */
  async transform(
    analysisData: StructuredAnalysisData,
    sessions: ParsedSession[],
    productivityData?: ProductivityAnalysisData,
    agentOutputs?: AgentOutputs
  ): Promise<ContentWriterResult> {
    // Delegate to internal method with session count
    return this.transformInternal(
      analysisData,
      sessions.length,
      productivityData,
      agentOutputs
    );
  }

  /**
   * v2 Architecture: Transform without raw session access
   *
   * This method enforces the v2 architecture principle where Phase 3
   * does NOT have access to raw sessions. Session count is derived
   * from Phase 1 metrics.
   *
   * @param analysisData - Module A output (behavioral analysis)
   * @param sessionCount - Number of sessions (from Phase 1 metrics)
   * @param productivityData - Module C output (productivity metrics) - optional
   * @param agentOutputs - Phase 2 agent outputs (insight generation) - optional
   *
   * @returns ContentWriterResult with VerboseLLMResponse (nested arrays) and token usage
   */
  async transformV2(
    analysisData: StructuredAnalysisData,
    sessionCount: number,
    productivityData?: ProductivityAnalysisData,
    agentOutputs?: AgentOutputs
  ): Promise<ContentWriterResult> {
    return this.transformInternal(
      analysisData,
      sessionCount,
      productivityData,
      agentOutputs
    );
  }

  /**
   * Internal transformation method
   */
  private async transformInternal(
    analysisData: StructuredAnalysisData,
    sessionCount: number,
    productivityData?: ProductivityAnalysisData,
    agentOutputs?: AgentOutputs
  ): Promise<ContentWriterResult> {
    const structuredDataJson = JSON.stringify(analysisData, null, 2);
    const productivityDataJson = productivityData ? JSON.stringify(productivityData, null, 2) : undefined;
    const agentOutputsJson = agentOutputs ? JSON.stringify(agentOutputs, null, 2) : undefined;

    // Detect primary language from user's quotes
    const quotes = analysisData.extractedQuotes.map((q) => q.quote);
    const languageResult = detectPrimaryLanguage(quotes);
    const outputLanguage = languageResult.primary;

    // Build KB context from detected patterns for enriched tips
    const patternTypes = analysisData.detectedPatterns
      ? extractPatternTypes(analysisData.detectedPatterns)
      : [];
    const kbContext = buildPatternKnowledgeContext(patternTypes);

    const userPrompt = buildContentWriterUserPrompt(
      structuredDataJson,
      sessionCount,
      outputLanguage,
      kbContext,
      productivityDataJson,
      agentOutputsJson
    );

    const result = await this.client.generateStructured({
      systemPrompt: CONTENT_WRITER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: VerboseLLMResponseSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    // Sanitize and merge with Stage 1 data
    return {
      data: this.sanitizeResponse(result.data, analysisData, agentOutputs),
      usage: result.usage,
    };
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
    analysisData: StructuredAnalysisData,
    agentOutputs?: AgentOutputs
  ): any {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as any;

    // Ensure type classification matches Stage 1 (Stage 1 is authoritative)
    sanitized.primaryType = analysisData.typeAnalysis.primaryType;
    sanitized.controlLevel = analysisData.typeAnalysis.controlLevel;
    sanitized.distribution = analysisData.typeAnalysis.distribution;

    // Get controlScore from TypeSynthesis worker (Phase 2.5) if available,
    // otherwise fall back to Stage 1 data or default to 50
    sanitized.controlScore = agentOutputs?.typeSynthesis?.controlScore
      ?? analysisData.typeAnalysis.controlScore
      ?? 50;

    // Truncate strings that exceed limits (preserving bold markers)
    if (sanitized.personalitySummary && typeof sanitized.personalitySummary === 'string') {
      if (sanitized.personalitySummary.length > 3000) {
        let truncated = sanitized.personalitySummary.slice(0, 2997);
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

    // Process translatedAgentInsights if present (for non-English output)
    // Keep as-is since frontend will parse the flattened strings
    if (sanitized.translatedAgentInsights) {
      this.sanitizeTranslatedAgentInsights(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize translatedAgentInsights to ensure proper format
   * Removes empty agent entries and validates string fields
   */
  private sanitizeTranslatedAgentInsights(response: any): void {
    const translatedInsights = response.translatedAgentInsights;
    if (!translatedInsights || typeof translatedInsights !== 'object') {
      delete response.translatedAgentInsights;
      return;
    }

    const agentKeys = [
      'patternDetective',
      'metacognition',
      'antiPatternSpotter',
      'knowledgeGap',
      'contextEfficiency',
      'temporalAnalysis',
      'multitasking',
    ];

    // Check if there's any actual content
    let hasContent = false;

    for (const key of agentKeys) {
      const agent = translatedInsights[key];
      if (!agent) continue;

      // Check if agent has any content
      const hasStrengths = agent.strengthsData && typeof agent.strengthsData === 'string' && agent.strengthsData.trim() !== '';
      const hasGrowth = agent.growthAreasData && typeof agent.growthAreasData === 'string' && agent.growthAreasData.trim() !== '';

      if (hasStrengths || hasGrowth) {
        hasContent = true;
      } else {
        // Remove empty agent entries
        delete translatedInsights[key];
      }
    }

    // If no content at all, remove the entire field
    if (!hasContent) {
      delete response.translatedAgentInsights;
    }
  }

  /**
   * Sanitize Premium/Enterprise sections and provide defaults if missing
   */
  private sanitizePremiumSections(
    response: any,
    analysisData: StructuredAnalysisData
  ): void {
    this.sanitizeAntiPatternsAnalysis(response, analysisData);
    this.sanitizeCriticalThinkingAnalysis(response, analysisData);
    this.sanitizePlanningAnalysis(response, analysisData);
    this.sanitizeTopFocusAreas(response, analysisData);
  }

  private sanitizeAntiPatternsAnalysis(response: any, analysisData: StructuredAnalysisData): void {
    const hasData = analysisData.detectedAntiPatterns && analysisData.detectedAntiPatterns.length > 0;
    if (!hasData) return;

    if (!response.antiPatternsAnalysis) {
      response.antiPatternsAnalysis = {
        detected: [],
        summary: 'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
        overallHealthScore: 80,
      };
    }

    this.ensureArrayField(response.antiPatternsAnalysis, 'detected');
    this.ensureNumberField(response.antiPatternsAnalysis, 'overallHealthScore', 80);
  }

  private sanitizeCriticalThinkingAnalysis(response: any, analysisData: StructuredAnalysisData): void {
    const hasData = analysisData.criticalThinkingMoments && analysisData.criticalThinkingMoments.length > 0;
    if (!hasData) return;

    if (!response.criticalThinkingAnalysis) {
      response.criticalThinkingAnalysis = {
        strengths: [],
        opportunities: [],
        summary: 'Shows signs of critical evaluation when working with AI-generated content.',
        overallScore: 70,
      };
    }

    this.ensureArrayField(response.criticalThinkingAnalysis, 'strengths');
    this.ensureArrayField(response.criticalThinkingAnalysis, 'opportunities');
    this.ensureNumberField(response.criticalThinkingAnalysis, 'overallScore', 70);
  }

  private sanitizePlanningAnalysis(response: any, analysisData: StructuredAnalysisData): void {
    const behaviors = analysisData.planningBehaviors;
    if (!behaviors || behaviors.length === 0) return;

    if (!response.planningAnalysis) {
      response.planningAnalysis = {
        strengths: [],
        opportunities: [],
        summary: 'Shows planning awareness in development workflow.',
        planningMaturityLevel: this.determinePlanningMaturityLevel(behaviors),
      };
    }

    this.ensureArrayField(response.planningAnalysis, 'strengths');
    this.ensureArrayField(response.planningAnalysis, 'opportunities');

    if (!response.planningAnalysis.slashPlanStats) {
      response.planningAnalysis.slashPlanStats = this.calculateSlashPlanStats(behaviors);
    }
  }

  private determinePlanningMaturityLevel(
    behaviors: NonNullable<StructuredAnalysisData['planningBehaviors']>
  ): 'reactive' | 'emerging' | 'structured' | 'expert' {
    const slashPlanBehavior = behaviors.find((b) => b.behaviorType === 'slash_plan_usage');

    if (slashPlanBehavior) {
      const hasDetailedDecomposition =
        slashPlanBehavior.planHasDecomposition && (slashPlanBehavior.planStepsCount ?? 0) >= 3;
      return hasDetailedDecomposition ? 'expert' : 'structured';
    }

    const hasTodoWrite = behaviors.some((b) => b.behaviorType === 'todowrite_usage');
    return hasTodoWrite ? 'emerging' : 'reactive';
  }

  private calculateSlashPlanStats(
    behaviors: NonNullable<StructuredAnalysisData['planningBehaviors']>
  ): { totalUsage: number; avgStepsPerPlan?: number; problemDecompositionRate?: number } | undefined {
    const slashPlanBehaviors = behaviors.filter((b) => b.behaviorType === 'slash_plan_usage');
    if (slashPlanBehaviors.length === 0) return undefined;

    const totalUsage = slashPlanBehaviors.length;
    const stepsArray = slashPlanBehaviors
      .map((b) => b.planStepsCount)
      .filter((s): s is number => typeof s === 'number');

    const avgStepsPerPlan = stepsArray.length > 0
      ? stepsArray.reduce((a, b) => a + b, 0) / stepsArray.length
      : undefined;

    const decompositionCount = slashPlanBehaviors.filter((b) => b.planHasDecomposition).length;
    const problemDecompositionRate = totalUsage > 0 ? decompositionCount / totalUsage : undefined;

    return { totalUsage, avgStepsPerPlan, problemDecompositionRate };
  }

  private sanitizeTopFocusAreas(response: any, analysisData: StructuredAnalysisData): void {
    const priorities = analysisData.personalizedPriorities;
    if (!priorities?.priority1Dimension || response.topFocusAreas) return;

    response.topFocusAreas = {
      areas: this.convertPrioritiesToFocusAreas(priorities),
      summary: priorities.selectionRationale,
    };
  }

  private ensureArrayField(obj: any, field: string): void {
    if (!Array.isArray(obj[field])) {
      obj[field] = [];
    }
  }

  private ensureNumberField(obj: any, field: string, defaultValue: number): void {
    if (typeof obj[field] !== 'number') {
      obj[field] = defaultValue;
    }
  }

  /**
   * Convert flattened priority data to focus areas array
   */
  private convertPrioritiesToFocusAreas(
    priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']>
  ): Array<{
    rank: number;
    dimension: DimensionNameEnum;
    title: string;
    narrative: string;
    expectedImpact: string;
    priorityScore: number;
  }> {
    const areas: Array<{
      rank: number;
      dimension: DimensionNameEnum;
      title: string;
      narrative: string;
      expectedImpact: string;
      priorityScore: number;
    }> = [];

    const priorityConfigs = [
      {
        rank: 1,
        dimension: priorities.priority1Dimension,
        focusArea: priorities.priority1FocusArea,
        rationale: priorities.priority1Rationale,
        expectedImpact: priorities.priority1ExpectedImpact,
        score: priorities.priority1Score,
      },
      {
        rank: 2,
        dimension: priorities.priority2Dimension,
        focusArea: priorities.priority2FocusArea,
        rationale: priorities.priority2Rationale,
        expectedImpact: priorities.priority2ExpectedImpact,
        score: priorities.priority2Score,
      },
      {
        rank: 3,
        dimension: priorities.priority3Dimension,
        focusArea: priorities.priority3FocusArea,
        rationale: priorities.priority3Rationale,
        expectedImpact: priorities.priority3ExpectedImpact,
        score: priorities.priority3Score,
      },
    ];

    for (const config of priorityConfigs) {
      if (config.dimension && config.focusArea) {
        areas.push({
          rank: config.rank,
          dimension: config.dimension,
          title: config.focusArea,
          narrative: config.rationale || '',
          expectedImpact: config.expectedImpact || '',
          priorityScore: config.score || 0,
        });
      }
    }

    return areas;
  }

  /**
   * Add evidence quotes from Stage 1 data to dimension insights
   * Uses clusterId-based matching (primary) with semantic fallback
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

      // ClusterId-based matching for strengths (with semantic fallback)
      if (Array.isArray(insight.strengths)) {
        const strengthQuotes = dimensionQuotes.filter(q => q.signal === 'strength');

        for (const strength of insight.strengths) {
          const clusterId = (strength as any).clusterId;

          if (clusterId && quotesByCluster.has(clusterId)) {
            // Primary: Direct clusterId match
            (strength as any).evidence = quotesByCluster.get(clusterId)!
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 6)
              .map((q) => q.quote);
          } else {
            // Fallback: Semantic similarity matching
            (strength as any).evidence = this.findSemanticMatches(
              strength.title + ' ' + strength.description,
              strengthQuotes
            );
            if (!clusterId) {
              console.warn(`[ContentWriter] Strength "${strength.title}" missing clusterId, using semantic fallback`);
            } else {
              console.warn(`[ContentWriter] ClusterId "${clusterId}" not found in quotes, using semantic fallback`);
            }
          }
        }
      }

      // ClusterId-based matching for growthAreas (with semantic fallback)
      if (Array.isArray(insight.growthAreas)) {
        const growthQuotes = dimensionQuotes.filter(q => q.signal === 'growth');

        for (const growth of insight.growthAreas) {
          const clusterId = (growth as any).clusterId;

          if (clusterId && quotesByCluster.has(clusterId)) {
            // Primary: Direct clusterId match
            (growth as any).evidence = quotesByCluster.get(clusterId)!
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 4)
              .map((q) => q.quote);
          } else {
            // Fallback: Semantic similarity matching
            (growth as any).evidence = this.findSemanticMatches(
              growth.title + ' ' + growth.description,
              growthQuotes,
              4
            );
            if (!clusterId) {
              console.warn(`[ContentWriter] Growth "${growth.title}" missing clusterId, using semantic fallback`);
            } else {
              console.warn(`[ContentWriter] ClusterId "${clusterId}" not found in quotes, using semantic fallback`);
            }
          }
        }
      }
    }
  }

  /**
   * Find semantically matching quotes when clusterId matching fails
   * Uses keyword overlap scoring as a lightweight semantic similarity measure
   */
  private findSemanticMatches(
    sectionText: string,
    candidates: Array<{ quote: string; behavioralMarker: string; confidence: number }>,
    maxResults: number = 6
  ): string[] {
    if (candidates.length === 0) return [];

    // Extract keywords from section text
    const keywords = this.extractKeywords(sectionText);

    // Score each candidate quote
    const scored = candidates.map(quote => ({
      quote,
      score: this.calculateOverlapScore(keywords, quote.quote + ' ' + quote.behavioralMarker)
    }));

    // Sort by score descending, then by confidence, take top matches
    return scored
      .filter(s => s.score > 0.1) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score || b.quote.confidence - a.quote.confidence)
      .slice(0, maxResults)
      .map(s => s.quote.quote);
  }

  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    // Common stop words in English
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'or', 'and', 'but', 'if', 'then', 'else', 'when', 'where', 'which', 'who',
      'your', 'you', 'their', 'its', 'our', 'my', 'his', 'her'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    return new Set(words);
  }

  /**
   * Calculate overlap score between keyword sets
   */
  private calculateOverlapScore(keywords: Set<string>, text: string): number {
    const textKeywords = this.extractKeywords(text);
    if (textKeywords.size === 0 || keywords.size === 0) return 0;

    let matches = 0;
    for (const kw of keywords) {
      if (textKeywords.has(kw)) {
        matches++;
      } else {
        // Partial match for compound words
        for (const tk of textKeywords) {
          if (tk.includes(kw) || kw.includes(tk)) {
            matches += 0.5;
            break;
          }
        }
      }
    }

    return matches / Math.max(keywords.size, 1);
  }
}
