import { describe, expect, it } from 'vitest';
import { CanonicalAnalysisRunSchema } from '@betterprompt/shared';
import {
  assembleCanonicalAnalysisRun,
  buildCanonicalEvaluation,
  buildReportActivitySessions,
} from '../../../packages/plugin/lib/evaluation-assembler.js';
import type {
  CanonicalStageOutputs,
  DeterministicTypeResult,
  DeterministicScores,
  DomainResult,
  Phase1Output,
} from '../../../packages/plugin/lib/core/types.js';

function createPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: 'Please add verification before merging this change.',
        timestamp: '2026-03-15T12:00:00.000Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 48,
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
      avgDeveloperMessageLength: 48,
      questionRatio: 0,
      codeBlockRatio: 0,
      dateRange: {
        earliest: '2026-03-15T12:00:00.000Z',
        latest: '2026-03-15T12:05:00.000Z',
      },
    },
    activitySessions: [
      {
        sessionId: 'session-1',
        projectName: 'nomoreaislop',
        projectPath: '/tmp/nomoreaislop',
        startTime: '2026-03-15T12:00:00.000Z',
        durationSeconds: 600,
        messageCount: 2,
        userMessageCount: 1,
        assistantMessageCount: 1,
        totalInputTokens: 120,
        totalOutputTokens: 80,
        firstUserMessage: 'Please add verification before merging this change.',
      },
    ],
    sessions: [
      {
        sessionId: 'session-1',
        projectPath: '/tmp/nomoreaislop',
        projectName: 'nomoreaislop',
        startTime: '2026-03-15T12:00:00.000Z',
        endTime: '2026-03-15T12:10:00.000Z',
        durationSeconds: 600,
        claudeCodeVersion: '1.0.0',
        messages: [
          {
            uuid: 'user-1',
            role: 'user',
            timestamp: '2026-03-15T12:00:00.000Z',
            content: 'Please add verification before merging this change.',
          },
          {
            uuid: 'assistant-1',
            role: 'assistant',
            timestamp: '2026-03-15T12:05:00.000Z',
            content: 'Added verification.',
            toolCalls: [
              {
                id: 'tool-1',
                name: 'edit_file',
                input: {},
                result: 'ok',
              },
            ],
            tokenUsage: { input: 120, output: 80 },
          },
        ],
        stats: {
          userMessageCount: 1,
          assistantMessageCount: 1,
          toolCallCount: 1,
          uniqueToolsUsed: ['edit_file'],
          totalInputTokens: 120,
          totalOutputTokens: 80,
        },
        source: 'claude-code',
      },
    ],
  };
}

function createDomainResults(): DomainResult[] {
  return [
    {
      domain: 'communicationPatterns',
      overallScore: 82,
      confidenceScore: 0.8,
      strengths: [
        {
          title: 'Specific requests',
          description: 'The developer gives concrete goals, explicit completion conditions, and clear acceptance criteria so the assistant can act with less ambiguity and fewer hidden assumptions.',
          evidence: [{ utteranceId: 'session-1_0', quote: 'Please add verification before merging this change.' }],
        },
      ],
      growthAreas: [],
      data: {
        communicationPatterns: [
          {
            title: 'Verification-first prompts',
            description: 'The developer asks for explicit verification before completion.',
            frequency: 'frequent',
            evidence: [
              {
                utteranceId: 'session-1_0',
                quote: 'Please add verification before merging this change.',
                context: 'Sets a clear quality bar.',
              },
            ],
            effectiveness: 'highly_effective',
          },
        ],
      },
      analyzedAt: '2026-03-16T00:00:00.000Z',
    },
    {
      domain: 'contextEfficiency',
      overallScore: 76,
      confidenceScore: 0.7,
      strengths: [],
      growthAreas: [
        {
          title: 'Long context carryover',
          description: 'The developer occasionally keeps too much stale context around between steps, which can blur the current objective and make it harder for the assistant to separate old assumptions from the next task.',
          severity: 'medium',
          recommendation: 'Trim no-longer-needed context between phases and restate the current objective before asking for the next change.',
          evidence: [
            { utteranceId: 'session-1_0', quote: 'Please add verification before merging this change.' },
            { utteranceId: 'session-1_1', quote: 'Unverified stale context example.' },
          ],
        },
      ],
      data: {
        inefficiencyPatterns: [
          {
            type: 'stale_context',
            frequency: 30,
            impact: 'medium',
          },
        ],
      },
      analyzedAt: '2026-03-16T00:00:00.000Z',
    },
  ];
}

