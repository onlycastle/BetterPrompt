/**
 * Worker Insights - Common types for Phase 2 Worker strengths/growthAreas output
 *
 * All Phase 2 Workers (TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * output their domain-specific strengths and growth areas using these shared types.
 *
 * This replaces the centralized StrengthGrowthSynthesizer approach, allowing each
 * worker to directly identify positive/negative patterns within its domain.
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

  /** Percentage of sessions showing this pattern (optional, 0-100) */
  frequency: z.number().min(0).max(100).optional(),
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

  /** Percentage of sessions where this pattern was observed (optional, 0-100) */
  frequency: z.number().min(0).max(100).optional(),
});
export type WorkerGrowth = z.infer<typeof WorkerGrowthSchema>;

// ============================================================================
// Worker Insights Container (for each Worker)
// ============================================================================

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
});
export type WorkerInsightsContainer = z.infer<typeof WorkerInsightsContainerSchema>;

// ============================================================================
// Flattened String Formats for Gemini API
// ============================================================================

/**
 * Flattened schema for LLM output (to avoid Gemini nesting limits).
 *
 * Formats:
 * - strengthsData: "title|description|quote1,quote2,quote3|frequency;..."
 * - growthAreasData: "title|description|quote1,quote2|recommendation|severity|frequency;..."
 */
export const WorkerInsightsLLMOutputSchema = z.object({
  /** Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items) */
  strengthsData: z.string()
    .describe('Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)'),

  /** Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items) */
  growthAreasData: z.string()
    .describe('Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)'),
});
export type WorkerInsightsLLMOutput = z.infer<typeof WorkerInsightsLLMOutputSchema>;

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
  if (!trimmed) return null;

  // Check for structured format: utteranceId:quote[:context]
  // utteranceId pattern: sessionId_turnIndex (e.g., "abc123_5")
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) {
    // No colon found - missing utteranceId
    if (trimmed.length > 0) {
      console.warn(`[parseEvidenceItem] No utteranceId found (missing colon): "${trimmed.slice(0, 50)}..."`);
    }
    return null;
  }

  const potentialUtteranceId = trimmed.slice(0, colonIndex);

  // Valid utteranceId contains underscore and ends with a number
  if (!/_\d+$/.test(potentialUtteranceId)) {
    console.warn(`[parseEvidenceItem] Invalid utteranceId format: "${potentialUtteranceId}" (must match sessionId_turnIndex pattern)`);
    return null;
  }

  const remainder = trimmed.slice(colonIndex + 1);
  const secondColonIndex = remainder.indexOf(':');

  if (secondColonIndex > 0) {
    // Has context: utteranceId:quote:context
    return {
      utteranceId: potentialUtteranceId,
      quote: remainder.slice(0, secondColonIndex).trim(),
      context: remainder.slice(secondColonIndex + 1).trim() || undefined,
    };
  } else {
    // No context: utteranceId:quote
    return {
      utteranceId: potentialUtteranceId,
      quote: remainder.trim(),
    };
  }
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
      const frequencyStr = parts[3]?.trim();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => e !== null && e.quote.length > 0);

      const frequency = frequencyStr ? parseFloat(frequencyStr) : undefined;

      const result: WorkerStrength = { title, description, evidence };
      if (frequency !== undefined && !isNaN(frequency)) {
        result.frequency = frequency;
      }

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
      const frequencyStr = parts[5]?.trim();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => e !== null && e.quote.length > 0);

      const result: WorkerGrowth = {
        title,
        description,
        evidence,
        recommendation,
      };

      if (severityStr && ['critical', 'high', 'medium', 'low'].includes(severityStr)) {
        result.severity = severityStr;
      }
      const frequency = frequencyStr ? parseFloat(frequencyStr) : undefined;
      if (frequency !== undefined && !isNaN(frequency)) {
        result.frequency = frequency;
      }

      return result;
    })
    .filter((g) => g.title && g.description && g.evidence.length > 0);
}

/**
 * Convert LLM output to structured WorkerInsightsContainer.
 */
export function parseWorkerInsightsLLMOutput(
  llmOutput: WorkerInsightsLLMOutput,
  domainScore?: number
): WorkerInsightsContainer {
  return {
    strengths: parseWorkerStrengthsData(llmOutput.strengthsData),
    growthAreas: parseWorkerGrowthAreasData(llmOutput.growthAreasData),
    domainScore,
  };
}

// ============================================================================
// Aggregated Worker Insights (for VerboseEvaluation)
// ============================================================================

/**
 * All Worker insights aggregated for the VerboseEvaluation.
 *
 * This structure replaces dimensionInsights from StrengthGrowthSynthesizer.
 * Each worker's insights are accessed by key for direct frontend rendering.
 */
export interface AggregatedWorkerInsights {
  /** Trust & Verification domain insights */
  trustVerification?: WorkerInsightsContainer;

  /** Workflow & Planning domain insights */
  workflowHabit?: WorkerInsightsContainer;

  /** Knowledge & Learning domain insights */
  knowledgeGap?: WorkerInsightsContainer;

  /** Context Efficiency domain insights */
  contextEfficiency?: WorkerInsightsContainer;
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
 * Configuration for all 4 Worker domains.
 * Used by frontend to render consistent UI sections.
 */
export const WORKER_DOMAIN_CONFIGS: WorkerDomainConfig[] = [
  {
    key: 'trustVerification',
    icon: '🛡️',
    title: 'Trust & Verification',
    subtitle: 'How do you verify AI outputs?',
    scoreLabel: 'Trust Health Score',
  },
  {
    key: 'workflowHabit',
    icon: '📋',
    title: 'Workflow & Planning',
    subtitle: 'How do you structure your work?',
    scoreLabel: 'Workflow Score',
  },
  {
    key: 'knowledgeGap',
    icon: '📚',
    title: 'Knowledge & Learning',
    subtitle: 'What are you learning?',
    scoreLabel: 'Knowledge Score',
  },
  {
    key: 'contextEfficiency',
    icon: '⚡',
    title: 'Context Efficiency',
    subtitle: 'How efficiently do you use tokens?',
    scoreLabel: 'Efficiency Score',
  },
];

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
      recommendation: translatedRecommendation || growth.recommendation,
      // evidence, severity, frequency stay as original
    };
  });
}
