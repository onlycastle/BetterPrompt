import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CanonicalAnalysisRunSchema,
  CanonicalStageOutputsSchema,
  DeterministicScoresSchema,
  DeterministicTypeResultSchema,
  DomainResultSchema,
  Phase1OutputSchema,
} from '@betterprompt/shared';
import {
  assembleCanonicalAnalysisRun,
  buildCanonicalEvaluation,
  buildReportActivitySessions,
} from '../../../packages/plugin/lib/evaluation-assembler.js';
import type {
  CanonicalStageOutputs,
  DeterministicScores,
  DeterministicTypeResult,
  DomainResult,
  Phase1Output,
} from '../../../packages/plugin/lib/core/types.js';
import { mergeTranslatedFields } from '../../../src/lib/analyzer/stages/evaluation-assembler.js';
import { VerboseEvaluationSchema } from '../../../src/lib/models/verbose-evaluation.js';
import type { TranslatorOutput as ServerTranslatorOutput } from '../../../src/lib/models/translator-output.js';

interface ParityFixture {
  runId: number;
  analyzedAt: string;
  phase1Output: Phase1Output;
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
  stageOutputs: CanonicalStageOutputs;
  expectedFinalSections: Record<string, unknown>;
}

function loadFixture(name: string): ParityFixture {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'plugin-parity', name), 'utf8'),
  ) as ParityFixture;

  return {
    ...raw,
    phase1Output: Phase1OutputSchema.parse(raw.phase1Output),
    deterministicScores: DeterministicScoresSchema.parse(raw.deterministicScores),
    typeResult: raw.typeResult ? DeterministicTypeResultSchema.parse(raw.typeResult) : null,
    domainResults: raw.domainResults.map(item => DomainResultSchema.parse(item)),
    stageOutputs: CanonicalStageOutputsSchema.parse(raw.stageOutputs),
  };
}

function pickSections(
  evaluation: Record<string, unknown>,
  expectedSections: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(expectedSections).map(key => [key, evaluation[key]]),
  );
}

function buildServerOracleEvaluation(fixture: ParityFixture): Record<string, unknown> {
  const englishStageOutputs: CanonicalStageOutputs = {
    ...fixture.stageOutputs,
    translator: undefined,
  };

  const activitySessions = buildReportActivitySessions(
    fixture.phase1Output,
    englishStageOutputs.sessionSummaries,
  );

  const evaluation = buildCanonicalEvaluation({
    analyzedAt: fixture.analyzedAt,
    phase1Output: fixture.phase1Output,
    activitySessions,
    deterministicScores: fixture.deterministicScores,
    typeResult: fixture.typeResult,
    domainResults: fixture.domainResults,
    stageOutputs: englishStageOutputs,
  }) as Record<string, unknown>;

  if (fixture.stageOutputs.translator) {
    mergeTranslatedFields(
      evaluation,
      fixture.stageOutputs.translator.translatedFields as unknown as ServerTranslatorOutput,
      fixture.stageOutputs.translator.targetLanguage as never,
    );

    const translatedWeekly = fixture.stageOutputs.translator.translatedFields.weeklyInsights as
      | { topSessionSummaries?: string[] }
      | undefined;
    const weeklyInsights = evaluation.weeklyInsights as { topProjectSessions?: Array<{ summary: string }> } | undefined;

    if (translatedWeekly?.topSessionSummaries?.length && weeklyInsights?.topProjectSessions?.length) {
      translatedWeekly.topSessionSummaries.forEach((summary, index) => {
        if (weeklyInsights.topProjectSessions?.[index]) {
          weeklyInsights.topProjectSessions[index]!.summary = summary;
        }
      });
    }
  }

  return evaluation;
}

describe('plugin parity fixtures', () => {
  const fixtureNames = [
    'claude-only-no-translation.json',
    'cursor-inclusive-translation.json',
  ];

  for (const fixtureName of fixtureNames) {
    it(`matches frozen parity sections for ${fixtureName}`, () => {
      const fixture = loadFixture(fixtureName);

      const run = assembleCanonicalAnalysisRun({
        runId: fixture.runId,
        analyzedAt: fixture.analyzedAt,
        phase1Output: fixture.phase1Output,
        deterministicScores: fixture.deterministicScores,
        typeResult: fixture.typeResult,
        domainResults: fixture.domainResults,
        stageOutputs: fixture.stageOutputs,
      });

      expect(CanonicalAnalysisRunSchema.safeParse(run).success).toBe(true);
      expect(VerboseEvaluationSchema.safeParse(run.evaluation).success).toBe(true);

      const pluginSections = pickSections(
        run.evaluation as Record<string, unknown>,
        fixture.expectedFinalSections,
      );
      expect(pluginSections).toEqual(fixture.expectedFinalSections);

      const serverOracle = buildServerOracleEvaluation(fixture);
      const serverSections = pickSections(serverOracle, fixture.expectedFinalSections);
      expect(pluginSections).toEqual(serverSections);

      if (fixtureName.includes('cursor-inclusive')) {
        const sources = fixture.phase1Output.sessions?.map(session => session.source);
        expect(sources).toContain('cursor');
        expect(sources).toContain('claude-code');
        expect((run.evaluation as Record<string, unknown>).translatedAgentInsights).toBeDefined();
      }
    });
  }
});
