/**
 * Local Web Server for Report Display
 *
 * Serves a terminal-aesthetic HTML report of the analysis results.
 * Pure Node.js HTTP server with no external dependencies.
 */

import { createServer, type Server } from 'node:http';
import { type TypeResult } from '../models/index.js';
import { type VerboseEvaluation } from '../models/verbose-evaluation.js';
import { type FullAnalysisResult } from '../analyzer/dimensions/index.js';
import { generateReportHTML } from './template.js';

export interface WebServerOptions {
  port?: number;
  autoOpen?: boolean;
}

export interface ReportData {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
}

const DEFAULT_OPTIONS: Required<WebServerOptions> = {
  port: 3000,
  autoOpen: true,
};

/**
 * Start a local web server to display the report
 *
 * @param result - Type analysis result (required)
 * @param options - Server options
 * @param dimensions - Optional dimension analysis for extended report
 */
export async function startReportServer(
  result: TypeResult,
  options: WebServerOptions = {},
  dimensions?: FullAnalysisResult
): Promise<{ server: Server; port: number; url: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const html = generateReportHTML(result, dimensions);
  const reportData: ReportData = { typeResult: result, dimensions };

  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } else if (req.url === '/api/result') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(reportData));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const port = await findAvailablePort(server, opts.port);
  const url = `http://localhost:${port}`;

  if (opts.autoOpen) {
    await openBrowser(url);
  }

  return { server, port, url };
}

/**
 * Stop the report server
 */
export function stopReportServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Find an available port, incrementing if the initial port is in use
 */
async function findAvailablePort(server: Server, startPort: number): Promise<number> {
  const maxRetries = 10;
  let port = startPort;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const errorHandler = (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            port++;
            reject(err);
          } else {
            reject(err);
          }
        };

        server.once('error', errorHandler);

        server.listen(port, () => {
          // Remove error handler on success to prevent memory leak
          server.removeListener('error', errorHandler);
          resolve();
        });
      });
      return port;
    } catch {
      // Error handler already fired and was auto-removed by 'once'
      if (i === maxRetries - 1) {
        throw new Error(`Could not find available port after ${maxRetries} attempts`);
      }
    }
  }

  throw new Error('Unreachable: port finding loop should always return or throw');
}

/**
 * Open a URL in the default browser
 */
async function openBrowser(url: string): Promise<void> {
  try {
    const { exec } = await import('node:child_process');
    const command = getBrowserCommand(url);
    exec(command);
  } catch {
    // Ignore errors when opening browser
  }
}

/**
 * Get the platform-specific command to open a URL in the browser
 */
function getBrowserCommand(url: string): string {
  if (process.platform === 'darwin') {
    return `open "${url}"`;
  }

  if (process.platform === 'win32') {
    return `start "${url}"`;
  }

  return `xdg-open "${url}"`;
}

/**
 * Convert VerboseEvaluation to TypeResult for template compatibility
 */
function createTypeResultFromVerbose(verbose: VerboseEvaluation): TypeResult {
  return {
    primaryType: verbose.primaryType,
    distribution: verbose.distribution,
    metrics: {
      avgPromptLength: 0,
      avgFirstPromptLength: 0,
      avgTurnsPerSession: 0,
      questionFrequency: 0,
      modificationRate: 0,
      toolUsageHighlight: 'N/A',
    },
    evidence: [],
    sessionCount: verbose.sessionsAnalyzed,
    analyzedAt: verbose.analyzedAt,
  };
}

/**
 * Verbose report data for API endpoint
 */
export interface VerboseReportData {
  typeResult: TypeResult;
  verboseEvaluation: VerboseEvaluation;
}

/**
 * Start a local web server to display verbose evaluation results
 *
 * @param verboseResult - Verbose evaluation result from LLM analysis
 * @param options - Server options
 */
export async function startVerboseReportServer(
  verboseResult: VerboseEvaluation,
  options: WebServerOptions = {}
): Promise<{ server: Server; port: number; url: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const typeResult = createTypeResultFromVerbose(verboseResult);
  const html = generateReportHTML(typeResult, undefined, undefined, verboseResult);
  const reportData: VerboseReportData = { typeResult, verboseEvaluation: verboseResult };

  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } else if (req.url === '/api/result') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(reportData));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const port = await findAvailablePort(server, opts.port);
  const url = `http://localhost:${port}`;

  if (opts.autoOpen) {
    await openBrowser(url);
  }

  return { server, port, url };
}
