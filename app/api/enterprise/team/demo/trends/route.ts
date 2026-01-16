/**
 * Enterprise Team Trends API Route
 * GET /api/enterprise/team/demo/trends - Historical trend data
 */

import { NextRequest, NextResponse } from 'next/server';
import { MOCK_TEAM_ANALYTICS } from '@/lib/api/data/mockEnterprise';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || '30d';

  // Filter trends based on period
  let trends = MOCK_TEAM_ANALYTICS.weeklyTrend;

  if (period === '7d') {
    // Last 7 days (1 week)
    trends = trends.slice(-1);
  } else if (period === '90d') {
    // For 90d, we'd extend the data, but for demo just return all
    trends = MOCK_TEAM_ANALYTICS.weeklyTrend;
  }

  return NextResponse.json({ trends });
}
