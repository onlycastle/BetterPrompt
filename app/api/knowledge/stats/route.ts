import { NextResponse } from 'next/server';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';

export async function GET() {
  try {
    return NextResponse.json(await knowledgeStore.getStats());
  } catch (error) {
    console.error('[Knowledge/Stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
