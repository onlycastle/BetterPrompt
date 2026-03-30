import { describe, it, expect } from 'vitest';
import { mapUserToTeamMember } from '../../../src/lib/local/evaluation-to-team';
import type { LocalUser } from '../../../src/lib/local/auth';
import type { StoredAnalysisResult } from '../../../src/lib/local/analysis-store';
import { createMockStoredAnalysisResult } from '../../utils/team-helpers';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function testUser(overrides: Partial<LocalUser> = {}): LocalUser {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    role: 'member',
    createdAt: new Date().toISOString(),
    organizationId: null,
    ...overrides,
  };
}

/** Create an analysis claimed at a specific ISO date string. */
function analysisAt(
  claimedAt: string,
  overrides: Partial<StoredAnalysisResult> = {},
): StoredAnalysisResult {
  return createMockStoredAnalysisResult({ claimedAt, ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mapUserToTeamMember', () => {
  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('should populate all fields correctly from a single analysis', () => {
    const user = testUser();
    const analysis = createMockStoredAnalysisResult({
      claimedAt: '2026-03-20T10:00:00Z',
    });

    const result = mapUserToTeamMember(user, [analysis], 'team-1', 'member', 'Engineering');

    expect(result.id).toBe('user-1');
    expect(result.name).toBe('alice');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('member');
    expect(result.department).toBe('Engineering');
    expect(result.primaryType).toBe('architect');
    expect(result.controlLevel).toBe('navigator');
    expect(result.analysisCount).toBe(1);
    expect(result.lastAnalyzedAt).toBe('2026-03-20T10:00:00Z');
  });

  it('should compute overallScore as average of all domain scores', () => {
    // The mock has: thinkingQuality=75, communicationPatterns=70,
    // learningBehavior=65, contextEfficiency=72, sessionOutcome=80
    // Average = (75 + 70 + 65 + 72 + 80) / 5 = 72.4 -> rounded to 72
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    expect(result.overallScore).toBe(72);
  });

  it('should aggregate data from two analyses', () => {
    const a1 = analysisAt('2026-03-15T10:00:00Z', {
      activitySessions: [
        { sessionId: 's1', projectName: 'alpha', startTime: '2026-03-15T10:00:00Z', durationMinutes: 30, messageCount: 20, summary: 'Init alpha.' },
      ],
    });
    const a2 = analysisAt('2026-03-22T10:00:00Z', {
      activitySessions: [
        { sessionId: 's2', projectName: 'beta', startTime: '2026-03-22T10:00:00Z', durationMinutes: 45, messageCount: 30, summary: 'Init beta.' },
      ],
    });

    const result = mapUserToTeamMember(testUser(), [a1, a2], 'team-1', 'lead', 'Platform');

    expect(result.analysisCount).toBe(2);
    expect(result.history).toHaveLength(2);
    expect(result.tokenUsage.totalSessions).toBe(2);
    expect(result.tokenUsage.totalMessages).toBe(50);
    expect(result.projects).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Empty analyses
  // -----------------------------------------------------------------------

  it('should return defaults when analyses array is empty', () => {
    const result = mapUserToTeamMember(testUser(), [], 'team-1', 'member', 'Eng');

    expect(result.overallScore).toBe(0);
    expect(result.primaryType).toBe('analyst');
    expect(result.controlLevel).toBe('navigator');
    expect(result.history).toEqual([]);
    expect(result.lastAnalyzedAt).toBe('');
    expect(result.analysisCount).toBe(0);
    expect(result.dimensions).toEqual({
      aiCollaboration: 0,
      contextEngineering: 0,
      burnoutRisk: 100, // inverted: 100 - 0
      aiControl: 0,
      skillResilience: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Sorting: latest analysis used for scores
  // -----------------------------------------------------------------------

  it('should use the latest analysis (by claimedAt) for primaryType regardless of input order', () => {
    const older = analysisAt('2026-03-10T00:00:00Z', {
      evaluation: {
        primaryType: 'speedrunner',
        controlLevel: 'explorer',
      } as StoredAnalysisResult['evaluation'],
    });
    const newer = analysisAt('2026-03-20T00:00:00Z', {
      evaluation: {
        primaryType: 'conductor',
        controlLevel: 'cartographer',
      } as StoredAnalysisResult['evaluation'],
    });

    // Pass out of order (older first)
    const result = mapUserToTeamMember(testUser(), [older, newer], 'team-1', 'member', 'Eng');

    expect(result.primaryType).toBe('conductor');
    expect(result.controlLevel).toBe('cartographer');
    expect(result.lastAnalyzedAt).toBe('2026-03-20T00:00:00Z');
  });

  // -----------------------------------------------------------------------
  // extractNameFromEmail (tested through main function)
  // -----------------------------------------------------------------------

  it('should extract name from email by taking text before @', () => {
    const result = mapUserToTeamMember(
      testUser({ email: 'bob.smith@company.io' }),
      [],
      'team-1',
      'member',
      'Eng',
    );
    expect(result.name).toBe('bob.smith');
  });

  it('should return full string if email has no @ sign', () => {
    const result = mapUserToTeamMember(
      testUser({ email: 'noatsign' }),
      [],
      'team-1',
      'member',
      'Eng',
    );
    expect(result.name).toBe('noatsign');
  });

  // -----------------------------------------------------------------------
  // buildDimensions: domain mapping + burnoutRisk inversion
  // -----------------------------------------------------------------------

  it('should map domain scores to correct dimension keys', () => {
    // Mock workerInsights: thinkingQuality=75, contextEfficiency=72,
    // sessionOutcome=80, communicationPatterns=70, learningBehavior=65
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    // thinkingQuality -> aiCollaboration
    expect(result.dimensions.aiCollaboration).toBe(75);
    // contextEfficiency -> contextEngineering
    expect(result.dimensions.contextEngineering).toBe(72);
    // communicationPatterns -> aiControl
    expect(result.dimensions.aiControl).toBe(70);
    // learningBehavior -> skillResilience
    expect(result.dimensions.skillResilience).toBe(65);
  });

  it('should invert sessionOutcome score for burnoutRisk (100 - score)', () => {
    // sessionOutcome = 80 -> burnoutRisk = 100 - 80 = 20
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    expect(result.dimensions.burnoutRisk).toBe(20);
  });

  // -----------------------------------------------------------------------
  // averageOfScores (tested via overallScore)
  // -----------------------------------------------------------------------

  it('should return 0 for overallScore when no domain scores exist', () => {
    const analysis = createMockStoredAnalysisResult({
      evaluation: {
        workerInsights: undefined,
        agentOutputs: undefined,
      } as unknown as StoredAnalysisResult['evaluation'],
    });

    const result = mapUserToTeamMember(testUser(), [analysis], 'team-1', 'member', 'Eng');

    expect(result.overallScore).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Token usage
  // -----------------------------------------------------------------------

  it('should aggregate totalSessions and totalMessages across analyses', () => {
    const a1 = analysisAt('2026-03-15T10:00:00Z', {
      activitySessions: [
        { sessionId: 's1', projectName: 'p1', startTime: '2026-03-15T09:00:00Z', durationMinutes: 10, messageCount: 5, summary: '' },
        { sessionId: 's2', projectName: 'p1', startTime: '2026-03-15T11:00:00Z', durationMinutes: 20, messageCount: 15, summary: '' },
      ],
    });
    const a2 = analysisAt('2026-03-20T10:00:00Z', {
      activitySessions: [
        { sessionId: 's3', projectName: 'p2', startTime: '2026-03-20T14:00:00Z', durationMinutes: 25, messageCount: 8, summary: '' },
      ],
    });

    const result = mapUserToTeamMember(testUser(), [a1, a2], 'team-1', 'member', 'Eng');

    expect(result.tokenUsage.totalSessions).toBe(3);
    expect(result.tokenUsage.totalMessages).toBe(28);
  });

  it('should group sessions into weekly token trends by ISO week (Monday start)', () => {
    // 2026-03-16 is a Monday, 2026-03-23 is a Monday
    const a = analysisAt('2026-03-25T00:00:00Z', {
      activitySessions: [
        // Week of 2026-03-16 (Mon)
        { sessionId: 's1', projectName: 'p', startTime: '2026-03-16T10:00:00Z', durationMinutes: 10, messageCount: 4, summary: '' },
        { sessionId: 's2', projectName: 'p', startTime: '2026-03-18T10:00:00Z', durationMinutes: 10, messageCount: 6, summary: '' },
        // Week of 2026-03-23 (Mon)
        { sessionId: 's3', projectName: 'p', startTime: '2026-03-24T10:00:00Z', durationMinutes: 10, messageCount: 10, summary: '' },
      ],
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    const trends = result.tokenUsage.weeklyTokenTrend;
    expect(trends).toHaveLength(2);

    // Sorted chronologically
    expect(trends[0].weekStart).toBe('2026-03-16');
    expect(trends[0].sessions).toBe(2);
    expect(trends[0].totalTokens).toBe(10 * 500); // (4+6) * 500

    expect(trends[1].weekStart).toBe('2026-03-23');
    expect(trends[1].sessions).toBe(1);
    expect(trends[1].totalTokens).toBe(10 * 500);
  });

  it('should handle null activitySessions gracefully', () => {
    const a = analysisAt('2026-03-20T00:00:00Z', {
      activitySessions: null,
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.tokenUsage.totalSessions).toBe(0);
    expect(result.tokenUsage.totalMessages).toBe(0);
    expect(result.tokenUsage.weeklyTokenTrend).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // weekStartOf: Monday calculation for various days
  // -----------------------------------------------------------------------

  it('should return Monday as week start for a Sunday session', () => {
    // 2026-03-22 is a Sunday -> week start is 2026-03-16 (Monday)
    const a = analysisAt('2026-03-22T12:00:00Z', {
      activitySessions: [
        { sessionId: 's1', projectName: 'p', startTime: '2026-03-22T12:00:00Z', durationMinutes: 5, messageCount: 3, summary: '' },
      ],
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.tokenUsage.weeklyTokenTrend[0].weekStart).toBe('2026-03-16');
  });

  // -----------------------------------------------------------------------
  // Anti-patterns
  // -----------------------------------------------------------------------

  it('should extract anti-patterns from agentOutputs.efficiency.inefficiencyPatterns', () => {
    const a = createMockStoredAnalysisResult({
      evaluation: {
        ...createMockStoredAnalysisResult().evaluation,
        agentOutputs: {
          efficiency: {
            inefficiencyPatterns: [
              { pattern: 'context_bloat', frequency: 5, impact: 'high', description: 'Too much context.' },
              { pattern: 'late_compact', frequency: 2, impact: 'medium', description: 'Compaction too late.' },
            ],
            contextUsagePatterns: [],
            promptLengthTrends: [],
            redundantInfo: [],
            topInsights: [],
          },
        },
      } as unknown as StoredAnalysisResult['evaluation'],
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.antiPatterns).toHaveLength(2);
    expect(result.antiPatterns[0]).toEqual({ pattern: 'context_bloat', frequency: 5, impact: 'high' });
    expect(result.antiPatterns[1]).toEqual({ pattern: 'late_compact', frequency: 2, impact: 'medium' });
  });

  it('should fall back to agentOutputs.contextEfficiency for anti-patterns when efficiency is absent', () => {
    const a = createMockStoredAnalysisResult({
      evaluation: {
        ...createMockStoredAnalysisResult().evaluation,
        agentOutputs: {
          contextEfficiency: {
            inefficiencyPatterns: [
              { pattern: 'verbose_error_pasting', frequency: 3, impact: 'low', description: 'Pasting errors.' },
            ],
            contextUsagePatterns: [],
            promptLengthTrends: [],
            redundantInfo: [],
            topInsights: [],
          },
        },
      } as unknown as StoredAnalysisResult['evaluation'],
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.antiPatterns).toHaveLength(1);
    expect(result.antiPatterns[0].pattern).toBe('verbose_error_pasting');
  });

  it('should return empty anti-patterns when agentOutputs is undefined', () => {
    const a = createMockStoredAnalysisResult();
    // Default mock has no agentOutputs

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.antiPatterns).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Projects: deduplication and summaryLines cap
  // -----------------------------------------------------------------------

  it('should deduplicate projects across analyses and accumulate sessionCount', () => {
    const a1 = analysisAt('2026-03-15T00:00:00Z', {
      activitySessions: [
        { sessionId: 's1', projectName: 'shared-proj', startTime: '2026-03-15T09:00:00Z', durationMinutes: 10, messageCount: 5, summary: 'Task A' },
      ],
    });
    const a2 = analysisAt('2026-03-20T00:00:00Z', {
      activitySessions: [
        { sessionId: 's2', projectName: 'shared-proj', startTime: '2026-03-20T14:00:00Z', durationMinutes: 20, messageCount: 10, summary: 'Task B' },
      ],
    });

    const result = mapUserToTeamMember(testUser(), [a1, a2], 'team-1', 'member', 'Eng');

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].projectName).toBe('shared-proj');
    expect(result.projects[0].sessionCount).toBe(2);
    expect(result.projects[0].lastActiveDate).toBe('2026-03-20T14:00:00Z');
    expect(result.projects[0].summaryLines).toContain('Task A');
    expect(result.projects[0].summaryLines).toContain('Task B');
  });

  it('should cap summaryLines at 5 per project', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      sessionId: `s${i}`,
      projectName: 'big-proj',
      startTime: `2026-03-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
      durationMinutes: 10,
      messageCount: 5,
      summary: `Summary line ${i + 1}`,
    }));

    const a = analysisAt('2026-03-20T00:00:00Z', { activitySessions: sessions });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.projects[0].summaryLines.length).toBeLessThanOrEqual(5);
  });

  // -----------------------------------------------------------------------
  // Strength summaries
  // -----------------------------------------------------------------------

  it('should build strength summaries from workerInsights domains', () => {
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    // The mock has strengths for all 5 domains
    expect(result.strengthSummaries.length).toBeGreaterThanOrEqual(5);

    const thinking = result.strengthSummaries.find((s) => s.domain === 'thinkingQuality');
    expect(thinking).toBeDefined();
    expect(thinking!.topStrength).toBe('Strategic Planning');
    expect(thinking!.domainScore).toBe(75);
    expect(thinking!.domainLabel).toBe('Thinking Quality');
  });

  // -----------------------------------------------------------------------
  // Growth snapshot
  // -----------------------------------------------------------------------

  it('should set trend to "improving" when weekDelta > 3', () => {
    // Two analyses: latest with higher scores, older with lower
    const older = createMockStoredAnalysisResult({
      claimedAt: '2026-03-15T00:00:00Z',
      evaluation: {
        ...createMockStoredAnalysisResult().evaluation,
        workerInsights: {
          thinkingQuality: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          communicationPatterns: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          learningBehavior: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          contextEfficiency: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          sessionOutcome: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
        },
      } as unknown as StoredAnalysisResult['evaluation'],
    });
    // Latest: all scores at 75 -> avg 75. Older: all at 50 -> avg 50. Delta = 25 > 3
    const newer = createMockStoredAnalysisResult({
      claimedAt: '2026-03-22T00:00:00Z',
    });

    const result = mapUserToTeamMember(testUser(), [older, newer], 'team-1', 'member', 'Eng');

    expect(result.growth.trend).toBe('improving');
    expect(result.growth.currentScore).toBe(72); // average of newer
    expect(result.growth.weekOverWeekDelta).toBeGreaterThan(3);
  });

  it('should set trend to "declining" when weekDelta < -3', () => {
    // Latest with lower scores, older with higher
    const older = createMockStoredAnalysisResult({
      claimedAt: '2026-03-15T00:00:00Z',
    });
    const newer = createMockStoredAnalysisResult({
      claimedAt: '2026-03-22T00:00:00Z',
      evaluation: {
        ...createMockStoredAnalysisResult().evaluation,
        workerInsights: {
          thinkingQuality: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          communicationPatterns: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          learningBehavior: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          contextEfficiency: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
          sessionOutcome: { strengths: [{ title: 'S', description: 'D', evidence: ['e'] }], growthAreas: [], domainScore: 50 },
        },
      } as unknown as StoredAnalysisResult['evaluation'],
    });

    const result = mapUserToTeamMember(testUser(), [older, newer], 'team-1', 'member', 'Eng');

    expect(result.growth.trend).toBe('declining');
    expect(result.growth.weekOverWeekDelta).toBeLessThan(-3);
  });

  it('should set trend to "stable" when weekDelta is between -3 and 3', () => {
    // Single analysis -> no previous week entry -> delta = 0
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    expect(result.growth.trend).toBe('stable');
    expect(result.growth.weekOverWeekDelta).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Growth areas
  // -----------------------------------------------------------------------

  it('should extract growth areas from workerInsights', () => {
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    // The mock has growthAreas in thinkingQuality and communicationPatterns
    expect(result.growthAreas.length).toBeGreaterThanOrEqual(2);

    const toolExploration = result.growthAreas.find((g) => g.title === 'Tool Exploration');
    expect(toolExploration).toBeDefined();
    expect(toolExploration!.domain).toBe('thinkingQuality');
    expect(toolExploration!.recommendation).toBe('Try Task tool.');
  });

  // -----------------------------------------------------------------------
  // KPT (Keep / Problem / Try)
  // -----------------------------------------------------------------------

  it('should build KPT keep from strength summaries', () => {
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    // keep entries format: "domainLabel: topStrength"
    expect(result.kpt.keep.length).toBeGreaterThan(0);
    expect(result.kpt.keep).toContain('Thinking Quality: Strategic Planning');
    expect(result.kpt.keep).toContain('Communication: Clear Requests');
  });

  it('should build KPT tryNext from growth area recommendations, capped at 5', () => {
    const result = mapUserToTeamMember(
      testUser(),
      [createMockStoredAnalysisResult()],
      'team-1',
      'member',
      'Eng',
    );

    // The mock has 2 growth areas with recommendations
    expect(result.kpt.tryNext).toContain('Try Task tool.');
    expect(result.kpt.tryNext).toContain('Add file references.');
    expect(result.kpt.tryNext.length).toBeLessThanOrEqual(5);
  });

  it('should build KPT problem from anti-patterns', () => {
    const a = createMockStoredAnalysisResult({
      evaluation: {
        ...createMockStoredAnalysisResult().evaluation,
        agentOutputs: {
          efficiency: {
            inefficiencyPatterns: [
              { pattern: 'context_bloat', frequency: 5, impact: 'high', description: 'Context accumulates.' },
            ],
            contextUsagePatterns: [],
            promptLengthTrends: [],
            redundantInfo: [],
            topInsights: [],
          },
        },
      } as unknown as StoredAnalysisResult['evaluation'],
    });

    const result = mapUserToTeamMember(testUser(), [a], 'team-1', 'member', 'Eng');

    expect(result.kpt.problem).toHaveLength(1);
    expect(result.kpt.problem[0]).toBe('context_bloat (impact: high, freq: 5)');
  });

  // -----------------------------------------------------------------------
  // History entries
  // -----------------------------------------------------------------------

  it('should create one history entry per analysis sorted newest-first', () => {
    const a1 = analysisAt('2026-03-10T00:00:00Z');
    const a2 = analysisAt('2026-03-20T00:00:00Z');

    const result = mapUserToTeamMember(testUser(), [a1, a2], 'team-1', 'member', 'Eng');

    expect(result.history).toHaveLength(2);
    // Newest first
    expect(result.history[0].date).toBe('2026-03-20T00:00:00Z');
    expect(result.history[1].date).toBe('2026-03-10T00:00:00Z');
    // Each has dimensions
    expect(result.history[0].dimensions).toBeDefined();
  });
});
