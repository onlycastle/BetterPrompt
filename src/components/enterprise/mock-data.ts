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
  MemberTokenUsage,
  MemberAntiPattern,
  MemberProjectActivity,
  MemberStrengthSummary,
  MemberGrowthSnapshot,
  MemberGrowthArea,
  MemberKPT,
  WeeklyTokenTrend,
  AntiPatternAggregate,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamKPTAggregate,
  TeamKPTItem,
  InefficiencyPattern,
} from '../../types/enterprise';
import { ANTI_PATTERN_LABELS } from '../../types/enterprise';
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

// ---------------------------------------------------------------------------
// New generator helpers for manager-actionable data
// ---------------------------------------------------------------------------

const DOMAIN_CONFIGS = [
  { domain: 'thinkingQuality', label: 'Thinking Quality' },
  { domain: 'communicationPatterns', label: 'Communication' },
  { domain: 'learningBehavior', label: 'Learning Behavior' },
  { domain: 'contextEfficiency', label: 'Context Efficiency' },
  { domain: 'sessionOutcome', label: 'Session Outcome' },
] as const;

const STRENGTH_TITLES: Record<string, string[]> = {
  thinkingQuality: ['Systematic Planning', 'Critical Verification', 'Error Anticipation'],
  communicationPatterns: ['Clear Requirement Framing', 'Iterative Refinement', 'Context Provisioning'],
  learningBehavior: ['Knowledge Retention', 'Cross-Session Learning', 'Mistake Recovery'],
  contextEfficiency: ['Token Optimization', 'Context Window Management', 'Efficient Prompting'],
  sessionOutcome: ['Goal Completion', 'Friction Reduction', 'Outcome Quality'],
};

const PROJECT_NAMES = [
  'auth-service', 'payment-gateway', 'dashboard-v2', 'api-refactor',
  'search-engine', 'notification-hub', 'mobile-app', 'data-pipeline',
  'infra-migration', 'ml-platform', 'docs-site', 'design-system',
];

const SUMMARY_LINES = [
  'Implemented JWT token rotation with refresh flow',
  'Refactored database query layer for batch operations',
  'Added real-time WebSocket event streaming',
  'Migrated legacy REST endpoints to GraphQL',
  'Built CI/CD pipeline with staged deployments',
  'Integrated Stripe webhook handlers for subscription billing',
  'Added E2E tests for critical user flows',
  'Optimized image processing pipeline with worker threads',
  'Implemented role-based access control middleware',
  'Created reusable form validation library',
  'Set up monitoring dashboards with Grafana',
  'Built data export feature with CSV/JSON formats',
];

function generateTokenUsage(activity: 'high' | 'medium' | 'low'): MemberTokenUsage {
  const base = activity === 'high' ? { sessions: 28, messages: 420, fill: 52, max: 78 }
    : activity === 'medium' ? { sessions: 18, messages: 260, fill: 65, max: 88 }
    : { sessions: 8, messages: 110, fill: 78, max: 96 };

  const now = new Date();
  const weeklyTokenTrend: WeeklyTokenTrend[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const baseTokens = activity === 'high' ? 450000 : activity === 'medium' ? 280000 : 120000;
    const noise = Math.round(Math.sin(i * 1.3) * baseTokens * 0.15);
    weeklyTokenTrend.push({
      weekStart: d.toISOString().split('T')[0],
      totalTokens: baseTokens + noise + Math.round(i * baseTokens * 0.03),
      sessions: Math.max(1, Math.round(base.sessions / 4 + Math.sin(i) * 2)),
    });
  }

  return {
    totalSessions: base.sessions,
    totalMessages: base.messages,
    avgContextFillPercent: base.fill,
    maxContextFillPercent: base.max,
    contextFillExceeded90Count: activity === 'low' ? 5 : activity === 'medium' ? 2 : 0,
    weeklyTokenTrend,
  };
}

function generateAntiPatterns(risk: 'low' | 'medium' | 'high'): MemberAntiPattern[] {
  const allPatterns: InefficiencyPattern[] = [
    'late_compact', 'context_bloat', 'redundant_info',
    'prompt_length_inflation', 'no_session_separation', 'verbose_error_pasting',
    'no_knowledge_persistence',
  ];

  const count = risk === 'high' ? 4 : risk === 'medium' ? 2 : 1;
  const patterns: MemberAntiPattern[] = [];
  const shuffled = [...allPatterns].sort(() => Math.sin(patterns.length + count) - 0.3);

  for (let i = 0; i < count; i++) {
    patterns.push({
      pattern: shuffled[i],
      frequency: risk === 'high' ? 5 + i * 2 : risk === 'medium' ? 3 + i : 1,
      impact: risk === 'high' ? (i < 2 ? 'high' : 'medium') : risk === 'medium' ? 'medium' : 'low',
    });
  }
  return patterns;
}

