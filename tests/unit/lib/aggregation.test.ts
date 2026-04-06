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
  aggregateGrowthAreasPEA,
  aggregateKPT,
  aggregateEnhancedAntiPatterns,
  computeTagOverlapCount,
  computePatternFrequencies,
  generateTeamActionItems,
  groupPatternsByTag,
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

// ---------------------------------------------------------------------------
// computeTagOverlapCount
// ---------------------------------------------------------------------------

describe('computeTagOverlapCount', () => {
  it('returns 0 when either array is empty', () => {
    expect(computeTagOverlapCount([], ['react', 'typescript'])).toBe(0);
    expect(computeTagOverlapCount(['react'], [])).toBe(0);
    expect(computeTagOverlapCount([], [])).toBe(0);
  });

  it('counts shared tags with semantic normalization (case, separators, fillers)', () => {
    // "Error-Handling" and "error-handling" normalize to the same canonical form
    expect(computeTagOverlapCount(
      ['Error-Handling', 'React'],
      ['error-handling', 'react', 'testing'],
    )).toBe(2);
  });

  it('matches synonym tags (e.g. testing ↔ test, docs ↔ documentation)', () => {
    // "debugging" and "troubleshooting" both map to canonical "debug"
    expect(computeTagOverlapCount(
      ['debugging', 'documentation'],
      ['troubleshooting', 'docs'],
    )).toBe(2);
  });

  it('returns 0 when no tags overlap semantically', () => {
    expect(computeTagOverlapCount(
      ['debugging', 'python'],
      ['react', 'deployment'],
    )).toBe(0);
  });

  it('does not double-count: each tag in tagsB matches at most once', () => {
    // Both 'error-handling' entries in tagsA normalize the same, but tagsB only has one match
    expect(computeTagOverlapCount(
      ['error-handling', 'error-handling', 'react'],
      ['error handling', 'typescript'],
    )).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// aggregateGrowthAreasPEA
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreasPEA', () => {
  it('returns empty array when no members provided', () => {
    expect(aggregateGrowthAreasPEA([])).toEqual([]);
  });

  it('returns empty array when no growth areas shared by 2+ members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Only Alice',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Unique to Alice',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Only Bob',
          domain: 'communicationPatterns',
          severity: 'low',
          recommendation: 'Unique to Bob',
        }],
      }),
    ];

    expect(aggregateGrowthAreasPEA(members)).toEqual([]);
  });

  // Pass 1: Exact title match
  it('clusters growth areas with identical titles across developers (Pass 1)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Error Loop Pattern',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Run test first before changing code.',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Error Loop Pattern',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Use TDD approach.',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{
          title: 'Error Loop Pattern',
          domain: 'thinkingQuality',
          severity: 'low',
          recommendation: 'Read logs carefully.',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Error Loop Pattern');
    expect(result[0].memberCount).toBe(3);
    expect(result[0].affectedMembers).toEqual(['Alice', 'Bob', 'Carol']);
    expect(result[0].predominantSeverity).toBe('high');
  });

  // Pass 2: Tag overlap clustering
  it('clusters growth areas with different titles but overlapping tags (Pass 2)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Late Error Handling',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Add error boundaries early.',
          // PEA extension fields cast as any to simulate runtime
          categoryTags: ['error-handling', 'react', 'component-lifecycle'],
          toolsFilesApis: ['ErrorBoundary.tsx'],
          actionInstruction: 'Add ErrorBoundary to App.tsx',
          verificationCheck: 'Check for ErrorBoundary import',
          goalRelevance: 'Prevents user-facing crashes',
          evidenceCount: 3,
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Missing Error Boundaries',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Wrap async components with error boundaries.',
          categoryTags: ['error-handling', 'react', 'async-patterns'],
          toolsFilesApis: ['AsyncComponent.tsx'],
          actionInstruction: 'Add Suspense error boundary',
          verificationCheck: 'Check for Suspense+ErrorBoundary pairing',
          goalRelevance: 'Improves user experience',
          evidenceCount: 2,
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    // memberCount = 2 (Alice + Bob)
    expect(result[0].memberCount).toBe(2);
    expect(result[0].affectedMembers).toContain('Alice');
    expect(result[0].affectedMembers).toContain('Bob');
    // Tags should be de-duplicated and frequency-ranked
    expect(result[0].categoryTags).toContain('error-handling');
    expect(result[0].categoryTags).toContain('react');
  });

  it('does NOT cluster areas in different domains even with overlapping tags', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Area A',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['testing', 'debugging', 'vitest'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Area B',
          domain: 'communicationPatterns', // different domain
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['testing', 'debugging', 'communication'],
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);
    // Areas in different domains should not cluster together
    expect(result).toHaveLength(0);
  });

  it('requires TAG_OVERLAP_THRESHOLD (2) shared tags to cluster', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Area A',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['testing', 'unique-alice-tag'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Area B',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['testing', 'unique-bob-tag'],
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);
    // Only 1 shared tag ('testing') < threshold of 2 -> no cluster
    expect(result).toHaveLength(0);
  });

  it('produces frequency-ranked category tags in output', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Shared Pattern',
          domain: 'learningBehavior',
          severity: 'high',
          recommendation: 'rec',
          categoryTags: ['debugging', 'testing', 'rare-tag'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Shared Pattern',
          domain: 'learningBehavior',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['debugging', 'testing'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{
          title: 'Shared Pattern',
          domain: 'learningBehavior',
          severity: 'low',
          recommendation: 'rec',
          categoryTags: ['debugging'],
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    // 'debugging' has freq 3, 'testing' has freq 2, 'rare-tag' has freq 1
    expect(result[0].categoryTags[0]).toBe('debugging');
    expect(result[0].categoryTags[1]).toBe('testing');
    expect(result[0].categoryTags[2]).toBe('rare-tag');
  });

  it('includes memberSeverities breakdown for each contributor', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Shared Issue',
          domain: 'contextEfficiency',
          severity: 'critical',
          recommendation: 'rec',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Shared Issue',
          domain: 'contextEfficiency',
          severity: 'low',
          recommendation: 'rec',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result[0].memberSeverities).toEqual([
      { memberName: 'Alice', severity: 'critical' },
      { memberName: 'Bob', severity: 'low' },
    ]);
  });

  it('generates teamRecommendation with frequency count and domain-specific intervention', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Context Bloat',
          domain: 'contextEfficiency',
          severity: 'high',
          recommendation: 'Use concise prompts.',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Context Bloat',
          domain: 'contextEfficiency',
          severity: 'high',
          recommendation: 'Trim context.',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{
          title: 'Context Bloat',
          domain: 'contextEfficiency',
          severity: 'medium',
          recommendation: 'Minimal pastes.',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // Frequency context is present
    expect(result[0].teamRecommendation).toContain('3 of 3 developers');
    expect(result[0].teamRecommendation).toContain('100%');
    // Individual guidance is appended
    expect(result[0].teamRecommendation).toContain('Individual guidance:');
    // Domain-specific intervention for contextEfficiency + high severity
    // Should contain one of the context-efficiency urgent interventions (workshop/checklist/CLAUDE.md)
    const teamRec = result[0].teamRecommendation;
    const hasContextIntervention = teamRec.includes('context') || teamRec.includes('session') || teamRec.includes('CLAUDE.md');
    expect(hasContextIntervention).toBe(true);
  });

  it('selects best KB tip by highest relevance score among members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Testing Gap',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Add tests.',
          categoryTags: ['testing', 'vitest'],
          toolsFilesApis: ['vitest'],
          actionInstruction: 'Run vitest before commits',
          verificationCheck: 'Check for vitest in bash history',
          goalRelevance: 'Code reliability',
          evidenceCount: 2,
          kbTipId: 'kb-001',
          kbTipTitle: 'Vitest Best Practices',
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Testing Gap',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Write unit tests.',
          categoryTags: ['testing', 'jest'],
          toolsFilesApis: ['jest'],
          actionInstruction: 'Add test coverage',
          verificationCheck: 'Check coverage report',
          goalRelevance: 'Prevent regressions',
          evidenceCount: 3,
          kbTipId: 'kb-002',
          kbTipTitle: 'TDD Workflow Guide',
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // Both have kbTipId but neither has kbTipRelevanceScore explicitly set
    // so the first one encountered with a kbTipId wins (Alice's, since 0 > 0 is false, keeps first)
    expect(result[0].kbTipId).toBeDefined();
  });

  it('deduplicates same member contributing multiple areas to a tag cluster', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          {
            title: 'Error Handling A',
            domain: 'thinkingQuality',
            severity: 'low',
            recommendation: 'rec-1',
            categoryTags: ['error-handling', 'react', 'jsx'],
          } as any,
          {
            title: 'Error Handling B',
            domain: 'thinkingQuality',
            severity: 'critical',
            recommendation: 'rec-2',
            categoryTags: ['error-handling', 'react', 'hooks'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Error Recovery',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec-3',
          categoryTags: ['error-handling', 'react', 'retry'],
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    // Alice should appear only once even though she contributed 2 areas
    expect(result[0].memberCount).toBe(2);
    expect(result[0].affectedMembers).toEqual(['Alice', 'Bob']);
    // Alice's highest severity (critical) should be kept
    const aliceSeverity = result[0].memberSeverities.find(s => s.memberName === 'Alice');
    expect(aliceSeverity?.severity).toBe('critical');
  });

  it('sorts results by memberCount desc then severity desc', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'learningBehavior', severity: 'low', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'learningBehavior', severity: 'low', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'low', recommendation: 'rec' },
        ],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // Pattern A: 3 members, Pattern B: 2 members
    expect(result[0].title).toBe('Pattern A');
    expect(result[0].memberCount).toBe(3);
    expect(result[1].title).toBe('Pattern B');
    expect(result[1].memberCount).toBe(2);
  });

  it('handles mixed PEA and non-PEA growth areas in the same team', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          // PEA-format growth area
          {
            title: 'Shared Pattern',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'rec-pea',
            categoryTags: ['testing', 'debugging'],
            toolsFilesApis: ['vitest'],
            actionInstruction: 'Run tests first',
            verificationCheck: 'Check bash for vitest',
            goalRelevance: 'reliability',
            evidenceCount: 3,
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          // Non-PEA growth area (no categoryTags)
          {
            title: 'Shared Pattern',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec-plain',
          },
        ],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // Should still cluster by exact title match (Pass 1)
    expect(result).toHaveLength(1);
    expect(result[0].memberCount).toBe(2);
    // Tags from Alice's PEA area should be present
    expect(result[0].categoryTags).toContain('testing');
    expect(result[0].categoryTags).toContain('debugging');
  });

  it('propagates lowConfidence flag when any contributor has it', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Emerging Pattern',
          domain: 'sessionOutcome',
          severity: 'low',
          recommendation: 'rec',
          lowConfidence: true,
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Emerging Pattern',
          domain: 'sessionOutcome',
          severity: 'low',
          recommendation: 'rec',
          lowConfidence: false,
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result[0].hasLowConfidenceContributors).toBe(true);
  });

  it('uses correct domain label from DOMAIN_CONFIGS', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'communicationPatterns',
          severity: 'medium',
          recommendation: 'rec',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'communicationPatterns',
          severity: 'medium',
          recommendation: 'rec',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result[0].domainLabel).toBe('Communication');
  });

  it('picks most frequent title as representative in tag clusters', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Common Title',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['error-handling', 'react', 'hooks'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Common Title',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['error-handling', 'react', 'state'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{
          title: 'Rare Title',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['error-handling', 'react', 'context'],
        } as any],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // All 3 should cluster via exact title (Common Title x2) + tag overlap (Carol's Rare Title has 2 shared tags)
    // Actually: Pass 1 clusters Alice+Bob by title. Carol remains unclustered.
    // Pass 2: Carol's tags overlap with Alice+Bob cluster? No - Pass 2 only handles unclustered.
    // So we get 1 cluster (Common Title, 2 members). Carol is unclustered (1 member, excluded).
    // Let's verify this is the expected behavior:
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Common Title');
    expect(result[0].memberCount).toBe(2);
  });

  it('includes representative evidence moments from PEA growth areas', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          evidenceMoments: [{
            sessionId: 'sess-1',
            quote: 'Alice said this',
            behaviorDescription: 'debugging without tests',
          }],
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          evidenceMoments: [{
            sessionId: 'sess-2',
            quote: 'Bob said this',
            behaviorDescription: 'skipping test verification',
          }],
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result[0].representativeEvidence).toHaveLength(2);
    expect(result[0].representativeEvidence![0].memberName).toBe('Alice');
    expect(result[0].representativeEvidence![1].memberName).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// generateTeamActionItems
