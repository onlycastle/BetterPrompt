import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CUTOVER_RESPONSE = {
  error: 'ANALYSIS_ROUTE_REMOVED',
  message: 'Server-side BetterPrompt analysis has been removed. Install the Claude Code plugin, run `/analyze` locally, and sync the canonical run with `sync_to_team` or `/api/analysis/sync` if you need dashboard storage.',
};

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(CUTOVER_RESPONSE, { status: 410 });
}
