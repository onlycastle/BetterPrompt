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
import type { Phase1Output, DeveloperUtterance } from '../../models/phase1-output';
import {
  CONTENT_WRITER_SYSTEM_PROMPT,
  CONTENT_WRITER_SYSTEM_PROMPT_V3,
  buildContentWriterUserPrompt,
  buildContentWriterUserPromptV3,
} from './content-writer-prompts';
import { buildPatternKnowledgeContext, extractPatternTypes } from './pattern-knowledge-mapping';
import { summarizeAgentOutputsForPhase3 } from './phase3-summarizer';

/**
 * Configuration for the Content Writer stage
 */
export interface ContentWriterConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  verbose?: boolean;
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
  verbose: false,
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
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
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
   * v3 Architecture: Transform using AgentOutputs only
   *
   * Phase 3 in the new pipeline:
   * - Phase 2 workers provide semantic analysis (strengths, trust, workflow, etc.)
   * - Phase 2.5 (TypeClassifier) provides classification + synthesis
   * - Phase 3 (this) transforms everything into personalized narrative
   *
   * Key differences from transformV2:
   * - No StructuredAnalysisData — uses AgentOutputs only
   * - No ProductivityAnalysisData — consolidated into ContextEfficiency
   * - Type override from agentOutputs.typeClassifier
   * - Deterministic evidence verification against Phase1Output (when provided)
   * - Premium sections use Phase 2 outputs (TrustVerification, WorkflowHabit)
   *
   * @param sessionCount - Number of sessions analyzed (from Phase 1 metrics)
   * @param agentOutputs - All Phase 2 + 2.5 worker outputs
   * @param phase1Output - Optional Phase1Output for deterministic evidence verification
   * @returns ContentWriterResult with VerboseLLMResponse and token usage
   */
  async transformV3(
    sessionCount: number,
    agentOutputs: AgentOutputs,
    phase1Output?: Phase1Output
  ): Promise<ContentWriterResult> {
    const agentOutputsSummary = summarizeAgentOutputsForPhase3(agentOutputs);

    // Build KB context from TrustVerification detected patterns
    const detectedPatternsData = agentOutputs.trustVerification?.detectedPatternsData;
    const patternTypes = detectedPatternsData
      ? this.extractPatternTypesFromData(detectedPatternsData)
      : [];
    const kbContext = buildPatternKnowledgeContext(patternTypes);

    const userPrompt = buildContentWriterUserPromptV3(
      agentOutputsSummary,
      sessionCount,
      kbContext
    );

    const result = await this.client.generateStructured({
      systemPrompt: CONTENT_WRITER_SYSTEM_PROMPT_V3,
      userPrompt,
      responseSchema: VerboseLLMResponseSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    // Sanitize response using v3 logic, with optional evidence verification
    return {
      data: this.sanitizeResponseV3(result.data, agentOutputs, phase1Output),
      usage: result.usage,
    };
  }

  /**
   * Extract pattern types from detectedPatternsData string
   * Format: "patternType|frequency|significance;..."
   */
  private extractPatternTypesFromData(data: string): string[] {
    if (!data || data.trim() === '') return [];
    return data
      .split(';')
      .filter(Boolean)
      .map(entry => entry.split('|')[0]?.trim())
      .filter((type): type is string => !!type);
  }

  /**
   * Sanitize response for v3 architecture
   *
   * Uses Phase 2 outputs instead of StructuredAnalysisData:
   * - Type override from TypeClassifier (Phase 2.5)
   * - Deterministic evidence verification against Phase1Output (when provided)
   * - Premium sections from TrustVerification + WorkflowHabit
   */
  private sanitizeResponseV3(
    input: VerboseLLMResponse,
    agentOutputs: AgentOutputs,
    phase1Output?: Phase1Output
  ): any {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as any;

    // Type classification from TypeClassifier (Phase 2.5) — authoritative source
    if (agentOutputs.typeClassifier) {
      sanitized.primaryType = agentOutputs.typeClassifier.primaryType;
      sanitized.controlLevel = agentOutputs.typeClassifier.controlLevel;
      sanitized.distribution = agentOutputs.typeClassifier.distribution;
      sanitized.controlScore = agentOutputs.typeClassifier.controlScore;
    }

    // Truncate strings that exceed limits
    if (sanitized.personalitySummary && typeof sanitized.personalitySummary === 'string') {
      if (sanitized.personalitySummary.length > 3000) {
        let truncated = sanitized.personalitySummary.slice(0, 2997);
        const lastBoldStart = truncated.lastIndexOf('**');
        const beforeLastBold = truncated.slice(0, lastBoldStart).lastIndexOf('**');
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
        actions: area.actionsData
          ? parseActionsData(area.actionsData)
          : area.actions,
      }));
    }

    // Deterministic evidence verification: cross-reference Phase 2 evidence
    // against Phase1Output originals to ensure quote accuracy
    if (phase1Output) {
      this.verifyAndEnrichEvidence(sanitized, agentOutputs, phase1Output);
    }

    // Sanitize Premium sections using Phase 2 outputs
    this.sanitizePremiumSectionsV3(sanitized, agentOutputs);

    return sanitized;
  }

  /**
   * Sanitize Premium/Enterprise sections using Phase 2 worker outputs
   *
   * Uses TrustVerification for anti-patterns + verification behavior
   * Uses WorkflowHabit for critical thinking + planning habits
   * Uses StrengthGrowth for personalized priorities
   */
  private sanitizePremiumSectionsV3(
    response: any,
    agentOutputs: AgentOutputs
  ): void {
    // Anti-patterns from TrustVerification
    const trustVerification = agentOutputs.trustVerification;
    if (trustVerification && trustVerification.antiPatterns && trustVerification.antiPatterns.length > 0) {
      if (!response.antiPatternsAnalysis) {
        response.antiPatternsAnalysis = {
          detected: [],
          summary: 'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
          overallHealthScore: trustVerification.overallTrustHealthScore ?? 80,
        };
      }
      this.ensureArrayField(response.antiPatternsAnalysis, 'detected');
      this.ensureNumberField(response.antiPatternsAnalysis, 'overallHealthScore',
        trustVerification.overallTrustHealthScore ?? 80);
    }

    // Critical thinking from WorkflowHabit
    const workflowHabit = agentOutputs.workflowHabit;
    if (workflowHabit && workflowHabit.criticalThinkingMoments && workflowHabit.criticalThinkingMoments.length > 0) {
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

    // Planning from WorkflowHabit
    if (workflowHabit && workflowHabit.planningHabits && workflowHabit.planningHabits.length > 0) {
      if (!response.planningAnalysis) {
        const hasSlashPlan = workflowHabit.planningHabits.some(ph => ph.type === 'uses_plan_command');
        const hasTodoWrite = workflowHabit.planningHabits.some(ph => ph.type === 'todowrite_usage');
        const hasTaskDecomp = workflowHabit.planningHabits.some(ph => ph.type === 'task_decomposition');

        let maturityLevel: 'reactive' | 'emerging' | 'structured' | 'expert' = 'reactive';
        if (hasSlashPlan && hasTaskDecomp) maturityLevel = 'expert';
        else if (hasSlashPlan) maturityLevel = 'structured';
        else if (hasTodoWrite) maturityLevel = 'emerging';

        response.planningAnalysis = {
          strengths: [],
          opportunities: [],
          summary: 'Shows planning awareness in development workflow.',
          planningMaturityLevel: maturityLevel,
        };
      }
      this.ensureArrayField(response.planningAnalysis, 'strengths');
      this.ensureArrayField(response.planningAnalysis, 'opportunities');
    }

    // Top focus areas from StrengthGrowth personalized priorities
    const strengthGrowth = agentOutputs.strengthGrowth;
    if (strengthGrowth?.personalizedPrioritiesData && !response.topFocusAreas) {
      const areas = this.parsePersonalizedPriorities(strengthGrowth.personalizedPrioritiesData);
      if (areas.length > 0) {
        response.topFocusAreas = {
          areas,
          summary: 'Personalized priorities based on your analysis results.',
        };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evidence Verification Layer
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deterministic evidence verification and enrichment
   *
   * Cross-references evidence from Phase 2 workers against Phase1Output
   * to ensure quote accuracy. This provides a hard guarantee that evidence
   * quotes are actual developer utterances, not LLM paraphrases.
   *
   * Strategy:
   * 1. Build a lookup map from Phase1Output.developerUtterances (id → text)
   * 2. For each dimension insight's strengths/growthAreas, check if evidence
   *    already exists from Phase 3 LLM or from Phase 2 worker data
   * 3. If Phase 2 StrengthGrowth has evidence with utteranceIds,
   *    verify quotes against originals and replace mismatches
   * 4. Enrich evidence with structured { utteranceId, quote, sessionId }
   */
  private verifyAndEnrichEvidence(
    sanitized: any,
    agentOutputs: AgentOutputs,
    phase1Output: Phase1Output
  ): void {
    // Build utterance lookup: id → DeveloperUtterance
    const utteranceLookup = new Map<string, DeveloperUtterance>();
    for (const utterance of phase1Output.developerUtterances) {
      utteranceLookup.set(utterance.id, utterance);
    }

    if (utteranceLookup.size === 0) {
      this.log('No developer utterances in Phase1Output — skipping evidence verification');
      return;
    }

    // Get Phase 2 StrengthGrowth evidence for cross-referencing
    const strengthGrowth = agentOutputs.strengthGrowth;
    if (!strengthGrowth) return;

    // Collect all Phase 2 evidence by dimension for matching
    const phase2EvidenceByDimension = this.collectPhase2Evidence(strengthGrowth);

    let verifiedCount = 0;
    let replacedCount = 0;
    let removedCount = 0;

    // Process each dimension insight
    if (!Array.isArray(sanitized.dimensionInsights)) return;

    for (const insight of sanitized.dimensionInsights) {
      const dimension = insight.dimension;
      const phase2Data = phase2EvidenceByDimension.get(dimension);
      if (!phase2Data) continue;

      // Index-based matching for strengths:
      // Phase 3 strength at index i corresponds to Phase 2 strength at index i
      if (Array.isArray(insight.strengths)) {
        for (let i = 0; i < insight.strengths.length; i++) {
          const matchedEvidence = phase2Data.strengths[i]?.evidence ?? null;
          const result = this.verifyEvidenceForInsight(
            insight.strengths[i],
            matchedEvidence,
            utteranceLookup,
            phase2Data.strengths // fallback for title-based matching
          );
          verifiedCount += result.verified;
          replacedCount += result.replaced;
          removedCount += result.removed;
        }
      }

      // Index-based matching for growth areas
      if (Array.isArray(insight.growthAreas)) {
        for (let i = 0; i < insight.growthAreas.length; i++) {
          const matchedEvidence = phase2Data.growthAreas[i]?.evidence ?? null;
          const result = this.verifyEvidenceForInsight(
            insight.growthAreas[i],
            matchedEvidence,
            utteranceLookup,
            phase2Data.growthAreas // fallback for title-based matching
          );
          verifiedCount += result.verified;
          replacedCount += result.replaced;
          removedCount += result.removed;
        }
      }
    }

    this.log(`Evidence verification: verified=${verifiedCount}, replaced=${replacedCount}, removed=${removedCount}`);
  }

  /**
   * Collect Phase 2 evidence organized by dimension
   */
  private collectPhase2Evidence(strengthGrowth: NonNullable<AgentOutputs['strengthGrowth']>): Map<string, {
    strengths: Array<{ title: string; evidence: Array<{ utteranceId: string; quote: string; context?: string }> }>;
    growthAreas: Array<{ title: string; evidence: Array<{ utteranceId: string; quote: string; context?: string }> }>;
  }> {
    const result = new Map<string, {
      strengths: Array<{ title: string; evidence: Array<{ utteranceId: string; quote: string; context?: string }> }>;
      growthAreas: Array<{ title: string; evidence: Array<{ utteranceId: string; quote: string; context?: string }> }>;
    }>();

    // Collect from strengths
    if (Array.isArray(strengthGrowth.strengths)) {
      for (const s of strengthGrowth.strengths) {
        const dim = (s as any).dimension || 'aiCollaboration';
        if (!result.has(dim)) {
          result.set(dim, { strengths: [], growthAreas: [] });
        }
        result.get(dim)!.strengths.push({
          title: (s as any).title || '',
          evidence: Array.isArray((s as any).evidence)
            ? (s as any).evidence.map((e: any) => ({
                utteranceId: e.utteranceId || '',
                quote: e.quote || (typeof e === 'string' ? e : ''),
                context: e.context,
              }))
            : [],
        });
      }
    }

    // Collect from growth areas
    if (Array.isArray(strengthGrowth.growthAreas)) {
      for (const g of strengthGrowth.growthAreas) {
        const dim = (g as any).dimension || 'aiCollaboration';
        if (!result.has(dim)) {
          result.set(dim, { strengths: [], growthAreas: [] });
        }
        result.get(dim)!.growthAreas.push({
          title: (g as any).title || '',
          evidence: Array.isArray((g as any).evidence)
            ? (g as any).evidence.map((e: any) => ({
                utteranceId: e.utteranceId || '',
                quote: e.quote || (typeof e === 'string' ? e : ''),
                context: e.context,
              }))
            : [],
        });
      }
    }

    return result;
  }

  /**
   * Verify and correct evidence for a single insight (strength or growth area)
   *
   * Primary strategy: Use pre-matched Phase 2 evidence (matched by dimension + index).
   * Fallback: Search by title similarity if no index-based match is available.
   *
   * For each evidence quote:
   * 1. Look up the utteranceId in Phase1Output
   * 2. If quote matches original → keep (verified)
   * 3. If quote doesn't match → replace with original text (corrected)
   * 4. If utteranceId invalid → remove evidence entry (removed)
   */
  private verifyEvidenceForInsight(
    insight: any,
    matchedPhase2Evidence: Array<{ utteranceId: string; quote: string; context?: string }> | null,
    utteranceLookup: Map<string, DeveloperUtterance>,
    fallbackPhase2Insights?: Array<{ title: string; evidence: Array<{ utteranceId: string; quote: string; context?: string }> }>,
  ): { verified: number; replaced: number; removed: number } {
    const stats = { verified: 0, replaced: 0, removed: 0 };

    // Determine which evidence to use: index-based match or title-based fallback
    let evidenceToVerify = matchedPhase2Evidence;

    if (!evidenceToVerify || evidenceToVerify.length === 0) {
      // Fallback: find Phase 2 insight by title similarity
      if (fallbackPhase2Insights) {
        const insightTitle = (insight.title || '').toLowerCase();
        const matchingPhase2 = fallbackPhase2Insights.find(
          p2 => p2.title.toLowerCase() === insightTitle
        ) || fallbackPhase2Insights.find(
          p2 => this.titleSimilarity(p2.title, insight.title || '') > 0.6
        );
        evidenceToVerify = matchingPhase2?.evidence ?? null;
      }
    }

    if (!evidenceToVerify || evidenceToVerify.length === 0) {
      // No Phase 2 evidence to verify against — leave as-is
      return stats;
    }

    // Build verified evidence array with structured data
    const verifiedEvidence: Array<{ utteranceId: string; quote: string; sessionId?: string }> = [];

    for (const ev of evidenceToVerify) {
      if (!ev.utteranceId) {
        stats.removed++;
        continue;
      }

      const original = utteranceLookup.get(ev.utteranceId);
      if (!original) {
        // utteranceId not found in Phase1Output — remove
        this.log(`Evidence utteranceId "${ev.utteranceId}" not found in Phase1Output — removing`);
        stats.removed++;
        continue;
      }

      // Extract original quote (first 500 chars of utterance text)
      const originalQuote = original.text.slice(0, 500);

      // Check if Phase 2 quote matches original
      if (this.quotesMatch(ev.quote, originalQuote)) {
        // Match — use Phase 2 quote (may be trimmed version of original)
        verifiedEvidence.push({
          utteranceId: ev.utteranceId,
          quote: ev.quote,
          sessionId: this.extractSessionId(ev.utteranceId),
        });
        stats.verified++;
      } else {
        // Mismatch — replace with original text
        this.log(`Evidence quote mismatch for utterance "${ev.utteranceId}" — replacing with original`);
        verifiedEvidence.push({
          utteranceId: ev.utteranceId,
          quote: originalQuote,
          sessionId: this.extractSessionId(ev.utteranceId),
        });
        stats.replaced++;
      }
    }

    // Set verified evidence on the insight
    if (verifiedEvidence.length > 0) {
      insight.evidence = verifiedEvidence;
    }

    return stats;
  }

  /**
   * Check if two quote strings match (allowing for truncation and minor differences)
   *
   * Uses a substring containment check: if the shorter quote is contained
   * within the longer one, or vice versa, they're considered matching.
   * This handles cases where the LLM truncated or slightly reformatted the quote.
   */
  private quotesMatch(quote1: string, quote2: string): boolean {
    const normalized1 = quote1.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalized2 = quote2.trim().toLowerCase().replace(/\s+/g, ' ');

    if (normalized1 === normalized2) return true;

    // Check substring containment (handles truncation)
    const shorter = normalized1.length <= normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;

    // If the shorter string is at least 30 chars and is contained in the longer, match
    if (shorter.length >= 30 && longer.includes(shorter)) return true;

    // Check prefix match (first 50 chars) — handles minor ending differences
    const prefixLen = Math.min(50, shorter.length);
    if (prefixLen >= 20 && normalized1.slice(0, prefixLen) === normalized2.slice(0, prefixLen)) return true;

    return false;
  }

  /**
   * Simple title similarity score (0-1)
   */
  private titleSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.toLowerCase().split(/\s+/));
    const words2 = new Set(title2.toLowerCase().split(/\s+/));
    let matches = 0;
    for (const w of words1) {
      if (words2.has(w)) matches++;
    }
    return matches / Math.max(words1.size, words2.size, 1);
  }

  /**
   * Extract sessionId from utteranceId
   * Format: "{sessionId}_{turnIndex}" → "{sessionId}"
   */
  private extractSessionId(utteranceId: string): string | undefined {
    const lastUnderscore = utteranceId.lastIndexOf('_');
    if (lastUnderscore <= 0) return undefined;
    return utteranceId.slice(0, lastUnderscore);
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Parse personalizedPrioritiesData into focus areas
   * Format: "dimension|focusArea|rationale|impact|score;..."
   */
  private parsePersonalizedPriorities(data: string): Array<{
    rank: number;
    dimension: DimensionNameEnum;
    title: string;
    narrative: string;
    expectedImpact: string;
    priorityScore: number;
  }> {
    if (!data || data.trim() === '') return [];

    return data
      .split(';')
      .filter(Boolean)
      .slice(0, 3) // Top 3
      .map((entry, index) => {
        const parts = entry.split('|');
        return {
          rank: index + 1,
          dimension: (parts[0]?.trim() || 'aiCollaboration') as DimensionNameEnum,
          title: parts[1]?.trim() || '',
          narrative: parts[2]?.trim() || '',
          expectedImpact: parts[3]?.trim() || '',
          priorityScore: parts[4] ? parseFloat(parts[4]) : 0,
        };
      })
      .filter(a => a.title);
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

    // Build KB context from detected patterns for enriched tips
    const patternTypes = analysisData.detectedPatterns
      ? extractPatternTypes(analysisData.detectedPatterns)
      : [];
    const kbContext = buildPatternKnowledgeContext(patternTypes);

    const userPrompt = buildContentWriterUserPrompt(
      structuredDataJson,
      sessionCount,
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

    // Get controlScore from TypeClassifier (Phase 2.5) if available,
    // otherwise fall back to Stage 1 data or default to 50
    sanitized.controlScore = agentOutputs?.typeClassifier?.controlScore
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

    return sanitized;
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
              this.log(`Strength "${strength.title}" missing clusterId, using semantic fallback`);
            } else {
              this.log(`ClusterId "${clusterId}" not found in quotes, using semantic fallback`);
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
              this.log(`Growth "${growth.title}" missing clusterId, using semantic fallback`);
            } else {
              this.log(`ClusterId "${clusterId}" not found in quotes, using semantic fallback`);
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

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[ContentWriter] ${message}`);
    }
  }
}
