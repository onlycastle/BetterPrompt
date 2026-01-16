/**
 * Enterprise Dashboard Data Hooks
 * React Query hooks for team analytics and member data
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_TEAM_ANALYTICS, MOCK_TEAM_MEMBERS } from '../data/mockEnterpriseData';
import type { TeamAnalytics, TeamMemberAnalysis } from '../types/enterprise';

// In Next.js, API routes are served from the same domain

export interface TeamMembersResponse {
  members: TeamMemberAnalysis[];
}

/**
 * Fetch team-level aggregate analytics
 */
export function useTeamAnalytics(teamId?: string) {
  return useQuery<TeamAnalytics>({
    queryKey: ['team-analytics', teamId],
    queryFn: async (): Promise<TeamAnalytics> => {
      try {
        const url = teamId
          ? `/api/enterprise/team/demo?teamId=${teamId}`
          : `/api/enterprise/team/demo`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch team analytics');
        }
        return await response.json();
      } catch (error) {
        console.warn('Failed to fetch team analytics, using mock data:', error);
        return MOCK_TEAM_ANALYTICS;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch team member analysis data
 */
export function useTeamMembers(teamId?: string, sortBy?: string, sortOrder?: 'asc' | 'desc') {
  return useQuery<TeamMembersResponse>({
    queryKey: ['team-members', teamId, sortBy, sortOrder],
    queryFn: async (): Promise<TeamMembersResponse> => {
      try {
        const params = new URLSearchParams();
        if (sortBy) params.append('sortBy', sortBy);
        if (sortOrder) params.append('sortOrder', sortOrder);

        const queryString = params.toString();
        const url = `/api/enterprise/team/demo/members${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }
        return await response.json();
      } catch (error) {
        console.warn('Failed to fetch team members, using mock data:', error);
        return { members: MOCK_TEAM_MEMBERS };
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
