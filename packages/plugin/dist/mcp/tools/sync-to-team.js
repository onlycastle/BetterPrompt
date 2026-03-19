/**
 * sync_to_team MCP Tool
 *
 * Sends analysis results to a team server (self-hosted or cloud).
 * Optional tool — uses the configured plugin server URL unless overridden.
 */
import { getConfig } from '../../lib/config.js';
import { assembleCanonicalRun } from '../../lib/results-db.js';
import { markAnalysisComplete } from '../../lib/debounce.js';
export const definition = {
    name: 'sync_to_team',
    description: 'Sync local analysis results to a team BetterPrompt server. ' +
        'Uses the BetterPrompt plugin server URL setting unless serverUrl is passed explicitly. ' +
        'The server receives pre-analyzed results (no LLM work needed server-side). ' +
        'Use this to share your analysis with your team dashboard.',
};
export async function execute(args) {
    const serverUrl = (args.serverUrl ?? getConfig().serverUrl)?.replace(/\/$/, '');
    if (!serverUrl) {
        return JSON.stringify({
            status: 'not_configured',
            message: 'No team server URL is available. Set the BetterPrompt plugin serverUrl setting ' +
                'or pass serverUrl to enable team sync.',
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                run,
                syncedAt: new Date().toISOString(),
            }),
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
        const result = await response.json().catch(() => ({}));
        markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
        return JSON.stringify({
            status: 'ok',
            serverUrl,
            message: `Successfully synced analysis to ${serverUrl}.`,
            ...(result && typeof result === 'object' ? result : {}),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            message: `Failed to connect to ${serverUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}
//# sourceMappingURL=sync-to-team.js.map