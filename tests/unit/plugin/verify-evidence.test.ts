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
    const { execute } = await import('../../../packages/plugin/mcp/tools/verify-evidence.js');

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
          utteranceId: 'missing_utterance',
          relevanceScore: 0,
          verified: false,
        }),
      ]),
    );

    expect(saved?.domainStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'aiPartnership',
          totalEvidence: 3,
          keptCount: 2,
          filteredCount: 1,
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
