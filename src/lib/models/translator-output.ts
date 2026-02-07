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

/**
 * Flat version of TranslatedTopFocusAreaSchema for LLM schema
 * Inlines actions as strings to reduce nesting from 4 → 3 levels
 */
const FlatTranslatedTopFocusAreaSchema = z.object({
  rank: z.number().min(1).max(3),
  title: z.string().describe('Translated focus area title'),
  narrative: z.string().describe('Translated narrative'),
  expectedImpact: z.string().describe('Translated expected impact'),
  actionStart: z.string().optional().describe('Translated START action'),
  actionStop: z.string().optional().describe('Translated STOP action'),
  actionContinue: z.string().optional().describe('Translated CONTINUE action'),
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
    // v3.1 Workers (primary - 5 workers)
    thinkingQuality: TranslatedAgentInsightEntrySchema.optional(),
    communicationPatterns: TranslatedAgentInsightEntrySchema.optional(),
    learningBehavior: TranslatedAgentInsightEntrySchema.optional(),
    contextEfficiency: TranslatedAgentInsightEntrySchema.optional(),
    sessionOutcome: TranslatedAgentInsightEntrySchema.optional(),
    // v2 Legacy Workers (backward compatibility)
    patternDetective: TranslatedAgentInsightEntrySchema.optional(),
    metacognition: TranslatedAgentInsightEntrySchema.optional(),
    antiPatternSpotter: TranslatedAgentInsightEntrySchema.optional(),
    knowledgeGap: TranslatedAgentInsightEntrySchema.optional(),
    temporalAnalysis: TranslatedAgentInsightEntrySchema.optional(),
    multitasking: TranslatedAgentInsightEntrySchema.optional(),
  }).optional().describe('Translated Phase 2 worker insights — v3.1 uses thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome'),

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

// ============================================================================
// Flat LLM Schema for Gemini API (max 3 levels of nesting)
// ============================================================================

/**
 * TranslatorLLMOutputSchema — flattened version of TranslatorOutputSchema for Gemini API
 *
 * The nested `translatedAgentInsights.thinkingQuality.strengths[]` path creates 4 levels
 * of object nesting which exceeds Gemini's limit. This schema flattens worker insights
 * to camelCase keys (e.g., `thinkingQualityStrengths`) reducing depth to 3 levels.
 *
 * Max depth: root{L1} → translatedAgentInsights{L2} → thinkingQualityStrengths[] → {title, desc}{L3} = 3 levels
 *
 * After Gemini returns this flat structure, use reshapeTranslatorLLMOutput() to convert
 * back to the nested TranslatorOutput expected by downstream code.
 */