function createStageOutputs(): CanonicalStageOutputs {
  return {
    sessionSummaries: {
      summaries: [{ sessionId: 'session-1', summary: 'Added verification before merge.' }],
    },
    projectSummaries: {
      projects: [{ projectName: 'nomoreaislop', summaryLines: ['Improved plugin parity flow.'], sessionCount: 1 }],
    },
    weeklyInsights: {
      stats: {
        sessionCount: 1,
        totalMinutes: 10,
        totalTokens: 200,
        activeDays: 1,
      },
      projects: [{ projectName: 'nomoreaislop', sessionCount: 1, percentage: 100 }],
      topSessions: [{ sessionId: 'session-1', summary: 'Added verification before merge.' }],
      narrative: 'A focused week on plugin parity.',
      highlights: ['Tightened report/sync contracts.'],
    },
    typeClassification: {
      reasoning: ['You consistently ask for verification before considering work complete.'],
      personalityNarrative: ['You prefer explicit quality gates.'],
      collaborationMaturity: 'structured',
    },
    contentWriter: {
      topFocusAreas: [
        {
          title: 'Keep verification visible',
          description: 'Continue making completion checks explicit in prompts and review steps.',
          relatedQualities: ['thinkingQuality'],
          actions: {
            start: 'List the proof command up front.',
            stop: 'Accepting unchecked changes.',
            continue: 'Requesting validation.',
          },
        },
      ],
    },
    evidenceVerification: {
      threshold: 75,
      domainStats: [
        {
          domain: 'contextEfficiency',
          totalEvidence: 1,
          keptCount: 1,
          filteredCount: 0,
        },
      ],
      verifiedResults: [
        {
          utteranceId: 'session-1_0',
          quote: 'Please add verification before merging this change.',
          relevanceScore: 91,
          verified: true,
        },
        {
          utteranceId: 'session-1_1',
          quote: 'Unverified stale context example.',
          relevanceScore: 20,
          verified: false,
        },
      ],
    },
    translator: {
      targetLanguage: 'ko',
      translatedFields: {
        personalitySummary: '명시적인 품질 게이트를 선호합니다.',
        promptPatterns: [
          {
            patternName: '검증 우선 프롬프트',
            description: '완료 전에 명시적 검증을 요청합니다.',
            examples: [{ analysis: '명확한 품질 기준을 세웁니다.' }],
          },
        ],
        topFocusAreas: {
          summary: '가장 중요한 협업 개선 포인트입니다.',
          areas: [
            {
              rank: 1,
              title: '검증을 계속 드러내기',
              narrative: '완료 기준을 프롬프트와 리뷰 단계에 계속 명시하세요.',
              expectedImpact: '검증 누락을 줄입니다.',
              actions: {
                start: '처음에 증명 명령을 적으세요.',
                stop: '검증 없는 완료 수용.',
                continue: '검증 요청 유지.',
              },
            },
          ],
        },
        projectSummaries: [
          {
            projectName: 'nomoreaislop',
            summaryLines: ['플러그인 패리티 흐름을 개선했습니다.'],
          },
        ],
        weeklyInsights: {
          narrative: '플러그인 패리티에 집중한 한 주였습니다.',
          highlights: ['리포트와 동기화 계약을 강화했습니다.'],
          topSessionSummaries: ['병합 전 검증을 추가했습니다.'],
        },
      },
    },
  };
}

const deterministicScores: DeterministicScores = {
  aiPartnership: 77,
  sessionCraft: 73,
  toolMastery: 82,
  skillResilience: 72,
  sessionMastery: 75,
  controlScore: 74,
  thinkingQuality: 80,
  communicationPatterns: 82,
  learningBehavior: 70,
  contextEfficiency: 76,
  sessionOutcome: 75,
};

const typeResult: DeterministicTypeResult = {
  primaryType: 'architect',
  distribution: {
    architect: 45,
    analyst: 20,
    conductor: 15,
    speedrunner: 10,
    trendsetter: 10,
  },
  controlLevel: 'navigator',
  controlScore: 74,
  matrixName: 'Systems Architect',
  matrixEmoji: '🏛️',
};

describe('canonical plugin analysis assembly', () => {
  it('builds a dashboard-compatible evaluation from stored run artifacts', () => {
    const phase1Output = createPhase1Output();
    const activitySessions = buildReportActivitySessions(phase1Output, createStageOutputs().sessionSummaries);
    const evaluation = buildCanonicalEvaluation({
      analyzedAt: '2026-03-16T00:00:00.000Z',
      phase1Output,
      activitySessions,
      deterministicScores,
      domainResults: createDomainResults(),
      stageOutputs: createStageOutputs(),
      typeResult,
    }) as Record<string, any>;

    expect(activitySessions[0]?.durationMinutes).toBe(10);
    expect(activitySessions[0]?.summary).toContain('verification');
    expect(evaluation.personalitySummary).toBe('명시적인 품질 게이트를 선호합니다.');
    expect(evaluation.promptPatterns[0]?.patternName).toBe('검증 우선 프롬프트');
    expect(evaluation.promptPatterns[0]?.examples[0]?.quote).toContain('Please add verification');
    expect(evaluation.promptPatterns[0]?.examples[0]?.analysis).toBe('명확한 품질 기준을 세웁니다.');
    expect(evaluation.sessionSummaries[0]?.summary).toContain('verification');
    expect(evaluation.projectSummaries[0]?.projectName).toBe('nomoreaislop');
    expect(evaluation.projectSummaries[0]?.summaryLines[0]).toContain('패리티');
    expect(evaluation.weeklyInsights?.narrative).toContain('패리티');
    expect(evaluation.weeklyInsights?.topProjectSessions[0]?.summary).toContain('검증');
    expect(evaluation.topFocusAreas?.areas[0]?.actions?.start).toContain('증명 명령');
    expect(evaluation.workerInsights.contextEfficiency.domainScore).toBe(76);
    expect(evaluation.agentOutputs.efficiency.inefficiencyPatterns[0]?.pattern).toBe('context_bloat');
    expect(evaluation.analysisMetadata.evidenceVerification.threshold).toBe(75);
  });

  it('produces a canonical run envelope accepted by the shared schema', () => {
    const phase1Output = createPhase1Output();
    const run = assembleCanonicalAnalysisRun({
      runId: 7,
      analyzedAt: '2026-03-16T00:00:00.000Z',
      phase1Output,
      deterministicScores,
      typeResult,
      domainResults: createDomainResults(),
      stageOutputs: createStageOutputs(),
    });

    const parsed = CanonicalAnalysisRunSchema.safeParse(run);
    expect(parsed.success).toBe(true);
    expect(run.domainResults[0]?.strengths[0]?.evidence).toHaveLength(1);
    expect(run.domainResults[1]?.growthAreas[0]?.evidence).toHaveLength(1);
  });
});
