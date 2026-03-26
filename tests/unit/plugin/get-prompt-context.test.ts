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
  it('returns domain-specific context for skill resilience analysis without rereading raw phase1 files', async () => {
    const runId = seedRun();

    const parsed = JSON.parse(await execute({
      kind: 'domainAnalysis',
      domain: 'skillResilience',
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.kind).toBe('domainAnalysis');
    expect(parsed.domain).toBe('skillResilience');
    expect(parsed.data.availableDomains).toContain('skillResilience');
    expect(parsed.data.availableStages).toContain('contentWriter');
    expect(parsed.data.phase1.developerUtterances[0].precedingAIToolCalls).toEqual(['read_file', 'search_code']);
    expect(parsed.data.phase1.aiInsightBlocks[0].triggeringUtteranceId).toBe('session-1_1');
    expect(parsed.data.phase1.sessionOverviews[0].toolSequence).toEqual(['read_file', 'run_tests']);
    expect(parsed.data.phase1.interactionSnapshots[1].precedingAssistantPreview).toHaveLength(200);
    expect(parsed.data.phase1.interactionSnapshots[1].precedingAssistantPreview.endsWith('…')).toBe(true);
    expect(parsed.data.phase1.sessions).toBeUndefined();
  });

  it('returns condensed domain-analysis payloads so extractor stages do not carry raw session dumps', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({
      kind: 'domainAnalysis',
      domain: 'aiPartnership',
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.data.phase1.sessions).toBeUndefined();
    expect(parsed.data.phase1.sessionOverviews).toHaveLength(1);
    expect(parsed.data.phase1.interactionSnapshots).toHaveLength(2);
    expect(JSON.stringify(parsed.data).length).toBeLessThan(5000);
  });

  it('returns the narrowed content-writer context instead of dumping every prior stage', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({ kind: 'contentWriter' }));

    expect(parsed.status).toBe('ok');
    expect(parsed.data.deterministicType.matrixName).toBeTruthy();
    expect(parsed.data.domainResults).toHaveLength(5);
    expect(parsed.data.domainResults[0].strengths[0].evidence).toBeUndefined();
    expect(parsed.data.domainResults[0].data).toBeUndefined();
    expect(Object.keys(parsed.data.stageOutputs).sort()).toEqual([
      'evidenceVerification',
      'projectSummaries',
      'typeClassification',
      'weeklyInsights',
    ]);
    expect(parsed.data.stageOutputs.evidenceVerification.verifiedResults).toBeUndefined();
    expect(parsed.data.stageOutputs.evidenceVerification.verifiedEvidenceCount).toBe(1);
  });

  it('returns condensed type-classification context so skills can stay on MCP payloads', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({ kind: 'typeClassification' }));
    const domainWithGrowth = parsed.data.domainResults.find(
      (result: { growthAreas: Array<{ recommendation?: string }> }) => result.growthAreas.length > 0,
    );

    expect(parsed.status).toBe('ok');
    expect(parsed.data.deterministicType.matrixName).toBeTruthy();
    expect(parsed.data.domainResults).toHaveLength(5);
    expect(parsed.data.domainResults[0].strengths[0].evidence).toBeUndefined();
    expect(domainWithGrowth).toBeTruthy();
    expect(domainWithGrowth.growthAreas[0].recommendation).toBeTruthy();
    expect(parsed.data.domainResults[0].data).toBeUndefined();
  });

  it('filters untagged skill-injected prompts out of session overviews and interaction snapshots', async () => {
    const phase1Output = createPhase1Output();
    phase1Output.sessions![0]!.messages.splice(2, 0, {
      uuid: 'user-skill-injected',
      role: 'user',
      timestamp: '2026-03-16T09:04:00.000Z',
      content: 'Base directory for this skill: /tmp/skill\n\n# Example Skill',
    });
    phase1Output.sessions![0]!.stats.userMessageCount = 3;

    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores: deterministicScores,
      phase1Output,
      activitySessions: phase1Output.activitySessions,
    });

    for (const result of createDomainResults()) {
      saveDomainResult(runId, result);
    }

    pinCurrentRunId(runId);

    const parsed = JSON.parse(await execute({
      kind: 'domainAnalysis',
      domain: 'aiPartnership',
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.data.phase1.sessionOverviews[0].stats.userMessageCount).toBe(2);
    expect(parsed.data.phase1.interactionSnapshots).toHaveLength(2);
    expect(
      parsed.data.phase1.interactionSnapshots.some(
        (snapshot: { text: string }) => snapshot.text.startsWith('Base directory for this skill:'),
      ),
    ).toBe(false);
  });

  it('fails fast when a domain analysis request omits the domain', async () => {
    seedRun();

    const parsed = JSON.parse(await execute({ kind: 'domainAnalysis' }));

    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('Domain is required');
  });
});
