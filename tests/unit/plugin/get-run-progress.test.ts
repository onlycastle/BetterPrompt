import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAnalysisRun,
  saveDomainResult,
  saveTypeResult,
} from '../../../packages/plugin/lib/results-db.js';
import {
  recordStageStatus,
  saveStageOutput,
} from '../../../packages/plugin/lib/stage-db.js';
import {
  createDomainResults,
  createPhase1Output,
  createStageOutputs,
  createTypeResult,
  deterministicScores,
  pinCurrentRunId,
  resetResultsStorage,
} from './plugin-analysis-fixtures.js';

function seedPartialRun(): number {
  const phase1Output = createPhase1Output();
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: deterministicScores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });

  pinCurrentRunId(runId);

  saveStageOutput(runId, 'sessionSummaries', createStageOutputs().sessionSummaries);
  recordStageStatus(runId, 'sessionSummaries', { status: 'validated' });

  saveStageOutput(runId, 'extractAiPartnership', createStageOutputs().extractAiPartnership);
  recordStageStatus(runId, 'extractAiPartnership', { status: 'validated' });

  saveDomainResult(runId, createDomainResults()[0]!);
  recordStageStatus(runId, 'aiPartnership', { status: 'validated' });

  return runId;
}

function seedCompleteRun(): number {
  const phase1Output = createPhase1Output();
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: deterministicScores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });

  pinCurrentRunId(runId);

  for (const result of createDomainResults()) {
    saveDomainResult(runId, result);
  }

  saveTypeResult(runId, createTypeResult(phase1Output));

  for (const [stage, data] of Object.entries(createStageOutputs())) {
    saveStageOutput(runId, stage, data);
  }

  return runId;
}

afterEach(() => {
  resetResultsStorage();
  vi.resetModules();
});

describe('get_run_progress', () => {
  it('reports when no resumable run exists', async () => {
    const { execute } = await import('../../../packages/plugin/mcp/tools/get-run-progress.js');

    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('no_run');
    expect(parsed.message).toContain('Start Phase 1');
  });

  it('returns the first incomplete required stage for a partial run', async () => {
    const runId = seedPartialRun();
    const { execute } = await import('../../../packages/plugin/mcp/tools/get-run-progress.js');

    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.completionStatus).toBe('incomplete');
    expect(parsed.completedRequiredStages).toBe(3);
    expect(parsed.nextStep).toEqual({
      stage: 'extractSessionCraft',
      skill: 'extract-session-craft',
      tool: null,
      kind: 'stage',
    });
    expect(parsed.projectNames).toEqual(['nomoreaislop']);
  });

  it('returns verify_evidence as the resume tool when only evidence verification remains', async () => {
    const phase1Output = createPhase1Output();
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores: deterministicScores,
      phase1Output,
      activitySessions: phase1Output.activitySessions,
    });

    pinCurrentRunId(runId);
    saveTypeResult(runId, createTypeResult(phase1Output));

    for (const result of createDomainResults()) {
      saveDomainResult(runId, result);
    }

    for (const [stage, data] of Object.entries(createStageOutputs())) {
      if (stage === 'evidenceVerification' || stage === 'contentWriter') {
        continue;
      }

      saveStageOutput(runId, stage, data);
      recordStageStatus(runId, stage, { status: 'validated' });
    }

    const { execute } = await import('../../../packages/plugin/mcp/tools/get-run-progress.js');
    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('ok');
    expect(parsed.completionStatus).toBe('incomplete');
    expect(parsed.nextStep).toEqual({
      stage: 'evidenceVerification',
      skill: null,
      tool: 'verify_evidence',
      kind: 'stage',
    });
  });

  it('returns classify_developer_type when deterministic type is missing after writers and context stages', async () => {
    const phase1Output = createPhase1Output();
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores: deterministicScores,
      phase1Output,
      activitySessions: phase1Output.activitySessions,
    });

    pinCurrentRunId(runId);

    for (const result of createDomainResults()) {
      saveDomainResult(runId, result);
      recordStageStatus(runId, result.domain, { status: 'validated' });
    }

    for (const [stage, data] of Object.entries(createStageOutputs())) {
      if (stage === 'typeClassification' || stage === 'evidenceVerification' || stage === 'contentWriter') {
        continue;
      }

      saveStageOutput(runId, stage, data);
      recordStageStatus(runId, stage, { status: 'validated' });
    }

    const { execute } = await import('../../../packages/plugin/mcp/tools/get-run-progress.js');
    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('ok');
    expect(parsed.completionStatus).toBe('incomplete');
    expect(parsed.nextStep).toEqual({
      stage: 'deterministicType',
      skill: null,
      tool: 'classify_developer_type',
      kind: 'stage',
    });
  });

  it('reports generate_report as the next step when all required stages are present', async () => {
    const { execute } = await import('../../../packages/plugin/mcp/tools/get-run-progress.js');
    seedCompleteRun();

    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('ok');
    expect(parsed.completionStatus).toBe('complete');
    expect(parsed.completedRequiredStages).toBe(parsed.totalRequiredStages);
    expect(parsed.nextStep).toEqual({
      stage: 'generateReport',
      skill: null,
      tool: 'generate_report',
      kind: 'report',
    });
  });
});
