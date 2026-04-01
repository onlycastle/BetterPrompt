import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAnalysisRun,
  getCurrentRunId,
  saveDomainResult,
} from '../../../packages/plugin/lib/results-db.js';
import {
  getStageOutput,
  getStageStatuses,
} from '../../../packages/plugin/lib/stage-db.js';
import {
  createDomainResults,
  createPhase1Output,
  deterministicScores,
  pinCurrentRunId,
  resetResultsStorage,
} from './plugin-analysis-fixtures.js';

function seedRunWithEvidence(): number {
  const phase1Output = createPhase1Output();
  phase1Output.developerUtterances.push(
    {
      id: 'session-1_2',
      text: '/ship-it',
      timestamp: '2026-03-16T09:09:00.000Z',
      sessionId: 'session-1',
      turnIndex: 2,
      characterCount: 8,
      wordCount: 1,
      hasCodeBlock: false,
      hasQuestion: false,
      isContinuation: true,
    },
    {
      id: 'session-1_3',
      text: 'task-id: abc123 status: completed',
      timestamp: '2026-03-16T09:10:00.000Z',
      sessionId: 'session-1',
      turnIndex: 3,
      characterCount: 33,
      wordCount: 4,
      hasCodeBlock: false,
      hasQuestion: false,
      isContinuation: true,
    },
    {
      id: 'session-1_4',
      text: '[RALPH LOOP ACTIVATED]\n\n구현 시작해줘\n\n## How Ralph Loop Works\n\n1. Work on the task continuously and thoroughly\n2. Output `<promise>DONE</promise>` when complete\n3. Continue until verified.\n',
      timestamp: '2026-03-16T09:11:00.000Z',
      sessionId: 'session-1',
      turnIndex: 4,
      characterCount: 188,
      wordCount: 27,
      hasCodeBlock: false,
      hasQuestion: false,
      isContinuation: true,
    },
    {
      id: 'session-1_5',
      text: '/api/users returns 500 for suspended members.',
      timestamp: '2026-03-16T09:12:00.000Z',
      sessionId: 'session-1',
      turnIndex: 5,
      characterCount: 45,
      wordCount: 6,
      hasCodeBlock: false,
      hasQuestion: false,
      isContinuation: true,
    },
  );
  phase1Output.sessionMetrics.totalDeveloperUtterances = phase1Output.developerUtterances.length;
  phase1Output.activitySessions[0]!.userMessageCount = phase1Output.developerUtterances.length;
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: deterministicScores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });

  pinCurrentRunId(runId);

  const domainResults = createDomainResults();
  domainResults[0] = {
    ...domainResults[0]!,
    strengths: [
      ...(domainResults[0]?.strengths ?? []),
      {
        title: 'Bad citation',
        description: 'This quote should be filtered because it does not exist in the source utterances.',
        evidence: [
          {
            utteranceId: 'missing_utterance',
            quote: 'This quote was never said in the transcript.',
          },
        ],
      },
      {
        title: 'Command-only citation',
        description: 'This quote should be filtered because a bare slash-command is not strong user evidence for a report finding.',
        evidence: [
          {
            utteranceId: 'session-1_2',
            quote: '/ship-it',
          },
        ],
      },
      {
        title: 'Task status citation',
        description: 'This quote should be filtered because task completion metadata is machine output, not the user prompt itself.',
        evidence: [
          {
            utteranceId: 'session-1_3',
            quote: 'task-id: abc123 status: completed',
          },
        ],
      },
      {
        title: 'Injected instruction block citation',
        description: 'This quote should be filtered because slash-command activation instructions are system-expanded workflow text, not the user prompt itself.',
        evidence: [
          {
            utteranceId: 'session-1_4',
            quote: '[RALPH LOOP ACTIVATED] 구현 시작해줘 - a self-referential development loop that runs until task completion.',
          },
        ],
      },
      {
        title: 'Path-like prompt citation',
        description: 'This quote should be kept because it is a legitimate user prompt about an API path, not a slash-command invocation.',
        evidence: [
          {
            utteranceId: 'session-1_5',
            quote: '/api/users returns 500 for suspended members.',
          },
        ],
      },
    ],
  };

  for (const result of domainResults) {
    saveDomainResult(runId, result);
  }

  return runId;
}

afterEach(() => {
  resetResultsStorage();
  vi.resetModules();
});

describe('verify_evidence', () => {
  it('persists a validated evidenceVerification stage with deterministic scores', async () => {
    const runId = seedRunWithEvidence();
    const { execute } = await import('../../../packages/plugin/cli/commands/verify-evidence.ts');

    const parsed = JSON.parse(await execute({}));

    expect(getCurrentRunId()).toBe(runId);
    expect(parsed.status).toBe('ok');
    expect(parsed.stage).toBe('evidenceVerification');
    expect(parsed.threshold).toBe(50);
    expect(parsed.keptCount).toBeGreaterThan(0);
    expect(parsed.filteredCount).toBeGreaterThan(0);

    const saved = getStageOutput<{
      threshold: number;
      verifiedResults: Array<{ utteranceId: string; relevanceScore: number; verified: boolean }>;
      domainStats: Array<{ domain: string; totalEvidence: number; keptCount: number; filteredCount: number }>;
    }>(runId, 'evidenceVerification');

    expect(saved).not.toBeNull();
    expect(saved?.threshold).toBe(50);
    expect(saved?.verifiedResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          utteranceId: 'session-1_0',
          relevanceScore: 100,
          verified: true,
        }),
        expect.objectContaining({
          utteranceId: 'session-1_5',
          relevanceScore: 100,
          verified: true,
        }),
        expect.objectContaining({
          utteranceId: 'missing_utterance',
          relevanceScore: 0,
          verified: false,
        }),
        expect.objectContaining({
          utteranceId: 'session-1_2',
          relevanceScore: 0,
          verified: false,
        }),
        expect.objectContaining({
          utteranceId: 'session-1_3',
          relevanceScore: 0,
          verified: false,
        }),
        expect.objectContaining({
          utteranceId: 'session-1_4',
          relevanceScore: 0,
          verified: false,
        }),
      ]),
    );

    expect(saved?.domainStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'aiPartnership',
          totalEvidence: 7,
          keptCount: 3,
          filteredCount: 4,
        }),
      ]),
    );

    expect(getStageStatuses(runId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'evidenceVerification',
          status: 'validated',
        }),
      ]),
    );
  });
});
