/**
 * Enterprise Team Analytics API Route
 * GET /api/enterprise/team/demo - Team analytics overview
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseTeamRepository,
} from '@/lib/infrastructure/storage/supabase/index';
import { MOCK_TEAM_ANALYTICS } from '@/lib/api/data/mockEnterprise';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');

    // Create repository instance
    const teamRepo = createSupabaseTeamRepository();

    if (teamId) {
      const membersResult = await teamRepo.getMembers(teamId);
      if (membersResult.success && membersResult.data.length > 0) {
        // TODO: Build analytics from real member data
        // For now, we need to fetch analyses for each member and calculate aggregates
        // This will be implemented when we have user-analysis associations
      }
    }

    // Fall back to mock data if no real data available
    return NextResponse.json(MOCK_TEAM_ANALYTICS);
  } catch (error) {
    // Fall back to mock data on error
    return NextResponse.json(MOCK_TEAM_ANALYTICS);
  }
}
