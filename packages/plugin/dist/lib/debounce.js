/**
 * Debounce Logic
 *
 * Determines whether an auto-analysis should be triggered based on:
 *   1. Cooldown: ≥4 hours since last analysis
 *   2. Threshold: ≥N new sessions since last analysis (configurable)
 *   3. Duration: Just-ended session was ≥3 minutes
 *   4. Guard: No analysis already in progress
 *
 * State tracked in ~/.betterprompt/plugin-state.json
 */
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { dirname } from 'node:path';
import { getConfig, getStateFilePath } from './config.js';
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const MIN_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAX_RUNNING_STATE_AGE_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_STATE = {
    lastAnalysisTimestamp: null,
    lastAnalysisSessionCount: 0,
    analysisState: 'idle',
    analysisInProgress: false,
    analysisPending: false,
    pendingSince: null,
    lastError: null,
    stateUpdatedAt: null,
};
function normalizeState(state) {
    let analysisState = state.analysisState;
    if (!analysisState) {
        if (state.analysisInProgress)
            analysisState = 'running';
        else if (state.analysisPending)
            analysisState = 'pending';
        else
            analysisState = 'idle';
    }
    return {
        ...state,
        analysisState,
        analysisInProgress: analysisState === 'running',
        analysisPending: analysisState === 'pending',
    };
}
export function readState() {
    try {
        const raw = readFileSync(getStateFilePath(), 'utf-8');
        return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    }
    catch {
        return { ...DEFAULT_STATE };
    }
}
export function writeState(state) {
    const filePath = getStateFilePath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(normalizeState({
        ...state,
        stateUpdatedAt: new Date().toISOString(),
    }), null, 2));
}
/**
 * Count Claude Code session JSONL files.
 */
function countClaudeSessions() {
    const projectsDir = join(homedir(), '.claude', 'projects');
    let count = 0;
    try {
        const projects = readdirSync(projectsDir);
        for (const project of projects) {
            const projectPath = join(projectsDir, project);
            try {
                const files = readdirSync(projectPath);
                for (const file of files) {
                    if (file.endsWith('.jsonl')) {
                        count++;
                    }
                }
            }
            catch {
                // Skip unreadable project directories
            }
        }
    }
    catch {
        // ~/.claude/projects doesn't exist
    }
    return count;
}
function getCursorChatsDir() {
    return join(homedir(), '.cursor', 'chats');
}
function countCursorSessions() {
    const chatsDir = getCursorChatsDir();
    let count = 0;
    try {
        const workspaces = readdirSync(chatsDir);
        for (const workspace of workspaces) {
            const workspacePath = join(chatsDir, workspace);
            try {
                const sessions = readdirSync(workspacePath);
                for (const session of sessions) {
                    if (existsSync(join(workspacePath, session, 'store.db'))) {
                        count++;
                    }
                }
            }
            catch {
                // Skip unreadable workspace directories
            }
        }
    }
    catch {
        // ~/.cursor/chats doesn't exist
    }
    return count;
}
function getCursorComposerDbPath() {
    switch (platform()) {
        case 'darwin':
            return join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        case 'win32':
            return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        default:
            return join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
    }
}
function countCursorComposerSessions() {
    const dbPath = getCursorComposerDbPath();
    if (!existsSync(dbPath)) {
        return 0;
    }
    let db = null;
    try {
        db = new Database(dbPath, { readonly: true, fileMustExist: true });
        const row = db
            .prepare("SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE 'composerData:%'")
            .get();
        return row?.count ?? 0;
    }
    catch {
        return 0;
    }
    finally {
        db?.close();
    }
}
function countLocalSessions() {
    return countClaudeSessions() + countCursorSessions() + countCursorComposerSessions();
}
export function getAnalysisLifecycleState() {
    return readState().analysisState;
}
export function recoverStaleAnalysisState(options) {
    const state = readState();
    if (state.analysisState !== 'running') {
        return state;
    }
    const updatedAt = state.stateUpdatedAt ? new Date(state.stateUpdatedAt).getTime() : Number.NaN;
    const isStale = options?.force
        || Number.isNaN(updatedAt)
        || (Date.now() - updatedAt) > MAX_RUNNING_STATE_AGE_MS;
    if (!isStale) {
        return state;
    }
    const recoveredState = {
        ...state,
        analysisState: 'failed',
        analysisInProgress: false,
        analysisPending: false,
        pendingSince: null,
        lastError: options?.reason ?? state.lastError ?? 'Recovered stale running analysis state.',
    };
    writeState(recoveredState);
    return recoveredState;
}
/**
 * Evaluate all debounce rules.
 *
 * @param sessionDurationMs - Duration of the just-ended session in milliseconds.
 *   Pass 0 if unknown (e.g. manual trigger).
 */
