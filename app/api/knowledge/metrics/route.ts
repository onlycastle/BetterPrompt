/**
 * Knowledge API Route - Metrics
 * GET /api/knowledge/metrics - Get quality metrics
 */

import { NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/search-agent/db/index';

export async function GET() {
  try {
    const metrics = await knowledgeDb.getQualityMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
