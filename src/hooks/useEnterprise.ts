/**
 * Enterprise Dashboard Hooks
 * Thin wrappers over mock data — replace with real API calls when backend is ready
 */

import {
  MOCK_ORGANIZATION,
  MOCK_TEAMS,
  MOCK_MEMBERS,
  aggregateGrowthAreas,
  aggregateKPT,
  aggregateEnhancedAntiPatterns,
} from '../components/enterprise/mock-data';
import type {
  OrganizationAnalytics,
  TeamAnalytics,
  TeamMemberAnalysis,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamKPTAggregate,
} from '../types/enterprise';

export function useOrganization(): OrganizationAnalytics {
  return MOCK_ORGANIZATION;
}

export function useTeams(): TeamAnalytics[] {
  return MOCK_TEAMS;
}

export function useMembers(): TeamMemberAnalysis[] {
  return MOCK_MEMBERS;
}

export function useMember(memberId: string): TeamMemberAnalysis | undefined {
  return MOCK_MEMBERS.find(m => m.id === memberId);
}

export function useTeam(teamId: string): TeamAnalytics | undefined {
  return MOCK_TEAMS.find(t => t.teamId === teamId);
}

export function useTeamMembers(teamId: string): TeamMemberAnalysis[] {
  const team = MOCK_TEAMS.find(t => t.teamId === teamId);
  if (!team) return [];
  return MOCK_MEMBERS.filter(m => m.department === team.teamName.replace(' Team', ''));
}

export function useOrgAntiPatterns(): EnhancedAntiPatternAggregate[] {
  return aggregateEnhancedAntiPatterns(MOCK_MEMBERS);
}

export function useOrgGrowthAreas(): TeamGrowthAreaAggregate[] {
  return aggregateGrowthAreas(MOCK_MEMBERS);
}

export function useOrgKpt(): TeamKPTAggregate {
  return aggregateKPT(MOCK_MEMBERS);
}