function generateProjects(count: number, seed: number): MemberProjectActivity[] {
  const now = new Date();
  const projects: MemberProjectActivity[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 3) % PROJECT_NAMES.length;
    const d = new Date(now);
    d.setDate(d.getDate() - i * 5);
    projects.push({
      projectName: PROJECT_NAMES[idx],
      sessionCount: Math.max(1, 8 - i * 2),
      lastActiveDate: d.toISOString().split('T')[0],
      summaryLines: [
        SUMMARY_LINES[(seed + i) % SUMMARY_LINES.length],
        SUMMARY_LINES[(seed + i + 4) % SUMMARY_LINES.length],
      ],
    });
  }
  return projects;
}

function generateStrengths(level: 'strong' | 'average' | 'developing'): MemberStrengthSummary[] {
  const baseScore = level === 'strong' ? 82 : level === 'average' ? 68 : 52;
  return DOMAIN_CONFIGS.map(({ domain, label }, i) => ({
    domain,
    domainLabel: label,
    topStrength: STRENGTH_TITLES[domain]?.[i % 3] ?? 'General Proficiency',
    domainScore: Math.min(100, Math.max(20, baseScore + (Math.sin(i * 2.1) * 10))),
  }));
}

// ---------------------------------------------------------------------------
// Growth area pools (shared titles ensure overlap for meaningful aggregation)
// ---------------------------------------------------------------------------

const GROWTH_AREA_POOL: Record<string, { title: string; recommendation: string }[]> = {
  thinkingQuality: [
    { title: 'Premature Implementation', recommendation: 'Spend more time understanding requirements before jumping into code. Write a brief plan for sessions longer than 30 minutes.' },
    { title: 'Insufficient Error Anticipation', recommendation: 'Before implementing, list 3 potential failure modes. Add error handling proactively rather than reactively.' },
    { title: 'Weak Verification Habits', recommendation: 'After each major code change, explicitly verify the output matches expectations before moving on.' },
  ],
  communicationPatterns: [
    { title: 'Vague Requirement Framing', recommendation: 'Provide concrete examples and acceptance criteria when describing tasks to AI assistants.' },
    { title: 'Lack of Iterative Refinement', recommendation: 'Break large requests into smaller, verifiable steps rather than asking for everything at once.' },
    { title: 'Missing Context in Follow-ups', recommendation: 'When continuing a conversation, reference specific prior decisions to maintain coherent context.' },
  ],
  learningBehavior: [
    { title: 'Repeated Mistake Patterns', recommendation: 'Create a personal "lessons learned" doc and review it before starting similar tasks.' },
    { title: 'No Cross-Session Knowledge Transfer', recommendation: 'Summarize key decisions at session end and reference them in the next session.' },
    { title: 'Low Adaptation Speed', recommendation: 'When AI suggests a new approach, try it in a small scope before defaulting to familiar patterns.' },
  ],
  contextEfficiency: [
    { title: 'Context Window Overuse', recommendation: 'Use session separation and context compaction techniques to stay under 70% fill.' },
    { title: 'Redundant Information Passing', recommendation: 'Reference prior context instead of re-pasting large code blocks. Use file paths and line numbers.' },
    { title: 'Inefficient Prompt Structure', recommendation: 'Structure prompts with clear sections: goal, constraints, examples. Avoid narrative-style requests.' },
  ],
  sessionOutcome: [
    { title: 'Incomplete Task Closure', recommendation: 'Define "done" criteria at session start. Verify all criteria are met before ending.' },
    { title: 'High Friction Ratio', recommendation: 'Track time spent on rework vs. forward progress. If >30% is rework, pause and reassess approach.' },
    { title: 'Low Outcome Quality', recommendation: 'Add a final review step: re-read generated code, check edge cases, verify test coverage.' },
  ],
};

// ---------------------------------------------------------------------------
// KPT pools (shared text ensures overlap for meaningful aggregation)
// ---------------------------------------------------------------------------

