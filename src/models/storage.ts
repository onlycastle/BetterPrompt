import { z } from 'zod';
import { EvaluationSchema } from './evaluation.js';

/**
 * Stored analysis schema - persisted evaluation with metadata
 */
export const StoredAnalysisSchema = z.object({
  version: z.literal('1.0.0'),
  createdAt: z.string().datetime(),

  evaluation: EvaluationSchema,

  metadata: z.object({
    projectPath: z.string(),
    projectName: z.string(),
    durationSeconds: z.number(),
    messageCount: z.number(),
    toolCallCount: z.number(),
    claudeCodeVersion: z.string(),
    /** SHA-256 hash of source JSONL file for cache invalidation */
    sourceHash: z.string().optional(),
  }),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;

/**
 * Analysis summary for listing - lightweight representation
 */
export interface AnalysisSummary {
  sessionId: string;
  projectName: string;
  analyzedAt: Date;
  ratings: {
    planning: string;
    criticalThinking: string;
    codeUnderstanding: string;
  };
  filePath: string;
}
