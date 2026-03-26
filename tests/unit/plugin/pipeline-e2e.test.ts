/**
 * Pipeline E2E Test
 *
 * Verifies the full BetterPrompt analysis pipeline data flow by programmatically
 * executing each stage's MCP tool persistence and validating progress tracking.
 * Does NOT invoke skills (those require an LLM) -- tests the MCP tool layer.
 */
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
  REQUIRED_STAGE_SEQUENCE,
  computeRunProgress,
} from '../../../packages/plugin/mcp/tools/get-run-progress.js';
import {
  createDomainResults,
  createPhase1Output,
  createStageOutputs,
  createTypeResult,
  deterministicScores,
  pinCurrentRunId,
  resetResultsStorage,
} from './plugin-analysis-fixtures.js';

afterEach(() => {
  resetResultsStorage();
  vi.resetModules();
});

/** Domain stages that use saveDomainResult instead of saveStageOutput */
const DOMAIN_STAGES = new Set([
  'aiPartnership',
  'sessionCraft',
  'toolMastery',
  'skillResilience',
  'sessionMastery',
]);

/** Stage that uses saveTypeResult instead of saveStageOutput */
const TYPE_STAGE = 'deterministicType';

function createRun() {
  const phase1Output = createPhase1Output();
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: deterministicScores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });
  pinCurrentRunId(runId);
  return { runId, phase1Output };
}

