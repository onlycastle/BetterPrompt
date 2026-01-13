/**
 * Mock Enterprise Data for API
 * Simplified version of web-ui mock data with hardcoded values
 */

export interface DimensionScores {
  aiCollaboration: number;
  contextEngineering: number;
  burnoutRisk: number;
  toolMastery: number;
  aiControl: number;
  skillResilience: number;
}

export interface HistoryEntry {
  date: string;
  overallScore: number;
}

export interface TeamMemberAnalysis {
  id: string;
  name: string;
  email?: string;
  role: string;
  department: string;
  primaryType: 'architect' | 'scientist' | 'collaborator' | 'speedrunner' | 'craftsman';
  controlLevel: 'vibe-coder' | 'developing' | 'ai-master';
  overallScore: number;
  dimensions: DimensionScores;
  history: HistoryEntry[];
  lastAnalyzedAt: string;
  analysisCount: number;
}

export interface SkillGap {
  dimension: keyof DimensionScores;
  label: string;
  avgScore: number;
  membersBelowThreshold: number;
  threshold: number;
}

export interface TeamAnalytics {
  teamId: string;
  teamName: string;
  memberCount: number;
  averageOverallScore: number;
  averageDimensions: DimensionScores;
  typeDistribution: Record<string, number>;
  controlLevelDistribution: Record<string, number>;
  skillGaps: SkillGap[];
  weeklyTrend: HistoryEntry[];
  weekOverWeekChange: number;
  monthOverMonthChange: number;
}

// 8 Mock Team Members
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
    history: [
      { date: '2025-12-16', overallScore: 78 },
      { date: '2025-12-23', overallScore: 80 },
      { date: '2025-12-30', overallScore: 81 },
      { date: '2026-01-06', overallScore: 82 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 74 },
      { date: '2025-12-23', overallScore: 76 },
      { date: '2025-12-30', overallScore: 77 },
      { date: '2026-01-06', overallScore: 78 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 64 },
      { date: '2025-12-23', overallScore: 66 },
      { date: '2025-12-30', overallScore: 67 },
      { date: '2026-01-06', overallScore: 68 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 81 },
      { date: '2025-12-23', overallScore: 83 },
      { date: '2025-12-30', overallScore: 84 },
      { date: '2026-01-06', overallScore: 85 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 48 },
      { date: '2025-12-23', overallScore: 50 },
      { date: '2025-12-30', overallScore: 51 },
      { date: '2026-01-06', overallScore: 52 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 67 },
      { date: '2025-12-23', overallScore: 69 },
      { date: '2025-12-30', overallScore: 70 },
      { date: '2026-01-06', overallScore: 71 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 84 },
      { date: '2025-12-23', overallScore: 86 },
      { date: '2025-12-30', overallScore: 87 },
      { date: '2026-01-06', overallScore: 88 },
    ],
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
    history: [
      { date: '2025-12-16', overallScore: 61 },
      { date: '2025-12-23', overallScore: 63 },
      { date: '2025-12-30', overallScore: 64 },
      { date: '2026-01-06', overallScore: 65 },
    ],
    lastAnalyzedAt: '2026-01-12T10:15:00Z',
    analysisCount: 6,
  },
];

// Pre-calculated Team Analytics
export const MOCK_TEAM_ANALYTICS: TeamAnalytics = {
  teamId: 'team-demo',
  teamName: 'Engineering Team',
  memberCount: 8,
  averageOverallScore: 74,
  averageDimensions: {
    aiCollaboration: 79,
    contextEngineering: 73,
    burnoutRisk: 34,
    toolMastery: 74,
    aiControl: 71,
    skillResilience: 68,
  },
  typeDistribution: {
    architect: 2,
    scientist: 2,
    collaborator: 2,
    speedrunner: 1,
    craftsman: 1,
  },
  controlLevelDistribution: {
    'vibe-coder': 1,
    developing: 3,
    'ai-master': 4,
  },
  skillGaps: [
    {
      dimension: 'skillResilience',
      label: 'Skill Resilience',
      avgScore: 68,
      membersBelowThreshold: 3,
      threshold: 65,
    },
    {
      dimension: 'aiControl',
      label: 'AI Control',
      avgScore: 71,
      membersBelowThreshold: 2,
      threshold: 65,
    },
  ],
  weeklyTrend: [
    { date: '2025-12-16', overallScore: 70 },
    { date: '2025-12-23', overallScore: 72 },
    { date: '2025-12-30', overallScore: 73 },
    { date: '2026-01-06', overallScore: 74 },
  ],
  weekOverWeekChange: 1.4,
  monthOverMonthChange: 5.2,
};
