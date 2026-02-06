/**
 * Worker Insights - Common types for Phase 2 Worker strengths/growthAreas output
 *
 * v3.1 Workers (2026-02):
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 * - LearningBehavior: Knowledge Gaps + Repeated Mistakes (redesigned)
 * - ContextEfficiency: Token efficiency patterns (retained)
 *
 * Each worker outputs domain-specific strengths and growth areas using shared types.
 * This decentralized approach allows workers to directly identify positive/negative
 * patterns within their capability domain.
 *
 * @module models/worker-insights
 */

import { z } from 'zod';

// ============================================================================
// Insight Evidence Schema (NEW - utterance-linked evidence)
// ============================================================================

/**
 * Structured evidence with utterance ID linking.
 *
 * This enables linking evidence quotes back to original developer utterances
 * for verification and detailed context display in the frontend.
 *
 * Format from LLM: "utteranceId:quote:context" parsed into this structure.
 */
export const InsightEvidenceSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Direct quote or paraphrase from the developer's message */
  quote: z.string(),

  /** Brief context description (optional) */
  context: z.string().optional(),
});
export type InsightEvidence = z.infer<typeof InsightEvidenceSchema>;

/**
 * Evidence can be either a simple string (legacy) or structured with utterance linking (new).
 * Union type enables backward compatibility with existing data.
 */
export const EvidenceItemSchema = z.union([
  z.string(),
  InsightEvidenceSchema,
]);
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ============================================================================
// Worker Strength Schema
// ============================================================================

/**
 * A strength identified by a Phase 2 Worker in its domain.
 *
 * Each worker identifies 1-4 strengths with supporting evidence.
 * Evidence quotes link back to Phase 1 utteranceIds for verification.
 */
export const WorkerStrengthSchema = z.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),

  /**
   * Direct quotes from developer messages demonstrating this (2-8 items).
   * Can be simple strings (legacy) or structured with utterance linking (new).
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),
});
export type WorkerStrength = z.infer<typeof WorkerStrengthSchema>;

// ============================================================================
// Worker Growth Schema
// ============================================================================

/**
 * Severity level for growth areas.
 *
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const WorkerGrowthSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type WorkerGrowthSeverity = z.infer<typeof WorkerGrowthSeveritySchema>;

/**
 * A growth area identified by a Phase 2 Worker in its domain.
 *
 * Each worker identifies 1-4 growth areas with supporting evidence
 * and actionable recommendations.
 */
export const WorkerGrowthSchema = z.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),

  /**
   * Direct quotes from developer messages showing this pattern (2-8 items).
   * Can be simple strings (legacy) or structured with utterance linking (new).
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),

  /** 4-6 sentences with step-by-step actionable advice */
  recommendation: z.string(),

  /** How critical this growth area is to address */
  severity: WorkerGrowthSeveritySchema.optional(),
});
export type WorkerGrowth = z.infer<typeof WorkerGrowthSchema>;

// ============================================================================
// Worker Insights Container (for each Worker)
// ============================================================================

/**
 * Referenced insight from Knowledge Base (imported for container schema).
 * Full schema is defined in thinking-quality-data.ts.
 */
export const ReferencedInsightSchema = z.object({
  /** Insight ID (e.g., "pi-001") */
  id: z.string(),
  /** Human-readable title (e.g., "Skill Atrophy Self-Diagnosis") */
  title: z.string(),
  /** Source URL for the insight */
  url: z.string(),
  /** Main insight text */
  keyTakeaway: z.string(),
  /** Actionable tips array */
  actionableAdvice: z.array(z.string()),
  /** Insight category: diagnosis | trend | tool | type-specific */
  category: z.string(),
  /** Author name from source */
  sourceAuthor: z.string(),
});
export type ReferencedInsight = z.infer<typeof ReferencedInsightSchema>;

/**
 * Container for a single Worker's strengths and growth areas.
 *
 * Each Phase 2 Worker outputs this structure alongside its domain-specific data.
 */
