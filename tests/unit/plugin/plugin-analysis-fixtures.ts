import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeDeterministicType } from '../../../packages/plugin/lib/core/deterministic-type-mapper.js';
import { getPluginDataDir } from '../../../packages/plugin/lib/core/session-scanner.js';
import { closeResultsDb } from '../../../packages/plugin/lib/results-db.js';
import type {
  CanonicalStageOutputs,
  DeterministicScores,
  DeterministicTypeResult,
  DomainResult,
  Phase1Output,
} from '../../../packages/plugin/lib/core/types.js';

export const deterministicScores: DeterministicScores = {
  thinkingQuality: 80,
  communicationPatterns: 82,
  learningBehavior: 74,
  contextEfficiency: 76,
  sessionOutcome: 78,
  controlScore: 74,
};

export function resetResultsStorage(): void {
  closeResultsDb();
  rmSync(getPluginDataDir(), { recursive: true, force: true });
}

export function pinCurrentRunId(runId: number): void {
  const pluginDataDir = getPluginDataDir();
  mkdirSync(pluginDataDir, { recursive: true });
  writeFileSync(join(pluginDataDir, 'current-run-id.txt'), String(runId));
}

export function createPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: 'Map the plan first, then verify it with tests before merging.',
        displayText: 'Map the plan first, then verify it with tests before merging.',
        timestamp: '2026-03-16T09:00:00.000Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 59,
        wordCount: 11,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        precedingAIToolCalls: ['read_file', 'search_code'],
      },
      {
        id: 'session-1_1',
        text: 'The retry logs still show stale context. Summarize the root cause and the fix.',
        timestamp: '2026-03-16T09:08:00.000Z',
        sessionId: 'session-1',
        turnIndex: 1,
        characterCount: 79,
        wordCount: 14,
        hasCodeBlock: false,
        hasQuestion: false,
        isContinuation: true,
        precedingAIToolCalls: ['run_tests'],
        precedingAIHadError: true,
      },
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 4,
      totalDeveloperUtterances: 2,
      totalAIResponses: 2,
      avgMessagesPerSession: 4,
      avgDeveloperMessageLength: 69,
      questionRatio: 0,
      codeBlockRatio: 0,
      avgContextFillPercent: 58,
      maxContextFillPercent: 74,
      dateRange: {
        earliest: '2026-03-16T09:00:00.000Z',
        latest: '2026-03-16T09:12:00.000Z',
      },
    },
    aiInsightBlocks: [
      {
        sessionId: 'session-1',
        turnIndex: 1,
        content: 'Captured retry analysis, test verification, and stale-context evidence for the root-cause pass.',
        triggeringUtteranceId: 'session-1_1',
      },
    ],
    activitySessions: [
      {
        sessionId: 'session-1',
        projectName: 'nomoreaislop',
        projectPath: '/tmp/nomoreaislop',
        startTime: '2026-03-16T09:00:00.000Z',
        durationSeconds: 720,
        messageCount: 4,
        userMessageCount: 2,
        assistantMessageCount: 2,
        totalInputTokens: 640,
        totalOutputTokens: 420,
        firstUserMessage: 'Map the plan first, then verify it with tests before merging.',
      },
    ],
    sessions: [
      {
        sessionId: 'session-1',
        projectPath: '/tmp/nomoreaislop',
        projectName: 'nomoreaislop',
        startTime: '2026-03-16T09:00:00.000Z',
        endTime: '2026-03-16T09:12:00.000Z',
        durationSeconds: 720,
        claudeCodeVersion: '1.0.0',
        messages: [
          {
            uuid: 'user-1',
            role: 'user',
            timestamp: '2026-03-16T09:00:00.000Z',
            content: 'Map the plan first, then verify it with tests before merging.',
          },
          {
            uuid: 'assistant-1',
            role: 'assistant',
            timestamp: '2026-03-16T09:03:00.000Z',
            content: 'A'.repeat(900),
            toolCalls: [
              {
                id: 'tool-1',
                name: 'read_file',
                input: {},
                result: 'ok',
              },
            ],
            tokenUsage: { input: 320, output: 180 },
          },
          {
            uuid: 'user-2',
            role: 'user',
            timestamp: '2026-03-16T09:08:00.000Z',
            content: 'The retry logs still show stale context. Summarize the root cause and the fix.',
          },
          {
            uuid: 'assistant-2',
            role: 'assistant',
            timestamp: '2026-03-16T09:12:00.000Z',
            content: 'Root cause isolated and fix verified.',
            toolCalls: [
              {
                id: 'tool-2',
                name: 'run_tests',
                input: {},
                result: 'ok',
              },
            ],
            tokenUsage: { input: 320, output: 240 },
          },
        ],
        stats: {
          userMessageCount: 2,
          assistantMessageCount: 2,
          toolCallCount: 2,
          uniqueToolsUsed: ['read_file', 'run_tests'],
          totalInputTokens: 640,
          totalOutputTokens: 420,
        },
        source: 'claude-code',
      },
    ],
  };
}

