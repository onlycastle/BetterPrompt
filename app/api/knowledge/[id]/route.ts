import { NextRequest, NextResponse } from 'next/server';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await knowledgeStore.loadItem(id);
    if (!item) {
      return NextResponse.json(
        { error: 'Not found', message: 'Knowledge item not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      item: {
        ...item,
        category: item.category || 'other',
      },
    });
  } catch (error) {
    console.error('[Knowledge/Detail] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getCurrentUserFromRequest();

    const { id } = await params;
    const deleted = await knowledgeStore.deleteItem(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Not found', message: 'Knowledge item not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Knowledge/Delete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
