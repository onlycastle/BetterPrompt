import { NextResponse } from 'next/server';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';

export async function GET() {
  try {
    return NextResponse.json(await knowledgeStore.getQualityMetrics());
  } catch (error) {
    console.error('[Knowledge/Metrics] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