const KPT_POOL = {
  keep: [
    'Systematic planning before implementation',
    'Consistent use of session separation for distinct tasks',
    'Thorough verification of AI-generated code',
    'Effective context engineering with clear constraints',
    'Regular knowledge persistence through documentation',
    'Iterative refinement of prompts based on output quality',
  ],
  problem: [
    'Context window frequently exceeds 80% utilization',
    'Repeated patterns of verbose error pasting',
    'Lack of session separation for unrelated tasks',
    'Accepting AI output without sufficient verification',
    'Starting implementation without understanding requirements',
    'Not leveraging prior session learnings',
  ],
  tryNext: [
    'Implement structured prompt templates for common tasks',
    'Create a personal anti-pattern checklist for code review',
    'Adopt context compaction strategy before 60% fill',
    'Use AI pair programming for design discussions before coding',
    'Document session insights in a reusable knowledge base',
    'Practice deliberate verification after every 3 AI interactions',
  ],
};

function generateMemberGrowthAreas(level: 'strong' | 'average' | 'developing'): MemberGrowthArea[] {
  const count = level === 'developing' ? 4 : level === 'average' ? 2 : 1;
  const severities: MemberGrowthArea['severity'][] =
    level === 'developing' ? ['critical', 'high', 'high', 'medium']
    : level === 'average' ? ['medium', 'low']
    : ['low'];
  const domains = Object.keys(GROWTH_AREA_POOL);
  const areas: MemberGrowthArea[] = [];
  for (let i = 0; i < count; i++) {
    const domain = domains[i % domains.length];
    const pool = GROWTH_AREA_POOL[domain];
    const item = pool[i % pool.length];
    areas.push({
      title: item.title,
      domain,
      severity: severities[i] ?? 'medium',
      recommendation: item.recommendation,
    });
  }
  return areas;
}

function generateMemberKPT(level: 'strong' | 'average' | 'developing'): MemberKPT {
  const keepCount = level === 'strong' ? 3 : level === 'average' ? 2 : 1;
  const problemCount = level === 'developing' ? 3 : level === 'average' ? 2 : 1;
  const tryCount = level === 'developing' ? 3 : level === 'average' ? 2 : 1;
  return {
    keep: KPT_POOL.keep.slice(0, keepCount),
    problem: KPT_POOL.problem.slice(0, problemCount),
    tryNext: KPT_POOL.tryNext.slice(0, tryCount),
  };
}

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
// Team-level aggregation functions
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

