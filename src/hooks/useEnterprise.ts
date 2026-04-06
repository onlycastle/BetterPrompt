/**
 * Enterprise Dashboard Hooks
 * Async API-backed hooks for organization, team, and member data.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  aggregateGrowthAreas,
  aggregateGrowthAreasPEA,
  aggregateKPT,
  aggregateEnhancedAntiPatterns,
  buildTeamAnalytics,
  buildOrganizationAnalytics,
  generateTeamActionItems,
} from '@/lib/enterprise/aggregation';
import type {
  OrganizationAnalytics,
  TeamAnalytics,
  TeamMemberAnalysis,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamGrowthAreaPEAAggregate,
  TeamKPTAggregate,
  TeamActionItem,
  TeamAnalysisOutput,
} from '@/types/enterprise';
import type { StoredTeam, StoredTeamMember, StoredOrganization } from '@/lib/local/team-store';

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

interface TeamDetailResponse {
  team: StoredTeam;
  members: StoredTeamMember[];
}

export function useTeam(teamId: string): AsyncState<TeamAnalytics> {
  const { data: teamData, isLoading: teamLoading, error: teamError, refetch } = useApiFetch<TeamDetailResponse>(`/api/teams/${teamId}`);
  const { data: members, isLoading: membersLoading, error: membersError } = useApiFetch<TeamMemberAnalysis[]>(`/api/teams/${teamId}/members`);

  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);

  useEffect(() => {
    if (!teamData || !members) {
      setAnalytics(null);
      return;
    }
    setAnalytics(buildTeamAnalytics(teamData.team.id, teamData.team.name, members));
  }, [teamData, members]);

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

/**
 * Cross-developer pattern detection using PEA-format growth areas.
 * Returns aggregated patterns with freeform category tags, team recommendations,
 * per-member severity breakdowns, and KB tip attachments.
 */
export function useOrgGrowthAreasPEA(): AsyncState<TeamGrowthAreaPEAAggregate[]> & { totalMembers: number } {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const aggregated = members ? aggregateGrowthAreasPEA(members) : null;
  const totalMembers = members?.length ?? 0;

  return { data: aggregated, isLoading, error, refetch, totalMembers };
}

export function useOrgKpt(): AsyncState<TeamKPTAggregate> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const aggregated = members ? aggregateKPT(members) : null;

  return { data: aggregated, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// Team action items hook (prioritized recommendations for managers)
// ---------------------------------------------------------------------------

/**
 * Generate prioritized team action items from cross-developer pattern analysis.
 * Returns up to 7 concrete, manager-actionable recommendations sorted by impact.
 * Each item includes urgency level, specific action, rationale, and affected members.
 */
export function useOrgTeamActionItems(): AsyncState<TeamActionItem[]> {
  const { data: members, isLoading, error, refetch } = useApiFetch<TeamMemberAnalysis[]>('/api/org/members');

  const items = members
    ? generateTeamActionItems(aggregateGrowthAreasPEA(members), members.length)
    : null;

  return { data: items, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// Team analysis hook — patterns + recommendations co-located (server-side)
// ---------------------------------------------------------------------------

/**
 * Fetch the full team analysis output for a team, including cross-developer
 * patterns and manager recommendations in a single co-located response.
 *
 * Calls GET /api/teams/[teamId]/analysis which runs server-side:
 *   1. aggregateGrowthAreasPEA() — two-pass cross-developer pattern detection
 *   2. generateLLMTeamRecommendations() when ANTHROPIC_API_KEY is set,
 *      or generateTeamActionItems() (deterministic) otherwise
 *
 * This replaces multiple client-side useMemo calls with a single server-side
 * computation where patterns and recommendations are guaranteed to be derived
 * from the same member dataset in the same request.
 *
 * The `recommendationSource` field in the returned data indicates whether
 * recommendations were LLM-generated ('llm') or template-based ('deterministic').
 *
 * @param teamId - The team ID to analyze
 */
export function useTeamAnalysis(teamId: string | null): AsyncState<TeamAnalysisOutput> {
  return useApiFetch<TeamAnalysisOutput>(
    teamId ? `/api/teams/${teamId}/analysis` : null,
  );
}
