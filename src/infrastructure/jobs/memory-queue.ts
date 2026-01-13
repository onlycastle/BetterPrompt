/**
 * In-Memory Job Queue Implementation
 *
 * Full-featured in-memory job queue with:
 * - Priority-based job processing (critical > high > normal > low)
 * - Concurrent job execution with configurable concurrency
 * - Exponential backoff retry strategy
 * - Event emission for job lifecycle
 * - Progress tracking and cancellation support
 * - Graceful shutdown with running job completion
 *
 * @module infrastructure/jobs/memory-queue
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { ok, err, type Result } from '../../lib/result.js';
import { JobError } from '../../domain/errors/index.js';
import type {
  Job,
  JobType,
  JobStatus,
  JobPayload,
  JobResult,
  CreateJobInput,
  JobStatusResponse,
  JobPriority,
} from '../../domain/models/index.js';
import type {
  IJobQueuePort,
  JobHandler,
  JobContext,
  QueueConfig,
  QueueStats,
  JobQueueEvent,
  JobEventHandler,
  JobEventPayload,
} from '../../application/ports/job-queue.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<QueueConfig> = {
  concurrency: 3,
  defaultRetries: 3,
  retryDelay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 30000), // Exponential backoff
  jobTimeout: 5 * 60 * 1000, // 5 minutes
  pollInterval: 100, // 100ms polling
};

const PRIORITY_ORDER: Record<JobPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

// ============================================================================
// Internal Job State
// ============================================================================

interface InternalJob {
  job: Job;
  timeoutHandle?: NodeJS.Timeout;
  cancelledFlag: boolean;
  startedAt?: Date;
}

// ============================================================================
// Memory Job Queue Implementation
// ============================================================================

class MemoryJobQueue implements IJobQueuePort {
  // Configuration
  private readonly config: Required<QueueConfig>;

  // Storage
  private readonly jobs = new Map<string, InternalJob>();
  private readonly handlers = new Map<JobType, JobHandler>();

  // Processing state
  private running = false;
  private paused = false;
  private processingCount = 0;
  private pollTimer?: NodeJS.Timeout;

  // Event emitter
  private readonly eventEmitter = new EventEmitter();

  // Statistics
  private stats = {
    totalProcessed: 0,
    totalProcessingTimeMs: 0,
  };

  constructor(config?: QueueConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Normalize retryDelay to function
    if (typeof this.config.retryDelay === 'number') {
      const delay = this.config.retryDelay;
      this.config.retryDelay = () => delay;
    }
  }

  // ==========================================================================
  // Queue Control
  // ==========================================================================

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.paused = false;
    this.startPolling();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.stopPolling();

    // Wait for currently processing jobs to complete
    while (this.processingCount > 0) {
      await this.sleep(100);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  async pause(): Promise<void> {
    this.paused = true;
    this.stopPolling();
  }

  async resume(): Promise<void> {
    if (!this.running) {
      throw new Error('Queue is not started. Call start() first.');
    }

    this.paused = false;
    this.startPolling();
  }

  async clear(): Promise<void> {
    this.jobs.clear();
    this.stats = {
      totalProcessed: 0,
      totalProcessingTimeMs: 0,
    };
  }

  // ==========================================================================
  // Job Management
  // ==========================================================================

  async enqueue(input: CreateJobInput): Promise<Result<Job, JobError>> {
    try {
      const job: Job = {
        id: randomUUID(),
        type: input.type,
        status: 'pending',
        priority: input.priority ?? 'normal',
        payload: input.payload,
        retryCount: 0,
        maxRetries: this.config.defaultRetries,
        createdAt: new Date().toISOString(),
        userId: input.userId,
      };

      const internalJob: InternalJob = {
        job,
        cancelledFlag: false,
      };

      this.jobs.set(job.id, internalJob);

      this.emit('job:created', {
        jobId: job.id,
        type: job.type,
        status: job.status,
      });

      return ok(job);
    } catch (error) {
      return err(
        JobError.processingFailed('new-job', 'Failed to create job', error as Error)
      );
    }
  }

  async enqueueBatch(inputs: CreateJobInput[]): Promise<Result<Job[], JobError>> {
    const jobs: Job[] = [];

    for (const input of inputs) {
      const result = await this.enqueue(input);
      if (!result.success) return err(result.error);
      jobs.push(result.data);
    }

    return ok(jobs);
  }

  async getJob(jobId: string): Promise<Result<Job | null, JobError>> {
    try {
      const internal = this.jobs.get(jobId);
      return ok(internal ? { ...internal.job } : null);
    } catch (error) {
      return err(
        JobError.processingFailed(jobId, 'Failed to get job', error as Error)
      );
    }
  }

  async getStatus(jobId: string): Promise<Result<JobStatusResponse | null, JobError>> {
    const result = await this.getJob(jobId);
    if (!result.success) return err(result.error);

    if (!result.data) return ok(null);

    const job = result.data;
    const percentage = job.progress?.total
      ? Math.round((job.progress.current / job.progress.total) * 100)
      : undefined;

    const status: JobStatusResponse = {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress
        ? {
            current: job.progress.current,
            total: job.progress.total,
            percentage,
            message: job.progress.message,
          }
        : undefined,
      result: job.result,
      error: job.error
        ? {
            code: job.error.code,
            message: job.error.message,
          }
        : undefined,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };

    return ok(status);
  }

  async cancel(jobId: string): Promise<Result<void, JobError>> {
    const internal = this.jobs.get(jobId);
    if (!internal) {
      return err(JobError.notFound(jobId));
    }

    if (this.isTerminalStatus(internal.job.status)) {
      return err(JobError.alreadyCompleted(jobId));
    }

    // Set cancellation flag
    internal.cancelledFlag = true;

    // If pending, mark as cancelled immediately
    if (internal.job.status === 'pending') {
      internal.job.status = 'cancelled';
      internal.job.completedAt = new Date().toISOString();

      this.emit('job:cancelled', {
        jobId: internal.job.id,
        type: internal.job.type,
        status: internal.job.status,
      });
    }
    // If processing, handler will check cancelledFlag and stop

    // Clear timeout if exists
    if (internal.timeoutHandle) {
      clearTimeout(internal.timeoutHandle);
      internal.timeoutHandle = undefined;
    }

    return ok(undefined);
  }

  async retry(jobId: string): Promise<Result<Job, JobError>> {
    const internal = this.jobs.get(jobId);
    if (!internal) {
      return err(JobError.notFound(jobId));
    }

    if (internal.job.status !== 'failed') {
      return err(
        new JobError(
          'JOB_NOT_FAILED',
          `Job is not in failed state: ${jobId}`,
          'Only failed jobs can be retried.',
          false,
          400,
          jobId
        )
      );
    }

    if (internal.job.retryCount >= internal.job.maxRetries) {
      return err(JobError.maxRetriesExceeded(jobId));
    }

    // Reset job state
    internal.job.status = 'pending';
    internal.job.retryCount += 1;
    internal.job.startedAt = undefined;
    internal.job.completedAt = undefined;
    internal.job.error = undefined;
    internal.job.result = undefined;
    internal.job.progress = undefined;
    internal.cancelledFlag = false;

    this.emit('job:retrying', {
      jobId: internal.job.id,
      type: internal.job.type,
      status: internal.job.status,
    });

    return ok({ ...internal.job });
  }

  async updatePriority(jobId: string, priority: JobPriority): Promise<Result<void, JobError>> {
    const internal = this.jobs.get(jobId);
    if (!internal) {
      return err(JobError.notFound(jobId));
    }

    if (internal.job.status !== 'pending') {
      return err(
        new JobError(
          'JOB_NOT_PENDING',
          `Cannot update priority of non-pending job: ${jobId}`,
          'Only pending jobs can have their priority updated.',
          false,
          400,
          jobId
        )
      );
    }

    internal.job.priority = priority;
    return ok(undefined);
  }

  // ==========================================================================
  // Job Queries
  // ==========================================================================

  async listByStatus(
    status: JobStatus,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<Job[], JobError>> {
    try {
      const jobs = Array.from(this.jobs.values())
        .filter((internal) => internal.job.status === status)
        .map((internal) => ({ ...internal.job }))
        .slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? Infinity));

      return ok(jobs);
    } catch (error) {
      return err(
        new JobError(
          'JOB_QUERY_FAILED',
          'Failed to list jobs by status',
          'Unable to retrieve jobs.',
          true,
          500,
          undefined,
          error as Error
        )
      );
    }
  }

  async listByType(
    type: JobType,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<Job[], JobError>> {
    try {
      const jobs = Array.from(this.jobs.values())
        .filter((internal) => internal.job.type === type)
        .map((internal) => ({ ...internal.job }))
        .slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? Infinity));

      return ok(jobs);
    } catch (error) {
      return err(
        new JobError(
          'JOB_QUERY_FAILED',
          'Failed to list jobs by type',
          'Unable to retrieve jobs.',
          true,
          500,
          undefined,
          error as Error
        )
      );
    }
  }

  async listByUser(
    userId: string,
    options?: { limit?: number; status?: JobStatus }
  ): Promise<Result<Job[], JobError>> {
    try {
      let jobs = Array.from(this.jobs.values()).filter(
        (internal) => internal.job.userId === userId
      );

      if (options?.status) {
        jobs = jobs.filter((internal) => internal.job.status === options.status);
      }

      const result = jobs
        .map((internal) => ({ ...internal.job }))
        .slice(0, options?.limit ?? Infinity);

      return ok(result);
    } catch (error) {
      return err(
        new JobError(
          'JOB_QUERY_FAILED',
          'Failed to list jobs by user',
          'Unable to retrieve jobs.',
          true,
          500,
          undefined,
          error as Error
        )
      );
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getStats(): Promise<QueueStats> {
    const statuses = Array.from(this.jobs.values()).map((internal) => internal.job.status);

    const pending = statuses.filter((s) => s === 'pending').length;
    const processing = statuses.filter((s) => s === 'processing').length;
    const completed = statuses.filter((s) => s === 'completed').length;
    const failed = statuses.filter((s) => s === 'failed').length;

    const avgProcessingTimeMs =
      this.stats.totalProcessed > 0
        ? Math.round(this.stats.totalProcessingTimeMs / this.stats.totalProcessed)
        : 0;

    return {
      pending,
      processing,
      completed,
      failed,
      totalProcessed: this.stats.totalProcessed,
      avgProcessingTimeMs,
    };
  }

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  registerHandler<T extends JobPayload>(type: JobType, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  on(event: JobQueueEvent, handler: JobEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: JobQueueEvent, handler: JobEventHandler): void {
    this.eventEmitter.off(event, handler);
  }

  private emit(event: JobQueueEvent, payload: JobEventPayload): void {
    this.eventEmitter.emit(event, payload);
  }

  // ==========================================================================
  // Processing Logic
  // ==========================================================================

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      void this.processNextJobs();
    }, this.config.pollInterval);

    // Immediately try to process
    void this.processNextJobs();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private async processNextJobs(): Promise<void> {
    if (!this.running || this.paused) return;

    // Process up to concurrency limit
    while (this.processingCount < this.config.concurrency) {
      const nextJob = this.getNextPendingJob();
      if (!nextJob) {
        // Check if queue is empty
        if (this.processingCount === 0 && this.getPendingCount() === 0) {
          this.emit('queue:empty', { jobId: '', type: 'youtube_transcript' }); // dummy type
        }
        break;
      }

      void this.processJob(nextJob);
    }
  }

  private getNextPendingJob(): InternalJob | null {
    const pending = Array.from(this.jobs.values()).filter(
      (internal) => internal.job.status === 'pending' && !internal.cancelledFlag
    );

    if (pending.length === 0) return null;

    // Sort by priority (high to low), then by creation time (FIFO)
    pending.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[b.job.priority] - PRIORITY_ORDER[a.job.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return (
        new Date(a.job.createdAt).getTime() - new Date(b.job.createdAt).getTime()
      );
    });

    return pending[0];
  }

  private getPendingCount(): number {
    return Array.from(this.jobs.values()).filter(
      (internal) => internal.job.status === 'pending'
    ).length;
  }

  private async processJob(internal: InternalJob): Promise<void> {
    const { job } = internal;

    // Mark as processing
    this.processingCount++;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    internal.startedAt = new Date();

    this.emit('job:started', {
      jobId: job.id,
      type: job.type,
      status: job.status,
    });

    // Get handler
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.processingCount--;
      await this.failJob(
        internal,
        new JobError(
          'JOB_NO_HANDLER',
          `No handler registered for job type: ${job.type}`,
          'This job type is not supported.',
          false,
          500,
          job.id
        )
      );
      return;
    }

    // Set timeout
    internal.timeoutHandle = setTimeout(() => {
      void this.timeoutJob(internal);
    }, this.config.jobTimeout);

    // Create context
    const context: JobContext = {
      updateProgress: async (current: number, total?: number, message?: string) => {
        job.progress = { current, total, message };

        this.emit('job:progress', {
          jobId: job.id,
          type: job.type,
          status: job.status,
          progress: { current, total },
        });
      },
      isCancelled: () => internal.cancelledFlag,
      getMetadata: () => ({
        jobId: job.id,
        type: job.type,
        attempt: job.retryCount + 1,
        startedAt: internal.startedAt!,
      }),
    };

    // Execute handler
    try {
      const result = await handler(job.payload, context);

      // Clear timeout
      if (internal.timeoutHandle) {
        clearTimeout(internal.timeoutHandle);
        internal.timeoutHandle = undefined;
      }

      // Check if cancelled during processing
      if (internal.cancelledFlag) {
        job.status = 'cancelled';
        job.completedAt = new Date().toISOString();

        this.emit('job:cancelled', {
          jobId: job.id,
          type: job.type,
          status: job.status,
        });
      } else {
        // Success
        await this.completeJob(internal, result);
      }
    } catch (error) {
      // Clear timeout
      if (internal.timeoutHandle) {
        clearTimeout(internal.timeoutHandle);
        internal.timeoutHandle = undefined;
      }

      // Create a retryable error by default if not a JobError
      const jobError =
        error instanceof JobError
          ? error
          : new JobError(
              'JOB_PROCESSING_FAILED',
              `Job processing failed: ${(error as Error).message}`,
              'The job encountered an error during processing.',
              true, // retryable by default
              500,
              job.id,
              error as Error
            );

      await this.failJob(internal, jobError);
    } finally {
      this.processingCount--;
    }
  }

  private async completeJob(internal: InternalJob, result: JobResult): Promise<void> {
    const { job } = internal;

    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date().toISOString();

    // Update stats
    const processingTime = internal.startedAt
      ? Date.now() - internal.startedAt.getTime()
      : 0;
    this.stats.totalProcessed++;
    this.stats.totalProcessingTimeMs += processingTime;

    this.emit('job:completed', {
      jobId: job.id,
      type: job.type,
      status: job.status,
      result,
    });
  }

  private async failJob(internal: InternalJob, error: JobError): Promise<void> {
    const { job } = internal;

    job.error = {
      code: error.code,
      message: error.message,
      stack: error.stack,
    };

    // Check if should retry
    if (error.retryable && job.retryCount < job.maxRetries) {
      job.status = 'retrying';

      this.emit('job:retrying', {
        jobId: job.id,
        type: job.type,
        status: job.status,
        error,
      });

      // Schedule retry with exponential backoff
      const delay =
        typeof this.config.retryDelay === 'function'
          ? this.config.retryDelay(job.retryCount)
          : this.config.retryDelay;

      setTimeout(() => {
        job.status = 'pending';
        job.retryCount++;
        job.startedAt = undefined;
        job.error = undefined;
        internal.cancelledFlag = false;
      }, delay);
    } else {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();

      // Update stats
      const processingTime = internal.startedAt
        ? Date.now() - internal.startedAt.getTime()
        : 0;
      this.stats.totalProcessed++;
      this.stats.totalProcessingTimeMs += processingTime;

      this.emit('job:failed', {
        jobId: job.id,
        type: job.type,
        status: job.status,
        error,
      });
    }
  }

  private async timeoutJob(internal: InternalJob): Promise<void> {
    const { job } = internal;

    // Mark as cancelled
    internal.cancelledFlag = true;

    const error = JobError.timeout(job.id, this.config.jobTimeout);
    await this.failJob(internal, error);
  }

  private isTerminalStatus(status: JobStatus): boolean {
    return ['completed', 'failed', 'cancelled'].includes(status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new in-memory job queue
 *
 * @param config - Queue configuration
 * @returns IJobQueuePort implementation
 *
 * @example
 * ```typescript
 * const queue = createMemoryJobQueue({
 *   concurrency: 5,
 *   defaultRetries: 3,
 *   retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
 * });
 *
 * // Register handlers
 * queue.registerHandler('youtube_transcript', async (payload, ctx) => {
 *   await ctx.updateProgress(0, 100, 'Starting...');
 *   // Process...
 *   return { success: true, data: { videoId: '...' } };
 * });
 *
 * // Start processing
 * await queue.start();
 *
 * // Enqueue jobs
 * const result = await queue.enqueue({
 *   type: 'youtube_transcript',
 *   payload: { type: 'youtube_transcript', url: '...' },
 *   priority: 'high',
 * });
 *
 * // Listen to events
 * queue.on('job:completed', (payload) => {
 *   console.log(`Job ${payload.jobId} completed!`);
 * });
 * ```
 */
export function createMemoryJobQueue(config?: QueueConfig): IJobQueuePort {
  return new MemoryJobQueue(config);
}
