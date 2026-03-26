import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { closeResultsDb, createAnalysisRun, getDomainResult } from '../../../packages/plugin/lib/results-db.js';
import { execute } from '../../../packages/plugin/mcp/tools/save-domain-results.js';

function makeLongText(label: string, minimumLength: number): string {
  return `${label} ${'x'.repeat(minimumLength)}`;
}

describe('save_domain_results tool', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-save-domain-results-'));
    process.env.HOME = homeDir;
    resetConfig();
  });

  afterEach(() => {
    closeResultsDb();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    resetConfig();
    if (homeDir) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('accepts stringified retry payloads from writer skills and persists the parsed result', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 180,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-25T01:48:51.124Z',
          latest: '2026-03-25T01:50:37.984Z',
        },
      },
      scores: {
        thinkingQuality: 80,
        communicationPatterns: 82,
        learningBehavior: 70,
        contextEfficiency: 76,
        sessionOutcome: 75,
        controlScore: 74,
      },
    });

    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const strengths = [
      {
        title: 'Explicit workflow composition',
        description: makeLongText('The developer routinely composes discrete steps, acceptance checks, and scope boundaries into a single workflow request so the assistant can move with low ambiguity and a stable execution order.', 220),
        evidence: [
          {
            utteranceId: 'session-1_0',
            quote: 'Run bp analyze. Use the BetterPrompt analysis flow end to end.',
            context: 'analysis orchestration',
          },
          {
            utteranceId: 'session-1_1',
            quote: 'Analyze only the projects currently selected in BetterPrompt prefs.',
            context: 'project scoping',
          },
        ],
      },
    ];

    const growthAreas = [
      {
        title: 'Broaden tool repertoire',
        description: makeLongText('The current sessions show disciplined tool usage, but they cluster tightly around a small set of reads and MCP calls. That keeps execution clean, yet it leaves some leverage unused when the task could benefit from richer exploration, cross-checking, or automation depth before committing to a conclusion.', 180),
        severity: 'medium',
        recommendation: makeLongText('Add one explicit discovery pass before locking the implementation route, then choose the narrowest follow-up tool that resolves the remaining uncertainty. This preserves the current low-noise style while widening the evidence base behind later decisions and reducing the chance that an early assumption silently shapes the whole run.', 80),
        evidence: [
          {
            utteranceId: 'session-1_2',
            quote: 'Read README.md and give a short checklist for improving scripting consistency in this project.',
            context: 'single-tool read pattern',
          },
          {
            utteranceId: 'session-1_3',
            quote: 'Read README.md and propose three workflow improvements for a YouTube creator planning system.',
            context: 'single-tool read pattern',
          },
        ],
      },
    ];

    const data = {
      _dimensionSource: 'toolMastery',
      communicationPatterns: [
        {
          patternName: 'Explicit Acceptance Criteria Definition',
          category: 'tool_usage',
          description: 'The developer encodes concrete completion markers before execution starts.',
          frequency: 'consistent',
          examples: ['When done, reply with exactly SEEDED.'],
        },
      ],
      signatureQuotes: [
        {
          utteranceId: 'session-1_0',
          text: 'Run bp analyze. Use the BetterPrompt analysis flow end to end.',
          behavioralMarker: 'workflow_composition',
          sessionId: 'session-1',
        },
      ],
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '82',
      confidenceScore: '0.78',
      strengths: JSON.stringify(strengths),
      growthAreas: JSON.stringify(growthAreas),
      data: JSON.stringify(data),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.domain).toBe('communicationPatterns');
    expect(parsed.score).toBe(82);

    const saved = getDomainResult(runId, 'communicationPatterns');
    expect(saved?.overallScore).toBe(82);
    expect(saved?.confidenceScore).toBe(0.78);
    expect(saved?.strengths[0]?.title).toBe('Explicit workflow composition');
    expect(saved?.growthAreas[0]?.severity).toBe('medium');
    expect(saved?.data).toMatchObject({
      _dimensionSource: 'toolMastery',
      communicationPatterns: [
        {
          patternName: 'Explicit Acceptance Criteria Definition',
        },
      ],
    });
  });
});
