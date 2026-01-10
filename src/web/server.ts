/**
 * Local Web Server for Report Display
 *
 * Serves a terminal-aesthetic HTML report of the analysis results.
 * Pure Node.js HTTP server with no external dependencies.
 */

import { createServer, type Server } from 'node:http';
import { type TypeResult } from '../models/index.js';
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

  // Generate HTML content with dimensions if provided
  const html = generateReportHTML(result, dimensions);

  // Create full report data for API endpoint
  const reportData: ReportData = { typeResult: result, dimensions };

  // Create server
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } else if (req.url === '/api/result') {
      // JSON API endpoint for result data
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

  // Find available port (try multiple if needed)
  let port = opts.port;
  const maxRetries = 10;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            port++;
            reject(err);
          } else {
            reject(err);
          }
        });

        server.listen(port, () => {
          resolve();
        });
      });
      break;
    } catch (err) {
      if (i === maxRetries - 1) {
        throw new Error(`Could not find available port after ${maxRetries} attempts`);
      }
    }
  }

  const url = `http://localhost:${port}`;

  // Auto-open in browser
  if (opts.autoOpen) {
    try {
      const { exec } = await import('node:child_process');
      const command =
        process.platform === 'darwin'
          ? `open "${url}"`
          : process.platform === 'win32'
            ? `start "${url}"`
            : `xdg-open "${url}"`;

      exec(command);
    } catch {
      // Ignore errors when opening browser
    }
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
