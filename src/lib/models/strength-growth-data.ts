/**
 * Strength & Growth Data Schema - Phase 2 Worker Output
 *
 * StrengthGrowthWorker is responsible for:
 * - Identifying developer strengths with evidence
 * - Identifying growth areas with evidence and recommendations
 * - Assigning dimensions to each insight
 * - Providing quantification (frequency, severity, priority)
 *
 * This worker answers: "What does this developer do well, and what could they improve?"
 *
 * @module models/strength-growth-data
 */

import { z } from 'zod';
import { DimensionNameEnumSchema } from './dimension-schema';

// ============================================================================
// Evidence Schema
// ============================================================================

/**
 * Evidence linking an insight to specific developer utterances.
 *
 * The utteranceId references Phase 1 DeveloperUtterance.id
 * This allows tracing insights back to their source.
 */
export const InsightEvidenceSchema = z.object({
  /** Reference to Phase 1 DeveloperUtterance.id */
  utteranceId: z.string(),

  /** The actual quote from the developer */
  quote: z.string().max(500),

  /** Brief context explaining what was happening */
  context: z.string().max(300),

  /** ISO timestamp for journey narrative */
  timestamp: z.string().optional(),
});
export type InsightEvidence = z.infer<typeof InsightEvidenceSchema>;

// ============================================================================
// Strength Schema
// ============================================================================

/**
 * A strength identified in the developer's AI collaboration style.
 *
 * Minimum 3-5 quotes per strength for credibility.
 * Each strength is tied to a specific dimension.
 */
export const StrengthInsightSchema = z.object({
  /** Clear, descriptive title (e.g., "Systematic Problem Decomposition") */
  title: z.string().max(80),

  /** 2-3 sentence detailed description of this strength */
  description: z.string().max(500),

  /** Evidence quotes demonstrating this strength (target: 3-5) */
  evidence: z.array(InsightEvidenceSchema),

  /** Which analysis dimension this strength belongs to */
  dimension: DimensionNameEnumSchema,

  /** Tip for further developing this strength */
  developmentTip: z.string().max(300).optional(),

  /** Confidence in this strength assessment (0-1) */
  confidence: z.number().min(0).max(1).optional(),
});
export type StrengthInsight = z.infer<typeof StrengthInsightSchema>;

// ============================================================================
// Growth Area Schema
// ============================================================================

/**
 * Severity level for growth areas.
 *
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const GrowthSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type GrowthSeverity = z.infer<typeof GrowthSeveritySchema>;

/**
 * A growth area identified in the developer's AI collaboration style.
 *
 * Includes quantification for prioritization and actionable recommendations.
 */
export const GrowthAreaInsightSchema = z.object({
  /** Clear, descriptive title (e.g., "Context Provision Habit") */
  title: z.string().max(80),

  /** 2-3 sentence description of what could improve */
  description: z.string().max(500),

  /** Evidence quotes showing this growth opportunity (target: 2-4) */
  evidence: z.array(InsightEvidenceSchema),

  /** Specific, actionable recommendation */
  recommendation: z.string().max(400),

  /** Which analysis dimension this growth area belongs to */
  dimension: DimensionNameEnumSchema,

  // ─────────────────────────────────────────────────────────────────────────
  // Quantification Fields
  // ─────────────────────────────────────────────────────────────────────────

  /** Percentage of sessions where this pattern was observed (0-100) */
  frequency: z.number().min(0).max(100).optional(),

  /** How critical this growth area is to address */
  severity: GrowthSeveritySchema.optional(),

  /** Computed priority based on frequency × impact (0-100) */
  priorityScore: z.number().min(0).max(100).optional(),

  /** Confidence in this assessment (0-1) */
  confidence: z.number().min(0).max(1).optional(),
});
export type GrowthAreaInsight = z.infer<typeof GrowthAreaInsightSchema>;

// ============================================================================
// Complete StrengthGrowth Output Schema
// ============================================================================

/**
 * Complete output from StrengthGrowthWorker.
 *
 * Target volume:
 * - 5-7 strengths with 3-5 quotes each
 * - 5-7 growth areas with 2-4 quotes each
 *
 * This creates a rich, evidence-backed assessment.
 */
export const StrengthGrowthOutputSchema = z.object({
  /** Identified strengths (target: 5-7) */
  strengths: z.array(StrengthInsightSchema),

  /** Identified growth areas (target: 5-7) */
  growthAreas: z.array(GrowthAreaInsightSchema),

  /** Summary of overall strength/growth balance */
  summary: z.string().max(500).optional(),

  /** Overall confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Total developer utterances analyzed */
  utterancesAnalyzed: z.number().int().min(0).optional(),

  /** Warnings or notes about the analysis */
  warnings: z.array(z.string()).optional(),

  /** Personalized priorities: "dimension|focusArea|rationale|impact|score;..." */
  personalizedPrioritiesData: z.string().max(3000).optional(),

  /** Absence-based growth signals (things the developer should do but doesn't) */
  absenceBasedSignalsData: z.string().max(3000).optional(),
});
export type StrengthGrowthOutput = z.infer<typeof StrengthGrowthOutputSchema>;