export function createTypeResult(phase1Output = createPhase1Output()): DeterministicTypeResult {
  return computeDeterministicType(deterministicScores, phase1Output);
}

export function createDomainResults(): DomainResult[] {
  return [
    {
      domain: 'thinkingQuality',
      overallScore: deterministicScores.thinkingQuality,
      confidenceScore: 0.86,
      strengths: [
        {
          title: 'Plans before editing',
          description: 'The developer frames the task as a sequence of deliberate steps before asking for edits, which makes verification and rollback boundaries clear.',
          evidence: [
            { utteranceId: 'session-1_0', quote: 'Map the plan first, then verify it with tests before merging.' },
          ],
        },
      ],
      growthAreas: [
        {
          title: 'Surface assumptions earlier',
          description: 'The developer often notices stale-context risks after a retry has already happened.',
          severity: 'medium',
          recommendation: 'State the expected source of truth before the first edit when a task spans multiple retries.',
          evidence: [
            { utteranceId: 'session-1_1', quote: 'The retry logs still show stale context. Summarize the root cause and the fix.' },
          ],
        },
      ],
      data: {
        planningHabits: [
          {
            type: 'plan_first',
            frequency: 'frequent',
            examples: ['Map the plan first, then verify it with tests before merging.'],
            effectiveness: 'high',
          },
        ],
        verificationBehavior: {
          level: 'systematic',
        },
        criticalThinkingMoments: [
          {
            type: 'assumption_check',
            quote: 'Summarize the root cause and the fix.',
            result: 'The request forces the model to separate symptoms from root cause.',
            utteranceId: 'session-1_1',
            sessionId: 'session-1',
          },
        ],
        verificationAntiPatterns: [
          {
            type: 'late_assumption_check',
            severity: 'low',
            frequency: 1,
            evidence: [
              { utteranceId: 'session-1_1', quote: 'The retry logs still show stale context. Summarize the root cause and the fix.' },
            ],
            improvement: 'Ask for the root-cause frame before the retry loop widens.',
          },
        ],
        planQualityScore: 82,
      },
      analyzedAt: '2026-03-16T10:00:00.000Z',
    },
    {
      domain: 'communicationPatterns',
      overallScore: deterministicScores.communicationPatterns,
      confidenceScore: 0.83,
      strengths: [
        {
          title: 'Explicit completion criteria',
          description: 'The developer names the desired artifact and the proof step in the same prompt, which keeps the assistant aligned on both output and validation.',
          evidence: [
            { utteranceId: 'session-1_0', quote: 'Map the plan first, then verify it with tests before merging.' },
          ],
        },
      ],
      growthAreas: [],
      data: {
        communicationPatterns: [
          {
            title: 'Verification-first prompts',
            description: 'Requests pair implementation with proof.',
            frequency: 'frequent',
            effectiveness: 'highly_effective',
            evidence: [
              {
                utteranceId: 'session-1_0',
                quote: 'Map the plan first, then verify it with tests before merging.',
                context: 'The prompt defines both the edit sequence and completion proof.',
              },
            ],
          },
        ],
      },
      analyzedAt: '2026-03-16T10:00:00.000Z',
    },
    {
      domain: 'learningBehavior',
      overallScore: deterministicScores.learningBehavior,
      confidenceScore: 0.79,
      strengths: [
        {
          title: 'Requests root-cause explanations',
          description: 'The developer asks for explanation and synthesis instead of only asking for another attempt, which gives the assistant a chance to generalize the fix.',
          evidence: [
            { utteranceId: 'session-1_1', quote: 'Summarize the root cause and the fix.' },
          ],
        },
      ],
      growthAreas: [],
      data: {
        knowledgeGaps: [
          {
            topic: 'stale context management',
            severity: 'medium',
            description: 'Retry loops occasionally widen the active context before the root cause is named.',
            evidence: [
              { utteranceId: 'session-1_1', quote: 'The retry logs still show stale context.' },
            ],
          },
        ],
        learningProgress: [
          {
            topic: 'verification discipline',
            startLevel: 'emerging',
            currentLevel: 'consistent',
            milestones: ['Started naming proof steps up front.'],
          },
        ],
        recommendedResources: [
          {
            name: 'Prompt Compression Notes',
            topic: 'stale context management',
            resourceType: 'guide',
            targetGap: 'Retry loops carrying old assumptions.',
            priority: 'high',
          },
        ],
      },
      analyzedAt: '2026-03-16T10:00:00.000Z',
    },
    {
      domain: 'contextEfficiency',
      overallScore: deterministicScores.contextEfficiency,
      confidenceScore: 0.78,
      strengths: [],
      growthAreas: [
        {
          title: 'Retry context spillover',
          description: 'The developer occasionally keeps too much stale context alive between attempts, which raises the chance that the assistant optimizes for the previous branch instead of the current fix.',
          severity: 'medium',
          recommendation: 'Restate the active branch and expected source of truth after each failed attempt.',
          evidence: [
            { utteranceId: 'session-1_1', quote: 'The retry logs still show stale context.' },
          ],
        },
      ],
      data: {
        inefficiencyPatterns: [
          {
            type: 'context_bloat',
            frequency: 30,
            impact: 'medium',
            description: 'Retries sometimes retain stale implementation branches.',
          },
        ],
      },
      analyzedAt: '2026-03-16T10:00:00.000Z',
    },
    {
      domain: 'sessionOutcome',
      overallScore: deterministicScores.sessionOutcome,
      confidenceScore: 0.81,
      strengths: [
        {
          title: 'Sessions end with proof',
          description: 'The developer tends to close the loop with tests or evidence, which improves confidence in the outcome even when retries were needed earlier in the session.',
          evidence: [
            { utteranceId: 'session-1_0', quote: 'verify it with tests before merging.' },
          ],
        },
      ],
      growthAreas: [],
      data: {
        sessionAnalyses: [
          {
            sessionId: 'session-1',
            goals: ['land the fix', 'verify with tests'],
            sessionType: 'implementation',
            outcome: 'successful',
            outcomeScore: 84,
            frictionTypes: ['stale_context'],
          },
        ],
        overallSuccessRate: 100,
      },
      analyzedAt: '2026-03-16T10:00:00.000Z',
    },
  ];
}

