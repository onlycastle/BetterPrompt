import { describe, expect, it } from 'vitest';
import { generateCanonicalReportHtml } from '../../../packages/plugin/lib/report-template.js';
import type { CanonicalAnalysisRun } from '../../../packages/plugin/lib/core/types.js';
import {
  createDomainResults,
  createPhase1Output,
  createStageOutputs,
  createTypeResult,
  deterministicScores,
} from './plugin-analysis-fixtures.js';

function createCanonicalRun(): CanonicalAnalysisRun {
  const phase1Output = createPhase1Output();
  const domainResults = createDomainResults();

  domainResults[0] = {
    ...domainResults[0]!,
    strengths: [
      {
        ...domainResults[0]!.strengths[0]!,
        evidence: [
          {
            utteranceId: 'session-1_0',
            quote: 'Map the plan first, then verify it with tests before merging.',
            context: 'Shows explicit planning tied to proof, not just intent.',
          },
        ],
      },
    ],
  };

  return {
    runId: 1,
    analyzedAt: '2026-03-16T10:00:00.000Z',
    phase1Output,
    activitySessions: [
      {
        sessionId: 'session-1',
        projectName: 'nomoreaislop',
        startTime: '2026-03-16T09:00:00.000Z',
        durationMinutes: 12,
        messageCount: 4,
        summary: 'Planned the fix and verified it before closing the loop.',
        totalInputTokens: 640,
        totalOutputTokens: 420,
      },
    ],
    deterministicScores,
    typeResult: createTypeResult(phase1Output),
    domainResults,
    stageOutputs: createStageOutputs() as CanonicalAnalysisRun['stageOutputs'],
    evaluation: {
      personalitySummary: '# Working Style\n\n- **Plan first** before editing\n- Use `npm test` as the final proof step',
      promptPatterns: [
        {
          patternName: 'Decomposition',
          description: '## Why it works\n\nBreak the task into a small number of explicit steps before editing.',
          frequency: 'often',
          examples: [
            {
              quote: 'Map the plan first, then verify it with tests before merging.',
              analysis: 'The prompt names both the sequence and the proof step.',
            },
          ],
        },
      ],
      weeklyInsights: {
        stats: {
          totalSessions: 2,
          totalMinutes: 42,
          totalTokens: 12000,
          activeDays: 3,
        },
        narrative: '## This Week\n\n- Verified the fix before merge\n- Reduced retry churn with a clearer plan',
        projects: [
          {
            projectName: 'nomoreaislop',
            sessionCount: 2,
            percentage: 100,
          },
        ],
        highlights: ['Kept tests green through the retry cycle.'],
        topProjectSessions: [
          {
            summary: 'Finished the stale-context fix and verified it.',
            durationMinutes: 20,
            date: '2026-03-16',
          },
        ],
      },
      topFocusAreas: {
        areas: [
          {
            title: 'Name the source of truth earlier',
            narrative: '1. State the active branch\n2. State the validation command',
            actions: {
              start: 'Name the branch before the first edit.',
              stop: 'Letting retry context drift.',
              continue: 'Closing work with explicit proof.',
            },
          },
        ],
      },
      projectSummaries: [
        {
          projectName: 'nomoreaislop',
          sessionCount: 1,
          summaryLines: ['Improved report evidence hygiene and rendering.'],
        },
      ],
    },
  };
}

describe('report template', () => {
  it('renders markdown, evidence rationale, and responsive radar markup in the canonical report', () => {
    const html = generateCanonicalReportHtml(createCanonicalRun());

    expect(html).toContain('<strong>Plan first</strong>');
    expect(html).toContain('<h3>Working Style</h3>');
    expect(html).toContain('<li>State the active branch</li>');
    expect(html).toContain('Shows explicit planning tied to proof, not just intent.');
    expect(html).toContain('class="prompt-example-context"');
    expect(html).toContain('class="radar-svg"');
    expect(html).not.toContain('</code>: &quot;');
  });
});
