/**
 * Enterprise Team Members API Route
 * GET /api/enterprise/team/demo/members - List all team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { MOCK_TEAM_MEMBERS } from '@/lib/api/data/mockEnterprise';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');

  let members = [...MOCK_TEAM_MEMBERS];

  // Sort if requested
  if (sortBy) {
    members = members.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'score':
          aVal = a.overallScore;
          bVal = b.overallScore;
          break;
        case 'department':
          aVal = a.department;
          bVal = b.department;
          break;
        case 'lastAnalyzed':
          aVal = new Date(a.lastAnalyzedAt).getTime();
          bVal = new Date(b.lastAnalyzedAt).getTime();
          break;
        default:
          return 0;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  return NextResponse.json({ members });
}
