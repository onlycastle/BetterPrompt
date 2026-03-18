/**
 * Multi-source session scanner wrapper for the plugin.
 *
 * Reuses the CLI's mature source discovery and parsing so the plugin can
 * analyze Claude Code and Cursor sessions with one canonical parsed-session
 * format instead of maintaining a Claude-only scanner.
 *
 * @module plugin/lib/core/multi-source-session-scanner
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { multiSourceScanner } from 'betterprompt-cli/dist/lib/scanner/index.js';
import { PLUGIN_DATA_DIR } from './session-scanner.js';
export const SCAN_CACHE_DIR = join(PLUGIN_DATA_DIR, 'scan-cache');
const PARSED_SESSIONS_CACHE = join(SCAN_CACHE_DIR, 'parsed-sessions.json');
function isNonNull(value) {
    return value !== null;
}
function serializeParsedSession(session) {
    return {
        sessionId: session.sessionId,
        projectPath: session.projectPath,
        projectName: session.projectName,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        durationSeconds: session.durationSeconds,
        claudeCodeVersion: session.claudeCodeVersion,
        messages: session.messages.map(message => ({
            uuid: message.uuid,
            role: message.role,
            timestamp: message.timestamp.toISOString(),
            content: message.content,
            toolCalls: message.toolCalls,
            tokenUsage: message.tokenUsage,
        })),
        stats: session.stats,
        source: session.source,
    };
}
/**
 * Discover, parse, normalize, and cache sessions from all available sources.
 */
export async function scanAndCacheParsedSessions() {
    const { files } = await multiSourceScanner.collectAllFileMetadata({
        minFileSize: 1024,
        maxFileSize: 50 * 1024 * 1024,
    });
    const metadata = (await Promise.all(files.map(file => multiSourceScanner.extractMetadata(file))))
        .filter(isNonNull)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const parsedSessions = (await Promise.all(metadata.map(item => multiSourceScanner.parseSession(item))))
        .filter(isNonNull)
        .map(serializeParsedSession)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    await cacheParsedSessions(parsedSessions);
    return parsedSessions;
}
export async function cacheParsedSessions(sessions) {
    await mkdir(SCAN_CACHE_DIR, { recursive: true });
    await writeFile(PARSED_SESSIONS_CACHE, JSON.stringify(sessions, null, 2), 'utf-8');
    return PARSED_SESSIONS_CACHE;
}
export async function readCachedParsedSessions() {
    try {
        const raw = await readFile(PARSED_SESSIONS_CACHE, 'utf-8');
        return JSON.parse(raw);
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
//# sourceMappingURL=multi-source-session-scanner.js.map