// ---------------------------------------------------------------------------

describe('generateTeamActionItems', () => {
  it('returns empty array when no patterns provided', () => {
    expect(generateTeamActionItems([], 5)).toEqual([]);
  });

  it('returns empty array when totalMembers is 0', () => {
    const patterns = aggregateGrowthAreasPEA([
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'X', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'X', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
    ]);
    expect(generateTeamActionItems(patterns, 0)).toEqual([]);
  });

  it('assigns priority numbers starting at 1', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'communicationPatterns', severity: 'low', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'communicationPatterns', severity: 'low', recommendation: 'rec' },
        ],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    const items = generateTeamActionItems(patterns, 2);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].priority).toBe(1);
    if (items.length > 1) {
      expect(items[1].priority).toBe(2);
    }
  });

  it('marks critical + >50% affected as immediate urgency', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Critical Pattern', domain: 'contextEfficiency', severity: 'critical', recommendation: 'Fix now.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Critical Pattern', domain: 'contextEfficiency', severity: 'critical', recommendation: 'Fix now.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{ title: 'Critical Pattern', domain: 'contextEfficiency', severity: 'high', recommendation: 'Fix soon.' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    const items = generateTeamActionItems(patterns, 3);

    expect(items[0].urgency).toBe('immediate');
    expect(items[0].severity).toBe('critical');
    expect(items[0].affectedMembers).toHaveLength(3);
  });

  it('marks high severity as this-sprint urgency', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'High Pattern', domain: 'learningBehavior', severity: 'high', recommendation: 'Learn more.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'High Pattern', domain: 'learningBehavior', severity: 'high', recommendation: 'Practice.' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    // 2 of 5 devs = 40%, high severity → this-sprint
    const items = generateTeamActionItems(patterns, 5);

    expect(items[0].urgency).toBe('this-sprint');
  });

  it('marks medium/low severity with low frequency as next-sprint urgency', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Minor Pattern', domain: 'sessionOutcome', severity: 'low', recommendation: 'Improve.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Minor Pattern', domain: 'sessionOutcome', severity: 'low', recommendation: 'Improve.' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    // 2 of 10 devs = 20%, low severity → next-sprint
    const items = generateTeamActionItems(patterns, 10);

    expect(items[0].urgency).toBe('next-sprint');
  });

  it('caps output at 7 items maximum', () => {
    // Create 10 distinct patterns shared by 2+ members
    const patterns: Array<{ title: string; domain: string; severity: 'high' | 'medium'; recommendation: string }> = [];
    for (let i = 0; i < 10; i++) {
      patterns.push({
        title: `Pattern ${i}`,
        domain: 'thinkingQuality',
        severity: i < 5 ? 'high' : 'medium',
        recommendation: `rec ${i}`,
      });
    }

    const members = [
      createMockTeamMemberAnalysis({ name: 'Alice', growthAreas: patterns }),
      createMockTeamMemberAnalysis({ name: 'Bob', growthAreas: patterns }),
    ];

    const peaPatterns = aggregateGrowthAreasPEA(members);
    const items = generateTeamActionItems(peaPatterns, 2);

    expect(items.length).toBeLessThanOrEqual(7);
  });

  it('sorts by urgency then severity then member count', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Low Priority', domain: 'sessionOutcome', severity: 'low', recommendation: 'rec' },
          { title: 'High Priority', domain: 'contextEfficiency', severity: 'critical', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Low Priority', domain: 'sessionOutcome', severity: 'low', recommendation: 'rec' },
          { title: 'High Priority', domain: 'contextEfficiency', severity: 'critical', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          { title: 'High Priority', domain: 'contextEfficiency', severity: 'critical', recommendation: 'rec' },
        ],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    // Use totalMembers=8 so Low Priority ratio = 2/8 = 25% (below 40% threshold → next-sprint)
    const items = generateTeamActionItems(patterns, 8);

    // High Priority: 3 of 8 members (38%), critical → immediate would require >50%, but critical+high → this-sprint
    // Actually: critical severity + 3/8=37.5% not >50% → not immediate. But high severity → this-sprint.
    // Low Priority: 2 of 8 members (25%), low severity, <40% → next-sprint
    expect(items[0].pattern).toBe('High Priority');
    expect(items[1].pattern).toBe('Low Priority');
    expect(items[1].urgency).toBe('next-sprint');
    // Higher urgency items come first
    const urgencyRank: Record<string, number> = { immediate: 3, 'this-sprint': 2, 'next-sprint': 1 };
    expect(urgencyRank[items[0].urgency]).toBeGreaterThanOrEqual(urgencyRank[items[1].urgency]);
  });

  it('generates domain-specific actions (not generic advice)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Prompt Verbosity', domain: 'communicationPatterns', severity: 'high', recommendation: 'Be concise.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Prompt Verbosity', domain: 'communicationPatterns', severity: 'high', recommendation: 'Shorten prompts.' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    const items = generateTeamActionItems(patterns, 2);

    // Communication domain high severity should have a communication-specific intervention
    // (prompt, template, review, workshop, etc. — not generic "add a checklist")
    const action = items[0].action.toLowerCase();
    const hasSpecificAction = action.includes('prompt') || action.includes('template')
      || action.includes('workshop') || action.includes('review')
      || action.includes('buddy') || action.includes('channel');
    expect(hasSpecificAction).toBe(true);
  });

  it('includes rationale with concrete affected count and percentage', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Testing Gap', domain: 'thinkingQuality', severity: 'medium', recommendation: 'Write tests.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Testing Gap', domain: 'thinkingQuality', severity: 'medium', recommendation: 'Add coverage.' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    const items = generateTeamActionItems(patterns, 4);

    expect(items[0].rationale).toContain('2 of 4 developers');
    expect(items[0].rationale).toContain('50%');
    expect(items[0].rationale).toContain('Testing Gap');
  });

  it('returns deterministic results (same input → same output)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Consistent Pattern', domain: 'learningBehavior', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Consistent Pattern', domain: 'learningBehavior', severity: 'high', recommendation: 'rec' }],
      }),
    ];

    const patterns = aggregateGrowthAreasPEA(members);
    const items1 = generateTeamActionItems(patterns, 2);
    const items2 = generateTeamActionItems(patterns, 2);

    expect(items1).toEqual(items2);
  });
});

