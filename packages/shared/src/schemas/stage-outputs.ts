/**
 * Stage Output Schemas
 *
 * Schemas for non-worker pipeline stages that don't exist in the plugin yet:
 * - Session Summarizer (Phase 1.5)
 * - Project Summarizer (Phase 2, parallel)
 * - Weekly Insight Generator (Phase 2, parallel)
 * - Evidence Verifier (Phase 2.8)
 * - Content Writer (Phase 3)
 * - Translator (Phase 4)
 *
 * @module @betterprompt/shared/schemas/stage-outputs
 */

import { z } from 'zod';

// ============================================================================
// Session Summarizer (Phase 1.5)
// ============================================================================

export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  summary: z.string(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionSummaryBatchSchema = z.object({
  summaries: z.array(SessionSummarySchema),
});
export type SessionSummaryBatch = z.infer<typeof SessionSummaryBatchSchema>;

// ============================================================================
// Project Summarizer (Phase 2)
// ============================================================================

export const ProjectSummarySchema = z.object({
  projectName: z.string(),
  summaryLines: z.array(z.string()),
  sessionCount: z.number().int().min(0),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectSummaryBatchSchema = z.object({
  projects: z.array(ProjectSummarySchema),
});
export type ProjectSummaryBatch = z.infer<typeof ProjectSummaryBatchSchema>;

// ============================================================================
// Weekly Insight Generator (Phase 2)
// ============================================================================

export const WeeklyProjectBreakdownSchema = z.object({
  projectName: z.string(),
  sessionCount: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});
export type WeeklyProjectBreakdown = z.infer<typeof WeeklyProjectBreakdownSchema>;

export const WeeklyTopSessionSchema = z.object({
  sessionId: z.string(),
  summary: z.string(),
});
export type WeeklyTopSession = z.infer<typeof WeeklyTopSessionSchema>;

export const WeeklyInsightsSchema = z.object({
  stats: z.object({
    sessionCount: z.number().int().min(0),
    totalMinutes: z.number().min(0),
    totalTokens: z.number().int().min(0),
    activeDays: z.number().int().min(0).max(7),
    deltaSessionCount: z.number().optional(),
    deltaMinutes: z.number().optional(),
    deltaTokens: z.number().optional(),
  }),
  projects: z.array(WeeklyProjectBreakdownSchema),
  topSessions: z.array(WeeklyTopSessionSchema),
  narrative: z.string(),
  highlights: z.array(z.string()),
});
export type WeeklyInsights = z.infer<typeof WeeklyInsightsSchema>;

// ============================================================================
// Evidence Verifier (Phase 2.8)
// ============================================================================

export const EvidenceVerificationResultSchema = z.object({
  utteranceId: z.string(),
  quote: z.string(),
  relevanceScore: z.number().min(0).max(100),
  verified: z.boolean(),
});
export type EvidenceVerificationResult = z.infer<typeof EvidenceVerificationResultSchema>;

export const DomainVerificationStatsSchema = z.object({
  domain: z.string(),
  totalEvidence: z.number().int().min(0),
  keptCount: z.number().int().min(0),
  filteredCount: z.number().int().min(0),
});
export type DomainVerificationStats = z.infer<typeof DomainVerificationStatsSchema>;

export const EvidenceVerificationOutputSchema = z.object({
  verifiedResults: z.array(EvidenceVerificationResultSchema),
  domainStats: z.array(DomainVerificationStatsSchema),
  threshold: z.number().min(0).max(100),
});
export type EvidenceVerificationOutput = z.infer<typeof EvidenceVerificationOutputSchema>;

// ============================================================================
// Content Writer (Phase 3)
// ============================================================================

export const TopFocusAreaSchema = z.object({
  title: z.string(),
  description: z.string(),
  relatedQualities: z.array(z.string()),
  actions: z.object({
    start: z.string(),
    stop: z.string(),
    continue: z.string(),
  }),
});
export type TopFocusArea = z.infer<typeof TopFocusAreaSchema>;

export const ContentWriterOutputSchema = z.object({
  topFocusAreas: z.array(TopFocusAreaSchema),
  personalitySummary: z.array(z.string()).optional(),
});
export type ContentWriterOutput = z.infer<typeof ContentWriterOutputSchema>;

export const TypeClassificationStageOutputSchema = z.object({
  reasoning: z.array(z.string()),
  personalityNarrative: z.array(z.string()),
  collaborationMaturity: z.string().optional(),
});
export type TypeClassificationStageOutput = z.infer<typeof TypeClassificationStageOutputSchema>;

// ============================================================================
// Translator (Phase 4)
// ============================================================================

export const TranslatorOutputSchema = z.object({
  targetLanguage: z.string(),
  translatedFields: z.record(z.string(), z.unknown()),
});
export type TranslatorOutput = z.infer<typeof TranslatorOutputSchema>;

// ============================================================================
// Stage Output Union (for save_stage_output tool validation)
// ============================================================================

export const STAGE_NAMES = [
  'sessionSummaries',
  'projectSummaries',
  'weeklyInsights',
  'typeClassification',
  'evidenceVerification',
  'contentWriter',
  'translator',
] as const;

export type StageName = typeof STAGE_NAMES[number];

/** Map of stage name to its validation schema */
export const STAGE_SCHEMAS: Record<StageName, z.ZodTypeAny> = {
  sessionSummaries: SessionSummaryBatchSchema,
  projectSummaries: ProjectSummaryBatchSchema,
  weeklyInsights: WeeklyInsightsSchema,
  typeClassification: TypeClassificationStageOutputSchema,
  evidenceVerification: EvidenceVerificationOutputSchema,
  contentWriter: ContentWriterOutputSchema,
  translator: TranslatorOutputSchema,
};
