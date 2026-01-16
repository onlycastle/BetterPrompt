/**
 * Session Cache - Local caching for session data
 *
 * Saves scanned session data to avoid repeated API costs during testing.
 * Cache location: ~/.nomoreaislop/session-cache/sessions.json
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import pc from 'picocolors';
import type { ScanResult } from './scanner.js';
import { CLAUDE_PROJECTS_DIR } from './scanner.js';

const CACHE_DIR = join(homedir(), '.nomoreaislop', 'session-cache');
const CACHE_FILE = join(CACHE_DIR, 'sessions.json');

interface SessionCache {
  version: 1;
  createdAt: string;
  sessionsHash: string;
  scanResult: SerializableScanResult;
}

// ScanResult with Date converted to string for JSON serialization
interface SerializableScanResult {
  sessions: Array<{
    metadata: {
      sessionId: string;
      projectPath: string;
      projectName: string;
      timestamp: string; // ISO string
      messageCount: number;
      durationSeconds: number;
      filePath: string;
    };
    content: string;
  }>;
  totalMessages: number;
  totalDurationMinutes: number;
}

/**
 * Compute hash based on session file paths + modification times
 * This detects new/deleted/modified session files without reading content
 */
export async function computeSessionsHash(): Promise<string> {
  const fileStats: string[] = [];

  try {
    const entries = await readdir(CLAUDE_PROJECTS_DIR);

    for (const entry of entries) {
      const projectDir = join(CLAUDE_PROJECTS_DIR, entry);
      try {
        const dirStat = await stat(projectDir);
        if (!dirStat.isDirectory()) continue;

        const files = await readdir(projectDir);
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;
          const filePath = join(projectDir, file);
          try {
            const fileStat = await stat(filePath);
            fileStats.push(`${filePath}:${fileStat.size}:${fileStat.mtimeMs}`);
          } catch {
            // Skip inaccessible files
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }
  } catch {
    return 'empty';
  }

  fileStats.sort();
  return createHash('sha256').update(fileStats.join('\n')).digest('hex').slice(0, 16);
}

/**
 * Save scan result to cache
 */
export async function saveCache(scanResult: ScanResult): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });

  const sessionsHash = await computeSessionsHash();

  // Convert Date objects to ISO strings for serialization
  const serializableResult: SerializableScanResult = {
    sessions: scanResult.sessions.map((s) => ({
      metadata: {
        ...s.metadata,
        timestamp: s.metadata.timestamp.toISOString(),
      },
      content: s.content,
    })),
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
  };

  const cache: SessionCache = {
    version: 1,
    createdAt: new Date().toISOString(),
    sessionsHash,
    scanResult: serializableResult,
  };

  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(pc.dim(`  Cache saved to ${CACHE_FILE}`));
}

/**
 * Load scan result from cache
 * Returns null if cache doesn't exist or is invalid
 * @param validateHash - If true, validates that sessions haven't changed (default: false for testing)
 */
export async function loadCache(validateHash: boolean = false): Promise<ScanResult | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const cache: SessionCache = JSON.parse(content);

    // Validate version
    if (cache.version !== 1) {
      console.log(pc.yellow('  Cache version mismatch, will scan fresh'));
      return null;
    }

    // Optionally validate hash (detect session changes)
    if (validateHash) {
      const currentHash = await computeSessionsHash();
      if (cache.sessionsHash !== currentHash) {
        console.log(pc.yellow('  Sessions changed since cache, will scan fresh'));
        return null;
      }
    }

    // Convert ISO strings back to Date objects
    const scanResult: ScanResult = {
      sessions: cache.scanResult.sessions.map((s) => ({
        metadata: {
          ...s.metadata,
          timestamp: new Date(s.metadata.timestamp),
        },
        content: s.content,
      })),
      totalMessages: cache.scanResult.totalMessages,
      totalDurationMinutes: cache.scanResult.totalDurationMinutes,
    };

    const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
    const ageMinutes = Math.round(cacheAge / 60000);
    console.log(pc.green(`  Using cached data (${ageMinutes} minutes old)`));

    return scanResult;
  } catch {
    return null;
  }
}

/**
 * Display help message for cache flags
 */
export function displayCacheHelp(): void {
  console.log('');
  console.log(pc.bold('Cache Options:'));
  console.log('  --save-cache    Save scanned sessions to local cache');
  console.log('  --use-cache     Use cached sessions (skip scanning)');
  console.log('');
  console.log(pc.dim(`Cache location: ${CACHE_FILE}`));
}
