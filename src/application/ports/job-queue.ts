/**
 * Job Queue Port Interface
 *
 * Defines the contract for async job processing.
 * Implemented by in-memory queue and BullMQ adapters.
 *
 * @module application/ports/job-queue
 */

import type { Result } from '../../lib/result.js';
import type { JobError } from '../../domain/errors/index.js';
import type {
  Job,
  JobType,
  JobStatus,
  JobPayload,
  JobResult,
  JobPriority,
  CreateJobInput,
  JobStatusResponse,
} from '../../domain/models/index.js';

// ============================================================================
// Job Handler Types
// ============================================================================

/**
 * Job handler context
 */
export interface JobContext {
  /** Update job progress */
  updateProgress(current: number, total?: number, message?: string): Promise<void>;

  /** Check if job was cancelled */
  isCancelled(): boolean;

  /** Get job metadata */
  getMetadata(): {
    jobId: string;
    type: JobType;
    attempt: number;
    startedAt: Date;
  };
}

/**
 * Job handler function
 */
export type JobHandler<T extends JobPayload = JobPayload> = (
  payload: T,
  context: JobContext
) => Promise<JobResult>;

/**
 * Job handler registry
 */
export type JobHandlerRegistry = Partial<Record<JobType, JobHandler>>;

// ============================================================================
// Queue Configuration
// ============================================================================

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent jobs */
  concurrency?: number;

  /** Default retry count */
  defaultRetries?: number;

  /** Retry delay in ms (or function for exponential backoff) */
  retryDelay?: number | ((attempt: number) => number);

  /** Job timeout in ms */
  jobTimeout?: number;

  /** Polling interval for in-memory queue */
  pollInterval?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgProcessingTimeMs: number;
}

// ============================================================================
// Job Queue Port Interface
// ============================================================================

/**
 * Port for job queue operations
 */
export interface IJobQueuePort {
  /**
   * Enqueue a new job
   */
  enqueue(input: CreateJobInput): Promise<Result<Job, JobError>>;

  /**
   * Enqueue multiple jobs
   */
  enqueueBatch(inputs: CreateJobInput[]): Promise<Result<Job[], JobError>>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<Result<Job | null, JobError>>;

  /**
   * Get job status (simplified view)
   */
  getStatus(jobId: string): Promise<Result<JobStatusResponse | null, JobError>>;

  /**
   * List jobs by status
   */
  listByStatus(
    status: JobStatus,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<Job[], JobError>>;

  /**
   * List jobs by type
   */
  listByType(
    type: JobType,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<Job[], JobError>>;

  /**
   * List jobs by user
   */
  listByUser(
    userId: string,
    options?: { limit?: number; status?: JobStatus }
  ): Promise<Result<Job[], JobError>>;

  /**
   * Cancel a job
   */
  cancel(jobId: string): Promise<Result<void, JobError>>;

  /**
   * Retry a failed job
   */
  retry(jobId: string): Promise<Result<Job, JobError>>;

  /**
   * Update job priority
   */
  updatePriority(jobId: string, priority: JobPriority): Promise<Result<void, JobError>>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<QueueStats>;

  /**
   * Register a job handler
   */
  registerHandler<T extends JobPayload>(
    type: JobType,
    handler: JobHandler<T>
  ): void;

  /**
   * Start processing jobs
   */
  start(): Promise<void>;

  /**
   * Stop processing jobs (graceful shutdown)
   */
  stop(): Promise<void>;

  /**
   * Check if queue is running
   */
  isRunning(): boolean;

  /**
   * Pause processing
   */
  pause(): Promise<void>;

  /**
   * Resume processing
   */
  resume(): Promise<void>;

  /**
   * Clear all jobs (for testing)
   */
  clear(): Promise<void>;

  /**
   * Subscribe to job events
   */
  on(event: JobQueueEvent, handler: JobEventHandler): void;

  /**
   * Unsubscribe from job events
   */
  off(event: JobQueueEvent, handler: JobEventHandler): void;

  /**
   * Remove all event listeners (for cleanup/testing)
   */
  removeAllListeners?(): void;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Job queue events
 */
export type JobQueueEvent =
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:retrying'
  | 'job:cancelled'
  | 'queue:empty'
  | 'queue:error';

/**
 * Job event payload
 */
export interface JobEventPayload {
  jobId: string;
  type: JobType;
  status?: JobStatus;
  progress?: { current: number; total?: number };
  result?: JobResult;
  error?: Error;
}

/**
 * Job event handler
 */
export type JobEventHandler = (payload: JobEventPayload) => void;

// ============================================================================
// Worker Configuration
// ============================================================================

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Types this worker handles (empty = all) */
  types?: JobType[];

  /** Maximum jobs per worker */
  concurrency?: number;

  /** Worker name (for logging) */
  name?: string;
}

/**
 * Worker interface for distributed processing
 */
export interface IJobWorker {
  /**
   * Start the worker
   */
  start(): Promise<void>;

  /**
   * Stop the worker
   */
  stop(): Promise<void>;

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    currentJobs: number;
    processedCount: number;
  };
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory function for creating job queue
 */
export type JobQueueFactory = (config?: QueueConfig) => IJobQueuePort;

/**
 * Factory function for creating workers
 */
export type WorkerFactory = (
  queue: IJobQueuePort,
  handlers: JobHandlerRegistry,
  config?: WorkerConfig
) => IJobWorker;
