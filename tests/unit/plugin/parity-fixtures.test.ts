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
} from '../../../packages/plugin/lib/evaluation-assembler.js';
import type {
  CanonicalStageOutputs,
  DeterministicScores,
  DeterministicTypeResult,
  DomainResult,
  Phase1Output,
} from '../../../packages/plugin/lib/core/types.js';
import { VerboseEvaluationSchema } from '../../../src/lib/models/verbose-evaluation.js';

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

      if (fixtureName.includes('cursor-inclusive')) {
        const sources = fixture.phase1Output.sessions?.map(session => session.source);
        expect(sources).toContain('cursor');
        expect(sources).toContain('claude-code');
        expect((run.evaluation as Record<string, unknown>).translatedAgentInsights).toBeDefined();
      }
    });
  }
});
