/**
 * Tests for enterprise aggregation functions.
 *
 * These pure functions roll individual TeamMemberAnalysis records
 * into team-level and org-level aggregate views.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTeamAnalytics,
  buildOrganizationAnalytics,
  aggregateGrowthAreas,
  aggregateKPT,
  aggregateEnhancedAntiPatterns,
  ANTI_PATTERN_DETAILS,
} from '../../../src/lib/enterprise/aggregation';
import { ANTI_PATTERN_LABELS } from '../../../src/types/enterprise';
import { createMockTeamMemberAnalysis } from '../../utils/team-helpers';

// ---------------------------------------------------------------------------
// buildTeamAnalytics
// ---------------------------------------------------------------------------

describe('buildTeamAnalytics', () => {
  it('returns zeroed-out analytics when members list is empty', () => {
    const result = buildTeamAnalytics('team-1', 'Empty Team', []);

    expect(result.teamId).toBe('team-1');
    expect(result.teamName).toBe('Empty Team');
    expect(result.memberCount).toBe(0);
    expect(result.averageOverallScore).toBe(0);
    expect(result.averageDimensions).toEqual({
      aiCollaboration: 0,
      contextEngineering: 0,
      burnoutRisk: 0,
      aiControl: 0,
      skillResilience: 0,
    });
    expect(result.typeDistribution).toEqual({
      architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0,
    });
    expect(result.controlLevelDistribution).toEqual({
      explorer: 0, navigator: 0, cartographer: 0,
    });
    expect(result.skillGaps).toEqual([]);
    expect(result.weeklyTrend).toEqual([]);
    expect(result.activeProjects).toEqual([]);
    expect(result.growthDistribution).toEqual({ improving: 0, stable: 0, declining: 0 });
    expect(result.antiPatternAggregates).toEqual([]);
  });

  it('returns single member values unchanged for a one-member team', () => {
    const member = createMockTeamMemberAnalysis({
      name: 'Alice',
      primaryType: 'analyst',
      controlLevel: 'cartographer',
      overallScore: 82,
      dimensions: {
        aiCollaboration: 80,
        contextEngineering: 75,
        burnoutRisk: 20,
        aiControl: 85,
        skillResilience: 90,
      },
      growth: {
        currentScore: 82,
        previousWeekScore: 80,
        previousMonthScore: 75,
        weekOverWeekDelta: 2,
        monthOverMonthDelta: 7,
        trend: 'improving',
      },
    });

    const result = buildTeamAnalytics('team-solo', 'Solo Team', [member]);

    expect(result.memberCount).toBe(1);
    expect(result.averageOverallScore).toBe(82);
    expect(result.averageDimensions).toEqual({
      aiCollaboration: 80,
      contextEngineering: 75,
      burnoutRisk: 20,
      aiControl: 85,
      skillResilience: 90,
    });
    expect(result.typeDistribution.analyst).toBe(1);
    expect(result.typeDistribution.architect).toBe(0);
    expect(result.controlLevelDistribution.cartographer).toBe(1);
    expect(result.growthDistribution.improving).toBe(1);
    expect(result.growthDistribution.stable).toBe(0);
  });

  it('correctly averages dimensions and rounds for multiple members', () => {
    const alice = createMockTeamMemberAnalysis({
      name: 'Alice',
      dimensions: {
        aiCollaboration: 80,
        contextEngineering: 60,
        burnoutRisk: 30,
        aiControl: 50,
        skillResilience: 70,
      },
    });
    const bob = createMockTeamMemberAnalysis({
      name: 'Bob',
      dimensions: {
        aiCollaboration: 70,
        contextEngineering: 80,
        burnoutRisk: 40,
        aiControl: 60,
        skillResilience: 90,
      },
    });
    const carol = createMockTeamMemberAnalysis({
      name: 'Carol',
      dimensions: {
        aiCollaboration: 90,
        contextEngineering: 70,
        burnoutRisk: 20,
        aiControl: 70,
        skillResilience: 80,
      },
    });

    const result = buildTeamAnalytics('t', 'T', [alice, bob, carol]);

    // (80+70+90)/3 = 80, (60+80+70)/3 = 70, (30+40+20)/3 = 30
    // (50+60+70)/3 = 60, (70+90+80)/3 = 80
    expect(result.averageDimensions).toEqual({
      aiCollaboration: 80,
      contextEngineering: 70,
      burnoutRisk: 30,
      aiControl: 60,
      skillResilience: 80,
    });
  });

  it('counts type distribution correctly across members', () => {
    const members = [
      createMockTeamMemberAnalysis({ primaryType: 'architect' }),
      createMockTeamMemberAnalysis({ primaryType: 'architect' }),
      createMockTeamMemberAnalysis({ primaryType: 'analyst' }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.typeDistribution.architect).toBe(2);
    expect(result.typeDistribution.analyst).toBe(1);
    expect(result.typeDistribution.conductor).toBe(0);
  });

  it('counts control level distribution correctly', () => {
    const members = [
      createMockTeamMemberAnalysis({ controlLevel: 'explorer' }),
      createMockTeamMemberAnalysis({ controlLevel: 'navigator' }),
      createMockTeamMemberAnalysis({ controlLevel: 'navigator' }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.controlLevelDistribution.explorer).toBe(1);
    expect(result.controlLevelDistribution.navigator).toBe(2);
    expect(result.controlLevelDistribution.cartographer).toBe(0);
  });

  it('identifies skill gaps for dimensions below 65 threshold, excluding burnoutRisk', () => {
    // Average aiControl = (50+60)/2 = 55 (below 65) -> gap
    // Average burnoutRisk = 80 (below 65 = false, but excluded anyway)
    // Average contextEngineering = (60+60)/2 = 60 (below 65) -> gap
    const members = [
      createMockTeamMemberAnalysis({
        dimensions: { aiCollaboration: 80, contextEngineering: 60, burnoutRisk: 80, aiControl: 50, skillResilience: 70 },
      }),
      createMockTeamMemberAnalysis({
        dimensions: { aiCollaboration: 80, contextEngineering: 60, burnoutRisk: 80, aiControl: 60, skillResilience: 70 },
      }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    const gapDimensions = result.skillGaps.map(g => g.dimension);
    expect(gapDimensions).toContain('contextEngineering');
    expect(gapDimensions).toContain('aiControl');
    expect(gapDimensions).not.toContain('burnoutRisk');
    expect(gapDimensions).not.toContain('aiCollaboration');

    const contextGap = result.skillGaps.find(g => g.dimension === 'contextEngineering')!;
    expect(contextGap.avgScore).toBe(60);
    expect(contextGap.membersBelowThreshold).toBe(2);
    expect(contextGap.threshold).toBe(65);
  });

  it('rounds averageOverallScore to 1 decimal place', () => {
    // (73 + 81 + 64) / 3 = 72.666... -> 72.7
    const members = [
      createMockTeamMemberAnalysis({ overallScore: 73 }),
      createMockTeamMemberAnalysis({ overallScore: 81 }),
      createMockTeamMemberAnalysis({ overallScore: 64 }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.averageOverallScore).toBe(72.7);
  });

  it('collects unique active projects across all members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        projects: [
          { projectName: 'alpha', sessionCount: 1, lastActiveDate: '2026-03-20', summaryLines: [] },
          { projectName: 'beta', sessionCount: 2, lastActiveDate: '2026-03-21', summaryLines: [] },
        ],
      }),
      createMockTeamMemberAnalysis({
        projects: [
          { projectName: 'beta', sessionCount: 1, lastActiveDate: '2026-03-22', summaryLines: [] },
          { projectName: 'gamma', sessionCount: 3, lastActiveDate: '2026-03-22', summaryLines: [] },
        ],
      }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.activeProjects.sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('counts growth distribution across improving/stable/declining', () => {
    const members = [
      createMockTeamMemberAnalysis({ growth: { currentScore: 80, previousWeekScore: 75, previousMonthScore: 70, weekOverWeekDelta: 5, monthOverMonthDelta: 10, trend: 'improving' } }),
      createMockTeamMemberAnalysis({ growth: { currentScore: 70, previousWeekScore: 70, previousMonthScore: 70, weekOverWeekDelta: 0, monthOverMonthDelta: 0, trend: 'stable' } }),
      createMockTeamMemberAnalysis({ growth: { currentScore: 60, previousWeekScore: 65, previousMonthScore: 70, weekOverWeekDelta: -5, monthOverMonthDelta: -10, trend: 'declining' } }),
      createMockTeamMemberAnalysis({ growth: { currentScore: 75, previousWeekScore: 72, previousMonthScore: 68, weekOverWeekDelta: 3, monthOverMonthDelta: 7, trend: 'improving' } }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.growthDistribution).toEqual({ improving: 2, stable: 1, declining: 1 });
  });

  it('computes weeklyTrend by averaging members history entries', () => {
    const members = [
      createMockTeamMemberAnalysis({
        history: [
          { date: '2026-03-15', overallScore: 60 },
          { date: '2026-03-22', overallScore: 70 },
        ],
      }),
      createMockTeamMemberAnalysis({
        history: [
          { date: '2026-03-15', overallScore: 80 },
          { date: '2026-03-22', overallScore: 90 },
        ],
      }),
    ];

    const result = buildTeamAnalytics('t', 'T', members);

    expect(result.weeklyTrend).toHaveLength(2);
    // (60+80)/2 = 70, (70+90)/2 = 80
    expect(result.weeklyTrend[0].overallScore).toBe(70);
    expect(result.weeklyTrend[1].overallScore).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// buildOrganizationAnalytics
// ---------------------------------------------------------------------------

describe('buildOrganizationAnalytics', () => {
  it('computes totalMembers and overallAverageScore across all members', () => {
    const members = [
      createMockTeamMemberAnalysis({ overallScore: 80 }),
      createMockTeamMemberAnalysis({ overallScore: 60 }),
      createMockTeamMemberAnalysis({ overallScore: 70 }),
    ];
    const team = buildTeamAnalytics('t1', 'Team 1', members);

    const result = buildOrganizationAnalytics('org-1', 'Acme', [team], members);

    expect(result.organizationId).toBe('org-1');
    expect(result.organizationName).toBe('Acme');
    expect(result.totalMembers).toBe(3);
    // (80+60+70)/3 = 70.0
    expect(result.overallAverageScore).toBe(70);
    expect(result.teams).toHaveLength(1);
  });

  it('returns score 0 and totalMembers 0 for empty members list', () => {
    const result = buildOrganizationAnalytics('org-empty', 'Ghost Org', [], []);

    expect(result.totalMembers).toBe(0);
    expect(result.overallAverageScore).toBe(0);
  });

  it('rounds overallAverageScore to 1 decimal place', () => {
    // (73+82+64)/3 = 73.0
    const members = [
      createMockTeamMemberAnalysis({ overallScore: 73 }),
      createMockTeamMemberAnalysis({ overallScore: 82 }),
      createMockTeamMemberAnalysis({ overallScore: 64 }),
    ];

    const result = buildOrganizationAnalytics('o', 'O', [], members);

    expect(result.overallAverageScore).toBe(73);
  });
});

// ---------------------------------------------------------------------------
// aggregateGrowthAreas
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreas', () => {
  it('excludes growth areas shared by fewer than 2 members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Tool Exploration', domain: 'thinkingQuality', severity: 'medium', recommendation: 'Use Task tool.' },
          { title: 'Unique Issue', domain: 'sessionOutcome', severity: 'low', recommendation: 'Only Alice has this.' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Tool Exploration', domain: 'thinkingQuality', severity: 'high', recommendation: 'Try subagents.' },
        ],
      }),
    ];

    const result = aggregateGrowthAreas(members);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Tool Exploration');
    // "Unique Issue" only appears for 1 member, excluded
  });

  it('picks predominant severity as the highest among affected members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Context Provision', domain: 'communicationPatterns', severity: 'low', recommendation: 'Add context.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Context Provision', domain: 'communicationPatterns', severity: 'critical', recommendation: 'Provide files.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{ title: 'Context Provision', domain: 'communicationPatterns', severity: 'medium', recommendation: 'More detail.' }],
      }),
    ];

    const result = aggregateGrowthAreas(members);

    expect(result[0].predominantSeverity).toBe('critical');
  });

  it('sorts by memberCount descending, then predominantSeverity descending', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Area A', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec-a' },
          { title: 'Area B', domain: 'learningBehavior', severity: 'low', recommendation: 'rec-b' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Area A', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec-a' },
          { title: 'Area B', domain: 'learningBehavior', severity: 'low', recommendation: 'rec-b' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          { title: 'Area A', domain: 'thinkingQuality', severity: 'low', recommendation: 'rec-a' },
        ],
      }),
    ];

    const result = aggregateGrowthAreas(members);

    // Area A: 3 members, Area B: 2 members -> Area A first
    expect(result[0].title).toBe('Area A');
    expect(result[0].memberCount).toBe(3);
    expect(result[1].title).toBe('Area B');
    expect(result[1].memberCount).toBe(2);
  });

  it('includes affectedMembers names and sampleRecommendation from first encounter', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Shared Gap', domain: 'contextEfficiency', severity: 'medium', recommendation: 'Alice recommendation' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Shared Gap', domain: 'contextEfficiency', severity: 'high', recommendation: 'Bob recommendation' }],
      }),
    ];

    const result = aggregateGrowthAreas(members);

    expect(result[0].affectedMembers).toEqual(['Alice', 'Bob']);
    expect(result[0].sampleRecommendation).toBe('Alice recommendation');
    expect(result[0].domainLabel).toBe('Context Efficiency');
  });
});

// ---------------------------------------------------------------------------
// aggregateKPT
// ---------------------------------------------------------------------------

describe('aggregateKPT', () => {
  it('excludes items shared by fewer than 2 members in each category', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        kpt: { keep: ['Good planning', 'Solo habit'], problem: ['Slow reviews'], tryNext: ['Pair programming'] },
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        kpt: { keep: ['Good planning'], problem: ['Slow reviews'], tryNext: ['Pair programming'] },
      }),
    ];

    const result = aggregateKPT(members);

    // "Solo habit" only from Alice -> excluded
    expect(result.keep).toHaveLength(1);
    expect(result.keep[0].text).toBe('Good planning');
    expect(result.keep[0].memberCount).toBe(2);
    expect(result.keep[0].affectedMembers).toEqual(['Alice', 'Bob']);

    expect(result.problem).toHaveLength(1);
    expect(result.problem[0].text).toBe('Slow reviews');

    expect(result.tryNext).toHaveLength(1);
    expect(result.tryNext[0].text).toBe('Pair programming');
  });

  it('sorts items within each category by memberCount descending', () => {
    const members = [
      createMockTeamMemberAnalysis({ name: 'A', kpt: { keep: ['X', 'Y'], problem: [], tryNext: [] } }),
      createMockTeamMemberAnalysis({ name: 'B', kpt: { keep: ['X', 'Y'], problem: [], tryNext: [] } }),
      createMockTeamMemberAnalysis({ name: 'C', kpt: { keep: ['X'], problem: [], tryNext: [] } }),
    ];

    const result = aggregateKPT(members);

    // X: 3 members, Y: 2 members
    expect(result.keep[0].text).toBe('X');
    expect(result.keep[0].memberCount).toBe(3);
    expect(result.keep[1].text).toBe('Y');
    expect(result.keep[1].memberCount).toBe(2);
  });

  it('returns empty arrays when no items are shared by 2+ members', () => {
    const members = [
      createMockTeamMemberAnalysis({ name: 'A', kpt: { keep: ['Unique A'], problem: ['Only A'], tryNext: ['A only'] } }),
      createMockTeamMemberAnalysis({ name: 'B', kpt: { keep: ['Unique B'], problem: ['Only B'], tryNext: ['B only'] } }),
    ];

    const result = aggregateKPT(members);

    expect(result.keep).toEqual([]);
    expect(result.problem).toEqual([]);
    expect(result.tryNext).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateEnhancedAntiPatterns
// ---------------------------------------------------------------------------

describe('aggregateEnhancedAntiPatterns', () => {
  it('deduplicates member counts but sums total occurrences including duplicates', () => {
    const memberId = 'member-1';
    const member = createMockTeamMemberAnalysis({
      id: memberId,
      name: 'Alice',
      antiPatterns: [
        { pattern: 'context_bloat', frequency: 3, impact: 'medium' },
        { pattern: 'context_bloat', frequency: 2, impact: 'low' },
      ],
    });

    const result = aggregateEnhancedAntiPatterns([member]);

    const bloat = result.find(r => r.pattern === 'context_bloat')!;
    expect(bloat.memberCount).toBe(1); // same member counted once
    expect(bloat.totalOccurrences).toBe(5); // 3 + 2
  });

  it('picks predominantImpact as high when any entry has high impact', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        antiPatterns: [{ pattern: 'late_compact', frequency: 1, impact: 'low' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        antiPatterns: [{ pattern: 'late_compact', frequency: 2, impact: 'high' }],
      }),
    ];

    const result = aggregateEnhancedAntiPatterns(members);

    expect(result[0].predominantImpact).toBe('high');
  });

  it('picks medium impact when no high but medium exists', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        antiPatterns: [{ pattern: 'redundant_info', frequency: 1, impact: 'low' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        antiPatterns: [{ pattern: 'redundant_info', frequency: 1, impact: 'medium' }],
      }),
    ];

    const result = aggregateEnhancedAntiPatterns(members);

    expect(result[0].predominantImpact).toBe('medium');
  });

  it('sorts by totalOccurrences descending', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        antiPatterns: [
          { pattern: 'context_bloat', frequency: 2, impact: 'low' },
          { pattern: 'late_compact', frequency: 10, impact: 'high' },
        ],
      }),
    ];

    const result = aggregateEnhancedAntiPatterns(members);

    expect(result[0].pattern).toBe('late_compact');
    expect(result[0].totalOccurrences).toBe(10);
    expect(result[1].pattern).toBe('context_bloat');
    expect(result[1].totalOccurrences).toBe(2);
  });

  it('includes description, actionableInsight from ANTI_PATTERN_DETAILS and label from ANTI_PATTERN_LABELS', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        antiPatterns: [{ pattern: 'no_session_separation', frequency: 4, impact: 'medium' }],
      }),
    ];

    const result = aggregateEnhancedAntiPatterns(members);

    const entry = result.find(r => r.pattern === 'no_session_separation')!;
    expect(entry.label).toBe(ANTI_PATTERN_LABELS['no_session_separation']);
    expect(entry.description).toBe(ANTI_PATTERN_DETAILS['no_session_separation'].description);
    expect(entry.actionableInsight).toBe(ANTI_PATTERN_DETAILS['no_session_separation'].actionableInsight);
    expect(entry.affectedMembers).toEqual(['Alice']);
  });

  it('returns empty array when no members have anti-patterns', () => {
    const members = [
      createMockTeamMemberAnalysis({ antiPatterns: [] }),
      createMockTeamMemberAnalysis({ antiPatterns: [] }),
    ];

    const result = aggregateEnhancedAntiPatterns(members);

    expect(result).toEqual([]);
  });
});
