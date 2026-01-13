/**
 * Enterprise Dashboard Data Hooks
 * React Query hooks for team analytics and member data
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_TEAM_ANALYTICS, MOCK_TEAM_MEMBERS } from '../data/mockEnterpriseData';
import type { TeamAnalytics, TeamMemberAnalysis } from '../types/enterprise';

export interface TeamMembersResponse {
  members: TeamMemberAnalysis[];
}

/**
 * Fetch team-level aggregate analytics
 */
export function useTeamAnalytics() {
  return useQuery<TeamAnalytics>({
    queryKey: ['team-analytics'],
    queryFn: async (): Promise<TeamAnalytics> => {
      // TODO: Replace with actual API call when backend is ready
      // return await fetch('/api/enterprise/analytics').then(r => r.json());
      return MOCK_TEAM_ANALYTICS;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch team member analysis data
 */
export function useTeamMembers() {
  return useQuery<TeamMembersResponse>({
    queryKey: ['team-members'],
    queryFn: async (): Promise<TeamMembersResponse> => {
      // TODO: Replace with actual API call when backend is ready
      // return await fetch('/api/enterprise/members').then(r => r.json());
      return { members: MOCK_TEAM_MEMBERS };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