export const WorkerInsightsContainerSchema = z.object({
  /** Strengths identified in this domain (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).min(1).max(6),

  /** Growth areas identified in this domain (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).min(1).max(6),

  /** Domain-specific score (0-100) */
  domainScore: z.number().min(0).max(100).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type WorkerInsightsContainer = z.infer<typeof WorkerInsightsContainerSchema>;

// ============================================================================
// Structured LLM Output Schemas (NEW - replaces pipe-delimited strings)
// ============================================================================

/**
 * Structured evidence for LLM output.
 *
 * This is the LLM output format - each evidence is a JSON object with:
 * - utteranceId: Required - sessionId_turnIndex (e.g., "abc123_5")
 * - quote: Required - the developer's exact words (min 15 chars)
 * - context: Optional - additional context
 *
 * Gemini Nesting Depth Analysis (4 levels max, arrays don't count):
 * root{} → strengths[] → strength{} → evidence[] → evidenceItem{}
 *   L1                      L2                         L3 (safe)
 */
export const StructuredEvidenceLLMSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Direct quote from the developer's message (min 15 chars) */
  quote: z.string(),

  /** Brief context description (optional) */
  context: z.string().optional(),
});
export type StructuredEvidenceLLM = z.infer<typeof StructuredEvidenceLLMSchema>;

/**
 * Structured strength for LLM output.
 *
 * Uses StructuredEvidenceLLMSchema for evidence to provide type-safe structured output.
 *
 * Gemini Nesting Depth (arrays don't count toward 4-level limit):
 * root{} → strengths[] → strength{} → evidence[] → evidenceItem{}
 *   L1                      L2                         L3 (safe)
 */
export const StructuredStrengthLLMSchema = z.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis (min 300 chars) */
  description: z.string().min(300),

  /**
   * Evidence objects with utteranceId linking (2-8 items).
   * Each item: {utteranceId: "sessionId_turnIndex", quote: "...", context?: "..."}
   */
  evidence: z.array(StructuredEvidenceLLMSchema).min(1).max(8),
});
export type StructuredStrengthLLM = z.infer<typeof StructuredStrengthLLMSchema>;

/**
 * Structured growth area for LLM output.
 *
 * Uses StructuredEvidenceLLMSchema for evidence to provide type-safe structured output.
 */
export const StructuredGrowthLLMSchema = z.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis (min 300 chars) */
  description: z.string().min(300),

  /**
   * Evidence objects with utteranceId linking (2-8 items).
   * Each item: {utteranceId: "sessionId_turnIndex", quote: "...", context?: "..."}
   */
  evidence: z.array(StructuredEvidenceLLMSchema).min(1).max(8),

  /** 4-6 sentences with step-by-step actionable advice (min 150 chars) */
  recommendation: z.string().min(150),

  /** Severity level: critical | high | medium | low */
  severity: WorkerGrowthSeveritySchema.optional(),
});
export type StructuredGrowthLLM = z.infer<typeof StructuredGrowthLLMSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a single evidence item with REQUIRED utteranceId format.
 *
 * Format: "utteranceId:quote[:context]"
 * - utteranceId: Required - sessionId_turnIndex (e.g., "abc123_5")
 * - quote: Required - the developer's exact words
 * - context: Optional - additional context
 *
 * Returns null if utteranceId is missing or invalid, which will be filtered out.
 * This ensures all evidence can be verified against original utterances.
 *
 * @param evidenceStr - Raw evidence string from LLM output
 * @returns InsightEvidence object or null if utteranceId is missing/invalid
 */
