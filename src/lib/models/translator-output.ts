/**
 * Translator Output Schema - Lightweight Translation-Only Fields
 *
 * Phase 4 Translator produces this schema containing ONLY translatable text fields.
 * Structural/numeric fields (primaryType, controlLevel, scores, distributions)
 * remain from the English ContentWriter output and are NOT included here.
 *
 * This schema is kept flat to comply with Gemini API's nesting depth limit (~4 levels).
 *
 * @module models/translator-output
 */

import { z } from 'zod';
import { DimensionNameEnumSchema } from './dimension-schema';

// ============================================================================
// Translated Dimension Insight (text fields only)
// ============================================================================

/**
 * Translated dimension insight — text fields only
 *
 * Uses the same flattened pipe/semicolon format as the ContentWriter output,
 * but with translated text. ClusterIds are preserved as-is (not translated).
 *
 * Format:
 * - strengthsData: "clusterId|translatedTitle|translatedDescription;..."
 * - growthAreasData: "clusterId|translatedTitle|translatedDesc|translatedRec|frequency|severity|priorityScore;..."
 */
const TranslatedDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().describe('Translated human-readable dimension name'),
  /** Translated strengths: "clusterId|title|description;..." */
  strengthsData: z.string().optional()
    .describe('Translated strengths as "clusterId|title|description;..." — keep clusterId in English'),
  /** Translated growth areas: "clusterId|title|desc|rec|freq|severity|priority;..." */
  growthAreasData: z.string().optional()
    .describe('Translated growth areas — keep clusterId, freq, severity, priority in English'),
});

// ============================================================================
// Translated Prompt Pattern (text fields only)
// ============================================================================

const TranslatedPromptPatternSchema = z.object({
  patternName: z.string().describe('Translated pattern name'),
  description: z.string().describe('Translated pattern description'),
  /** Translated examples: "quote|translatedAnalysis;..." — quotes stay in original language */
  examplesData: z.string().optional()
    .describe('Examples as "originalQuote|translatedAnalysis;..." — do NOT translate quotes'),
  tip: z.string().optional().describe('Translated coaching tip'),
});

// ============================================================================
// Translated Top Focus Area (text fields only)
// ============================================================================

const TranslatedTopFocusAreaSchema = z.object({
  rank: z.number().min(1).max(3),
  title: z.string().describe('Translated focus area title'),
  narrative: z.string().describe('Translated narrative'),
  expectedImpact: z.string().describe('Translated expected impact'),
  /** Translated actions: "translatedStart|translatedStop|translatedContinue" */
  actionsData: z.string().optional()
    .describe('Translated actions as "start|stop|continue" format'),
});

// ============================================================================
// Translated Highlight Item (shared by criticalThinking + planning)
// ============================================================================

const TranslatedHighlightItemSchema = z.object({
  displayName: z.string().describe('Translated display name'),
  description: z.string().describe('Translated description'),
  tip: z.string().optional().describe('Translated tip'),
});

/**
 * Translated analysis section with strengths/opportunities/summary.
 * Shared by criticalThinkingAnalysis and planningAnalysis.
 */
const TranslatedAnalysisSectionSchema = z.object({
  strengths: z.array(TranslatedHighlightItemSchema),
  opportunities: z.array(TranslatedHighlightItemSchema),
  summary: z.string().describe('Translated summary'),
});

// ============================================================================
// Translated Agent Insight (for Phase 2 agent outputs)
// ============================================================================

const TranslatedAgentInsightEntrySchema = z.object({
  /** Strengths as "translatedTitle|translatedDescription|originalQuotes;..." */
  strengthsData: z.string().optional()
    .describe('Translated strengths — keep evidence quotes in original language'),
  /** Growth areas as "translatedTitle|translatedDesc|originalEvidence|translatedRec|freq|severity|priority;..." */
  growthAreasData: z.string().optional()
    .describe('Translated growth areas — keep evidence in original language'),
});

