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
  title: z.string().max(100),

  /** 2-3 sentences explaining the strength */
  description: z.string().max(500),

  /** Direct quotes from developer messages demonstrating this (2-3 quotes) */
  evidence: z.array(z.string().max(300)).min(1).max(4),

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
  title: z.string().max(100),

  /** 2-3 sentences describing the issue */
  description: z.string().max(500),

  /** Direct quotes from developer messages showing this pattern (2-3 quotes) */
  evidence: z.array(z.string().max(300)).min(1).max(4),

  /** Actionable advice (1-2 sentences) */
  recommendation: z.string().max(400),

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
  /** Strengths identified in this domain (1-4 items) */
  strengths: z.array(WorkerStrengthSchema).min(1).max(4),

  /** Growth areas identified in this domain (1-4 items) */
  growthAreas: z.array(WorkerGrowthSchema).min(1).max(4),

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
  /** Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-4 items) */
  strengthsData: z.string().max(4000)
    .describe('Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-4 items)'),

  /** Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-4 items) */
  growthAreasData: z.string().max(4000)
    .describe('Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-4 items)'),
});
export type WorkerInsightsLLMOutput = z.infer<typeof WorkerInsightsLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse strengthsData string into structured array.
 * Format: "title|description|quote1,quote2,quote3|frequency;..."
 *
 * @example
 * parseWorkerStrengthsData("Systematic Verification|You consistently verify...|'let me check','verifying this'|75")
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

      // Parse evidence: comma-separated, remove surrounding quotes
      const evidence = evidenceStr
        .split(',')
        .map((e) => e.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);

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
 * Format: "title|description|quote1,quote2|recommendation|severity|frequency;..."
 *
 * @example
 * parseWorkerGrowthAreasData("Error Loop|You tend to retry...|'fix it','still broken'|Try pausing...|high|65")
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

      // Parse evidence: comma-separated, remove surrounding quotes
      const evidence = evidenceStr
        .split(',')
        .map((e) => e.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);

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