export function parseEvidenceItem(evidenceStr: string): InsightEvidence | null {
  const trimmed = evidenceStr.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return null;
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) {
    if (trimmed.length > 0) {
      console.warn(`[parseEvidenceItem] No utteranceId found (missing colon): "${trimmed.slice(0, 50)}..."`);
    }
    return null;
  }

  const utteranceId = trimmed.slice(0, colonIndex);

  // Validate utteranceId format: must end with _<number>
  if (!/_\d+$/.test(utteranceId)) {
    console.warn(`[parseEvidenceItem] Invalid utteranceId format: "${utteranceId}" (must match sessionId_turnIndex pattern)`);
    return null;
  }

  const remainder = trimmed.slice(colonIndex + 1);
  const secondColonIndex = remainder.indexOf(':');

  if (secondColonIndex > 0) {
    return {
      utteranceId,
      quote: remainder.slice(0, secondColonIndex).trim(),
      context: remainder.slice(secondColonIndex + 1).trim() || undefined,
    };
  }

  return {
    utteranceId,
    quote: remainder.trim(),
  };
}

/**
 * Parse strengthsData string into structured array.
 * Format: "title|description|evidence1,evidence2,evidence3|frequency;..."
 *
 * Evidence items MUST have utteranceId format: "sessionId_turnIndex:quote[:context]"
 * Evidence without valid utteranceId will be filtered out.
 *
 * @example
 * parseWorkerStrengthsData("Systematic Verification|You consistently verify...|session1_5:let me check:verifying,session1_8:looks good|75")
 */
export function parseWorkerStrengthsData(data: string | undefined): WorkerStrength[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';

      // Track seen quotes for deduplication within this strength item
      const seenQuotes = new Set<string>();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      // Require minimum quote length of 15 chars to filter out corrupted/too-short quotes
      // Deduplicate by normalized quote text
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => {
          if (e === null || e.quote.length < 15) return false;
          const normalizedQuote = e.quote.trim().toLowerCase();
          if (seenQuotes.has(normalizedQuote)) {
            console.warn(
              `[parseWorkerStrengthsData] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
            );
            return false;
          }
          seenQuotes.add(normalizedQuote);
          return true;
        });

      const result: WorkerStrength = { title, description, evidence };

      return result;
    })
    .filter((s) => s.title && s.description && s.evidence.length > 0);
}

/**
 * Parse growthAreasData string into structured array.
 * Format: "title|description|evidence1,evidence2|recommendation|severity|frequency;..."
 *
 * Evidence items MUST have utteranceId format: "sessionId_turnIndex:quote[:context]"
 * Evidence without valid utteranceId will be filtered out.
 *
 * @example
 * parseWorkerGrowthAreasData("Error Loop|You tend to retry...|session1_3:fix it:debugging,session1_5:still broken|Try pausing...|high|65")
 */
export function parseWorkerGrowthAreasData(data: string | undefined): WorkerGrowth[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';
      const recommendation = parts[3]?.trim() || '';
      const severityStr = parts[4]?.trim() as WorkerGrowthSeverity | undefined;

      // Track seen quotes for deduplication within this growth area item
      const seenQuotes = new Set<string>();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      // Require minimum quote length of 15 chars to filter out corrupted/too-short quotes
      // Deduplicate by normalized quote text
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => {
          if (e === null || e.quote.length < 15) return false;
          const normalizedQuote = e.quote.trim().toLowerCase();
          if (seenQuotes.has(normalizedQuote)) {
            console.warn(
              `[parseWorkerGrowthAreasData] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
            );
            return false;
          }
          seenQuotes.add(normalizedQuote);
          return true;
        });

      const result: WorkerGrowth = {
        title,
        description,
        evidence,
        recommendation,
      };

      if (severityStr && ['critical', 'high', 'medium', 'low'].includes(severityStr)) {
        result.severity = severityStr;
      }

      return result;
    })
    .filter((g) => g.title && g.description && g.evidence.length > 0);
}

// ============================================================================
// Structured Parsing Functions (for StructuredStrengthLLM/StructuredGrowthLLM)
// ============================================================================

