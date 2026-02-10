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
  AntiPatternAggregate,
  InefficiencyPattern,
} from '../types/enterprise';
import { ANTI_PATTERN_LABELS } from '../types/enterprise';

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

export function useOrgAntiPatterns(): AntiPatternAggregate[] {
  const map = new Map<InefficiencyPattern, { members: Set<string>; total: number; impacts: ('high' | 'medium' | 'low')[] }>();
  for (const m of MOCK_MEMBERS) {
    for (const ap of m.antiPatterns) {
      const entry = map.get(ap.pattern) ?? { members: new Set(), total: 0, impacts: [] };
      entry.members.add(m.id);
      entry.total += ap.frequency;
      entry.impacts.push(ap.impact);
      map.set(ap.pattern, entry);
    }
  }
  return [...map.entries()]
    .map(([pattern, data]) => ({
      pattern,
      label: ANTI_PATTERN_LABELS[pattern],
      memberCount: data.members.size,
      totalOccurrences: data.total,
      predominantImpact: data.impacts.includes('high') ? 'high' as const
        : data.impacts.includes('medium') ? 'medium' as const
        : 'low' as const,
    }))
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}
