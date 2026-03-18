import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import {
  closeResultsDb,
  createAnalysisRun,
  saveDomainResult,
} from '../../../packages/plugin/lib/results-db.js';
import { execute } from '../../../packages/plugin/mcp/tools/get-domain-results.js';

function resetResultsStorage(): void {
  closeResultsDb();
  rmSync(join(homedir(), '.betterprompt'), { recursive: true, force: true });
}

function pinCurrentRunId(runId: number): void {
  const dataDir = join(homedir(), '.betterprompt');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));
}

afterEach(() => {
  resetResultsStorage();
});

describe('get_domain_results tool', () => {
  it('returns all saved domain results for the current run', async () => {
    resetResultsStorage();
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 40,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-16T00:00:00.000Z',
          latest: '2026-03-16T00:05:00.000Z',
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

    saveDomainResult(runId, {
      domain: 'communicationPatterns',
      overallScore: 82,
      confidenceScore: 0.8,
      strengths: [
        {
          title: 'Specific requests',
          description: 'The developer gives concrete goals, explicit completion conditions, and clear acceptance criteria so the assistant can act with less ambiguity and fewer hidden assumptions.',
          evidence: [
            {
              utteranceId: 'session-1_0',
              quote: 'Please add verification before merging this change.',
            },
          ],
        },
      ],
      growthAreas: [],
      analyzedAt: '2026-03-16T00:10:00.000Z',
    });

    pinCurrentRunId(runId);

    const parsed = JSON.parse(await execute({}));
    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.domainsAvailable).toEqual(['communicationPatterns']);
    expect(parsed.data).toHaveLength(1);
  });

  it('returns one saved domain result when filtered by domain', async () => {
    resetResultsStorage();
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 40,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-16T00:00:00.000Z',
          latest: '2026-03-16T00:05:00.000Z',
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

    saveDomainResult(runId, {
      domain: 'contextEfficiency',
      overallScore: 76,
      confidenceScore: 0.7,
      strengths: [],
      growthAreas: [
        {
          title: 'Retry context spillover',
          description: 'The developer sometimes carries too many retry details into the next prompt, which widens the active context and makes the assistant separate the immediate task from leftover background details.',
          severity: 'medium',
          recommendation: 'Restate the active task in one sentence after the discovery pass so the next prompt only carries the context that is still live.',
          evidence: [
            {
              utteranceId: 'session-1_0',
              quote: 'Document the retry edge cases before editing.',
            },
          ],
        },
      ],
      analyzedAt: '2026-03-16T00:10:00.000Z',
    });

    pinCurrentRunId(runId);

    const parsed = JSON.parse(await execute({ domain: 'contextEfficiency' }));
    expect(parsed.status).toBe('ok');
    expect(parsed.runId).toBe(runId);
    expect(parsed.domain).toBe('contextEfficiency');
    expect(parsed.data.domain).toBe('contextEfficiency');
    expect(parsed.data.growthAreas).toHaveLength(1);
  });
});
