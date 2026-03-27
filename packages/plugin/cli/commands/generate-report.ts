/**
 * generate-report CLI command
 *
 * Generates a standalone HTML report and opens it in the browser.
 * Optionally starts a localhost HTTP server with --serve.
 *
 * Usage: betterprompt-cli generate-report [--serve] [--port 3456] [--no-open] [--allowIncomplete]
 */

import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import {
  assembleCanonicalRun,
  getCurrentRunId,
  getDomainResult,
} from '../../lib/results-db.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';
import { generateCanonicalReportHtml } from '../../lib/report-template.js';
import { markAnalysisComplete } from '../../lib/debounce.js';
import {
  getStageStatuses,
  getStageOutput,
  REQUIRED_STAGE_NAMES,
} from '../../lib/stage-db.js';

const DOMAIN_STAGE_NAMES = new Set([
  'aiPartnership', 'sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery',
]);

function hasFallbackArtifact(runId: number, stage: string): boolean {
  if (DOMAIN_STAGE_NAMES.has(stage)) return getDomainResult(runId, stage) !== null;
  return getStageOutput(runId, stage) !== null;
}

interface StageGateIssue {
  stage: string;
  required: boolean;
  status: string;
  attemptCount: number;
  lastError: string | null;
  updatedAt: string | null;
}

function getRequiredStageGateIssues(runId: number): StageGateIssue[] {
  const statuses = getStageStatuses(runId);
  const statusLookup = new Map(statuses.map(s => [s.stage, s]));
  const issues: StageGateIssue[] = [];

  for (const stage of REQUIRED_STAGE_NAMES) {
    const status = statusLookup.get(stage);
    if (status) {
      if (status.status !== 'validated') {
        issues.push({
          stage,
          required: status.required,
          status: status.status,
          attemptCount: status.attemptCount,
          lastError: status.lastError,
          updatedAt: status.updatedAt,
        });
      }
      continue;
    }
    if (!hasFallbackArtifact(runId, stage)) {
      issues.push({
        stage, required: true, status: 'missing',
        attemptCount: 0, lastError: null, updatedAt: null,
      });
    }
  }
  return issues;
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const serve = args.serve === true;
  const port = (typeof args.port === 'number' ? args.port : 3456);
  const noOpen = args.noOpen === true;
  const allowIncomplete = args.allowIncomplete === true;

  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No analysis results found. Run extract-data and domain analyses first.',
    });
  }

  const gateIssues = getRequiredStageGateIssues(runId);
  if (gateIssues.length > 0 && !allowIncomplete) {
    return JSON.stringify({
      status: 'blocked',
      message: 'Required analysis stages are incomplete. Re-run the missing stages or pass --allowIncomplete.',
      issues: gateIssues,
    });
  }

  const run = assembleCanonicalRun(runId);
  if (!run) {
    return JSON.stringify({
      status: 'error',
      message: 'No analysis results found. Run extract-data and domain analyses first.',
    });
  }

  const html = generateCanonicalReportHtml(run);

  const reportsDir = join(getPluginDataDir(), 'reports');
  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = join(reportsDir, `report-${timestamp}.html`);
  await writeFile(reportPath, html, 'utf-8');

  const latestPath = join(reportsDir, 'latest.html');
  await writeFile(latestPath, html, 'utf-8');

  markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);

  // Default: open the HTML file directly in the browser
  if (!serve) {
    if (!noOpen) {
      try {
        const cmd = process.platform === 'darwin' ? `open "${reportPath}"`
          : process.platform === 'win32' ? `start "${reportPath}"`
          : `xdg-open "${reportPath}"`;
        exec(cmd);
      } catch { /* non-critical */ }
    }

    return JSON.stringify({
      status: 'ok',
      url: `file://${reportPath}`,
      reportPath,
      latestPath,
      domainCount: run.domainResults.length,
      type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : 'Not classified',
      ...(gateIssues.length > 0 ? { warning: 'Report generated with incomplete stages.' } : {}),
      message: `Report saved to ${reportPath}. Opened in browser.`,
    });
  }

  // Optional: serve via HTTP
  const url = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url !== '/' && req.url !== '') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      try {
        res.end(readFileSync(latestPath, 'utf-8'));
      } catch {
        res.end(html);
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') resolve(`file://${reportPath}`);
      else reject(err);
    });

    // Auto-shutdown after 30 minutes
    server.listen(port, () => {
      setTimeout(() => server.close(), 30 * 60 * 1000);
      resolve(`http://localhost:${port}`);
    });
  });

  if (!noOpen && url.startsWith('http')) {
    try {
      const cmd = process.platform === 'darwin' ? `open "${url}"`
        : process.platform === 'win32' ? `start "${url}"`
        : `xdg-open "${url}"`;
      exec(cmd);
    } catch { /* non-critical */ }
  }

  return JSON.stringify({
    status: 'ok',
    url,
    reportPath,
    latestPath,
    domainCount: run.domainResults.length,
    type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : 'Not classified',
    ...(gateIssues.length > 0 ? { warning: 'Report generated with incomplete stages.' } : {}),
    message: `Report available at ${url}. Saved to ${reportPath}.`,
  });
}
