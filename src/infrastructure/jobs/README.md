# Job Queue Infrastructure

This directory contains job queue implementations for async background processing.

## Memory Queue

A full-featured in-memory job queue implementation with:

- **Priority-based processing**: `urgent` > `high` > `normal` > `low`
- **Concurrent execution**: Process multiple jobs simultaneously
- **Automatic retries**: Exponential backoff for failed jobs
- **Progress tracking**: Real-time progress updates
- **Job cancellation**: Cancel running or pending jobs
- **Event system**: Subscribe to job lifecycle events
- **Graceful shutdown**: Waits for running jobs to complete

## Usage

### Basic Setup

```typescript
import { createMemoryJobQueue } from './infrastructure/jobs/index.js';
import type { JobHandler } from './application/ports/job-queue.js';
import type { YouTubeTranscriptPayload } from './domain/models/index.js';

// Create queue with configuration
const queue = createMemoryJobQueue({
  concurrency: 5,                    // Process 5 jobs at once
  defaultRetries: 3,                 // Retry failed jobs 3 times
  jobTimeout: 5 * 60 * 1000,        // 5 minute timeout
  retryDelay: (attempt) =>          // Exponential backoff
    Math.min(1000 * Math.pow(2, attempt), 30000),
  pollInterval: 100,                 // Check for new jobs every 100ms
});

// Register handlers for different job types
const transcriptHandler: JobHandler<YouTubeTranscriptPayload> = async (payload, ctx) => {
  // Update progress
  await ctx.updateProgress(0, 100, 'Fetching video...');

  // Check for cancellation
  if (ctx.isCancelled()) {
    return { success: false, error: { code: 'CANCELLED', message: 'Job was cancelled' } };
  }

  // Process the job
  const result = await processVideo(payload.url);

  await ctx.updateProgress(100, 100, 'Complete!');

  return { success: true, data: result };
};

queue.registerHandler('youtube_transcript', transcriptHandler);

// Start processing
await queue.start();
```

### Enqueuing Jobs

```typescript
// Single job
const result = await queue.enqueue({
  type: 'youtube_transcript',
  payload: {
    type: 'youtube_transcript',
    url: 'https://youtube.com/watch?v=abc123',
    playlistMode: false,
  },
  priority: 'high',
  userId: 'user-123',
});

if (result.success) {
  console.log('Job ID:', result.data.id);
}

// Batch jobs
const batchResult = await queue.enqueueBatch([
  { type: 'youtube_transcript', payload: { /* ... */ } },
  { type: 'knowledge_learn', payload: { /* ... */ } },
]);
```

### Monitoring Jobs

```typescript
// Get job status
const status = await queue.getStatus(jobId);
if (status.success && status.data) {
  console.log('Status:', status.data.status);
  console.log('Progress:', status.data.progress?.percentage);
}

// Get full job details
const job = await queue.getJob(jobId);
if (job.success && job.data) {
  console.log('Result:', job.data.result);
  console.log('Error:', job.data.error);
}

// Get queue statistics
const stats = await queue.getStats();
console.log('Pending:', stats.pending);
console.log('Processing:', stats.processing);
console.log('Completed:', stats.completed);
console.log('Avg time:', stats.avgProcessingTimeMs, 'ms');
```

### Job Control

```typescript
// Cancel a job
await queue.cancel(jobId);

// Retry a failed job
await queue.retry(jobId);

// Update priority
await queue.updatePriority(jobId, 'urgent');

// Pause/resume processing
await queue.pause();   // Stop picking up new jobs
await queue.resume();  // Resume processing

// Graceful shutdown
await queue.stop();    // Waits for running jobs to finish
```

### Event Handling

```typescript
// Listen to job events
queue.on('job:created', (payload) => {
  console.log('New job:', payload.jobId);
});

queue.on('job:started', (payload) => {
  console.log('Job started:', payload.jobId);
});

queue.on('job:progress', (payload) => {
  console.log('Progress:', payload.progress?.current, '/', payload.progress?.total);
});

queue.on('job:completed', (payload) => {
  console.log('Job completed:', payload.jobId);
  console.log('Result:', payload.result);
});

queue.on('job:failed', (payload) => {
  console.error('Job failed:', payload.jobId, payload.error);
});

queue.on('job:retrying', (payload) => {
  console.log('Job retrying:', payload.jobId);
});

queue.on('job:cancelled', (payload) => {
  console.log('Job cancelled:', payload.jobId);
});

queue.on('queue:empty', () => {
  console.log('Queue is empty');
});

queue.on('queue:error', (payload) => {
  console.error('Queue error:', payload.error);
});

// Remove event listeners
const handler = (payload) => { /* ... */ };
queue.on('job:completed', handler);
queue.off('job:completed', handler);  // Clean up
```

### Querying Jobs

```typescript
// List jobs by status
const pending = await queue.listByStatus('pending', { limit: 10 });
const processing = await queue.listByStatus('processing');
const failed = await queue.listByStatus('failed', { offset: 10, limit: 10 });

// List jobs by type
const transcriptJobs = await queue.listByType('youtube_transcript');

// List jobs by user
const userJobs = await queue.listByUser('user-123', {
  status: 'completed',
  limit: 50,
});
```

## Job Handler Context

The `JobContext` provided to handlers includes:

```typescript
interface JobContext {
  // Update job progress
  updateProgress(current: number, total?: number, message?: string): Promise<void>;

  // Check if job was cancelled
  isCancelled(): boolean;

  // Get job metadata
  getMetadata(): {
    jobId: string;
    type: JobType;
    attempt: number;      // Current attempt (1-based)
    startedAt: Date;
  };
}
```

## Job Result Format

Handlers should return a `JobResult`:

```typescript
interface JobResult {
  success: boolean;
  data?: any;              // Success data
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics?: {
    itemsProcessed?: number;
    itemsSucceeded?: number;
    itemsFailed?: number;
    durationMs?: number;
  };
}
```

## Priority Ordering

Jobs are processed in this priority order:

1. `urgent` - Critical jobs that need immediate processing
2. `high` - Important jobs
3. `normal` - Standard priority (default)
4. `low` - Background jobs that can wait

Within the same priority, jobs are processed FIFO (first in, first out).

## Retry Strategy

Failed jobs are automatically retried with exponential backoff:

- Attempt 1: immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay
- ... up to 30 seconds max

You can customize this with the `retryDelay` configuration option.

## Testing

See `tests/unit/memory-queue.test.ts` for comprehensive examples of:

- Job processing
- Error handling and retries
- Cancellation
- Priority scheduling
- Concurrency limits
- Progress tracking
- Event emission

## Production Considerations

For production use, consider:

1. **Persistence**: The memory queue loses all data on restart. For production, implement a persistent queue (e.g., BullMQ with Redis).

2. **Distributed Processing**: The memory queue runs in a single process. For horizontal scaling, use a distributed queue.

3. **Monitoring**: Integrate with your monitoring system:
   ```typescript
   queue.on('job:failed', (payload) => {
     monitoring.trackError(payload.error);
   });
   ```

4. **Graceful Shutdown**: Always call `stop()` before exiting:
   ```typescript
   process.on('SIGTERM', async () => {
     await queue.stop();
     process.exit(0);
   });
   ```

5. **Resource Limits**: Configure appropriate `concurrency` based on your system resources and job requirements.