// ============================================================================
// Main Translator Output Schema
// ============================================================================

/**
 * TranslatorOutputSchema — contains ONLY translatable text fields
 *
 * The orchestrator merges these translated fields into the English ContentWriter
 * response, preserving all structural/numeric fields from the English version.
 */
export const TranslatorOutputSchema = z.object({
  /** Translated personality summary (no max - may exceed 3000 when translated) */
  personalitySummary: z.string()
    .describe('Translated personality summary — keep **bold markers** and technical terms in English'),

  /** Translated dimension insights (6 items) */
  dimensionInsights: z.array(TranslatedDimensionInsightSchema)
    .length(6)
    .describe('Translated insights for each dimension'),

  /** Translated prompt patterns */
  promptPatterns: z.array(TranslatedPromptPatternSchema)
    .describe('Translated prompt patterns — keep quotes in original language'),

  /** Translated top focus areas */
  topFocusAreas: z.object({
    areas: z.array(TranslatedTopFocusAreaSchema).max(3),
    summary: z.string().describe('Translated summary'),
  }).optional(),

  /** Translated anti-patterns analysis text fields */
  antiPatternsAnalysis: z.object({
    detected: z.array(z.object({
      antiPatternType: z.string().describe('Keep in English'),
      displayName: z.string().describe('Translated display name'),
      description: z.string().describe('Translated description'),
      growthOpportunity: z.string().describe('Translated growth opportunity'),
      actionableTip: z.string().describe('Translated tip'),
    })),
    summary: z.string().describe('Translated summary'),
  }).optional(),

  /** Translated critical thinking analysis text fields */
  criticalThinkingAnalysis: TranslatedAnalysisSectionSchema.optional(),

  /** Translated planning analysis text fields */
  planningAnalysis: TranslatedAnalysisSectionSchema.optional(),

  /** Translated agent insights (Phase 2 worker outputs) */
  translatedAgentInsights: z.object({
    patternDetective: TranslatedAgentInsightEntrySchema.optional(),
    metacognition: TranslatedAgentInsightEntrySchema.optional(),
    antiPatternSpotter: TranslatedAgentInsightEntrySchema.optional(),
    knowledgeGap: TranslatedAgentInsightEntrySchema.optional(),
    contextEfficiency: TranslatedAgentInsightEntrySchema.optional(),
    temporalAnalysis: TranslatedAgentInsightEntrySchema.optional(),
    multitasking: TranslatedAgentInsightEntrySchema.optional(),
    strengthGrowth: TranslatedAgentInsightEntrySchema.optional(),
    trustVerification: TranslatedAgentInsightEntrySchema.optional(),
    workflowHabit: TranslatedAgentInsightEntrySchema.optional(),
  }).optional().describe('Translated Phase 2 agent insights — keep evidence quotes in original language'),

  /** Translated premium section text fields */
  toolUsageDeepDive: z.string().optional()
    .describe('Translated tool usage deep dive narrative'),
  tokenEfficiency: z.string().optional()
    .describe('Translated token efficiency narrative'),
  growthRoadmap: z.string().optional()
    .describe('Translated growth roadmap narrative'),
  comparativeInsights: z.string().optional()
    .describe('Translated comparative insights narrative'),
  sessionTrends: z.string().optional()
    .describe('Translated session trends narrative'),

  /** Translated actionable practices text fields */
  actionablePractices: z.object({
    practiced: z.array(z.object({
      patternId: z.string().describe('Keep in English'),
      feedback: z.string().describe('Translated feedback'),
    })),
    opportunities: z.array(z.object({
      patternId: z.string().describe('Keep in English'),
      tip: z.string().describe('Translated tip'),
    })),
    summary: z.string().describe('Translated summary'),
  }).optional(),
});

export type TranslatorOutput = z.infer<typeof TranslatorOutputSchema>;