describe('plugin pipeline e2e', () => {
  describe('Phase 1: initial state', () => {
    it('reports no_run before Phase 1 data exists', async () => {
      const { execute } = await import(
        '../../../packages/plugin/mcp/tools/get-run-progress.js'
      );
      const result = JSON.parse(await execute());
      expect(result.status).toBe('no_run');
    });

    it('reports incomplete with sessionSummaries as first step after Phase 1', () => {
      const { runId } = createRun();
      const progress = computeRunProgress(runId);

      expect(progress).not.toBeNull();
      expect(progress!.completionStatus).toBe('incomplete');
      expect(progress!.phase1Complete).toBe(true);
      expect(progress!.nextStep.stage).toBe('sessionSummaries');
      expect(progress!.nextStep.skill).toBe('summarize-sessions');
      expect(progress!.completedRequiredStages).toBe(0);
      expect(progress!.totalRequiredStages).toBe(REQUIRED_STAGE_SEQUENCE.length);
    });
  });

  describe('full pipeline walkthrough', () => {
    it('progresses through all 17 stages to completion', () => {
      const { runId, phase1Output } = createRun();
      const stageOutputs = createStageOutputs();
      const domainResults = createDomainResults();
      const typeResult = createTypeResult(phase1Output);

      const domainResultsByName = new Map(
        domainResults.map((d) => [d.domain, d]),
      );

      let completedCount = 0;

      for (const step of REQUIRED_STAGE_SEQUENCE) {
        // Verify progress before this stage
        const beforeProgress = computeRunProgress(runId);
        expect(beforeProgress!.completionStatus).toBe('incomplete');
        expect(beforeProgress!.completedRequiredStages).toBe(completedCount);
        expect(beforeProgress!.nextStep.stage).toBe(step.stage);

        // Persist the stage artifact
        if (step.stage === TYPE_STAGE) {
          saveTypeResult(runId, typeResult);
        } else if (DOMAIN_STAGES.has(step.stage)) {
          const domainResult = domainResultsByName.get(step.stage);
          expect(domainResult, `missing fixture for domain ${step.stage}`).toBeDefined();
          saveDomainResult(runId, domainResult!);
          recordStageStatus(runId, step.stage, { status: 'validated' });
        } else {
          const data = stageOutputs[step.stage as keyof typeof stageOutputs];
          expect(data, `missing fixture for stage ${step.stage}`).toBeDefined();
          saveStageOutput(runId, step.stage, data);
          recordStageStatus(runId, step.stage, { status: 'validated' });
        }

        completedCount++;
      }

      // Verify final state
      const finalProgress = computeRunProgress(runId);
      expect(finalProgress!.completionStatus).toBe('complete');
      expect(finalProgress!.completedRequiredStages).toBe(REQUIRED_STAGE_SEQUENCE.length);
      expect(finalProgress!.nextStep).toEqual({
        stage: 'generateReport',
        skill: null,
        tool: 'generate_report',
        kind: 'report',
      });
    });
  });

  describe('progress tracking', () => {
    it('identifies correct skill or tool for each stage', () => {
      const { runId } = createRun();

      for (const step of REQUIRED_STAGE_SEQUENCE) {
        const progress = computeRunProgress(runId)!;
        const next = progress.nextStep;

        expect(next.stage).toBe(step.stage);

        if (step.tool) {
          expect(next.tool, `${step.stage} should dispatch as MCP tool`).toBe(step.tool);
          expect(next.skill).toBeNull();
        } else {
          expect(next.skill, `${step.stage} should dispatch as skill/agent`).toBe(step.skill);
          expect(next.tool).toBeNull();
        }

        // Persist to advance
        if (step.stage === TYPE_STAGE) {
          saveTypeResult(runId, createTypeResult());
        } else if (DOMAIN_STAGES.has(step.stage)) {
          const result = createDomainResults().find((d) => d.domain === step.stage);
          if (result) saveDomainResult(runId, result);
          recordStageStatus(runId, step.stage, { status: 'validated' });
        } else {
          const outputs = createStageOutputs();
          const data = outputs[step.stage as keyof typeof outputs];
          if (data) saveStageOutput(runId, step.stage, data);
          recordStageStatus(runId, step.stage, { status: 'validated' });
        }
      }
    });

    it('counts completed domain results separately', () => {
      const { runId } = createRun();
      const stageOutputs = createStageOutputs();
      const domainResults = createDomainResults();

      // Complete extractors only
      saveStageOutput(runId, 'sessionSummaries', stageOutputs.sessionSummaries);
      recordStageStatus(runId, 'sessionSummaries', { status: 'validated' });

      for (const extractor of [
        'extractAiPartnership', 'extractSessionCraft', 'extractToolMastery',
        'extractSkillResilience', 'extractSessionMastery',
      ]) {
        saveStageOutput(runId, extractor, stageOutputs[extractor as keyof typeof stageOutputs]);
        recordStageStatus(runId, extractor, { status: 'validated' });
      }

      let progress = computeRunProgress(runId)!;
      expect(progress.completedDomainCount).toBe(0);
      expect(progress.totalDomainCount).toBe(5);

      // Save 3 domain results
      for (const result of domainResults.slice(0, 3)) {
        saveDomainResult(runId, result);
        recordStageStatus(runId, result.domain, { status: 'validated' });
      }

      progress = computeRunProgress(runId)!;
      expect(progress.completedDomainCount).toBe(3);
    });
  });

  describe('resume flow', () => {
    it('resumes from first incomplete stage after partial run', () => {
      const { runId } = createRun();
      const stageOutputs = createStageOutputs();

      // Complete only sessionSummaries and first 2 extractors
      saveStageOutput(runId, 'sessionSummaries', stageOutputs.sessionSummaries);
      recordStageStatus(runId, 'sessionSummaries', { status: 'validated' });

      saveStageOutput(runId, 'extractAiPartnership', stageOutputs.extractAiPartnership);
      recordStageStatus(runId, 'extractAiPartnership', { status: 'validated' });

      saveStageOutput(runId, 'extractSessionCraft', stageOutputs.extractSessionCraft);
      recordStageStatus(runId, 'extractSessionCraft', { status: 'validated' });

      const progress = computeRunProgress(runId)!;
      expect(progress.completionStatus).toBe('incomplete');
      expect(progress.completedRequiredStages).toBe(3);
      expect(progress.nextStep.stage).toBe('extractToolMastery');
      expect(progress.nextStep.skill).toBe('extract-tool-mastery');
    });

    it('does not re-request completed stages', () => {
      const { runId } = createRun();
      const stageOutputs = createStageOutputs();

      // Save sessionSummaries
      saveStageOutput(runId, 'sessionSummaries', stageOutputs.sessionSummaries);
      recordStageStatus(runId, 'sessionSummaries', { status: 'validated' });

      const progress = computeRunProgress(runId)!;

      // pendingStages should not contain sessionSummaries
      const pendingStageNames = progress.stages
        .filter((s) => !s.completed)
        .map((s) => s.stage);
      expect(pendingStageNames).not.toContain('sessionSummaries');

      // Should skip to next incomplete
      expect(progress.nextStep.stage).toBe('extractAiPartnership');
    });
  });

  describe('stage sequence integrity', () => {
    it('has 17 required stages in the correct order', () => {
      expect(REQUIRED_STAGE_SEQUENCE).toHaveLength(17);

      const expectedOrder = [
        'sessionSummaries',
        'extractAiPartnership', 'extractSessionCraft', 'extractToolMastery',
        'extractSkillResilience', 'extractSessionMastery',
        'aiPartnership', 'sessionCraft', 'toolMastery',
        'skillResilience', 'sessionMastery',
        'projectSummaries', 'weeklyInsights',
        'deterministicType', 'typeClassification',
        'evidenceVerification', 'contentWriter',
      ];

      expect(REQUIRED_STAGE_SEQUENCE.map((s) => s.stage)).toEqual(expectedOrder);
    });

    it('marks deterministic stages with tool instead of skill', () => {
      const toolStages = REQUIRED_STAGE_SEQUENCE.filter((s) => s.tool !== null);
      expect(toolStages.map((s) => s.stage)).toEqual([
        'deterministicType',
        'evidenceVerification',
      ]);
      expect(toolStages.map((s) => s.tool)).toEqual([
        'classify_developer_type',
        'verify_evidence',
      ]);
    });

    it('marks all skill stages with the correct skill name', () => {
      const skillStages = REQUIRED_STAGE_SEQUENCE.filter((s) => s.skill !== null);
      expect(skillStages).toHaveLength(15);

      // Verify each skill stage has a matching skill name
      for (const stage of skillStages) {
        expect(stage.skill, `${stage.stage} should have a skill`).toBeTruthy();
        expect(stage.tool).toBeNull();
      }
    });
  });
});
