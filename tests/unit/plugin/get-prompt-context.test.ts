import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnalysisRun,
  saveDomainResult,
  saveTypeResult,
} from '../../../packages/plugin/lib/results-db.js';
import { saveStageOutput } from '../../../packages/plugin/lib/stage-db.js';
import { execute } from '../../../packages/plugin/mcp/tools/get-prompt-context.js';
import {
  createDomainResults,
  createPhase1Output,
  createStageOutputs,
  createTypeResult,
  deterministicScores,
  pinCurrentRunId,
  resetResultsStorage,
} from './plugin-analysis-fixtures.js';

function seedRun(): number {
  const phase1Output = createPhase1Output();
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: deterministicScores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });

  for (const result of createDomainResults()) {
    saveDomainResult(runId, result);
  }

  for (const [stage, data] of Object.entries(createStageOutputs())) {
    saveStageOutput(runId, stage, data);
  }

  saveTypeResult(runId, createTypeResult(phase1Output));
  pinCurrentRunId(runId);
  return runId;
}

afterEach(() => {
  resetResultsStorage();
});

describe('get_prompt_context tool', () => {
  it('returns domain-specific context for learning analysis without rereading raw phase1 files', async () => {
    const runId = seedRun();

    const parsed = JSON.parse(await execute({
      kind: 'domainAnalysis',
      domain: 'learningBehavior',
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.kind).toBe('domainAnalysis');
    expect(parsed.domain).toBe('learningBehavior');
    expect(parsed.data.availableDomains).toContain('learningBehavior');
    expect(parsed.data.availableStages).toContain('contentWriter');
    expect(parsed.data.phase1.developerUtterances[0].precedingAIToolCalls).toEqual(['read_file', 'search_code']);
    expect(parsed.data.phase1.aiInsightBlocks[0].triggeringUtteranceId).toBe('session-1_1');
    expect(parsed.data.phase1.sessions[0].messages[1].content).toHaveLength(700);
    expect(parsed.data.phase1.sessions[0].messages[1].content.endsWith('…')).toBe(true);
  });

  it('returns the narrowed content-writer context instead of dumping every prior stage', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({ kind: 'contentWriter' }));

    expect(parsed.status).toBe('ok');
    expect(parsed.data.deterministicType.matrixName).toBeTruthy();
    expect(parsed.data.domainResults).toHaveLength(5);
    expect(Object.keys(parsed.data.stageOutputs).sort()).toEqual([
      'evidenceVerification',
      'projectSummaries',
      'typeClassification',
      'weeklyInsights',
    ]);
  });

  it('fails fast when a domain analysis request omits the domain', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({ kind: 'domainAnalysis' }));

    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('Domain is required');
  });
});