function generateGrowth(history: HistoryEntry[]): MemberGrowthSnapshot {
  const current = history[history.length - 1]?.overallScore ?? 50;
  const prevWeek = history[history.length - 2]?.overallScore ?? current;
  const prevMonth = history[history.length - 5]?.overallScore ?? history[0]?.overallScore ?? current;
  const wow = Math.round((current - prevWeek) * 10) / 10;
  const mom = Math.round((current - prevMonth) * 10) / 10;
  const trend: MemberGrowthSnapshot['trend'] = mom > 2 ? 'improving' : mom < -2 ? 'declining' : 'stable';
  return {
    currentScore: current,
    previousWeekScore: prevWeek,
    previousMonthScore: prevMonth,
    weekOverWeekDelta: wow,
    monthOverMonthDelta: mom,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Member factory
// ---------------------------------------------------------------------------

interface MemberProfile {
  activity: 'high' | 'medium' | 'low';
  risk: 'low' | 'medium' | 'high';
  projectCount: number;
  strengthLevel: 'strong' | 'average' | 'developing';
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
  profile: MemberProfile,
): TeamMemberAnalysis {
  const history = generateHistory(overallScore - 8, 8);
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
    history,
    tokenUsage: generateTokenUsage(profile.activity),
    antiPatterns: generateAntiPatterns(profile.risk),
    projects: generateProjects(profile.projectCount, parseInt(id.replace('m', ''), 10)),
    strengthSummaries: generateStrengths(profile.strengthLevel),
    growth: generateGrowth(history),
    growthAreas: generateMemberGrowthAreas(profile.strengthLevel),
    kpt: generateMemberKPT(profile.strengthLevel),
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
    { aiCollaboration: 85, contextEngineering: 88, burnoutRisk: 25, aiControl: 90, skillResilience: 78 }, 12,
    { activity: 'high', risk: 'low', projectCount: 4, strengthLevel: 'strong' }),
  makeMember('m2', 'Bob Park', 'bob@acme.dev', 'Engineer', 'Platform',
    'speedrunner', 'navigator', 71,
    { aiCollaboration: 75, contextEngineering: 65, burnoutRisk: 45, aiControl: 68, skillResilience: 70 }, 8,
    { activity: 'medium', risk: 'medium', projectCount: 3, strengthLevel: 'average' }),
  makeMember('m3', 'Carol Lee', 'carol@acme.dev', 'Staff Engineer', 'Platform',
    'analyst', 'cartographer', 88,
    { aiCollaboration: 82, contextEngineering: 90, burnoutRisk: 20, aiControl: 92, skillResilience: 90 }, 15,
    { activity: 'high', risk: 'low', projectCount: 5, strengthLevel: 'strong' }),
  makeMember('m4', 'David Choi', 'david@acme.dev', 'Engineer', 'Platform',
    'conductor', 'navigator', 74,
    { aiCollaboration: 78, contextEngineering: 70, burnoutRisk: 35, aiControl: 72, skillResilience: 68 }, 6,
    { activity: 'medium', risk: 'medium', projectCount: 2, strengthLevel: 'average' }),
  makeMember('m5', 'Eve Jung', 'eve@acme.dev', 'Senior Engineer', 'Platform',
    'trendsetter', 'explorer', 69,
    { aiCollaboration: 72, contextEngineering: 68, burnoutRisk: 40, aiControl: 60, skillResilience: 65 }, 5,
    { activity: 'medium', risk: 'medium', projectCount: 3, strengthLevel: 'average' }),
  makeMember('m6', 'Frank Oh', 'frank@acme.dev', 'Junior Engineer', 'Platform',
    'speedrunner', 'explorer', 58,
    { aiCollaboration: 55, contextEngineering: 50, burnoutRisk: 55, aiControl: 52, skillResilience: 48 }, 3,
    { activity: 'low', risk: 'high', projectCount: 1, strengthLevel: 'developing' }),

  // Product Team (6 members)
  makeMember('m7', 'Grace Han', 'grace@acme.dev', 'Lead Engineer', 'Product',
    'architect', 'navigator', 79,
    { aiCollaboration: 80, contextEngineering: 82, burnoutRisk: 30, aiControl: 78, skillResilience: 80 }, 10,
    { activity: 'high', risk: 'low', projectCount: 4, strengthLevel: 'strong' }),
  makeMember('m8', 'Henry Yoon', 'henry@acme.dev', 'Senior Engineer', 'Product',
    'analyst', 'navigator', 76,
    { aiCollaboration: 78, contextEngineering: 80, burnoutRisk: 28, aiControl: 75, skillResilience: 74 }, 9,
    { activity: 'medium', risk: 'low', projectCount: 3, strengthLevel: 'average' }),
  makeMember('m9', 'Ivy Shin', 'ivy@acme.dev', 'Engineer', 'Product',
    'conductor', 'cartographer', 81,
    { aiCollaboration: 84, contextEngineering: 78, burnoutRisk: 22, aiControl: 82, skillResilience: 76 }, 11,
    { activity: 'high', risk: 'low', projectCount: 3, strengthLevel: 'strong' }),
  makeMember('m10', 'Jake Ryu', 'jake@acme.dev', 'Engineer', 'Product',
    'trendsetter', 'navigator', 67,
    { aiCollaboration: 70, contextEngineering: 64, burnoutRisk: 42, aiControl: 62, skillResilience: 60 }, 4,
    { activity: 'low', risk: 'medium', projectCount: 2, strengthLevel: 'developing' }),
  makeMember('m11', 'Kate Lim', 'kate@acme.dev', 'Senior Engineer', 'Product',
    'architect', 'cartographer', 85,
    { aiCollaboration: 88, contextEngineering: 86, burnoutRisk: 18, aiControl: 88, skillResilience: 84 }, 14,
    { activity: 'high', risk: 'low', projectCount: 4, strengthLevel: 'strong' }),
  makeMember('m12', 'Leo Baek', 'leo@acme.dev', 'Junior Engineer', 'Product',
    'speedrunner', 'explorer', 55,
    { aiCollaboration: 52, contextEngineering: 48, burnoutRisk: 58, aiControl: 50, skillResilience: 45 }, 2,
    { activity: 'low', risk: 'high', projectCount: 1, strengthLevel: 'developing' }),
];

// ---------------------------------------------------------------------------
// Team-level aggregates
// ---------------------------------------------------------------------------

/** Derive simple aggregates from enhanced aggregates (avoids duplicating aggregation logic) */
function aggregateAntiPatterns(members: TeamMemberAnalysis[]): AntiPatternAggregate[] {
  return aggregateEnhancedAntiPatterns(members).map(({ pattern, label, memberCount, totalOccurrences, predominantImpact }) => ({
    pattern, label, memberCount, totalOccurrences, predominantImpact,
  }));
}

function buildTeamAnalytics(
  teamId: string,
  teamName: string,
  members: TeamMemberAnalysis[],
): TeamAnalytics {
  const count = members.length;

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

  // Manager-actionable aggregates
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
    antiPatternAggregates: aggregateAntiPatterns(members),
    activeProjects: [...allProjects],
    growthDistribution: growthDist,
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
