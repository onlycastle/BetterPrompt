/**
 * User Preferences
 *
 * Read/write module for persistent user preferences stored in
 * ~/.betterprompt/prefs.json. Separate from the transient
 * plugin-state.json used by debounce/lifecycle tracking.
 *
 * @module plugin/lib/prefs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getPluginDataDir } from './config.js';

export interface UserPrefs {
  welcomeShown?: boolean;
  welcomeCompleted?: string;   // ISO timestamp
  welcomeVersion?: string;
  starAsked?: boolean;
  selectedProjects?: string[];
}

function getPrefsFilePath(): string {
  return join(getPluginDataDir(), 'prefs.json');
}

export function readPrefs(): UserPrefs {
  try {
    const raw = readFileSync(getPrefsFilePath(), 'utf-8');
    return JSON.parse(raw) as UserPrefs;
  } catch {
    return {};
  }
}

export function writePrefs(partial: Partial<UserPrefs>): void {
  const filePath = getPrefsFilePath();
  mkdirSync(dirname(filePath), { recursive: true });

  const existing = readPrefs();
  writeFileSync(
    filePath,
    JSON.stringify({ ...existing, ...partial }, null, 2),
  );
}

export function isFirstRun(): boolean {
  return !readPrefs().welcomeCompleted;
}