export const TranslatorLLMOutputSchema = z.object({
  personalitySummary: z.string()
    .describe('Translated personality summary — keep **bold markers** and technical terms in English'),

  promptPatterns: z.array(TranslatedPromptPatternSchema)
    .describe('Translated prompt patterns — keep quotes in original language'),

  topFocusAreas: z.object({
    areas: z.array(FlatTranslatedTopFocusAreaSchema).max(3),
    summary: z.string().describe('Translated summary'),
  }).optional(),

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

  criticalThinkingAnalysis: TranslatedAnalysisSectionSchema.optional(),
  planningAnalysis: TranslatedAnalysisSectionSchema.optional(),

  /** Flattened agent insights — each worker's strengths/growthAreas as top-level arrays */
  translatedAgentInsights: z.object({
    // v3.1 Workers (primary - 5 workers) — flattened
    thinkingQualityStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    thinkingQualityGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    communicationPatternsStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    communicationPatternsGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    learningBehaviorStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    learningBehaviorGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    contextEfficiencyStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    contextEfficiencyGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    sessionOutcomeStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    sessionOutcomeGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    // v2 Legacy Workers — flattened
    patternDetectiveStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    patternDetectiveGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    metacognitionStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    metacognitionGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    antiPatternSpotterStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    antiPatternSpotterGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    knowledgeGapStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    knowledgeGapGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    temporalAnalysisStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    temporalAnalysisGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
    multitaskingStrengths: z.array(TranslatedWorkerStrengthSchema).optional(),
    multitaskingGrowthAreas: z.array(TranslatedWorkerGrowthSchema).optional(),
  }).optional().describe('Flattened Phase 2 worker insights — keys are workerNameStrengths/workerNameGrowthAreas. v3.1 workers: thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome'),

  projectSummaries: z.array(z.object({
    projectName: z.string().describe('Keep project name in English'),
    summaryLines: z.array(z.string()).describe('Translated summary lines'),
  })).optional().describe('Translated project summaries — keep project names in English'),

  weeklyInsights: z.object({
    narrative: z.string().describe('Translated 2-3 sentence weekly summary'),
    highlights: z.array(z.string()).describe('Translated highlight bullet points'),
    topSessionSummaries: z.array(z.string()).optional()
      .describe('Translated 1-line session summaries'),
  }).optional().describe('Translated weekly insights — keep project names and technical terms in English'),

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

export type TranslatorLLMOutput = z.infer<typeof TranslatorLLMOutputSchema>;

// ============================================================================
// Reshape: Flat LLM output → Nested TranslatorOutput
// ============================================================================

/** Worker keys used in translatedAgentInsights */
const WORKER_KEYS = [
  'thinkingQuality', 'communicationPatterns', 'learningBehavior', 'contextEfficiency', 'sessionOutcome',
  'patternDetective', 'metacognition', 'antiPatternSpotter', 'knowledgeGap',
  'temporalAnalysis', 'multitasking',
] as const;

/**
 * Reshape flat LLM output back to nested TranslatorOutput structure.
 *
 * Performs two transformations:
 * 1. Agent insights: `{ thinkingQualityStrengths, thinkingQualityGrowthAreas }`
 *    → `{ thinkingQuality: { strengths, growthAreas } }`
 * 2. Focus area actions: `{ actionStart, actionStop, actionContinue }`
 *    → `{ actions: { start, stop, continue } }`
 */
export function reshapeTranslatorLLMOutput(llm: TranslatorLLMOutput): TranslatorOutput {
  const flatInsights = llm.translatedAgentInsights;

  let nestedInsights: TranslatorOutput['translatedAgentInsights'];
  if (flatInsights) {
    const result: Record<string, { strengths: TranslatedWorkerStrength[]; growthAreas: TranslatedWorkerGrowth[] }> = {};

    for (const key of WORKER_KEYS) {
      const strengths = (flatInsights as Record<string, unknown>)[`${key}Strengths`] as TranslatedWorkerStrength[] | undefined;
      const growthAreas = (flatInsights as Record<string, unknown>)[`${key}GrowthAreas`] as TranslatedWorkerGrowth[] | undefined;

      if (strengths || growthAreas) {
        result[key] = {
          strengths: strengths ?? [],
          growthAreas: growthAreas ?? [],
        };
      }
    }

    nestedInsights = Object.keys(result).length > 0 ? result as TranslatorOutput['translatedAgentInsights'] : undefined;
  }

  // Reshape flat topFocusAreas actions (actionStart/Stop/Continue → actions object)
  let nestedTopFocusAreas: TranslatorOutput['topFocusAreas'];
  if (llm.topFocusAreas) {
    nestedTopFocusAreas = {
      summary: llm.topFocusAreas.summary,
      areas: llm.topFocusAreas.areas.map(area => ({
        rank: area.rank,
        title: area.title,
        narrative: area.narrative,
        expectedImpact: area.expectedImpact,
        actions: (area.actionStart || area.actionStop || area.actionContinue)
          ? { start: area.actionStart ?? '', stop: area.actionStop ?? '', continue: area.actionContinue ?? '' }
          : undefined,
      })),
    };
  }

  return {
    ...llm,
    translatedAgentInsights: nestedInsights,
    topFocusAreas: nestedTopFocusAreas,
  };
}
