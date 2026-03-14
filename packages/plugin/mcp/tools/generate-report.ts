/**
 * generate_report MCP Tool
 *
 * Generates a standalone HTML report from analysis results
 * and serves it on a local HTTP server.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import { assembleReport, closeResultsDb } from '../../lib/results-db.js';
import { generateReportHtml } from '../../lib/report-template.js';

export const definition = {
  name: 'generate_report',
  description:
    'Generate a standalone HTML report from all completed domain analyses ' +
    'and serve it on a local HTTP server. Returns the URL to view the report. ' +
    'Call this after all domain analyses and type classification are complete.',
};

export const inputSchema = {
  port: {
    type: 'number' as const,
    description: 'Port for the report server (default: 3456)',
  },
  openBrowser: {
    type: 'boolean' as const,
    description: 'Whether to auto-open the report in the browser (default: true)',
  },
};

/** Track the running server so we can shut it down */
let activeServer: ReturnType<typeof createServer> | null = null;
let shutdownTimer: ReturnType<typeof setTimeout> | null = null;
const SHUTDOWN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function resetShutdownTimer(): void {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  shutdownTimer = setTimeout(() => {
    if (activeServer) {
      activeServer.close();
      activeServer = null;
    }
  }, SHUTDOWN_TIMEOUT_MS);
}

export async function execute(args: { port?: number; openBrowser?: boolean }): Promise<string> {
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

  // Start or restart server
  if (activeServer) {
    activeServer.close();
  }

  const url = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      resetShutdownTimer();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      // Always serve the latest report
      import('node:fs').then(fs => {
        try {
          const content = fs.readFileSync(latestPath, 'utf-8');
          res.end(content);
        } catch {
          res.end(html);
        }
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use — try to serve from file
        resolve(`file://${reportPath}`);
      } else {
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
      const { exec } = await import('node:child_process');
      const cmd = process.platform === 'darwin'
        ? `open "${url}"`
        : process.platform === 'win32'
          ? `start "${url}"`
          : `xdg-open "${url}"`;
      exec(cmd);
    } catch {
      // Non-critical — user can open manually
    }
  }

  return JSON.stringify({
    status: 'ok',
    url,
    reportPath,
    latestPath,
    domainCount: report.domainResults.length,
    type: report.typeResult
      ? `${report.typeResult.matrixEmoji} ${report.typeResult.matrixName}`
      : 'Not classified',
    message: `Report generated and available at ${url}. Saved to ${reportPath}.`,
  });
}