/**
 * Parse structured evidence objects from LLM output.
 *
 * Each evidence item is already a JSON object: {utteranceId, quote, context?}
 * This function validates, filters, and deduplicates the evidence objects.
 *
 * Deduplication is performed by normalizing quote text (trimmed, lowercased).
 * This handles cases where LLMs hallucinate different utteranceIds for the same quote,
 * or when users genuinely repeated the same message across different turns.
 * Only the first occurrence is kept.
 *
 * @param evidenceObjects - Array of StructuredEvidenceLLM from LLM output
 * @returns Array of InsightEvidence objects (invalid/duplicate items filtered out)
 */
export function parseStructuredEvidence(
  evidenceObjects: StructuredEvidenceLLM[]
): InsightEvidence[] {
  const seenQuotes = new Set<string>(); // Track seen quotes for deduplication

  return evidenceObjects
    .filter((e) => {
      // Validate utteranceId format: sessionId_turnIndex
      if (!e.utteranceId || !/_\d+$/.test(e.utteranceId)) {
        console.warn(
          `[parseStructuredEvidence] Invalid utteranceId format: "${e.utteranceId}"`
        );
        return false;
      }
      // Validate quote minimum length
      if (!e.quote || e.quote.length < 15) {
        console.warn(
          `[parseStructuredEvidence] Quote too short (min 15 chars): "${e.quote?.slice(0, 30)}..."`
        );
        return false;
      }

      // Deduplicate by normalized quote text (trim + lowercase)
      const normalizedQuote = e.quote.trim().toLowerCase();
      if (seenQuotes.has(normalizedQuote)) {
        console.warn(
          `[parseStructuredEvidence] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
        );
        return false;
      }
      seenQuotes.add(normalizedQuote);

      return true;
    })
    .map((e) => ({
      utteranceId: e.utteranceId,
      quote: e.quote.trim(),
      context: e.context?.trim() || undefined,
    }));
}

/**
 * Convert structured LLM strengths to WorkerStrength array.
 *
 * Directly maps structured evidence objects (no string parsing needed).
 *
 * @param llmStrengths - Array of StructuredStrengthLLM from LLM output
 * @returns Array of WorkerStrength with validated evidence
 */
export function parseStructuredStrengths(
  llmStrengths: StructuredStrengthLLM[] | undefined
): WorkerStrength[] {
  if (!llmStrengths || llmStrengths.length === 0) return [];

  return llmStrengths
    .map((s) => ({
      title: s.title,
      description: s.description,
      evidence: parseStructuredEvidence(s.evidence),
    }))
    .filter((s) => s.title && s.description && s.evidence.length > 0);
}

/**
 * Convert structured LLM growth areas to WorkerGrowth array.
 *
 * Directly maps structured evidence objects (no string parsing needed).
 *
 * @param llmGrowthAreas - Array of StructuredGrowthLLM from LLM output
 * @returns Array of WorkerGrowth with validated evidence
 */
export function parseStructuredGrowthAreas(
  llmGrowthAreas: StructuredGrowthLLM[] | undefined
): WorkerGrowth[] {
  if (!llmGrowthAreas || llmGrowthAreas.length === 0) return [];

  return llmGrowthAreas
    .map((g) => ({
      title: g.title,
      description: g.description,
      evidence: parseStructuredEvidence(g.evidence),
      recommendation: g.recommendation,
      severity: g.severity,
    }))
    .filter((g) => g.title && g.description && g.evidence.length > 0);
}

// ============================================================================
// Aggregated Worker Insights (for VerboseEvaluation)
// ============================================================================

/**
 * All Worker insights aggregated for the VerboseEvaluation.
 *
 * Each worker's insights are accessed by key for direct frontend rendering.
 */
export interface AggregatedWorkerInsights {
  // =========================================================================
  // v3.1 Unified Workers
  // =========================================================================

  /** Thinking Quality domain insights (planning + critical thinking) */
  thinkingQuality?: WorkerInsightsContainer;

  /** Communication Patterns domain insights (communication + signature quotes) */
  communicationPatterns?: WorkerInsightsContainer;

  /** Learning Behavior domain insights (knowledge gaps + repeated mistakes) */
  learningBehavior?: WorkerInsightsContainer;

  /** Context Efficiency domain insights */
  contextEfficiency?: WorkerInsightsContainer;

  /** Session Outcome domain insights (goals, friction, success rates) */
  sessionOutcome?: WorkerInsightsContainer;

  // =========================================================================
  // Legacy workers (kept for cached data compatibility)
  // =========================================================================

  /** Knowledge & Learning domain insights (legacy, use learningBehavior instead) */
  knowledgeGap?: WorkerInsightsContainer;
}

/**
 * Metadata for a Worker domain (used in frontend rendering).
 */
export interface WorkerDomainConfig {
  key: keyof AggregatedWorkerInsights;
  icon: string;
  title: string;
  subtitle: string;
  scoreLabel: string;
}

/**
 * Configuration for v3.1 Worker domains.
 * Used by frontend to render consistent UI sections.
 *
 * Tab order: Thinking → Communication → Learning → Context
 */
export const WORKER_DOMAIN_CONFIGS: WorkerDomainConfig[] = [
  {
    key: 'thinkingQuality',
    icon: '🧠',
    title: 'Thinking Quality',
    subtitle: 'How intentionally and critically do you work?',
    scoreLabel: 'Thinking Score',
  },
  {
    key: 'communicationPatterns',
    icon: '💬',
    title: 'Communication',
    subtitle: 'How clearly do you express your needs?',
    scoreLabel: 'Communication Score',
  },
  {
    key: 'learningBehavior',
    icon: '📈',
    title: 'Learning Behavior',
    subtitle: 'How much do you learn from AI?',
    scoreLabel: 'Learning Score',
  },
  {
    key: 'contextEfficiency',
    icon: '⚡',
    title: 'Context Efficiency',
    subtitle: 'How efficiently do you use tokens?',
    scoreLabel: 'Efficiency Score',
  },
  {
    key: 'sessionOutcome',
    icon: '🎯',
    title: 'Session Success',
    subtitle: 'How successful are your AI collaboration sessions?',
    scoreLabel: 'Success Rate',
  },
];

// ============================================================================
// Worker-to-Dimension Mapping (for Phase 2.75 fallback insights)
// ============================================================================

/**
 * Maps Worker domain keys to Phase 2.75 dimension names.
 *
 * Phase 2.75 KnowledgeResourceMatcher groups resources by DimensionNameEnum
 * (e.g., 'TrustVerification', 'CommunicationPatterns'), while the frontend
 * Worker tabs use AggregatedWorkerInsights keys (e.g., 'thinkingQuality').
 *
 * This mapping enables retrieving fallback professionalInsights for each Worker tab
 * when LLM doesn't reference any [pi-XXX] insights.
 *
 * Dimension names match DimensionNameEnum in dimension-schema.ts:
 * - TrustVerification: Verification behavior, critical thinking
 * - WorkflowHabit: Planning habits, structured approach
 * - CommunicationPatterns: Communication clarity, prompt patterns
 * - KnowledgeGap: Learning behavior, knowledge gaps
 * - ContextEfficiency: Token efficiency, context management
 */
export const WORKER_TO_DIMENSIONS: Record<keyof AggregatedWorkerInsights, string[]> = {
  thinkingQuality: ['TrustVerification', 'WorkflowHabit'],
  communicationPatterns: ['CommunicationPatterns'],
  learningBehavior: ['KnowledgeGap'],
  contextEfficiency: ['ContextEfficiency'],
  sessionOutcome: ['SessionOutcome'],  // NEW - maps to SessionOutcome insights
  // Legacy worker (kept for backward compatibility)
  knowledgeGap: ['KnowledgeGap'],
};

/**
 * Convert MatchedProfessionalInsight to ReferencedInsight format.
 *
 * MatchedProfessionalInsight (from Phase 2.75) has matchScore and priority fields
 * that ReferencedInsight doesn't need. This helper extracts the common fields
 * for consistent display in the frontend.
 *
 * @param matched - Professional insight from Phase 2.75 matching
 * @returns ReferencedInsight format for GrowthCard display
 */
export function matchedInsightToReferenced(matched: {
  id: string;
  title: string;
  sourceUrl: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  category: string;
  sourceAuthor: string;
}): ReferencedInsight {
  return {
    id: matched.id,
    title: matched.title,
    url: matched.sourceUrl,
    keyTakeaway: matched.keyTakeaway,
    actionableAdvice: matched.actionableAdvice,
    category: matched.category,
    sourceAuthor: matched.sourceAuthor,
  };
}

// ============================================================================
// Translation Overlay Functions
// ============================================================================

/**
 * Parse translated strengths data and apply to WorkerStrength array.
 *
 * The translatedData format mirrors the strengthsData format from LLM output:
 * "translatedTitle|translatedDescription|originalQuotes|frequency;..."
 *
 * This function overlays translated title/description while preserving
 * original evidence quotes (which should remain in the source language).
 *
 * @param strengths - Original WorkerStrength array (English)
 * @param translatedData - Translated data string from TranslatedAgentInsights
 * @returns WorkerStrength array with translated title/description
 */
export function applyTranslatedStrengths(
  strengths: WorkerStrength[],
  translatedData: string | undefined
): WorkerStrength[] {
  if (!translatedData || translatedData.trim() === '') return strengths;

  const translations = translatedData.split(';').filter(Boolean);

  return strengths.map((strength, index) => {
    const translationEntry = translations[index];
    if (!translationEntry) return strength;

    const parts = translationEntry.split('|');
    if (parts.length < 2) return strength;

    const translatedTitle = parts[0]?.trim();
    const translatedDescription = parts[1]?.trim();

    return {
      ...strength,
      title: translatedTitle || strength.title,
      description: translatedDescription || strength.description,
      // evidence stays as original (parts[2] contains original quotes)
    };
  });
}

/**
 * Parse translated growth areas data and apply to WorkerGrowth array.
 *
 * The translatedData format mirrors the growthAreasData format from LLM output:
 * "translatedTitle|translatedDesc|originalEvidence|translatedRec|freq|severity|priority;..."
 *
 * This function overlays translated title/description/recommendation while
 * preserving original evidence quotes and numeric fields.
 *
 * @param growthAreas - Original WorkerGrowth array (English)
 * @param translatedData - Translated data string from TranslatedAgentInsights
 * @returns WorkerGrowth array with translated title/description/recommendation
 */
export function applyTranslatedGrowthAreas(
  growthAreas: WorkerGrowth[],
  translatedData: string | undefined
): WorkerGrowth[] {
  if (!translatedData || translatedData.trim() === '') return growthAreas;

  const translations = translatedData.split(';').filter(Boolean);

  return growthAreas.map((growth, index) => {
    const translationEntry = translations[index];
    if (!translationEntry) return growth;

    const parts = translationEntry.split('|');
    if (parts.length < 4) return growth;

    const translatedTitle = parts[0]?.trim();
    const translatedDescription = parts[1]?.trim();
    // parts[2] is evidence (keep original)
    const translatedRecommendation = parts[3]?.trim();
    // parts[4], [5], [6] are frequency, severity, priority (keep original)

    return {
      ...growth,
      title: translatedTitle || growth.title,
      description: translatedDescription || growth.description,
      // CRITICAL: Preserve locked state (empty recommendation) for free tier
      // If original recommendation is empty (''), keep it empty even if translation exists
      // This prevents premium content from leaking through the translation overlay
      recommendation: growth.recommendation
        ? (translatedRecommendation || growth.recommendation)
        : growth.recommendation,
      // evidence, severity, frequency stay as original
    };
  });
}
