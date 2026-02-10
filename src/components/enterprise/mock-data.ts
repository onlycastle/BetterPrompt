/**
 * Enterprise Dashboard Mock Data
 * 12 members across 2 teams, 1 organization
 * Replace with real API calls when backend integration is ready
 */

import type {
  TeamMemberAnalysis,
  TeamAnalytics,
  OrganizationAnalytics,
  DimensionScores,
  HistoryEntry,
  SkillGap,
} from '../../types/enterprise';
import type { CodingStyleType, AIControlLevel } from '../../lib/models/coding-style';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateHistory(baseScore: number, weeks: number): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    // Gradual improvement with noise
    const trend = (weeks - 1 - i) * 0.8;
    const noise = (Math.sin(i * 2.5) * 4) + (Math.cos(i * 1.7) * 2);
    entries.push({
      date: date.toISOString().split('T')[0],
      overallScore: Math.round(Math.min(100, Math.max(20, baseScore + trend + noise))),
    });
  }
  return entries;
}

function makeMember(
  id: string,
  name: string,
  email: string,
  role: string,
  department: string,
  primaryType: CodingStyleType,
  controlLevel: AIControlLevel,
  overallScore: number,
  dimensions: DimensionScores,
  analysisCount: number,
): TeamMemberAnalysis {
  return {
    id,
    name,
    email,
    role,
    department,
    primaryType,
    controlLevel,
    overallScore,
    dimensions,
    history: generateHistory(overallScore - 8, 8),
    lastAnalyzedAt: new Date().toISOString(),
    analysisCount,
  };
}

// ---------------------------------------------------------------------------
// Members (12 total)
// ---------------------------------------------------------------------------

export const MOCK_MEMBERS: TeamMemberAnalysis[] = [
  // Platform Team (6 members)
  makeMember('m1', 'Alice Kim', 'alice@acme.dev', 'Senior Engineer', 'Platform',
    'architect', 'cartographer', 82,
    { aiCollaboration: 85, contextEngineering: 88, burnoutRisk: 25, toolMastery: 80, aiControl: 90, skillResilience: 78 }, 12),
  makeMember('m2', 'Bob Park', 'bob@acme.dev', 'Engineer', 'Platform',
    'speedrunner', 'navigator', 71,
    { aiCollaboration: 75, contextEngineering: 65, burnoutRisk: 45, toolMastery: 72, aiControl: 68, skillResilience: 70 }, 8),
  makeMember('m3', 'Carol Lee', 'carol@acme.dev', 'Staff Engineer', 'Platform',
    'analyst', 'cartographer', 88,
    { aiCollaboration: 82, contextEngineering: 90, burnoutRisk: 20, toolMastery: 85, aiControl: 92, skillResilience: 90 }, 15),
  makeMember('m4', 'David Choi', 'david@acme.dev', 'Engineer', 'Platform',
    'conductor', 'navigator', 74,
    { aiCollaboration: 78, contextEngineering: 70, burnoutRisk: 35, toolMastery: 82, aiControl: 72, skillResilience: 68 }, 6),
  makeMember('m5', 'Eve Jung', 'eve@acme.dev', 'Senior Engineer', 'Platform',
    'trendsetter', 'explorer', 69,
    { aiCollaboration: 72, contextEngineering: 68, burnoutRisk: 40, toolMastery: 75, aiControl: 60, skillResilience: 65 }, 5),
  makeMember('m6', 'Frank Oh', 'frank@acme.dev', 'Junior Engineer', 'Platform',
    'speedrunner', 'explorer', 58,
    { aiCollaboration: 55, contextEngineering: 50, burnoutRisk: 55, toolMastery: 60, aiControl: 52, skillResilience: 48 }, 3),

  // Product Team (6 members)
  makeMember('m7', 'Grace Han', 'grace@acme.dev', 'Lead Engineer', 'Product',
    'architect', 'navigator', 79,
    { aiCollaboration: 80, contextEngineering: 82, burnoutRisk: 30, toolMastery: 76, aiControl: 78, skillResilience: 80 }, 10),
  makeMember('m8', 'Henry Yoon', 'henry@acme.dev', 'Senior Engineer', 'Product',
    'analyst', 'navigator', 76,
    { aiCollaboration: 78, contextEngineering: 80, burnoutRisk: 28, toolMastery: 72, aiControl: 75, skillResilience: 74 }, 9),
  makeMember('m9', 'Ivy Shin', 'ivy@acme.dev', 'Engineer', 'Product',
    'conductor', 'cartographer', 81,
    { aiCollaboration: 84, contextEngineering: 78, burnoutRisk: 22, toolMastery: 88, aiControl: 82, skillResilience: 76 }, 11),
  makeMember('m10', 'Jake Ryu', 'jake@acme.dev', 'Engineer', 'Product',
    'trendsetter', 'navigator', 67,
    { aiCollaboration: 70, contextEngineering: 64, burnoutRisk: 42, toolMastery: 68, aiControl: 62, skillResilience: 60 }, 4),
  makeMember('m11', 'Kate Lim', 'kate@acme.dev', 'Senior Engineer', 'Product',
    'architect', 'cartographer', 85,
    { aiCollaboration: 88, contextEngineering: 86, burnoutRisk: 18, toolMastery: 82, aiControl: 88, skillResilience: 84 }, 14),
  makeMember('m12', 'Leo Baek', 'leo@acme.dev', 'Junior Engineer', 'Product',
    'speedrunner', 'explorer', 55,
    { aiCollaboration: 52, contextEngineering: 48, burnoutRisk: 58, toolMastery: 55, aiControl: 50, skillResilience: 45 }, 2),
];

// ---------------------------------------------------------------------------
// Team-level aggregates
// ---------------------------------------------------------------------------

function buildTeamAnalytics(
  teamId: string,
  teamName: string,
  members: TeamMemberAnalysis[],
): TeamAnalytics {
  const count = members.length;

  // Average dimensions
  const avgDim: DimensionScores = {
    aiCollaboration: 0, contextEngineering: 0, burnoutRisk: 0,
    toolMastery: 0, aiControl: 0, skillResilience: 0,
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
    toolMastery: 'Tool Mastery',
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
  };
}

const platformMembers = MOCK_MEMBERS.filter(m => m.department === 'Platform');
const productMembers = MOCK_MEMBERS.filter(m => m.department === 'Product');

export const MOCK_TEAMS: TeamAnalytics[] = [
  buildTeamAnalytics('team-platform', 'Platform Team', platformMembers),
  buildTeamAnalytics('team-product', 'Product Team', productMembers),
];

// ---------------------------------------------------------------------------
// Organization-level
// ---------------------------------------------------------------------------

export const MOCK_ORGANIZATION: OrganizationAnalytics = {
  organizationId: 'org-acme',
  organizationName: 'Acme Dev Corp',
  teams: MOCK_TEAMS,
  totalMembers: MOCK_MEMBERS.length,
  overallAverageScore: Math.round(
    MOCK_MEMBERS.reduce((s, m) => s + m.overallScore, 0) / MOCK_MEMBERS.length * 10
  ) / 10,
};
