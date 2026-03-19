import { existsSync, readFileSync } from 'node:fs';
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

function seedCompleteRun(): number {
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

async function loadGenerateReportTool(mockBusyPort = false) {
  vi.resetModules();

  if (mockBusyPort) {
    vi.doMock('node:http', async () => {
      const actual = await vi.importActual<typeof import('node:http')>('node:http');
      return {
        ...actual,
        createServer: () => {
          let errorHandler: ((error: NodeJS.ErrnoException) => void) | undefined;
          return {
            on(event: string, handler: (error: NodeJS.ErrnoException) => void) {
              if (event === 'error') {
                errorHandler = handler;
              }
              return this;
            },
            listen() {
              queueMicrotask(() => {
                errorHandler?.({ code: 'EADDRINUSE' } as NodeJS.ErrnoException);
              });
              return this;
            },
            close(callback?: () => void) {
              callback?.();
              return this;
            },
          };
        },
      };
    });
  } else {
    vi.doUnmock('node:http');
  }

  return import('../../../packages/plugin/mcp/tools/generate-report.js');
}

afterEach(() => {
  resetResultsStorage();
  vi.resetModules();
  vi.doUnmock('node:http');
});

describe('generate_report stage gating', () => {
  it('blocks report generation when a required stage is marked failed', async () => {
    const runId = seedCompleteRun();
    const { execute } = await loadGenerateReportTool();
    recordStageStatus(runId, 'sessionSummaries', {
      status: 'failed',
      lastError: 'Summary output was too shallow.',
    });

    const parsed = JSON.parse(await execute({ openBrowser: false }));

    expect(parsed.status).toBe('blocked');
    expect(parsed.issues).toEqual([
      expect.objectContaining({
        stage: 'sessionSummaries',
        status: 'failed',
        lastError: 'Summary output was too shallow.',
      }),
    ]);
  });

  it('can override the gate for diagnostics while still surfacing a warning', async () => {
    const runId = seedCompleteRun();
    const { execute } = await loadGenerateReportTool(true);
    recordStageStatus(runId, 'contentWriter', {
      status: 'failed',
      lastError: 'Content writer needs another pass.',
    });

    const parsed = JSON.parse(await execute({
      port: 3456,
      openBrowser: false,
      allowIncomplete: true,
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.url.startsWith('file://')).toBe(true);
    expect(parsed.warning).toContain('allowIncomplete=true');
    expect(parsed.domainCount).toBe(5);
    expect(existsSync(parsed.reportPath)).toBe(true);

    const html = readFileSync(parsed.reportPath, 'utf-8');
    expect(html).toContain('Planning Analysis');
    expect(html).toContain('Critical Thinking');
    expect(html).toContain('Anti-Patterns');
  });
});
