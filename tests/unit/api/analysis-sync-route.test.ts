import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CanonicalAnalysisRun } from '@betterprompt/shared';

vi.mock('@/lib/local/auth', () => ({
  getCurrentUserFromRequest: vi.fn(),
  findUserByEmail: vi.fn(),
}));

vi.mock('@/lib/local/analysis-store', () => ({
  createAnalysisRecord: vi.fn(),
}));

let normalizeCanonicalRunForStorage: typeof import('../../../app/api/analysis/sync/route.js').normalizeCanonicalRunForStorage;
let normalizeLegacyReportForStorage: typeof import('../../../app/api/analysis/sync/route.js').normalizeLegacyReportForStorage;

beforeAll(async () => {
  const route = await import('../../../app/api/analysis/sync/route.js');
  normalizeCanonicalRunForStorage = route.normalizeCanonicalRunForStorage;
  normalizeLegacyReportForStorage = route.normalizeLegacyReportForStorage;
});

function createCanonicalRun(): CanonicalAnalysisRun {
  return {
    runId: 3,
    analyzedAt: '2026-03-16T00:00:00.000Z',
    phase1Output: {
      developerUtterances: [
        {
          id: 'session-1_0',
          text: 'Verify the synced output matches the local report.',
          timestamp: '2026-03-15T12:00:00.000Z',
          sessionId: 'session-1',
          turnIndex: 0,
          characterCount: 46,
          wordCount: 8,
          hasCodeBlock: false,
          hasQuestion: false,
        },
      ],
      sessionMetrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 46,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-15T12:00:00.000Z',
          latest: '2026-03-15T12:05:00.000Z',
        },
      },
      sessions: [
        {
          sessionId: 'session-1',
          projectPath: '/tmp/nomoreaislop',
          startTime: '2026-03-15T12:00:00.000Z',
          endTime: '2026-03-15T12:10:00.000Z',
          durationSeconds: 600,
          claudeCodeVersion: '1.0.0',
          messages: [],
          stats: {
            userMessageCount: 1,
            assistantMessageCount: 1,
            toolCallCount: 0,
            uniqueToolsUsed: [],
            totalInputTokens: 0,
            totalOutputTokens: 0,
          },
          source: 'claude-code',
        },
      ],
    },
    activitySessions: [
      {
        sessionId: 'session-1',
        projectName: 'nomoreaislop',
        startTime: '2026-03-15T12:00:00.000Z',
        durationMinutes: 10,
        messageCount: 2,
        summary: 'Verified synced output matches local report.',
      },
    ],
    deterministicScores: {
      thinkingQuality: 80,
      communicationPatterns: 81,
      learningBehavior: 70,
      contextEfficiency: 75,
      sessionOutcome: 78,
      controlScore: 72,
    },
    typeResult: {
      primaryType: 'analyst',
      distribution: {
        architect: 20,
        analyst: 40,
        conductor: 15,
        speedrunner: 15,
        trendsetter: 10,
      },
      controlLevel: 'navigator',
      controlScore: 72,
      matrixName: 'Research Lead',
      matrixEmoji: '🧪',
    },
    domainResults: [],
    stageOutputs: {},
    evaluation: {
      sessionId: 'plugin-run-3',
      analyzedAt: '2026-03-16T00:00:00.000Z',
      sessionsAnalyzed: 1,
      primaryType: 'analyst',
      controlLevel: 'navigator',
      distribution: {
        architect: 20,
        analyst: 40,
        conductor: 15,
        speedrunner: 15,
        trendsetter: 10,
      },
      personalitySummary: 'Verification-first analyst.',
      promptPatterns: [],
      workerInsights: {},
      pipelineTokenUsage: {
        stages: [],
        totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
      },
    },
  };
}

describe('analysis sync normalization', () => {
  it('preserves canonical plugin output without fabricating fallback fields', () => {
    const run = createCanonicalRun();
    const normalized = normalizeCanonicalRunForStorage(run);

    expect(normalized.evaluation).toEqual(run.evaluation);
    expect(normalized.phase1Output).toEqual(run.phase1Output);
    expect(normalized.canonicalRun).toEqual(run);
    expect(normalized.activitySessions).toEqual(run.activitySessions);
  });

  it('still supports legacy report payloads during migration', () => {
    const normalized = normalizeLegacyReportForStorage({
      userId: 'local',
      analyzedAt: '2026-03-16T00:00:00.000Z',
      phase1Metrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 46,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-15T12:00:00.000Z',
          latest: '2026-03-15T12:05:00.000Z',
        },
      },
      deterministicScores: {
        thinkingQuality: 80,
        communicationPatterns: 81,
        learningBehavior: 70,
        contextEfficiency: 75,
        sessionOutcome: 78,
        controlScore: 72,
      },
      typeResult: {
        primaryType: 'analyst',
        distribution: {
          architect: 20,
          analyst: 40,
          conductor: 15,
          speedrunner: 15,
          trendsetter: 10,
        },
        controlLevel: 'navigator',
        controlScore: 72,
        matrixName: 'Research Lead',
        matrixEmoji: '🧪',
      },
      domainResults: [
        {
          domain: 'contextEfficiency',
          overallScore: 75,
          confidenceScore: 0.8,
          strengths: [],
          growthAreas: [],
          data: {
            inefficiencyPatterns: [{ type: 'stale_context', frequency: 30, impact: 'medium' }],
          },
          analyzedAt: '2026-03-16T00:00:00.000Z',
        },
      ],
      content: {
        personalitySummary: ['Verification-first analyst.'],
      },
    });

    expect(normalized.evaluation.personalitySummary).toContain('Verification-first analyst');
    expect(normalized.evaluation.agentOutputs?.efficiency?.inefficiencyPatterns[0]?.pattern).toBe('stale_context');
    expect(normalized.activitySessions?.[0]?.projectName).toBe('plugin-analysis');
  });
});
