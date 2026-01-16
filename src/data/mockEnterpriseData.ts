/**
 * Mock Enterprise Data
 * Sample team data for MVP demonstration
 */

import type {
  TeamMemberAnalysis,
  TeamAnalytics,
  DimensionScores,
  CodingStyleType,
  AIControlLevel,
  SkillGap,
  HistoryEntry,
} from '../types/enterprise';

// Helper to generate historical data
function generateHistory(baseScore: number, weeks: number = 4): HistoryEntry[] {
  const history: HistoryEntry[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);

    // Add some variance to simulate real data
    const variance = Math.floor(Math.random() * 10) - 5;
    const score = Math.max(30, Math.min(95, baseScore + variance - (weeks - i - 1) * 2));

    history.push({
      date: date.toISOString().split('T')[0],
      overallScore: score,
    });
  }

  return history;
}

// 8 Mock Team Members with varied profiles
export const MOCK_TEAM_MEMBERS: TeamMemberAnalysis[] = [
  {
    id: 'member-1',
    name: 'Alex Chen',
    email: 'alex.chen@company.com',
    role: 'Senior Engineer',
    department: 'Platform',
    primaryType: 'architect',
    controlLevel: 'ai-master',
    overallScore: 82,
    dimensions: {
      aiCollaboration: 85,
      contextEngineering: 78,
      burnoutRisk: 25,
      toolMastery: 88,
      aiControl: 82,
      skillResilience: 75,
    },
    history: generateHistory(82),
    lastAnalyzedAt: '2026-01-13T10:30:00Z',
    analysisCount: 12,
  },
  {
    id: 'member-2',
    name: 'Sarah Kim',
    email: 'sarah.kim@company.com',
    role: 'Staff Engineer',
    department: 'Backend',
    primaryType: 'scientist',
    controlLevel: 'ai-master',
    overallScore: 78,
    dimensions: {
      aiCollaboration: 72,
      contextEngineering: 85,
      burnoutRisk: 30,
      toolMastery: 76,
      aiControl: 88,
      skillResilience: 82,
    },
    history: generateHistory(78),
    lastAnalyzedAt: '2026-01-12T15:45:00Z',
    analysisCount: 9,
  },
  {
    id: 'member-3',
    name: 'Mike Park',
    email: 'mike.park@company.com',
    role: 'Frontend Lead',
    department: 'Frontend',
    primaryType: 'collaborator',
    controlLevel: 'developing',
    overallScore: 68,
    dimensions: {
      aiCollaboration: 82,
      contextEngineering: 65,
      burnoutRisk: 45,
      toolMastery: 70,
      aiControl: 55,
      skillResilience: 60,
    },
    history: generateHistory(68),
    lastAnalyzedAt: '2026-01-13T09:15:00Z',
    analysisCount: 7,
  },
  {
    id: 'member-4',
    name: 'Emma Wilson',
    email: 'emma.wilson@company.com',
    role: 'Data Engineer',
    department: 'Data',
    primaryType: 'craftsman',
    controlLevel: 'ai-master',
    overallScore: 85,
    dimensions: {
      aiCollaboration: 80,
      contextEngineering: 88,
      burnoutRisk: 20,
      toolMastery: 92,
      aiControl: 85,
      skillResilience: 78,
    },
    history: generateHistory(85),
    lastAnalyzedAt: '2026-01-11T14:20:00Z',
    analysisCount: 15,
  },
  {
    id: 'member-5',
    name: 'James Lee',
    email: 'james.lee@company.com',
    role: 'Junior Engineer',
    department: 'Frontend',
    primaryType: 'speedrunner',
    controlLevel: 'vibe-coder',
    overallScore: 52,
    dimensions: {
      aiCollaboration: 70,
      contextEngineering: 45,
      burnoutRisk: 60,
      toolMastery: 55,
      aiControl: 38,
      skillResilience: 42,
    },
    history: generateHistory(52),
    lastAnalyzedAt: '2026-01-13T11:00:00Z',
    analysisCount: 4,
  },
  {
    id: 'member-6',
    name: 'Lisa Zhang',
    email: 'lisa.zhang@company.com',
    role: 'Senior Engineer',
    department: 'Backend',
    primaryType: 'architect',
    controlLevel: 'developing',
    overallScore: 71,
    dimensions: {
      aiCollaboration: 75,
      contextEngineering: 72,
      burnoutRisk: 35,
      toolMastery: 68,
      aiControl: 70,
      skillResilience: 65,
    },
    history: generateHistory(71),
    lastAnalyzedAt: '2026-01-10T16:30:00Z',
    analysisCount: 8,
  },
  {
    id: 'member-7',
    name: 'David Brown',
    email: 'david.brown@company.com',
    role: 'Tech Lead',
    department: 'Platform',
    primaryType: 'scientist',
    controlLevel: 'ai-master',
    overallScore: 88,
    dimensions: {
      aiCollaboration: 90,
      contextEngineering: 92,
      burnoutRisk: 15,
      toolMastery: 85,
      aiControl: 90,
      skillResilience: 88,
    },
    history: generateHistory(88),
    lastAnalyzedAt: '2026-01-13T08:45:00Z',
    analysisCount: 20,
  },
  {
    id: 'member-8',
    name: 'Nina Patel',
    email: 'nina.patel@company.com',
    role: 'Engineer',
    department: 'Data',
    primaryType: 'collaborator',
    controlLevel: 'developing',
    overallScore: 65,
    dimensions: {
      aiCollaboration: 78,
      contextEngineering: 62,
      burnoutRisk: 40,
      toolMastery: 60,
      aiControl: 58,
      skillResilience: 55,
    },
    history: generateHistory(65),
    lastAnalyzedAt: '2026-01-12T10:15:00Z',
    analysisCount: 6,
  },
];