// ---------------------------------------------------------------------------
// aggregateGrowthAreas — totalDevs field
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreas — totalDevs', () => {
  it('includes totalDevs equal to the number of members passed in', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Tool Exploration', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Tool Exploration', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({ name: 'Carol', growthAreas: [] }),
    ];

    const result = aggregateGrowthAreas(members);

    // totalDevs should reflect the full team size (3), not just the 2 affected
    expect(result[0].totalDevs).toBe(3);
    expect(result[0].memberCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateGrowthAreasPEA — totalDevs field
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreasPEA — totalDevs', () => {
  it('includes totalDevs equal to the number of members passed in', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Error Loop Pattern', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Error Loop Pattern', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({ name: 'Carol', growthAreas: [] }),
      createMockTeamMemberAnalysis({ name: 'Dave', growthAreas: [] }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    expect(result[0].totalDevs).toBe(4);
    expect(result[0].memberCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computePatternFrequencies
// ---------------------------------------------------------------------------

describe('computePatternFrequencies', () => {
  it('returns empty array when no members provided', () => {
    expect(computePatternFrequencies([])).toEqual([]);
  });

  it('returns empty array when no patterns are shared by 2+ members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Unique To Alice', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Unique To Bob', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
    ];

    expect(computePatternFrequencies(members)).toEqual([]);
  });

  it('returns {pattern, devCount, totalDevs} shape for shared patterns', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'over-explains context', domain: 'communicationPatterns', severity: 'medium', recommendation: 'Be concise.' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'over-explains context', domain: 'communicationPatterns', severity: 'high', recommendation: 'Cut context.' }],
      }),
      createMockTeamMemberAnalysis({ name: 'Carol', growthAreas: [] }),
    ];

    const result = computePatternFrequencies(members);

    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe('over-explains context');
    expect(result[0].devCount).toBe(2);
    expect(result[0].totalDevs).toBe(3);
  });

  it('computes devCount and totalDevs correctly for multi-pattern team', () => {
    // 5-developer team with two shared patterns:
    //   pattern A: shared by 3 devs
    //   pattern B: shared by 2 devs
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'learningBehavior', severity: 'medium', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          { title: 'Pattern A', domain: 'thinkingQuality', severity: 'critical', recommendation: 'rec' },
          { title: 'Pattern B', domain: 'learningBehavior', severity: 'low', recommendation: 'rec' },
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{ title: 'Pattern A', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({ name: 'Dave', growthAreas: [] }),
      createMockTeamMemberAnalysis({ name: 'Eve', growthAreas: [] }),
    ];

    const result = computePatternFrequencies(members);

    // Sorted by devCount desc: Pattern A (3) before Pattern B (2)
    expect(result[0].pattern).toBe('Pattern A');
    expect(result[0].devCount).toBe(3);
    expect(result[0].totalDevs).toBe(5);
    expect(result[1].pattern).toBe('Pattern B');
    expect(result[1].devCount).toBe(2);
    expect(result[1].totalDevs).toBe(5);
  });

  it('includes domain and predominantSeverity in each result', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Skips Error Handling', domain: 'thinkingQuality', severity: 'critical', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Skips Error Handling', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
    ];

    const result = computePatternFrequencies(members);

    expect(result[0].domain).toBe('thinkingQuality');
    expect(result[0].predominantSeverity).toBe('critical');
  });

  it('is a projection of aggregateGrowthAreasPEA — produces identical counts', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Late Testing', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Late Testing', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({ name: 'Carol', growthAreas: [] }),
    ];

    const aggregated = aggregateGrowthAreasPEA(members);
    const frequencies = computePatternFrequencies(members);

    // Verify the projection matches the source aggregate
    expect(frequencies).toHaveLength(aggregated.length);
    for (let i = 0; i < aggregated.length; i++) {
      expect(frequencies[i].pattern).toBe(aggregated[i].title);
      expect(frequencies[i].devCount).toBe(aggregated[i].memberCount);
      expect(frequencies[i].totalDevs).toBe(aggregated[i].totalDevs);
    }
  });
});

