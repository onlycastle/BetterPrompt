/**
 * Knowledge API Route - Stats
 * GET /api/knowledge/stats - Get knowledge base statistics
 */

import { NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/search-agent/db/index';

export async function GET() {
  try {
    const stats = await knowledgeDb.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
