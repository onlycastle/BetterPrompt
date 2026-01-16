/**
 * Knowledge API Route - Single Item
 * GET /api/knowledge/:id - Get single knowledge item by ID
 * DELETE /api/knowledge/:id - Delete a knowledge item
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/search-agent/db/index';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const item = await knowledgeDb.findById(id);

    if (!item) {
      return NextResponse.json(
        { error: 'Knowledge item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error getting knowledge item:', error);
    return NextResponse.json(
      {
        error: 'Failed to get knowledge item',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const deleted = await knowledgeDb.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Knowledge item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting knowledge item:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete knowledge item',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
