/**
 * Canonical Analysis Run Envelope
 *
 * Shared run-scoped contract for plugin-produced analyses.
 * This keeps the full deterministic + staged pipeline output together so
 * local reports and server sync can consume the same artifact without
 * fabricating or dropping fields.
 *
 * @module @betterprompt/shared/schemas/analysis-run
 */

import { z } from 'zod';
import {
  Phase1OutputSchema,
  type Phase1Output,
} from './phase1-output.js';
import {
  DeterministicScoresSchema,
  type DeterministicScores,
  DeterministicTypeResultSchema,
  type DeterministicTypeResult,
} from './deterministic-scores.js';
import {
  DomainResultSchema,
  type DomainResult,
} from './domain-result.js';
import {
  SessionSummaryBatchSchema,
  ProjectSummaryBatchSchema,
  WeeklyInsightsSchema,
  TypeClassificationStageOutputSchema,
  EvidenceVerificationOutputSchema,
  ContentWriterOutputSchema,
  TranslatorOutputSchema,
} from './stage-outputs.js';

/**
 * Report-facing activity session shape.
 * Normalized to minutes because this is what the dashboard and local report use.
 */
export const ReportActivitySessionSchema = z.object({
  sessionId: z.string(),
  projectName: z.string(),
  startTime: z.string(),
  durationMinutes: z.number().min(0),
  messageCount: z.number().int().min(0),
  summary: z.string(),
  totalInputTokens: z.number().int().min(0).optional(),
  totalOutputTokens: z.number().int().min(0).optional(),
});
export type ReportActivitySession = z.infer<typeof ReportActivitySessionSchema>;

export const CanonicalStageOutputsSchema = z.object({
  sessionSummaries: SessionSummaryBatchSchema.optional(),
  projectSummaries: ProjectSummaryBatchSchema.optional(),
  weeklyInsights: WeeklyInsightsSchema.optional(),
  typeClassification: TypeClassificationStageOutputSchema.optional(),
  evidenceVerification: EvidenceVerificationOutputSchema.optional(),
  contentWriter: ContentWriterOutputSchema.optional(),
  translator: TranslatorOutputSchema.optional(),
});
export type CanonicalStageOutputs = z.infer<typeof CanonicalStageOutputsSchema>;

/**
 * Final evaluation is produced by the server-side schema today, but the plugin
 * package cannot depend on that app-local module. Keep the envelope strict about
 * run-scoped artifacts while allowing the evaluation payload to remain an
 * opaque structured object across package boundaries.
 */
export const CanonicalEvaluationPayloadSchema = z.record(z.string(), z.unknown());
export type CanonicalEvaluationPayload = z.infer<typeof CanonicalEvaluationPayloadSchema>;

export const CanonicalAnalysisRunSchema = z.object({
  runId: z.number().int().min(1),
  analyzedAt: z.string(),
  phase1Output: Phase1OutputSchema,
  activitySessions: z.array(ReportActivitySessionSchema),
  deterministicScores: DeterministicScoresSchema,
  typeResult: DeterministicTypeResultSchema.nullable(),
  domainResults: z.array(DomainResultSchema),
  stageOutputs: CanonicalStageOutputsSchema,
  evaluation: CanonicalEvaluationPayloadSchema,
  translation: TranslatorOutputSchema.optional(),
  debug: z.record(z.string(), z.unknown()).optional(),
});
export type CanonicalAnalysisRun = z.infer<typeof CanonicalAnalysisRunSchema>;

export interface CanonicalAnalysisRunParts {
  runId: number;
  analyzedAt: string;
  phase1Output: Phase1Output;
  activitySessions: ReportActivitySession[];
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
}