// Calculate type distribution
function calculateTypeDistribution(members: TeamMemberAnalysis[]): Record<CodingStyleType, number> {
  const dist: Record<CodingStyleType, number> = {
    architect: 0,
    scientist: 0,
    collaborator: 0,
    speedrunner: 0,
    craftsman: 0,
  };

  members.forEach(m => {
    dist[m.primaryType]++;
  });

  return dist;
}

// Calculate control level distribution
function calculateControlDistribution(members: TeamMemberAnalysis[]): Record<AIControlLevel, number> {
  const dist: Record<AIControlLevel, number> = {
    'vibe-coder': 0,
    'developing': 0,
    'ai-master': 0,
  };

  members.forEach(m => {
    dist[m.controlLevel]++;
  });

  return dist;
}

// Calculate average dimensions
function calculateAverageDimensions(members: TeamMemberAnalysis[]): DimensionScores {
  const totals: DimensionScores = {
    aiCollaboration: 0,
    contextEngineering: 0,
    burnoutRisk: 0,
    toolMastery: 0,
    aiControl: 0,
    skillResilience: 0,
  };

  members.forEach(m => {
    (Object.keys(totals) as (keyof DimensionScores)[]).forEach(key => {
      totals[key] += m.dimensions[key];
    });
  });

  const count = members.length;
  return {
    aiCollaboration: Math.round(totals.aiCollaboration / count),
    contextEngineering: Math.round(totals.contextEngineering / count),
    burnoutRisk: Math.round(totals.burnoutRisk / count),
    toolMastery: Math.round(totals.toolMastery / count),
    aiControl: Math.round(totals.aiControl / count),
    skillResilience: Math.round(totals.skillResilience / count),
  };
}

// Calculate skill gaps (dimensions below threshold)
function calculateSkillGaps(avgDimensions: DimensionScores, members: TeamMemberAnalysis[], threshold: number = 65): SkillGap[] {
  const gaps: SkillGap[] = [];
  const labels: Record<keyof DimensionScores, string> = {
    aiCollaboration: 'AI Collaboration',
    contextEngineering: 'Context Engineering',
    burnoutRisk: 'Burnout Risk',
    toolMastery: 'Tool Mastery',
    aiControl: 'AI Control',
    skillResilience: 'Skill Resilience',
  };

  (Object.keys(avgDimensions) as (keyof DimensionScores)[]).forEach(key => {
    // For burnout risk, lower is better, so we invert the logic
    const isBurnout = key === 'burnoutRisk';
    const avgScore = avgDimensions[key];
    const membersBelowThreshold = members.filter(m => {
      return isBurnout
        ? m.dimensions[key] > (100 - threshold)  // High burnout is bad
        : m.dimensions[key] < threshold;
    }).length;

    // Add to gaps if average is concerning
    const isConcerning = isBurnout
      ? avgScore > (100 - threshold)
      : avgScore < threshold;

    if (isConcerning || membersBelowThreshold >= 2) {
      gaps.push({
        dimension: key,
        label: labels[key],
        avgScore,
        membersBelowThreshold,
        threshold: isBurnout ? 100 - threshold : threshold,
      });
    }
  });

  // Sort by most critical gaps first
  return gaps.sort((a, b) => {
    if (a.dimension === 'burnoutRisk') return a.avgScore > b.avgScore ? -1 : 1;
    return a.avgScore - b.avgScore;
  });
}

// Generate weekly trend from member histories
function generateWeeklyTrend(members: TeamMemberAnalysis[]): HistoryEntry[] {
  const weeklyData: Map<string, number[]> = new Map();

  members.forEach(m => {
    m.history.forEach(h => {
      const scores = weeklyData.get(h.date) || [];
      scores.push(h.overallScore);
      weeklyData.set(h.date, scores);
    });
  });

  const trend: HistoryEntry[] = [];
  weeklyData.forEach((scores, date) => {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    trend.push({ date, overallScore: avg });
  });

  return trend.sort((a, b) => a.date.localeCompare(b.date));
}

// Calculate week-over-week change
function calculateWoWChange(trend: HistoryEntry[]): number {
  if (trend.length < 2) return 0;
  const latest = trend[trend.length - 1].overallScore;
  const previous = trend[trend.length - 2].overallScore;
  return Number(((latest - previous) / previous * 100).toFixed(1));
}

// Pre-calculated analytics
const avgDimensions = calculateAverageDimensions(MOCK_TEAM_MEMBERS);
const weeklyTrend = generateWeeklyTrend(MOCK_TEAM_MEMBERS);

// Mock Team Analytics (pre-calculated)
export const MOCK_TEAM_ANALYTICS: TeamAnalytics = {
  teamId: 'team-demo',
  teamName: 'Engineering Team',
  memberCount: MOCK_TEAM_MEMBERS.length,
  averageOverallScore: Math.round(
    MOCK_TEAM_MEMBERS.reduce((sum, m) => sum + m.overallScore, 0) / MOCK_TEAM_MEMBERS.length
  ),
  averageDimensions: avgDimensions,
  typeDistribution: calculateTypeDistribution(MOCK_TEAM_MEMBERS),
  controlLevelDistribution: calculateControlDistribution(MOCK_TEAM_MEMBERS),
  skillGaps: calculateSkillGaps(avgDimensions, MOCK_TEAM_MEMBERS),
  weeklyTrend,
  weekOverWeekChange: calculateWoWChange(weeklyTrend),
  monthOverMonthChange: 5.2, // Hardcoded for demo
};
