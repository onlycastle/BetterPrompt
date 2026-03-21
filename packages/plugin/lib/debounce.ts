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

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { getConfig, getStateFilePath } from './config.js';
import { debug } from './logger.js';

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const MIN_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MAX_RUNNING_STATE_AGE_MS = 30 * 60 * 1000; // 30 minutes

export type AnalysisLifecycleState =
  | 'idle'
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed';

export interface PluginState {
  lastAnalysisTimestamp: string | null;
  lastAnalysisSessionCount: number;
  analysisState: AnalysisLifecycleState;
  analysisInProgress: boolean;
  /** Set by post-session hook; cleared when next Claude Code session runs analysis */
  analysisPending: boolean;
  /** ISO timestamp when analysis was queued */
  pendingSince: string | null;
  lastError: string | null;
  stateUpdatedAt: string | null;
}

const DEFAULT_STATE: PluginState = {
  lastAnalysisTimestamp: null,
  lastAnalysisSessionCount: 0,
  analysisState: 'idle',
  analysisInProgress: false,
  analysisPending: false,
  pendingSince: null,
  lastError: null,
  stateUpdatedAt: null,
};

function normalizeState(state: PluginState): PluginState {
  let analysisState = state.analysisState;

  if (!analysisState) {
    if (state.analysisInProgress) analysisState = 'running';
    else if (state.analysisPending) analysisState = 'pending';
    else analysisState = 'idle';
  }

  return {
    ...state,
    analysisState,
    analysisInProgress: analysisState === 'running',
    analysisPending: analysisState === 'pending',
  };
}

export function readState(): PluginState {
  try {
    const raw = readFileSync(getStateFilePath(), 'utf-8');
    return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(raw) } as PluginState);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state: PluginState): void {
  const filePath = getStateFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    JSON.stringify(
      normalizeState({
        ...state,
        stateUpdatedAt: new Date().toISOString(),
      }),
      null,
      2,
    ),
  );
}

/**
 * Count Claude Code session JSONL files across all projects.
 */
function countClaudeSessions(): number {
  const projectsDir = join(homedir(), '.claude', 'projects');

  try {
    const projects = readdirSync(projectsDir);
    return projects.reduce((count, project) => {
      try {
        const files = readdirSync(join(projectsDir, project));
        return count + files.filter(f => f.endsWith('.jsonl')).length;
      } catch {
        return count;
      }
    }, 0);
  } catch {
    return 0;
  }
}

export interface DebounceResult {
  shouldAnalyze: boolean;
  reason: string;
}

export function getAnalysisLifecycleState(): AnalysisLifecycleState {
  return readState().analysisState;
}

export function recoverStaleAnalysisState(options?: {
  force?: boolean;
  reason?: string;
}): PluginState {
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

  debug('debounce', 'recovering stale running state', { reason: options?.reason ?? 'stale' });
  const recoveredState: PluginState = {
    ...state,
    analysisState: 'failed',
    pendingSince: null,
    lastError: options?.reason ?? state.lastError ?? 'Recovered stale running analysis state.',
  };

  writeState(recoveredState);
  return normalizeState(recoveredState);
}

/**
 * Evaluate all debounce rules.
 *
 * @param sessionDurationMs - Duration of the just-ended session in milliseconds.
 *   Pass 0 if unknown (e.g. manual trigger).
 */
export function shouldTriggerAnalysis(sessionDurationMs: number): DebounceResult {
  const state = recoverStaleAnalysisState();
  const config = getConfig();

  // Rule 4: Guard — no analysis already in progress
  if (state.analysisInProgress) {
    debug('debounce', 'shouldTriggerAnalysis', { shouldAnalyze: false, reason: 'Analysis already in progress' });
    return { shouldAnalyze: false, reason: 'Analysis already in progress' };
  }

  // Rule 3: Duration — session must be ≥3 minutes
  if (sessionDurationMs > 0 && sessionDurationMs < MIN_SESSION_DURATION_MS) {
    const reason = `Session too short (${Math.round(sessionDurationMs / 1000)}s < 3min)`;
    debug('debounce', 'shouldTriggerAnalysis', { shouldAnalyze: false, reason });
    return { shouldAnalyze: false, reason };
  }

  // Rule 1: Cooldown — ≥4 hours since last analysis
  if (state.lastAnalysisTimestamp) {
    const elapsed = Date.now() - new Date(state.lastAnalysisTimestamp).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingMin = Math.round((COOLDOWN_MS - elapsed) / 60_000);
      const reason = `Cooldown active (${remainingMin}min remaining)`;
      debug('debounce', 'shouldTriggerAnalysis', { shouldAnalyze: false, reason });
      return { shouldAnalyze: false, reason };
    }
  }

  // Rule 2: Threshold — ≥N new sessions since last analysis
  const currentCount = countClaudeSessions();
  const newSessions = currentCount - state.lastAnalysisSessionCount;
  if (newSessions < config.analyzeThreshold) {
    const reason = `Not enough new sessions (${newSessions}/${config.analyzeThreshold})`;
    debug('debounce', 'shouldTriggerAnalysis', { shouldAnalyze: false, reason });
    return { shouldAnalyze: false, reason };
  }

  const result: DebounceResult = {
    shouldAnalyze: true,
    reason: `${newSessions} new sessions, cooldown passed`,
  };
  debug('debounce', 'shouldTriggerAnalysis', { shouldAnalyze: result.shouldAnalyze, reason: result.reason });
  return result;
}

/**
 * Mark analysis as in-progress. Called when the queued local analysis starts.
 */
export function markAnalysisStarted(): void {
  debug('debounce', 'state transition: -> running');
  const state = readState();
  writeState({
    ...state,
    analysisState: 'running',
    pendingSince: null,
    lastError: null,
  });
}

/**
 * Mark analysis as complete. Called after the local pipeline finishes successfully.
 */
export function markAnalysisComplete(sessionCount?: number): void {
  debug('debounce', 'state transition: -> complete');
  writeState({
    ...DEFAULT_STATE,
    lastAnalysisTimestamp: new Date().toISOString(),
    lastAnalysisSessionCount: sessionCount ?? countClaudeSessions(),
    analysisState: 'complete',
  });
}

/**
 * Clear the in-progress flag. Called on failure or crash recovery.
 */
export function markAnalysisFailed(error?: unknown): void {
  const errorMsg = error instanceof Error ? error.message : (error ? String(error) : null);
  debug('debounce', 'state transition: -> failed', { error: errorMsg ?? undefined });
  const state = readState();
  writeState({
    ...state,
    analysisState: 'failed',
    pendingSince: null,
    lastError: errorMsg,
  });
}

/**
 * Mark analysis as pending for next Claude Code session.
 * Called by the post-session hook instead of spawning a background process.
 */
export function markAnalysisPending(): void {
  debug('debounce', 'state transition: -> pending');
  const state = readState();
  writeState({
    ...state,
    analysisState: 'pending',
    pendingSince: new Date().toISOString(),
    lastError: null,
  });
}

/**
 * Check if there is a pending analysis queued by a previous session's hook.
 */
export function isAnalysisPending(): boolean {
  const state = readState();
  return state.analysisState === 'pending';
}

/**
 * Clear the pending flag. Called when the pending analysis starts or is dismissed.
 */
export function clearAnalysisPending(): void {
  const state = readState();
  if (state.analysisState !== 'pending') {
    return;
  }
  writeState({
    ...state,
    analysisState: 'idle',
    pendingSince: null,
  });
}
