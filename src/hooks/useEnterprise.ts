/**
 * Enterprise Dashboard Hooks
 * Async API-backed hooks for organization, team, and member data.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  aggregateGrowthAreas,
  aggregateKPT,
  aggregateEnhancedAntiPatterns,
  buildTeamAnalytics,
  buildOrganizationAnalytics,
} from '@/lib/enterprise/aggregation';
import type {
  OrganizationAnalytics,
  TeamAnalytics,
  TeamMemberAnalysis,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamKPTAggregate,
} from '@/types/enterprise';
import type { StoredTeam, StoredOrganization } from '@/lib/local/team-store';

// ---------------------------------------------------------------------------
// Generic fetch hook
// ---------------------------------------------------------------------------

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useApiFetch<T>(url: string | null): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  const refetch = useCallback(() => setFetchCount(c => c + 1), []);

  useEffect(() => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(url, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((result) => {
        if (!cancelled) {
          setData(result as T);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url, fetchCount]);

  return { data, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface OrgApiResponse {
  organization: StoredOrganization;
  teams: StoredTeam[];
  memberCount: number;
}

// ---------------------------------------------------------------------------
// Organization hook
// ---------------------------------------------------------------------------

export function useOrganization(): AsyncState<OrganizationAnalytics> {
  const { data: orgData, isLoading: orgLoading, error: orgError, refetch: orgRefetch } = useApiFetch<OrgApiResponse>('/api/org');
  const { data: members, isLoading: membersLoading, error: membersError } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);

  useEffect(() => {
    if (!orgData || !members) {
      setAnalytics(null);
      return;
    }

    // Build team analytics from members grouped by team
    const teamAnalyticsList: TeamAnalytics[] = orgData.teams.map(team => {
      const teamMembers = members.filter(m => m.department === team.name);
      return buildTeamAnalytics(team.id, team.name, teamMembers);
    });

    const orgAnalytics = buildOrganizationAnalytics(
      orgData.organization.id,
      orgData.organization.name,
      teamAnalyticsList,
      members,
    );

    setAnalytics(orgAnalytics);
  }, [orgData, members]);

  return {
    data: analytics,
    isLoading: orgLoading || membersLoading,
    error: orgError || membersError,
    refetch: orgRefetch,
  };
}

// ---------------------------------------------------------------------------
// Teams hook
// ---------------------------------------------------------------------------

export function useTeams(): AsyncState<TeamAnalytics[]> {
  const { data: teams, isLoading, error, refetch } = useApiFetch<StoredTeam[]>('/api/teams');
  const { data: members } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const [analytics, setAnalytics] = useState<TeamAnalytics[] | null>(null);

  useEffect(() => {
    if (!teams || !members) {
      setAnalytics(null);
      return;
    }

    const teamAnalyticsList = teams.map(team => {
      const teamMembers = members.filter(m => m.department === team.name);
      return buildTeamAnalytics(team.id, team.name, teamMembers);
    });

    setAnalytics(teamAnalyticsList);
  }, [teams, members]);

  return { data: analytics, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// Members hooks
// ---------------------------------------------------------------------------

export function useMembers(): AsyncState<TeamMemberAnalysis[]> {
  return useApiFetch<TeamMemberAnalysis[]>('/api/org/members');
}

export function useMember(memberId: string): AsyncState<TeamMemberAnalysis> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const member = members?.find(m => m.id === memberId) ?? null;

  return { data: member, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// Team-specific hooks
// ---------------------------------------------------------------------------

export function useTeam(teamId: string): AsyncState<TeamAnalytics> {
  const { data: team, isLoading: teamLoading, error: teamError, refetch } = useApiFetch<StoredTeam>(`/api/teams/${teamId}`);
  const { data: members, isLoading: membersLoading, error: membersError } = useApiFetch<TeamMemberAnalysis[]>(`/api/teams/${teamId}/members`);

  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);

  useEffect(() => {
    if (!team || !members) {
      setAnalytics(null);
      return;
    }
    setAnalytics(buildTeamAnalytics(team.id, team.name, members));
  }, [team, members]);

  return {
    data: analytics,
    isLoading: teamLoading || membersLoading,
    error: teamError || membersError,
    refetch,
  };
}

export function useTeamMembers(teamId: string): AsyncState<TeamMemberAnalysis[]> {
  return useApiFetch<TeamMemberAnalysis[]>(`/api/teams/${teamId}/members`);
}

// ---------------------------------------------------------------------------
// Aggregation hooks (computed from members)
// ---------------------------------------------------------------------------

export function useOrgAntiPatterns(): AsyncState<EnhancedAntiPatternAggregate[]> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const aggregated = members ? aggregateEnhancedAntiPatterns(members) : null;

  return { data: aggregated, isLoading, error, refetch };
}

export function useOrgGrowthAreas(): AsyncState<TeamGrowthAreaAggregate[]> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const aggregated = members ? aggregateGrowthAreas(members) : null;

  return { data: aggregated, isLoading, error, refetch };
}

export function useOrgKpt(): AsyncState<TeamKPTAggregate> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const aggregated = members ? aggregateKPT(members) : null;

  return { data: aggregated, isLoading, error, refetch };
}
