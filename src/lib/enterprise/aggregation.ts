/**
 * Enterprise Aggregation Utilities
 *
 * Pure functions that aggregate individual TeamMemberAnalysis data
 * into team-level and org-level views. Extracted from mock-data.ts
 * for use with real data.
 */

import type {
  TeamMemberAnalysis,
  TeamAnalytics,
  OrganizationAnalytics,
  DimensionScores,
  HistoryEntry,
  SkillGap,
  AntiPatternAggregate,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamKPTAggregate,
  TeamKPTItem,
  MemberGrowthArea,
  InefficiencyPattern,
} from '@/types/enterprise';
import { ANTI_PATTERN_LABELS } from '@/types/enterprise';
import type { CodingStyleType, AIControlLevel } from '@/lib/models/coding-style';

// ---------------------------------------------------------------------------
// Anti-pattern detail map
// ---------------------------------------------------------------------------

export const ANTI_PATTERN_DETAILS: Record<InefficiencyPattern, { description: string; actionableInsight: string }> = {
  late_compact: {
    description: 'Context compaction triggered too late in the session, causing degraded AI performance and increased token waste.',
    actionableInsight: 'Train the team to trigger compaction proactively at 60% context fill, not reactively at 90%+.',
  },
  context_bloat: {
    description: 'Sessions accumulate excessive context through large paste operations and unnecessary file inclusions.',
    actionableInsight: 'Establish a "minimal context" practice: include only files and snippets directly relevant to the current task.',
  },
  redundant_info: {
    description: 'Same information is re-provided multiple times within a session, wasting context window capacity.',
    actionableInsight: 'Encourage referencing prior messages instead of re-pasting. Use "as discussed above" patterns.',
  },
  prompt_length_inflation: {
    description: 'Prompts grow increasingly verbose without proportional improvement in output quality.',
    actionableInsight: 'Workshop concise prompting techniques. Aim for <200 words per prompt with structured formatting.',
  },
  no_session_separation: {
    description: 'Multiple unrelated tasks are handled in a single session, degrading context relevance.',
    actionableInsight: 'Establish a team norm: new task = new session. Keep sessions focused on one objective.',
  },
  verbose_error_pasting: {
    description: 'Full stack traces and error logs are pasted without summarization, consuming excessive context.',
    actionableInsight: 'Train developers to extract key error lines and provide summaries rather than raw pastes.',
  },
  no_knowledge_persistence: {
    description: 'Insights and decisions from sessions are not recorded, leading to repeated problem-solving.',
    actionableInsight: 'Implement session-end summaries stored in project docs for cross-session knowledge transfer.',
  },
};

// ---------------------------------------------------------------------------
// Domain configs (shared constant)
// ---------------------------------------------------------------------------

export const DOMAIN_CONFIGS = [
  { domain: 'thinkingQuality', label: 'Thinking Quality' },
  { domain: 'communicationPatterns', label: 'Communication' },
  { domain: 'learningBehavior', label: 'Learning Behavior' },
  { domain: 'contextEfficiency', label: 'Context Efficiency' },
  { domain: 'sessionOutcome', label: 'Session Outcome' },
] as const;

// ---------------------------------------------------------------------------
// Growth area aggregation
// ---------------------------------------------------------------------------

