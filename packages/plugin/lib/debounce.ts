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

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { getConfig, getStateFilePath } from './config.js';

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const MIN_SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

export interface PluginState {
  lastAnalysisTimestamp: string | null;
  lastAnalysisSessionCount: number;
  analysisInProgress: boolean;
}

const DEFAULT_STATE: PluginState = {
  lastAnalysisTimestamp: null,
  lastAnalysisSessionCount: 0,
  analysisInProgress: false,
};

export function readState(): PluginState {
  try {
    const raw = readFileSync(getStateFilePath(), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as PluginState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state: PluginState): void {
  const filePath = getStateFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2));
}

/**
 * Count session JSONL files in ~/.claude/projects/
 * This is a fast filesystem-only check (no file content reading).
 */
function countClaudeSessions(): number {
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
      } catch {
        // Skip unreadable project directories
      }
    }
  } catch {
    // ~/.claude/projects doesn't exist
  }

  return count;
}

export interface DebounceResult {
  shouldAnalyze: boolean;
  reason: string;
}

/**
 * Evaluate all debounce rules.
 *
 * @param sessionDurationMs - Duration of the just-ended session in milliseconds.
 *   Pass 0 if unknown (e.g. manual trigger).
 */
export function shouldTriggerAnalysis(sessionDurationMs: number): DebounceResult {
  const state = readState();
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
  const currentCount = countClaudeSessions();
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
 * Mark analysis as in-progress. Called before spawning background analyzer.
 */
export function markAnalysisStarted(): void {
  const state = readState();
  state.analysisInProgress = true;
  writeState(state);
}

/**
 * Mark analysis as complete. Called by background analyzer on success.
 */
export function markAnalysisComplete(): void {
  const currentCount = countClaudeSessions();
  writeState({
    lastAnalysisTimestamp: new Date().toISOString(),
    lastAnalysisSessionCount: currentCount,
    analysisInProgress: false,
  });
}

/**
 * Clear the in-progress flag. Called on failure or crash recovery.
 */
export function markAnalysisFailed(): void {
  const state = readState();
  state.analysisInProgress = false;
  writeState(state);
}