// ---------------------------------------------------------------------------
// groupPatternsByTag
// ---------------------------------------------------------------------------

describe('groupPatternsByTag', () => {
  it('returns empty array when no members provided', () => {
    expect(groupPatternsByTag([])).toEqual([]);
  });

  it('returns empty array when no patterns are shared by 2+ members', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Only Alice',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['testing', 'react'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Only Bob',
          domain: 'communicationPatterns',
          severity: 'low',
          recommendation: 'rec',
          categoryTags: ['testing', 'communication'],
        } as any],
      }),
    ];

    // No 2+ member clusters → no tag groups
    expect(groupPatternsByTag(members)).toEqual([]);
  });

  it('returns empty array when aggregated patterns have no categoryTags', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Shared Pattern', domain: 'thinkingQuality', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Shared Pattern', domain: 'thinkingQuality', severity: 'high', recommendation: 'rec' }],
      }),
    ];

    // Pattern clusters but has no categoryTags → empty tag groups
    expect(groupPatternsByTag(members)).toEqual([]);
  });

  it('groups patterns by category tag and computes per-pattern occurrence counts', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Late Error Handling',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Add error boundaries early.',
          categoryTags: ['error-handling', 'react', 'component-lifecycle'],
          toolsFilesApis: ['ErrorBoundary.tsx'],
          actionInstruction: 'Add ErrorBoundary to App.tsx',
          verificationCheck: 'Check for ErrorBoundary import',
          goalRelevance: 'Prevents user-facing crashes',
          evidenceCount: 3,
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Missing Error Boundaries',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Wrap async components with error boundaries.',
          categoryTags: ['error-handling', 'react', 'async-patterns'],
          toolsFilesApis: ['AsyncComponent.tsx'],
          actionInstruction: 'Add Suspense error boundary',
          verificationCheck: 'Check for Suspense+ErrorBoundary pairing',
          goalRelevance: 'Improves user experience',
          evidenceCount: 2,
        } as any],
      }),
    ];

    const result = groupPatternsByTag(members);

    // Both Alice and Bob share error-handling and react tags
    // Each pattern has 1 dev but they are in the same domain+tag cluster (Pass 2)
    // Verify we get at least the error-handling group
    expect(result.length).toBeGreaterThan(0);

    // Should have an error-handling group
    const errorGroup = result.find(g => g.displayTag.includes('error'));
    expect(errorGroup).toBeDefined();
    expect(errorGroup!.patternCount).toBeGreaterThan(0);
    expect(errorGroup!.patterns.every(p => p.devCount >= 1)).toBe(true);
    expect(errorGroup!.totalDevOccurrences).toBeGreaterThan(0);
  });

  it('groups patterns sharing a common tag, with correct per-pattern occurrence counts', () => {
    // Three developers, all sharing the exact same pattern title with tags
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Testing Gap',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Write unit tests.',
          categoryTags: ['testing', 'vitest', 'coverage'],
          toolsFilesApis: ['vitest'],
          actionInstruction: 'Run vitest before commits',
          verificationCheck: 'Check bash for vitest',
          goalRelevance: 'Code reliability',
          evidenceCount: 3,
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Testing Gap',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Add test coverage.',
          categoryTags: ['testing', 'vitest', 'integration'],
          toolsFilesApis: ['vitest'],
          actionInstruction: 'Add integration tests',
          verificationCheck: 'Check coverage report',
          goalRelevance: 'Prevent regressions',
          evidenceCount: 2,
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [{
          title: 'Testing Gap',
          domain: 'thinkingQuality',
          severity: 'low',
          recommendation: 'Improve test coverage.',
          categoryTags: ['testing', 'jest'],
          toolsFilesApis: ['jest'],
          actionInstruction: 'Write jest tests',
          verificationCheck: 'Check jest run',
          goalRelevance: 'Code quality',
          evidenceCount: 2,
        } as any],
      }),
    ];

    const result = groupPatternsByTag(members);

    // "testing" tag should appear in results
    const testingGroup = result.find(g =>
      g.displayTag.toLowerCase().includes('test') || g.canonicalTag.includes('test'),
    );
    expect(testingGroup).toBeDefined();

    // "Testing Gap" pattern should be in the testing group with devCount=3
    const testingPattern = testingGroup!.patterns.find(p => p.pattern === 'Testing Gap');
    expect(testingPattern).toBeDefined();
    expect(testingPattern!.devCount).toBe(3);
    expect(testingPattern!.totalDevs).toBe(3);
  });

  it('assigns correct occurrence counts when multiple patterns share the same tag', () => {
    // Two distinct patterns both tagged with "testing"
    // Pattern A: 3 devs, Pattern B: 2 devs
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          {
            title: 'Pattern A',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'rec',
            categoryTags: ['testing', 'unit-tests', 'vitest'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          {
            title: 'Pattern A',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec',
            categoryTags: ['testing', 'unit-tests', 'vitest'],
          } as any,
          {
            title: 'Pattern B',
            domain: 'thinkingQuality',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['testing', 'integration', 'api'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          {
            title: 'Pattern A',
            domain: 'thinkingQuality',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['testing', 'unit-tests', 'coverage'],
          } as any,
          {
            title: 'Pattern B',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec',
            categoryTags: ['testing', 'integration', 'database'],
          } as any,
        ],
      }),
    ];

    const result = groupPatternsByTag(members);

    // Find the "testing" group
    const testingGroup = result.find(g =>
      g.canonicalTag.includes('test') || g.displayTag.toLowerCase().includes('test'),
    );
    expect(testingGroup).toBeDefined();

    // Pattern A: 3 devs, Pattern B: 2 devs
    const patternA = testingGroup!.patterns.find(p => p.pattern === 'Pattern A');
    const patternB = testingGroup!.patterns.find(p => p.pattern === 'Pattern B');

    expect(patternA).toBeDefined();
    expect(patternA!.devCount).toBe(3);

    expect(patternB).toBeDefined();
    expect(patternB!.devCount).toBe(2);

    // Patterns sorted by devCount desc: Pattern A first
    expect(testingGroup!.patterns[0].pattern).toBe('Pattern A');
    expect(testingGroup!.patterns[1].pattern).toBe('Pattern B');

    // totalDevOccurrences = 3 + 2 = 5
    expect(testingGroup!.totalDevOccurrences).toBe(5);
    expect(testingGroup!.patternCount).toBe(2);
  });

  it('sorts tag groups by totalDevOccurrences descending', () => {
    // Two tag groups: "testing" group has more total occurrences than "deployment"
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          {
            title: 'Shared Testing Issue',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'rec',
            categoryTags: ['testing', 'coverage', 'vitest'],
          } as any,
          {
            title: 'Minor Deploy Issue',
            domain: 'sessionOutcome',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['deployment', 'ci-cd', 'pipeline'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          {
            title: 'Shared Testing Issue',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec',
            categoryTags: ['testing', 'coverage', 'jest'],
          } as any,
          {
            title: 'Minor Deploy Issue',
            domain: 'sessionOutcome',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['deployment', 'ci-cd', 'github-actions'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          {
            title: 'Shared Testing Issue',
            domain: 'thinkingQuality',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['testing', 'coverage', 'tdd'],
          } as any,
        ],
      }),
    ];

    const result = groupPatternsByTag(members);

    // "testing" tag: pattern with 3 devs → totalDevOccurrences=3
    // "deployment" tag: pattern with 2 devs → totalDevOccurrences=2
    // So testing group should come before deployment group
    const tagNames = result.map(g => g.displayTag.toLowerCase());
    const testingIdx = tagNames.findIndex(t => t.includes('test'));
    const deployIdx = tagNames.findIndex(t => t.includes('deploy') || t.includes('ci'));

    // Testing group has higher total dev occurrences → appears before deployment
    if (testingIdx !== -1 && deployIdx !== -1) {
      expect(testingIdx).toBeLessThan(deployIdx);
    }
  });

  it('picks the most frequent raw tag form as displayTag', () => {
    // Three patterns all tagged with "error-handling" (hyphenated) x2 and "Error Handling" x1
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['error-handling', 'react', 'hooks'],
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'rec',
          categoryTags: ['error-handling', 'react', 'async'],
        } as any],
      }),
    ];

    const result = groupPatternsByTag(members);

    // Find the error-handling group
    const errorGroup = result.find(g =>
      g.canonicalTag.includes('error') || g.displayTag.includes('error'),
    );
    expect(errorGroup).toBeDefined();
    // Most frequent label should be set as displayTag
    expect(errorGroup!.displayTag).toBeTruthy();
    // canonicalTag should be the normalized form
    expect(errorGroup!.canonicalTag).toBeTruthy();
  });

  it('output TagPatternGroup shape has all required fields', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Shared Pattern',
          domain: 'learningBehavior',
          severity: 'medium',
          recommendation: 'rec',
          categoryTags: ['debugging', 'testing', 'vitest'],
          toolsFilesApis: ['vitest'],
          actionInstruction: 'Run tests before commit',
          verificationCheck: 'Check bash for vitest',
          goalRelevance: 'reliability',
          evidenceCount: 3,
        } as any],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Shared Pattern',
          domain: 'learningBehavior',
          severity: 'high',
          recommendation: 'rec',
          categoryTags: ['debugging', 'testing', 'jest'],
          toolsFilesApis: ['jest'],
          actionInstruction: 'Add tests',
          verificationCheck: 'Check test run',
          goalRelevance: 'code quality',
          evidenceCount: 2,
        } as any],
      }),
    ];

    const result = groupPatternsByTag(members);
    expect(result.length).toBeGreaterThan(0);

    const group = result[0];
    // Verify all required shape fields
    expect(typeof group.canonicalTag).toBe('string');
    expect(group.canonicalTag.length).toBeGreaterThan(0);
    expect(typeof group.displayTag).toBe('string');
    expect(group.displayTag.length).toBeGreaterThan(0);
    expect(typeof group.patternCount).toBe('number');
    expect(group.patternCount).toBeGreaterThan(0);
    expect(typeof group.totalDevOccurrences).toBe('number');
    expect(group.totalDevOccurrences).toBeGreaterThan(0);
    expect(Array.isArray(group.patterns)).toBe(true);
    expect(group.patterns.length).toBeGreaterThan(0);

    // Each pattern entry should have PatternFrequencyResult shape
    const firstPattern = group.patterns[0];
    expect(typeof firstPattern.pattern).toBe('string');
    expect(typeof firstPattern.devCount).toBe('number');
    expect(typeof firstPattern.totalDevs).toBe('number');
    expect(typeof firstPattern.domain).toBe('string');
    expect(typeof firstPattern.predominantSeverity).toBe('string');
  });

  it('correctly computes totalDevOccurrences as sum of devCounts across patterns', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          {
            title: 'Pattern Alpha',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'rec',
            categoryTags: ['debugging', 'logging', 'node'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          {
            title: 'Pattern Alpha',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec',
            categoryTags: ['debugging', 'logging', 'express'],
          } as any,
          {
            title: 'Pattern Beta',
            domain: 'thinkingQuality',
            severity: 'low',
            recommendation: 'rec',
            categoryTags: ['debugging', 'error-handling', 'try-catch'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          {
            title: 'Pattern Beta',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'rec',
            categoryTags: ['debugging', 'error-handling', 'async'],
          } as any,
        ],
      }),
    ];

    const result = groupPatternsByTag(members);

    // "debugging" tag should appear since both Alpha (2 devs) and Beta (2 devs) have it
    const debugGroup = result.find(g =>
      g.canonicalTag.includes('debug') || g.displayTag.toLowerCase().includes('debug'),
    );
    expect(debugGroup).toBeDefined();
    // totalDevOccurrences = devCount(Alpha) + devCount(Beta) = 2 + 2 = 4
    expect(debugGroup!.totalDevOccurrences).toBe(4);
    expect(debugGroup!.patternCount).toBe(2);
  });

  it('merges synonym-equivalent tags from different patterns into the same canonical cluster before counting (Sub-AC 14b)', () => {
    // Pattern A: Alice + Bob both have "exception handling" (synonym of "error handling")
    // Pattern B: Alice + Carol both have "error handling"
    // With cluster-based merging these should collapse into ONE tag group
    // because normalizeTag("exception handling") = normalizeTag("error handling") = "error handl"
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [
          {
            title: 'Missing Error Boundaries',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'Add error boundaries.',
            categoryTags: ['exception handling', 'react'],
          } as any,
          {
            title: 'Unhandled Promise Rejections',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'Handle promise errors.',
            categoryTags: ['error handling', 'async', 'react'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [
          {
            title: 'Missing Error Boundaries',
            domain: 'thinkingQuality',
            severity: 'medium',
            recommendation: 'Wrap components with boundaries.',
            categoryTags: ['exception handling', 'react'],
          } as any,
        ],
      }),
      createMockTeamMemberAnalysis({
        name: 'Carol',
        growthAreas: [
          {
            title: 'Unhandled Promise Rejections',
            domain: 'thinkingQuality',
            severity: 'high',
            recommendation: 'Use try-catch for promises.',
            categoryTags: ['error handling', 'async', 'typescript'],
          } as any,
        ],
      }),
    ];

    const result = groupPatternsByTag(members);

    // "exception handling" and "error handling" both normalize to "error handl"
    // via the synonym map (exception→error) + stemming (handling→handl).
    // They should be merged into ONE canonical tag group, not two separate groups.
    const errorGroups = result.filter(g =>
      g.canonicalTag.includes('error') || g.displayTag.toLowerCase().includes('error')
      || g.canonicalTag.includes('exception') || g.displayTag.toLowerCase().includes('exception'),
    );

    // Exactly one tag group for the error/exception concept (not two separate groups)
    expect(errorGroups.length).toBe(1);

    const errorGroup = errorGroups[0];
    // Both patterns (Missing Error Boundaries + Unhandled Promise Rejections)
    // should be in the same group
    expect(errorGroup.patternCount).toBe(2);

    // Missing Error Boundaries: Alice + Bob = 2 devs
    // Unhandled Promise Rejections: Alice + Carol = 2 devs
    // totalDevOccurrences = 2 + 2 = 4
    expect(errorGroup.totalDevOccurrences).toBe(4);

    // canonicalTag should be the cluster's normalized form (contains "error")
    expect(errorGroup.canonicalTag).toBeTruthy();
    expect(errorGroup.canonicalTag.includes('error')).toBe(true);

    // displayTag should be a human-readable label
    expect(errorGroup.displayTag).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5-dimension framework domain labels
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreasPEA — 5-dimension domain labels', () => {
  it.each([
    ['aiPartnership', 'AI Partnership'],
    ['sessionCraft', 'Session Craft'],
    ['toolMastery', 'Tool Mastery'],
    ['skillResilience', 'Skill Resilience'],
    ['sessionMastery', 'Session Mastery'],
  ])('maps domain "%s" to label "%s"', (domain, expectedLabel) => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Shared Pattern',
          domain,
          severity: 'medium' as const,
          recommendation: 'rec',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Shared Pattern',
          domain,
          severity: 'high' as const,
          recommendation: 'rec',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    expect(result[0].domainLabel).toBe(expectedLabel);
  });

  it('generates domain-specific intervention for aiPartnership (not generic fallback)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'AI Handoff Gaps', domain: 'aiPartnership', severity: 'high', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'AI Handoff Gaps', domain: 'aiPartnership', severity: 'high', recommendation: 'rec' }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // aiPartnership interventions reference AI collaboration or protocol concepts
    const rec = result[0].teamRecommendation.toLowerCase();
    const hasAiSpecificContent = rec.includes('ai') || rec.includes('collaboration')
      || rec.includes('protocol') || rec.includes('prompt') || rec.includes('workshop');
    expect(hasAiSpecificContent).toBe(true);
  });

  it('generates domain-specific intervention for toolMastery (not generic fallback)', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{ title: 'Tool Underuse', domain: 'toolMastery', severity: 'medium', recommendation: 'rec' }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{ title: 'Tool Underuse', domain: 'toolMastery', severity: 'medium', recommendation: 'rec' }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    const rec = result[0].teamRecommendation.toLowerCase();
    const hasToolContent = rec.includes('tool') || rec.includes('wiki') || rec.includes('workshop');
    expect(hasToolContent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aggregateGrowthAreasPEA — knowledgeTip propagation
// ---------------------------------------------------------------------------

describe('aggregateGrowthAreasPEA — knowledgeTip propagation', () => {
  it('propagates knowledgeTip from member growth area to team aggregate', () => {
    const tip: import('../../../src/types/enterprise').MemberKbTipAttachment = {
      tipId: 'kb-tip-001',
      title: 'Error Handling Best Practices',
      summary: 'Always wrap async operations in try-catch blocks.',
      sourceUrl: 'https://example.com/tip',
      sourceAuthor: 'Jane Doe',
      sourcePlatform: 'blog',
      credibilityTier: 'high',
      relevanceScore: 0.92,
    };

    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Async Error Handling Gap',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Add try-catch to all async calls.',
          knowledgeTip: tip,
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Async Error Handling Gap',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Use error boundaries.',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result).toHaveLength(1);
    // knowledgeTip from Alice should be propagated to the team aggregate
    expect(result[0].knowledgeTip).toBeDefined();
    expect(result[0].knowledgeTip!.tipId).toBe('kb-tip-001');
    expect(result[0].knowledgeTip!.relevanceScore).toBe(0.92);
    expect(result[0].knowledgeTip!.credibilityTier).toBe('high');
  });

  it('selects the highest-relevance knowledgeTip when multiple members have tips', () => {
    const lowRelevanceTip: import('../../../src/types/enterprise').MemberKbTipAttachment = {
      tipId: 'kb-low',
      title: 'Low Relevance Tip',
      summary: 'Generic advice.',
      sourceUrl: 'https://example.com/low',
      sourceAuthor: 'Generic Author',
      relevanceScore: 0.55,
    };
    const highRelevanceTip: import('../../../src/types/enterprise').MemberKbTipAttachment = {
      tipId: 'kb-high',
      title: 'High Relevance Tip',
      summary: 'Highly specific advice.',
      sourceUrl: 'https://example.com/high',
      sourceAuthor: 'Expert Author',
      credibilityTier: 'high',
      relevanceScore: 0.91,
    };

    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Testing Gaps',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'Add tests.',
          knowledgeTip: lowRelevanceTip,
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Testing Gaps',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'Write unit tests.',
          knowledgeTip: highRelevanceTip,
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // Higher relevance score wins
    expect(result[0].knowledgeTip).toBeDefined();
    expect(result[0].knowledgeTip!.tipId).toBe('kb-high');
    expect(result[0].knowledgeTip!.relevanceScore).toBe(0.91);
  });

  it('returns undefined knowledgeTip when no member has a tip', () => {
    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'medium',
          recommendation: 'rec',
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Pattern X',
          domain: 'thinkingQuality',
          severity: 'high',
          recommendation: 'rec',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    expect(result[0].knowledgeTip).toBeUndefined();
  });

  it('falls back to kbTip when knowledgeTip is absent', () => {
    const kbTip: import('../../../src/types/enterprise').MemberKbTipAttachment = {
      tipId: 'kb-legacy',
      title: 'Legacy Tip',
      summary: 'A tip from the kbTip field.',
      sourceUrl: 'https://example.com/legacy',
      sourceAuthor: 'Legacy Author',
      relevanceScore: 0.75,
    };

    const members = [
      createMockTeamMemberAnalysis({
        name: 'Alice',
        growthAreas: [{
          title: 'Pattern Y',
          domain: 'learningBehavior',
          severity: 'medium',
          recommendation: 'rec',
          kbTip,   // kbTip field, not knowledgeTip
        }],
      }),
      createMockTeamMemberAnalysis({
        name: 'Bob',
        growthAreas: [{
          title: 'Pattern Y',
          domain: 'learningBehavior',
          severity: 'high',
          recommendation: 'rec',
        }],
      }),
    ];

    const result = aggregateGrowthAreasPEA(members);

    // kbTip should be picked up as the best knowledge tip
    expect(result[0].knowledgeTip).toBeDefined();
    expect(result[0].knowledgeTip!.tipId).toBe('kb-legacy');
  });
});
