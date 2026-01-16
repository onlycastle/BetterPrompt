/**
 * Job Domain Models
 *
 * Zod schemas for async job processing and background tasks.
 * Single source of truth for job-related types.
 *
 * @module domain/models/job
 */

import { z } from 'zod';

// ============================================================================
// Job Types & Status
// ============================================================================

/**
 * Job types for async processing
 */
export const JobTypeSchema = z.enum([
  'youtube_transcript',   // Process YouTube video/playlist
  'knowledge_learn',      // Run full learning pipeline
  'bulk_analysis',        // Analyze multiple sessions
  'influencer_discover',  // Discover influencers from content
  'knowledge_sync',       // Sync knowledge to/from cloud
  'report_generate',      // Generate detailed report
]);
export type JobType = z.infer<typeof JobTypeSchema>;

/**
 * Job status
 */
export const JobStatusSchema = z.enum([
  'pending',      // Queued, waiting to be picked up
  'processing',   // Currently being processed
  'completed',    // Successfully completed
  'failed',       // Failed with error
  'cancelled',    // Cancelled by user
  'retrying',     // Failed but will retry
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * Job priority levels
 */
export const JobPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type JobPriority = z.infer<typeof JobPrioritySchema>;

// ============================================================================
// Job Payload Schemas
// ============================================================================

/**
 * YouTube transcript job payload
 */
export const YouTubeTranscriptPayloadSchema = z.object({
  type: z.literal('youtube_transcript'),
  url: z.string().url(),
  playlistMode: z.boolean().default(false),
  maxVideos: z.number().optional(),
});
export type YouTubeTranscriptPayload = z.infer<typeof YouTubeTranscriptPayloadSchema>;

/**
 * Knowledge learn job payload
 */
export const KnowledgeLearnPayloadSchema = z.object({
  type: z.literal('knowledge_learn'),
  query: z.string(),
  topics: z.array(z.string()).optional(),
  maxItems: z.number().default(10),
});
export type KnowledgeLearnPayload = z.infer<typeof KnowledgeLearnPayloadSchema>;

/**
 * Bulk analysis job payload
 */
export const BulkAnalysisPayloadSchema = z.object({
  type: z.literal('bulk_analysis'),
  sessionIds: z.array(z.string().uuid()),
  options: z.object({
    includeTypeDetection: z.boolean().default(true),
    includeDimensions: z.boolean().default(true),
  }).optional(),
});
export type BulkAnalysisPayload = z.infer<typeof BulkAnalysisPayloadSchema>;

/**
 * Influencer discover job payload
 */
export const InfluencerDiscoverPayloadSchema = z.object({
  type: z.literal('influencer_discover'),
  topic: z.string(),
  platforms: z.array(z.string()).optional(),
  maxResults: z.number().default(20),
});
export type InfluencerDiscoverPayload = z.infer<typeof InfluencerDiscoverPayloadSchema>;

/**
 * Knowledge sync job payload
 */
export const KnowledgeSyncPayloadSchema = z.object({
  type: z.literal('knowledge_sync'),
  direction: z.enum(['push', 'pull', 'both']),
  since: z.string().datetime().optional(),
});
export type KnowledgeSyncPayload = z.infer<typeof KnowledgeSyncPayloadSchema>;

/**
 * Report generate job payload
 */
export const ReportGeneratePayloadSchema = z.object({
  type: z.literal('report_generate'),
  analysisId: z.string().uuid(),
  format: z.enum(['html', 'pdf', 'json']).default('html'),
  includeRecommendations: z.boolean().default(true),
});
export type ReportGeneratePayload = z.infer<typeof ReportGeneratePayloadSchema>;

/**
 * Union of all job payloads
 */
export const JobPayloadSchema = z.discriminatedUnion('type', [
  YouTubeTranscriptPayloadSchema,
  KnowledgeLearnPayloadSchema,
  BulkAnalysisPayloadSchema,
  InfluencerDiscoverPayloadSchema,
  KnowledgeSyncPayloadSchema,
  ReportGeneratePayloadSchema,
]);
export type JobPayload = z.infer<typeof JobPayloadSchema>;

// ============================================================================
// Job Result Schemas
// ============================================================================

/**
 * Generic job result wrapper
 */
export const JobResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  metrics: z.object({
    itemsProcessed: z.number().optional(),
    itemsSucceeded: z.number().optional(),
    itemsFailed: z.number().optional(),
    durationMs: z.number().optional(),
  }).optional(),
});
export type JobResult = z.infer<typeof JobResultSchema>;

// ============================================================================
// Job Schema
// ============================================================================

/**
 * Job schema - represents an async task
 */
export const JobSchema = z.object({
  id: z.string().uuid(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  priority: JobPrioritySchema.default('normal'),

  // Payload (type-specific input)
  payload: JobPayloadSchema,

  // Result (populated on completion)
  result: JobResultSchema.optional(),

  // Progress tracking
  progress: z.object({
    current: z.number().default(0),
    total: z.number().optional(),
    message: z.string().optional(),
  }).optional(),

  // Retry configuration
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),

  // Timestamps
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),

  // User association
  userId: z.string().uuid().optional(),

  // Error info (for failed jobs)
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),
});
export type Job = z.infer<typeof JobSchema>;

/**
 * Job creation input
 */
export const CreateJobInputSchema = z.object({
  type: JobTypeSchema,
  payload: JobPayloadSchema,
  priority: JobPrioritySchema.optional(),
  userId: z.string().uuid().optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

/**
 * Job status response (for API)
 */
export const JobStatusResponseSchema = z.object({
  id: z.string().uuid(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  progress: z.object({
    current: z.number(),
    total: z.number().optional(),
    percentage: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
  result: JobResultSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if job is in a terminal state
 */
export function isJobTerminal(status: JobStatus): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status);
}

/**
 * Check if job can be retried
 */
export function canRetryJob(job: Job): boolean {
  return job.status === 'failed' && job.retryCount < job.maxRetries;
}

/**
 * Calculate job progress percentage
 */
export function getJobProgressPercentage(job: Job): number | null {
  if (!job.progress?.total) return null;
  return Math.round((job.progress.current / job.progress.total) * 100);
}

/**
 * Get estimated time remaining (simple heuristic)
 */
export function getEstimatedTimeRemaining(job: Job): number | null {
  if (!job.progress?.total || !job.startedAt) return null;
  if (job.progress.current === 0) return null;

  const elapsed = Date.now() - new Date(job.startedAt).getTime();
  const perItem = elapsed / job.progress.current;
  const remaining = job.progress.total - job.progress.current;

  return Math.round(perItem * remaining);
}
