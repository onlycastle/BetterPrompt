/**
 * sync-to-team CLI command
 *
 * Sends analysis results to a team server.
 *
 * Usage: betterprompt-cli sync-to-team [--serverUrl http://localhost:3000]
 */

import { getConfig } from '../../lib/config.js';
import { assembleCanonicalRun } from '../../lib/results-db.js';
import { markAnalysisComplete } from '../../lib/debounce.js';

export async function execute(args: Record<string, unknown>): Promise<string> {
  const serverUrl = ((args.serverUrl as string) ?? getConfig().serverUrl)?.replace(/\/$/, '');

  if (!serverUrl) {
    return JSON.stringify({
      status: 'not_configured',
      message: 'No team server URL. Set BETTERPROMPT_SERVER_URL or pass --serverUrl.',
    });
  }

  const run = assembleCanonicalRun();
  if (!run) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No analysis results to sync. Run a full analysis first.',
    });
  }

  try {
    const response = await fetch(`${serverUrl}/api/analysis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run, syncedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return JSON.stringify({
        status: 'sync_failed',
        httpStatus: response.status,
        message: `Server returned ${response.status}: ${errorText}`,
      });
    }

    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);

    return JSON.stringify({
      status: 'ok',
      serverUrl,
      message: `Successfully synced analysis to ${serverUrl}.`,
      ...(result && typeof result === 'object' ? result : {}),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      message: `Failed to connect to ${serverUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