export function createStageOutputs(): CanonicalStageOutputs {
  return {
    sessionSummaries: {
      summaries: [
        {
          sessionId: 'session-1',
          summary: 'Planned the fix, isolated stale context, and verified the result.',
        },
      ],
    },
    extractAiCollaboration: { dimension: 'aiCollaboration', quotes: [] },
    extractContextEngineering: { dimension: 'contextEngineering', quotes: [] },
    extractToolMastery: { dimension: 'toolMastery', quotes: [] },
    extractBurnoutRisk: { dimension: 'burnoutRisk', quotes: [] },
    extractAiControl: { dimension: 'aiControl', quotes: [] },
    extractSkillResilience: { dimension: 'skillResilience', quotes: [] },
    content: {
      topFocusAreas: [
        {
          title: 'Test focus area',
          description: 'Test description for content stage.',
          relatedQualities: ['thinkingQuality'],
          actions: {
            start: 'Start test.',
            stop: 'Stop test.',
            continue: 'Continue test.',
          },
        },
      ],
      personalitySummary: ['Test personality summary.'],
    },
    projectSummaries: {
      projects: [
        {
          projectName: 'nomoreaislop',
          summaryLines: ['Improved plugin parity and verification flow.'],
          sessionCount: 1,
        },
      ],
    },
    weeklyInsights: {
      stats: {
        sessionCount: 1,
        totalMinutes: 12,
        totalTokens: 1060,
        activeDays: 1,
      },
      projects: [
        {
          projectName: 'nomoreaislop',
          sessionCount: 1,
          percentage: 100,
        },
      ],
      topSessions: [
        {
          sessionId: 'session-1',
          summary: 'Resolved stale context and verified the fix.',
        },
      ],
      narrative: 'A focused pass on plugin analysis parity and verification discipline.',
      highlights: ['Replaced broad rereads with stage-specific context.'],
    },
    typeClassification: {
      reasoning: ['You consistently define proof steps before closing work.'],
      personalityNarrative: ['You prefer a plan-first, verification-heavy collaboration style.'],
      collaborationMaturity: 'structured',
    },
    evidenceVerification: {
      threshold: 75,
      domainStats: [
        {
          domain: 'thinkingQuality',
          totalEvidence: 2,
          keptCount: 2,
          filteredCount: 0,
        },
      ],
      verifiedResults: [
        {
          utteranceId: 'session-1_0',
          quote: 'Map the plan first, then verify it with tests before merging.',
          relevanceScore: 92,
          verified: true,
        },
      ],
    },
    contentWriter: {
      topFocusAreas: [
        {
          title: 'Name the source of truth earlier',
          description: 'Keep naming the active branch and validation command before retries widen the context.',
          relatedQualities: ['thinkingQuality', 'contextEfficiency'],
          actions: {
            start: 'Name the source of truth before the first edit.',
            stop: 'Carrying stale retry details into the next prompt.',
            continue: 'Requesting proof before considering work done.',
          },
        },
      ],
      personalitySummary: ['You work best when the plan and proof step are explicit.'],
    },
    translator: {
      targetLanguage: 'ko',
      translatedFields: {
        personalitySummary: '계획과 검증 단계를 분명히 둘 때 가장 잘 협업합니다.',
      },
    },
  };
}
