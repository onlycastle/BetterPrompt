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

// ============================================================================
// Translated Prompt Pattern (text fields only)
// ============================================================================

const TranslatedPromptPatternSchema = z.object({
  patternName: z.string().describe('Translated pattern name'),
  description: z.string().describe('Translated pattern description'),
  /** Translated examples — keep quotes in original language, translate only analysis */
  examples: z.array(z.object({
    quote: z.string().describe('Original quote — do NOT translate, keep in original language'),
    analysis: z.string().describe('Translated analysis text'),
  })).optional().describe('Translated examples — keep quotes in original language, translate only analysis'),
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
  /** Translated action steps as structured object */
  actions: z.object({
    start: z.string().describe('Translated START action'),
    stop: z.string().describe('Translated STOP action'),
    continue: z.string().describe('Translated CONTINUE action'),
  }).optional().describe('Translated action steps'),
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

/**
 * Translated worker strength — structured JSON (replaces pipe-delimited string)
 *
 * Gemini Nesting Depth (4-level limit, arrays don't count):
 * TranslatorOutput{L1} → translatedAgentInsights{L2} → thinkingQuality{L3} → strengths[] → {title, description}{L4}
 */
const TranslatedWorkerStrengthSchema = z.object({
  title: z.string().describe('Translated strength title'),
  description: z.string().describe('Translated strength description'),
});

/**
 * Translated worker growth area — structured JSON (replaces pipe-delimited string)
 */
const TranslatedWorkerGrowthSchema = z.object({
  title: z.string().describe('Translated growth area title'),
  description: z.string().describe('Translated growth area description'),
  recommendation: z.string().describe('Translated recommendation'),
});

export type TranslatedWorkerStrength = z.infer<typeof TranslatedWorkerStrengthSchema>;
export type TranslatedWorkerGrowth = z.infer<typeof TranslatedWorkerGrowthSchema>;

const TranslatedAgentInsightEntrySchema = z.object({
  /** Translated strengths — same order and count as input */
  strengths: z.array(TranslatedWorkerStrengthSchema)
    .describe('Translated strengths — same order as input, same count'),
  /** Translated growth areas — same order and count as input */
  growthAreas: z.array(TranslatedWorkerGrowthSchema)
    .describe('Translated growth areas — same order as input, same count'),
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
    // v3.1 Workers (primary - 4 workers)
    thinkingQuality: TranslatedAgentInsightEntrySchema.optional(),
    communicationPatterns: TranslatedAgentInsightEntrySchema.optional(),
    learningBehavior: TranslatedAgentInsightEntrySchema.optional(),
    contextEfficiency: TranslatedAgentInsightEntrySchema.optional(),
    // v2 Legacy Workers (backward compatibility)
    patternDetective: TranslatedAgentInsightEntrySchema.optional(),
    metacognition: TranslatedAgentInsightEntrySchema.optional(),
    antiPatternSpotter: TranslatedAgentInsightEntrySchema.optional(),
    knowledgeGap: TranslatedAgentInsightEntrySchema.optional(),
    temporalAnalysis: TranslatedAgentInsightEntrySchema.optional(),
    multitasking: TranslatedAgentInsightEntrySchema.optional(),
  }).optional().describe('Translated Phase 2 worker insights — v3.1 uses thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency'),

  /** Translated project summaries (Phase 2 ProjectSummarizer output) */
  projectSummaries: z.array(z.object({
    projectName: z.string().describe('Keep project name in English'),
    summaryLines: z.array(z.string()).describe('Translated summary lines'),
  })).optional().describe('Translated project summaries — keep project names in English'),

  /** Translated weekly insights text fields (narrative + highlights + top session summaries) */
  weeklyInsights: z.object({
    narrative: z.string().describe('Translated 2-3 sentence weekly summary'),
    highlights: z.array(z.string()).describe('Translated highlight bullet points'),
    topSessionSummaries: z.array(z.string()).optional()
      .describe('Translated 1-line session summaries'),
  }).optional().describe('Translated weekly insights — keep project names and technical terms in English'),

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
