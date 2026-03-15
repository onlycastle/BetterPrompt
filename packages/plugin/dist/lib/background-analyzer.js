#!/usr/bin/env node
/**
 * Background Analyzer
 *
 * Spawned as a detached child process by the post-session hook.
 * Reuses the CLI scanner and uploader to run a full analysis,
 * then refreshes the local insight cache.
 *
 * Usage: node background-analyzer.js
 *
 * Environment:
 *   BETTERPROMPT_SERVER_URL  — server URL
 *   BETTERPROMPT_AUTH_TOKEN  — CLI auth token
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getConfig, getErrorLogPath } from './config.js';
import { markAnalysisComplete, markAnalysisFailed } from './debounce.js';
import { refreshCache } from './cache.js';
import { verifyAuth } from './api-client.js';
function logError(message, error) {
    const logPath = getErrorLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    const timestamp = new Date().toISOString();
    const errorStr = error instanceof Error ? error.stack ?? error.message : String(error ?? '');
    appendFileSync(logPath, `[${timestamp}] ${message} ${errorStr}\n`);
}
/**
 * Dynamically load the CLI scanner and uploader at runtime.
 * Tries the npm package first, then falls back to monorepo relative path.
 * No compile-time dependency on the CLI package.
 */
async function loadCliModules() {
    // Try 1: installed npm package
    try {
        const [scannerMod, uploaderMod] = await Promise.all([
            import('betterprompt/scanner'),
            import('betterprompt/uploader'),
        ]);
        return {
            scanSessions: scannerMod.scanSessions,
            uploadForAnalysis: uploaderMod.uploadForAnalysis,
        };
    }
    catch {
        // not installed as npm package
    }
    // Try 2: monorepo sibling (dev mode)
    // Use a variable to prevent TypeScript from resolving the import statically
    const cliBase = '../../cli/src';
    try {
        const [scannerMod, uploaderMod] = await Promise.all([
            import(/* @vite-ignore */ `${cliBase}/scanner.js`),
            import(/* @vite-ignore */ `${cliBase}/uploader.js`),
        ]);
        return {
            scanSessions: scannerMod.scanSessions,
            uploadForAnalysis: uploaderMod.uploadForAnalysis,
        };
    }
    catch (importError) {
        throw new Error(`Cannot import scanner/uploader. Install the betterprompt CLI package. ${importError}`);
    }
}
async function run() {
    const config = getConfig();
    logError('Background analysis started');
    // Verify server connectivity
    const user = await verifyAuth();
    if (!user) {
        throw new Error('Server unreachable — cannot run analysis');
    }
    // Load CLI modules dynamically
    const { scanSessions, uploadForAnalysis } = await loadCliModules();
    // Phase 1: Scan sessions
    logError('Scanning sessions...');
    const scanResult = await scanSessions();
    if (!scanResult.sessions.length) {
        logError('No sessions found to analyze');
        markAnalysisComplete();
        return;
    }
    logError(`Found ${scanResult.sessions.length} sessions, uploading for analysis...`);
    // Phase 2: Upload and analyze
    // Set the API URL for the uploader
    process.env.BETTERPROMPT_API_URL = config.serverUrl;
    const result = await uploadForAnalysis(scanResult, config.authToken);
    logError(`Analysis complete: ${result.resultId} (${result.primaryType}/${result.controlLevel})`);
    // Phase 3: Refresh the insight cache
    await refreshCache(user.id);
    logError('Cache refreshed');
    // Mark complete
    markAnalysisComplete();
    logError('Background analysis finished successfully');
}
run().catch((error) => {
    logError('Background analysis failed', error);
    markAnalysisFailed();
    process.exit(1);
});
//# sourceMappingURL=background-analyzer.js.map