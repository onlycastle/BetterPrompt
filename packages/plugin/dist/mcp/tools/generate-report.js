/**
 * generate_report MCP Tool
 *
 * Generates a standalone HTML report from analysis results
 * and serves it on a local HTTP server.
 */
import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { assembleReport } from '../../lib/results-db.js';
import { generateReportHtml } from '../../lib/report-template.js';
export const definition = {
    name: 'generate_report',
    description: 'Generate a standalone HTML report from all completed domain analyses ' +
        'and serve it on a local HTTP server. Returns the URL to view the report. ' +
        'Call this after all domain analyses and type classification are complete.',
};
/** Track the running server so we can shut it down */
let activeServer = null;
let shutdownTimer = null;
const SHUTDOWN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
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
export async function execute(args) {
    const port = args.port ?? 3456;
    const openBrowser = args.openBrowser ?? true;
    // Assemble report data
    const report = assembleReport();
    if (!report) {
        return JSON.stringify({
            status: 'error',
            message: 'No analysis results found. Run extract_data and domain analyses first.',
        });
    }
    // Generate HTML
    const html = generateReportHtml(report);
    // Save report file
    const reportsDir = join(homedir(), '.betterprompt', 'reports');
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
    return JSON.stringify({
        status: 'ok',
        url,
        reportPath,
        latestPath,
        domainCount: report.domainResults.length,
        type: report.typeResult ? `${report.typeResult.matrixEmoji} ${report.typeResult.matrixName}` : 'Not classified',
        message: `Report generated and available at ${url}. Saved to ${reportPath}.`,
    });
}
//# sourceMappingURL=generate-report.js.map