// ============================================================================
// Flattened Schema for Gemini API (Max Nesting Depth ~4)
// ============================================================================

/**
 * Flattened StrengthGrowth output for Gemini API.
 *
 * Uses semicolon-separated strings for evidence to reduce nesting:
 * - strengthsData: "title|description|dimension|utteranceId:quote:context,utteranceId:quote:context;..."
 * - growthAreasData: "title|description|dimension|recommendation|frequency|severity|priority|evidence;..."
 */
export const StrengthGrowthLLMOutputSchema = z.object({
  /** Strengths as flattened string */
  strengthsData: z.string().max(8000)
    .describe('Strengths: "title|description|dimension|developmentTip|evidenceId:quote:context,evidenceId:quote:context;..." (target: 5-7)'),

  /** Growth areas as flattened string */
  growthAreasData: z.string().max(8000)
    .describe('Growth areas: "title|description|dimension|recommendation|frequency|severity|priority|evidenceId:quote:context,evidenceId:quote:context;..." (target: 5-7)'),

  /** Summary */
  summary: z.string().max(500).optional(),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Personalized priorities: "dimension|focusArea|rationale|impact|score;..." */
  personalizedPrioritiesData: z.string().max(3000).optional()
    .describe('Personalized priorities: "dimension|focusArea|rationale|impact|score;..."'),

  /** Absence-based growth signals: "signal|description|recommendation;..." */
  absenceBasedSignalsData: z.string().max(3000).optional()
    .describe('Absence-based signals: "signal|description|recommendation;..."'),
});
export type StrengthGrowthLLMOutput = z.infer<typeof StrengthGrowthLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse evidence string into structured array
 * Format: "utteranceId:quote:context,utteranceId:quote:context"
 */
export function parseEvidenceData(data: string | undefined): InsightEvidence[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(':');
      return {
        utteranceId: parts[0]?.trim() || '',
        quote: parts[1]?.trim() || '',
        context: parts.slice(2).join(':').trim() || '',
      };
    })
    .filter((e) => e.utteranceId && e.quote);
}

/**
 * Parse strengthsData string into structured array
 * Format: "title|description|dimension|developmentTip|evidence;..."
 */
export function parseStrengthsLLMData(data: string | undefined): StrengthInsight[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const dimension = parts[2]?.trim() || 'aiCollaboration';
      const developmentTip = parts[3]?.trim() || undefined;
      const evidenceStr = parts[4]?.trim() || '';

      return {
        title,
        description,
        dimension: dimension as StrengthInsight['dimension'],
        developmentTip,
        evidence: parseEvidenceData(evidenceStr),
      };
    })
    .filter((s) => s.title && s.description);
}

/**
 * Parse growthAreasData string into structured array
 * Format: "title|description|dimension|recommendation|frequency|severity|priority|evidence;..."
 */
export function parseGrowthAreasLLMData(data: string | undefined): GrowthAreaInsight[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const dimension = parts[2]?.trim() || 'aiCollaboration';
      const recommendation = parts[3]?.trim() || '';
      const frequency = parts[4] ? parseFloat(parts[4]) : undefined;
      const severity = parts[5]?.trim() as GrowthSeverity | undefined;
      const priority = parts[6] ? parseFloat(parts[6]) : undefined;
      const evidenceStr = parts[7]?.trim() || '';

      const result: GrowthAreaInsight = {
        title,
        description,
        dimension: dimension as GrowthAreaInsight['dimension'],
        recommendation,
        evidence: parseEvidenceData(evidenceStr),
      };

      if (frequency !== undefined && !isNaN(frequency)) result.frequency = frequency;
      if (severity && ['critical', 'high', 'medium', 'low'].includes(severity)) result.severity = severity;
      if (priority !== undefined && !isNaN(priority)) result.priorityScore = priority;

      return result;
    })
    .filter((g) => g.title && g.description);
}

/**
 * Convert LLM output to structured StrengthGrowthOutput
 */
export function parseStrengthGrowthLLMOutput(llmOutput: StrengthGrowthLLMOutput): StrengthGrowthOutput {
  return {
    strengths: parseStrengthsLLMData(llmOutput.strengthsData),
    growthAreas: parseGrowthAreasLLMData(llmOutput.growthAreasData),
    summary: llmOutput.summary,
    confidenceScore: llmOutput.confidenceScore,
    personalizedPrioritiesData: llmOutput.personalizedPrioritiesData,
    absenceBasedSignalsData: llmOutput.absenceBasedSignalsData,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty StrengthGrowth output for fallback cases
 */
export function createEmptyStrengthGrowthOutput(): StrengthGrowthOutput {
  return {
    strengths: [],
    growthAreas: [],
    confidenceScore: 0,
    warnings: ['Empty output - insufficient data for analysis'],
  };
}
