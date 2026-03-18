/**
 * generate_report MCP Tool
 *
 * Generates a standalone HTML report from analysis results
 * and serves it on a local HTTP server.
 */
import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { assembleCanonicalRun, getCurrentRunId, getDomainResult, } from '../../lib/results-db.js';
import { PLUGIN_DATA_DIR } from '../../lib/core/session-scanner.js';
import { generateCanonicalReportHtml } from '../../lib/report-template.js';
import { markAnalysisComplete } from '../../lib/debounce.js';
import { getStageStatuses, getStageOutput, REQUIRED_STAGE_NAMES, } from '../../lib/stage-db.js';
export const definition = {
    name: 'generate_report',
    description: 'Generate a standalone HTML report from all completed domain analyses ' +
        'and serve it on a local HTTP server. Returns the URL to view the report. ' +
        'Call this after all domain analyses and type classification are complete. ' +
        'Pass allowIncomplete=true to override required-stage gating.',
};
/** Track the running server so we can shut it down */
let activeServer = null;
let shutdownTimer = null;
const SHUTDOWN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DOMAIN_STAGE_NAMES = new Set([
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
]);
function resetShutdownTimer() {
    if (shutdownTimer)
        clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
        if (activeServer) {
            activeServer.close();
            activeServer = null;
        }
    }, SHUTDOWN_TIMEOUT_MS);
}
/** Close the active server and wait for it to fully release the port */
function closeActiveServer() {
    return new Promise((resolve) => {
        if (!activeServer) {
            resolve();
            return;
        }
        activeServer.close(() => {
            activeServer = null;
            resolve();
        });
    });
}
function hasFallbackArtifact(runId, stage) {
    if (DOMAIN_STAGE_NAMES.has(stage)) {
        return getDomainResult(runId, stage) !== null;
    }
    return getStageOutput(runId, stage) !== null;
}
function getRequiredStageGateIssues(runId) {
    const statuses = getStageStatuses(runId);
    const statusLookup = new Map(statuses.map(status => [status.stage, status]));
    const issues = [];
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
                stage,
                required: true,
                status: 'missing',
                attemptCount: 0,
                lastError: null,
                updatedAt: null,
            });
        }
    }
    return issues;
}
export async function execute(args) {
    const port = args.port ?? 3456;
    const openBrowser = args.openBrowser ?? true;
    const allowIncomplete = args.allowIncomplete ?? false;
    // Assemble report data
    const runId = getCurrentRunId();
    if (!runId) {
        return JSON.stringify({
            status: 'error',
            message: 'No analysis results found. Run extract_data and domain analyses first.',
        });
    }
    const gateIssues = getRequiredStageGateIssues(runId);
    if (gateIssues.length > 0 && !allowIncomplete) {
        return JSON.stringify({
            status: 'blocked',
            message: 'Required analysis stages are incomplete. Re-run the missing stages or pass allowIncomplete=true to override.',
            issues: gateIssues,
        });
    }
    const run = assembleCanonicalRun(runId);
    if (!run) {
        return JSON.stringify({
            status: 'error',
            message: 'No analysis results found. Run extract_data and domain analyses first.',
        });
    }
    // Generate HTML
    const html = generateCanonicalReportHtml(run);
    // Save report file
    const reportsDir = join(PLUGIN_DATA_DIR, 'reports');
    await mkdir(reportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportPath = join(reportsDir, `report-${timestamp}.html`);
    await writeFile(reportPath, html, 'utf-8');
    // Also save as latest
    const latestPath = join(reportsDir, 'latest.html');
    await writeFile(latestPath, html, 'utf-8');
    // Close existing server before starting a new one
    await closeActiveServer();
    const url = await new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            // Only serve on root path
            if (req.url !== '/' && req.url !== '') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            resetShutdownTimer();
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
            });
            // Always serve the latest report
            try {
                const content = readFileSync(latestPath, 'utf-8');
                res.end(content);
            }
            catch {
                res.end(html);
            }
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // Port in use - serve from file
                resolve(`file://${reportPath}`);
            }
            else {
                reject(err);
            }
        });
        server.listen(port, () => {
            activeServer = server;
            resetShutdownTimer();
            resolve(`http://localhost:${port}`);
        });
    });
    // Auto-open browser
    if (openBrowser && url.startsWith('http')) {
        try {
            let cmd;
            if (process.platform === 'darwin') {
                cmd = `open "${url}"`;
            }
            else if (process.platform === 'win32') {
                cmd = `start "${url}"`;
            }
            else {
                cmd = `xdg-open "${url}"`;
            }
            exec(cmd);
        }
        catch {
            // Non-critical - user can open manually
        }
    }
    markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
    return JSON.stringify({
        status: 'ok',
        url,
        reportPath,
        latestPath,
        domainCount: run.domainResults.length,
        type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : 'Not classified',
        ...(gateIssues.length > 0 ? { warning: 'Report generated with incomplete required stages because allowIncomplete=true.' } : {}),
        message: `Report generated and available at ${url}. Saved to ${reportPath}.`,
    });
}
//# sourceMappingURL=generate-report.js.map