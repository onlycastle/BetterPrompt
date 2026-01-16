/**
 * GET /api/learn/status/:id
 * Get learning job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMemoryJobQueue } from '@/lib/infrastructure/jobs';

// Job queue for async learning operations
let jobQueue: ReturnType<typeof createMemoryJobQueue> | null = null;

function getJobQueue() {
  if (!jobQueue) {
    jobQueue = createMemoryJobQueue({ concurrency: 2 });
    jobQueue.start();
  }
  return jobQueue;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const queue = getJobQueue();
    const statusResult = await queue.getStatus(id);

    if (!statusResult.success) {
      return NextResponse.json(
        { error: 'Failed to get job status' },
        { status: 500 }
      );
    }

    if (!statusResult.data) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(statusResult.data);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
