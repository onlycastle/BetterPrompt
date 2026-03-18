import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnalysisRun,
  getAnalysisRun,
} from '../../../packages/plugin/lib/results-db.js';
import { execute } from '../../../packages/plugin/mcp/tools/classify-developer-type.js';
import {
  createPhase1Output,
  deterministicScores,
  pinCurrentRunId,
  resetResultsStorage,
} from './plugin-analysis-fixtures.js';

afterEach(() => {
  resetResultsStorage();
});

describe('classify_developer_type tool', () => {
  it('classifies from the persisted run record when the legacy phase1 file is absent', async () => {
    const phase1Output = createPhase1Output();
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores: deterministicScores,
      phase1Output,
      activitySessions: phase1Output.activitySessions,
    });
    pinCurrentRunId(runId);

    const parsed = JSON.parse(await execute({}));
    const run = getAnalysisRun(runId);

    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.matrixName).toBeTruthy();
    expect(run?.typeResult?.matrixName).toBe(parsed.matrixName);
  });
});