export function shouldTriggerAnalysis(sessionDurationMs) {
    const state = recoverStaleAnalysisState();
    const config = getConfig();
    // Rule 4: Guard — no analysis already in progress
    if (state.analysisInProgress) {
        return { shouldAnalyze: false, reason: 'Analysis already in progress' };
    }
    // Rule 3: Duration — session must be ≥3 minutes
    if (sessionDurationMs > 0 && sessionDurationMs < MIN_SESSION_DURATION_MS) {
        return {
            shouldAnalyze: false,
            reason: `Session too short (${Math.round(sessionDurationMs / 1000)}s < 3min)`,
        };
    }
    // Rule 1: Cooldown — ≥4 hours since last analysis
    if (state.lastAnalysisTimestamp) {
        const elapsed = Date.now() - new Date(state.lastAnalysisTimestamp).getTime();
        if (elapsed < COOLDOWN_MS) {
            const remainingMin = Math.round((COOLDOWN_MS - elapsed) / 60_000);
            return {
                shouldAnalyze: false,
                reason: `Cooldown active (${remainingMin}min remaining)`,
            };
        }
    }
    // Rule 2: Threshold — ≥N new sessions since last analysis
    const currentCount = countLocalSessions();
    const newSessions = currentCount - state.lastAnalysisSessionCount;
    if (newSessions < config.analyzeThreshold) {
        return {
            shouldAnalyze: false,
            reason: `Not enough new sessions (${newSessions}/${config.analyzeThreshold})`,
        };
    }
    return {
        shouldAnalyze: true,
        reason: `${newSessions} new sessions, cooldown passed`,
    };
}
/**
 * Mark analysis as in-progress. Called when the queued local analysis starts.
 */
export function markAnalysisStarted() {
    const state = readState();
    state.analysisState = 'running';
    state.analysisInProgress = true;
    state.analysisPending = false;
    state.pendingSince = null;
    state.lastError = null;
    writeState(state);
}
/**
 * Mark analysis as complete. Called after the local pipeline finishes successfully.
 */
export function markAnalysisComplete(sessionCount) {
    const currentCount = sessionCount ?? countLocalSessions();
    writeState({
        lastAnalysisTimestamp: new Date().toISOString(),
        lastAnalysisSessionCount: currentCount,
        analysisState: 'complete',
        analysisInProgress: false,
        analysisPending: false,
        pendingSince: null,
        lastError: null,
        stateUpdatedAt: new Date().toISOString(),
    });
}
/**
 * Clear the in-progress flag. Called on failure or crash recovery.
 */
export function markAnalysisFailed(error) {
    const state = readState();
    state.analysisState = 'failed';
    state.analysisInProgress = false;
    state.analysisPending = false;
    state.pendingSince = null;
    state.lastError = error instanceof Error ? error.message : (error ? String(error) : null);
    writeState(state);
}
/**
 * Mark analysis as pending for next Claude Code session.
 * Called by the post-session hook instead of spawning a background process.
 */
export function markAnalysisPending() {
    const state = readState();
    state.analysisState = 'pending';
    state.analysisPending = true;
    state.analysisInProgress = false;
    state.pendingSince = new Date().toISOString();
    state.lastError = null;
    writeState(state);
}
/**
 * Check if there is a pending analysis queued by a previous session's hook.
 */
export function isAnalysisPending() {
    const state = readState();
    return state.analysisState === 'pending';
}
/**
 * Clear the pending flag. Called when the pending analysis starts or is dismissed.
 */
export function clearAnalysisPending() {
    const state = readState();
    if (state.analysisState === 'pending') {
        state.analysisState = 'idle';
        state.analysisPending = false;
        state.pendingSince = null;
    }
    writeState(state);
}
//# sourceMappingURL=debounce.js.map