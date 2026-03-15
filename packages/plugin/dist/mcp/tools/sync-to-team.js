/**
 * sync_to_team MCP Tool
 *
 * Sends analysis results to a team server (self-hosted or cloud).
 * Optional tool — only works when BETTERPROMPT_SERVER_URL is configured.
 */
import { assembleReport } from '../../lib/results-db.js';
export const definition = {
    name: 'sync_to_team',
    description: 'Sync local analysis results to a team BetterPrompt server. ' +
        'Requires BETTERPROMPT_SERVER_URL to be configured. ' +
        'The server receives pre-analyzed results (no LLM work needed server-side). ' +
        'Use this to share your analysis with your team dashboard.',
};
export async function execute(args) {
    const serverUrl = (args.serverUrl ??
        process.env.BETTERPROMPT_SERVER_URL ??
        process.env.BETTERPROMPT_API_URL)?.replace(/\/$/, '');
    if (!serverUrl) {
        return JSON.stringify({
            status: 'not_configured',
            message: 'No team server configured. Set BETTERPROMPT_SERVER_URL environment variable ' +
                'or pass serverUrl parameter to enable team sync.',
        });
    }
    const report = assembleReport();
    if (!report) {
        return JSON.stringify({
            status: 'no_data',
            message: 'No analysis results to sync. Run a full analysis first.',
        });
    }
    try {
        const authToken = process.env.BETTERPROMPT_AUTH_TOKEN ?? process.env.BETTERPROMPT_TOKEN ?? '';
        const response = await fetch(`${serverUrl}/api/analysis/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
                report,
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