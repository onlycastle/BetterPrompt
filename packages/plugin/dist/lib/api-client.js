/**
 * API Client
 *
 * HTTP client for communicating with the BetterPrompt server.
 * Authentication is no longer required — all endpoints work without tokens.
 */
import { getConfig } from './config.js';
/**
 * Fetch the user's analysis summary from the server.
 * Returns null if no analysis exists yet.
 * Throws on network or auth errors.
 */
export async function fetchUserSummary() {
    const config = getConfig();
    const url = `${config.serverUrl}/api/analysis/user/summary`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => ({})));
        throw new Error(`Server error (${response.status}): ${body.message ?? 'Unknown error'}`);
    }
    const data = await response.json();
    return data.summary;
}
/**
 * Verify server connectivity by hitting /api/auth/me.
 * No authentication required — always succeeds if server is reachable.
 */
export async function verifyAuth() {
    const config = getConfig();
    try {
        const response = await fetch(`${config.serverUrl}/api/auth/me`, {
            headers: {
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        return data;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=api-client.js.map