export function aggregateGrowthAreas(members: TeamMemberAnalysis[]): TeamGrowthAreaAggregate[] {
  const map = new Map<string, {
    domain: string;
    domainLabel: string;
    members: string[];
    severities: MemberGrowthArea['severity'][];
    recommendation: string;
  }>();

  const domainLabelMap: Record<string, string> = {};
  for (const { domain, label } of DOMAIN_CONFIGS) {
    domainLabelMap[domain] = label;
  }

  for (const m of members) {
    for (const ga of m.growthAreas) {
      const entry = map.get(ga.title) ?? {
        domain: ga.domain,
        domainLabel: domainLabelMap[ga.domain] ?? ga.domain,
        members: [],
        severities: [],
        recommendation: ga.recommendation,
      };
      entry.members.push(m.name);
      entry.severities.push(ga.severity);
      map.set(ga.title, entry);
    }
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;

  return [...map.entries()]
    .filter(([, data]) => data.members.length >= 2)
    .map(([title, data]) => {
      const predominant = data.severities.reduce((best, s) =>
        severityRank[s] > severityRank[best] ? s : best, data.severities[0]);
      return {
        title,
        domain: data.domain,
        domainLabel: data.domainLabel,
        memberCount: data.members.length,
        affectedMembers: data.members,
        predominantSeverity: predominant,
        sampleRecommendation: data.recommendation,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount || severityRank[b.predominantSeverity] - severityRank[a.predominantSeverity]);
}

// ---------------------------------------------------------------------------
// KPT aggregation
// ---------------------------------------------------------------------------

export function aggregateKPT(members: TeamMemberAnalysis[]): TeamKPTAggregate {
  function aggregateCategory(items: { text: string; memberName: string }[]): TeamKPTItem[] {
    const map = new Map<string, string[]>();
    for (const { text, memberName } of items) {
      const arr = map.get(text) ?? [];
      arr.push(memberName);
      map.set(text, arr);
    }
    return [...map.entries()]
      .filter(([, members]) => members.length >= 2)
      .map(([text, members]) => ({ text, memberCount: members.length, affectedMembers: members }))
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  const keepItems = members.flatMap(m => m.kpt.keep.map(text => ({ text, memberName: m.name })));
  const problemItems = members.flatMap(m => m.kpt.problem.map(text => ({ text, memberName: m.name })));
  const tryItems = members.flatMap(m => m.kpt.tryNext.map(text => ({ text, memberName: m.name })));

  return {
    keep: aggregateCategory(keepItems),
    problem: aggregateCategory(problemItems),
    tryNext: aggregateCategory(tryItems),
  };
}

// ---------------------------------------------------------------------------
// Anti-pattern aggregation
// ---------------------------------------------------------------------------

export function aggregateEnhancedAntiPatterns(members: TeamMemberAnalysis[]): EnhancedAntiPatternAggregate[] {
  const map = new Map<InefficiencyPattern, {
    memberNames: string[];
    memberIds: Set<string>;
    total: number;
    impacts: ('high' | 'medium' | 'low')[];
  }>();

  for (const m of members) {
    for (const ap of m.antiPatterns) {
      const entry = map.get(ap.pattern) ?? { memberNames: [], memberIds: new Set(), total: 0, impacts: [] };
      if (!entry.memberIds.has(m.id)) {
        entry.memberNames.push(m.name);
        entry.memberIds.add(m.id);
      }
      entry.total += ap.frequency;
      entry.impacts.push(ap.impact);
      map.set(ap.pattern, entry);
    }
  }

  return [...map.entries()]
    .map(([pattern, data]) => {
      const details = ANTI_PATTERN_DETAILS[pattern];
      return {
        pattern,
        label: ANTI_PATTERN_LABELS[pattern],
        memberCount: data.memberIds.size,
        totalOccurrences: data.total,
        predominantImpact: data.impacts.includes('high') ? 'high' as const
          : data.impacts.includes('medium') ? 'medium' as const
          : 'low' as const,
        description: details.description,
        affectedMembers: data.memberNames,
        actionableInsight: details.actionableInsight,
      };
    })
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}

// ---------------------------------------------------------------------------
// Team analytics builder
// ---------------------------------------------------------------------------

export function buildTeamAnalytics(
  teamId: string,
  teamName: string,
  members: TeamMemberAnalysis[],
): TeamAnalytics {
  const count = members.length;
  if (count === 0) {
    return {
      teamId,
      teamName,
      memberCount: 0,
      averageOverallScore: 0,
      averageDimensions: { aiCollaboration: 0, contextEngineering: 0, burnoutRisk: 0, aiControl: 0, skillResilience: 0 },
      typeDistribution: { architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0 },
      controlLevelDistribution: { explorer: 0, navigator: 0, cartographer: 0 },
      skillGaps: [],
      weeklyTrend: [],
      weekOverWeekChange: 0,
      monthOverMonthChange: 0,
      totalTokensThisWeek: 0,
      antiPatternAggregates: [],
      activeProjects: [],
      growthDistribution: { improving: 0, stable: 0, declining: 0 },
    };
  }

  // Average dimensions
  const avgDim: DimensionScores = {
    aiCollaboration: 0, contextEngineering: 0, burnoutRisk: 0,
    aiControl: 0, skillResilience: 0,
  };
  for (const m of members) {
    for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
      avgDim[key] += m.dimensions[key];
    }
  }
  for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
    avgDim[key] = Math.round(avgDim[key] / count);
  }

  // Type distribution
  const typeDist = { architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0 } as Record<CodingStyleType, number>;
  for (const m of members) {
    typeDist[m.primaryType]++;
  }

  // Control level distribution
  const controlDist = { explorer: 0, navigator: 0, cartographer: 0 } as Record<AIControlLevel, number>;
  for (const m of members) {
    controlDist[m.controlLevel]++;
  }

  // Skill gaps (dimensions below 65 avg)
  const threshold = 65;
  const gaps: SkillGap[] = [];
  const dimLabels: Record<keyof DimensionScores, string> = {
    aiCollaboration: 'AI Collaboration',
    contextEngineering: 'Context Engineering',
    burnoutRisk: 'Burnout Risk',
    aiControl: 'AI Control',
    skillResilience: 'Skill Resilience',
  };
  for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
    if (key === 'burnoutRisk') continue; // Inverted metric
    if (avgDim[key] < threshold) {
      gaps.push({
        dimension: key,
        label: dimLabels[key],
        avgScore: avgDim[key],
        membersBelowThreshold: members.filter(m => m.dimensions[key] < threshold).length,
        threshold,
      });
    }
  }

  // Average overall score
  const avgScore = Math.round(members.reduce((s, m) => s + m.overallScore, 0) / count * 10) / 10;

  // Weekly trend (aggregate from members' histories)
  const weeklyTrend: HistoryEntry[] = [];
  if (members.length > 0 && members[0].history.length > 0) {
    for (let w = 0; w < members[0].history.length; w++) {
      const avg = Math.round(members.reduce((s, m) => s + (m.history[w]?.overallScore ?? 0), 0) / count);
      weeklyTrend.push({ date: members[0].history[w].date, overallScore: avg });
    }
  }

  const wowChange = weeklyTrend.length >= 2
    ? Math.round((weeklyTrend[weeklyTrend.length - 1].overallScore - weeklyTrend[weeklyTrend.length - 2].overallScore) * 10) / 10
    : 0;

  const momChange = weeklyTrend.length >= 5
    ? Math.round((weeklyTrend[weeklyTrend.length - 1].overallScore - weeklyTrend[weeklyTrend.length - 5].overallScore) * 10) / 10
    : 0;

  // Token usage
  const lastWeekTrend = members.flatMap(m => {
    const last = m.tokenUsage.weeklyTokenTrend[m.tokenUsage.weeklyTokenTrend.length - 1];
    return last ? [last.totalTokens] : [];
  });
  const totalTokensThisWeek = lastWeekTrend.reduce((s, t) => s + t, 0);

  const allProjects = new Set(members.flatMap(m => m.projects.map(p => p.projectName)));

  const growthDist = { improving: 0, stable: 0, declining: 0 };
  for (const m of members) {
    growthDist[m.growth.trend]++;
  }

  // Simple anti-pattern aggregates (without enhanced details)
  const simpleAntiPatterns: AntiPatternAggregate[] = aggregateEnhancedAntiPatterns(members)
    .map(({ pattern, label, memberCount, totalOccurrences, predominantImpact }) => ({
      pattern, label, memberCount, totalOccurrences, predominantImpact,
    }));

  return {
    teamId,
    teamName,
    memberCount: count,
    averageOverallScore: avgScore,
    averageDimensions: avgDim,
    typeDistribution: typeDist,
    controlLevelDistribution: controlDist,
    skillGaps: gaps,
    weeklyTrend,
    weekOverWeekChange: wowChange,
    monthOverMonthChange: momChange,
    totalTokensThisWeek,
    antiPatternAggregates: simpleAntiPatterns,
    activeProjects: [...allProjects],
    growthDistribution: growthDist,
  };
}

// ---------------------------------------------------------------------------
// Organization analytics builder
// ---------------------------------------------------------------------------

export function buildOrganizationAnalytics(
  orgId: string,
  orgName: string,
  teams: TeamAnalytics[],
  allMembers: TeamMemberAnalysis[],
): OrganizationAnalytics {
  const totalMembers = allMembers.length;
  const overallAverageScore = totalMembers > 0
    ? Math.round(allMembers.reduce((s, m) => s + m.overallScore, 0) / totalMembers * 10) / 10
    : 0;

  return {
    organizationId: orgId,
    organizationName: orgName,
    teams,
    totalMembers,
    overallAverageScore,
  };
}
