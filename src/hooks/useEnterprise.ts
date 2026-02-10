/**
 * Enterprise Dashboard Hooks
 * Thin wrappers over mock data — replace with real API calls when backend is ready
 */

import {
  MOCK_ORGANIZATION,
  MOCK_TEAMS,
  MOCK_MEMBERS,
} from '../components/enterprise/mock-data';
import type {
  OrganizationAnalytics,
  TeamAnalytics,
  TeamMemberAnalysis,
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

export function useTeam(teamId: string): TeamAnalytics | undefined {
  return MOCK_TEAMS.find(t => t.teamId === teamId);
}

export function useTeamMembers(teamId: string): TeamMemberAnalysis[] {
  const team = MOCK_TEAMS.find(t => t.teamId === teamId);
  if (!team) return [];
  return MOCK_MEMBERS.filter(m => m.department === team.teamName.replace(' Team', ''));
}
