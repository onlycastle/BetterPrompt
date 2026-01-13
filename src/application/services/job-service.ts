/**
 * Job Service
 *
 * Orchestrates async job processing.
 * Coordinates with job queue for long-running operations.
 *
 * @module application/services/job-service
 */

import { ok, err, type Result } from '../../lib/result.js';
import { JobError } from '../../domain/errors/index.js';
import type { IJobQueuePort, JobHandler } from '../ports/job-queue.js';
import type {
  Job,
  JobType,
  JobStatus,
  JobPayload,
  JobStatusResponse,
  CreateJobInput,
  JobPriority,
} from '../../domain/models/index.js';

/**
 * Job service dependencies
 */
export interface JobServiceDeps {
  jobQueue: IJobQueuePort;
}

/**
 * Job creation options
 */
export interface JobCreateOptions {
  priority?: JobPriority;
  delayMs?: number;
}

/**
 * Create Job Service
 */
export function createJobService(deps: JobServiceDeps) {
  const { jobQueue } = deps;

  return {
    /**
     * Create a YouTube transcript job
     */
    async createYouTubeJob(
      url: string,
      options?: JobCreateOptions & { maxVideos?: number }
    ): Promise<Result<Job, JobError>> {
      const input: CreateJobInput = {
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url,
          playlistMode: url.includes('playlist') || url.includes('list='),
          maxVideos: options?.maxVideos,
        },
        priority: options?.priority ?? 'normal',
      };

      return jobQueue.enqueue(input);
    },

    /**
     * Create a knowledge learning job
     */
    async createKnowledgeLearnJob(
      query: string,
      options?: JobCreateOptions & { topics?: string[]; maxItems?: number }
    ): Promise<Result<Job, JobError>> {
      const input: CreateJobInput = {
        type: 'knowledge_learn',
        payload: {
          type: 'knowledge_learn',
          query,
          topics: options?.topics,
          maxItems: options?.maxItems ?? 10,
        },
        priority: options?.priority ?? 'normal',
      };

      return jobQueue.enqueue(input);
    },

    /**
     * Create a bulk analysis job
     */
    async createBulkAnalysisJob(
      sessionIds: string[],
      options?: JobCreateOptions & { includeTypeDetection?: boolean; includeDimensions?: boolean }
    ): Promise<Result<Job, JobError>> {
      const input: CreateJobInput = {
        type: 'bulk_analysis',
        payload: {
          type: 'bulk_analysis',
          sessionIds,
          options: {
            includeTypeDetection: options?.includeTypeDetection ?? true,
            includeDimensions: options?.includeDimensions ?? true,
          },
        },
        priority: options?.priority ?? 'normal',
      };

      return jobQueue.enqueue(input);
    },

    /**
     * Create a report generation job
     */
    async createReportJob(
      analysisId: string,
      format: 'pdf' | 'html' | 'json',
      options?: JobCreateOptions & { includeRecommendations?: boolean }
    ): Promise<Result<Job, JobError>> {
      const input: CreateJobInput = {
        type: 'report_generate',
        payload: {
          type: 'report_generate',
          analysisId,
          format,
          includeRecommendations: options?.includeRecommendations ?? true,
        },
        priority: options?.priority ?? 'normal',
      };

      return jobQueue.enqueue(input);
    },

    /**
     * Create an influencer discovery job
     */
    async createInfluencerDiscoveryJob(
      topic: string,
      options?: JobCreateOptions & { platforms?: string[]; maxResults?: number }
    ): Promise<Result<Job, JobError>> {
      const input: CreateJobInput = {
        type: 'influencer_discover',
        payload: {
          type: 'influencer_discover',
          topic,
          platforms: options?.platforms,
          maxResults: options?.maxResults ?? 20,
        },
        priority: options?.priority ?? 'low',
      };

      return jobQueue.enqueue(input);
    },

    /**
     * Create multiple jobs in batch
     */
    async createBatch(inputs: CreateJobInput[]): Promise<Result<Job[], JobError>> {
      return jobQueue.enqueueBatch(inputs);
    },

    /**
     * Get job by ID
     */
    async getJob(jobId: string): Promise<Result<Job | null, JobError>> {
      return jobQueue.getJob(jobId);
    },

    /**
     * Get job status (simplified view)
     */
    async getStatus(jobId: string): Promise<Result<JobStatusResponse | null, JobError>> {
      return jobQueue.getStatus(jobId);
    },

    /**
     * Cancel a job
     */
    async cancel(jobId: string): Promise<Result<void, JobError>> {
      return jobQueue.cancel(jobId);
    },

    /**
     * Retry a failed job
     */
    async retry(jobId: string): Promise<Result<Job, JobError>> {
      return jobQueue.retry(jobId);
    },

    /**
     * Update job priority
     */
    async updatePriority(
      jobId: string,
      priority: JobPriority
    ): Promise<Result<void, JobError>> {
      return jobQueue.updatePriority(jobId, priority);
    },

    /**
     * List jobs by status
     */
    async listByStatus(
      status: JobStatus,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<Job[], JobError>> {
      return jobQueue.listByStatus(status, options);
    },

    /**
     * List jobs by type
     */
    async listByType(
      type: JobType,
      options?: { limit?: number; offset?: number }
    ): Promise<Result<Job[], JobError>> {
      return jobQueue.listByType(type, options);
    },

    /**
     * List jobs by user
     */
    async listByUser(
      userId: string,
      options?: { limit?: number; status?: JobStatus }
    ): Promise<Result<Job[], JobError>> {
      return jobQueue.listByUser(userId, options);
    },

    /**
     * Get queue statistics
     */
    async getStats(): Promise<{
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      totalProcessed: number;
      avgProcessingTimeMs: number;
    }> {
      return jobQueue.getStats();
    },

    /**
     * Register a job handler
     */
    registerHandler<T extends JobPayload>(
      type: JobType,
      handler: JobHandler<T>
    ): void {
      jobQueue.registerHandler(type, handler);
    },

    /**
     * Start processing jobs
     */
    async start(): Promise<void> {
      return jobQueue.start();
    },

    /**
     * Stop processing jobs
     */
    async stop(): Promise<void> {
      return jobQueue.stop();
    },

    /**
     * Check if queue is running
     */
    isRunning(): boolean {
      return jobQueue.isRunning();
    },

    /**
     * Pause processing
     */
    async pause(): Promise<void> {
      return jobQueue.pause();
    },

    /**
     * Resume processing
     */
    async resume(): Promise<void> {
      return jobQueue.resume();
    },

    /**
     * Clear all jobs (for testing)
     */
    async clear(): Promise<void> {
      return jobQueue.clear();
    },

    /**
     * Subscribe to job events
     */
    onJobEvent(
      event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled',
      handler: (payload: { jobId: string; type: JobType; [key: string]: unknown }) => void
    ): void {
      const eventName = `job:${event}` as 'job:created';
      jobQueue.on(eventName, handler as any);
    },

    /**
     * Unsubscribe from job events
     */
    offJobEvent(
      event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled',
      handler: (payload: { jobId: string; type: JobType; [key: string]: unknown }) => void
    ): void {
      const eventName = `job:${event}` as 'job:created';
      jobQueue.off(eventName, handler as any);
    },

    /**
     * Wait for a job to complete
     */
    async waitForCompletion(
      jobId: string,
      options?: { timeoutMs?: number; pollIntervalMs?: number }
    ): Promise<Result<Job, JobError>> {
      const timeout = options?.timeoutMs ?? 300000; // 5 minutes default
      const pollInterval = options?.pollIntervalMs ?? 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const result = await jobQueue.getJob(jobId);

        if (!result.success) {
          return err(result.error);
        }

        if (!result.data) {
          return err(JobError.notFound(jobId));
        }

        const job = result.data;

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          return ok(job);
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      return err(JobError.timeout(jobId, timeout));
    },
  };
}

/**
 * Job Service type
 */
export type JobService = ReturnType<typeof createJobService>;
