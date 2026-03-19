/**
 * Session Scanner - Scans Claude Code session logs
 *
 * Extracted from src/lib/parser/jsonl-reader.ts for plugin self-sufficiency.
 * Pure filesystem operations with Zod validation.
 *
 * @module plugin/lib/core/session-scanner
 */

import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { JSONLLineSchema, CONTEXT_WINDOW_SIZE, type JSONLLine, type SessionMetadata } from './types.js';

/** Claude Code session log directory */
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** Plugin data directory */
export const PLUGIN_DATA_DIR = process.env.BETTERPROMPT_STORAGE_PATH?.trim()
  || join(homedir(), '.betterprompt');

/** Scan cache directory */
export const SCAN_CACHE_DIR = join(PLUGIN_DATA_DIR, 'scan-cache');

// ============================================================================
// JSONL Parsing
// ============================================================================

/** Parse a single line of JSONL. Returns null for invalid/empty lines. */
export function parseJSONLLine(line: string): JSONLLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    const result = JSONLLineSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Deduplicate assistant entries by message.id, keeping the LAST occurrence.
 * Claude Code writes multiple JSONL lines per assistant turn with progressively
 * more complete content.
 */
function deduplicateAssistantEntries(entries: JSONLLine[]): JSONLLine[] {
  const lastSeenIndex = new Map<string, number>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'assistant') {
      const msgId = entry.message?.id;
      if (msgId && !lastSeenIndex.has(msgId)) {
        lastSeenIndex.set(msgId, i);
      }
    }
  }

  return entries.filter((entry, i) => {
    if (entry.type !== 'assistant') return true;
    const msgId = entry.message?.id;
    if (!msgId) return true;
    return lastSeenIndex.get(msgId) === i;
  });
}

/** Read and parse a JSONL file */
export async function readJSONLFile(filePath: string): Promise<JSONLLine[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const parsed: JSONLLine[] = [];

  for (const line of lines) {
    const result = parseJSONLLine(line);
    if (result !== null) {
      parsed.push(result);
    }
  }

  return deduplicateAssistantEntries(parsed);
}

// ============================================================================
// Path Encoding/Decoding
// ============================================================================

/**
 * Decode project path from Claude's encoding.
 * '-Users-dev-projects-myapp' -> '/Users/dev/projects/myapp'
 * 'C--alphacut' -> 'C:/alphacut'
 */
export function decodeProjectPath(encoded: string): string {
  if (/^[A-Za-z]--/.test(encoded)) {
    const driveLetter = encoded[0];
    const rest = encoded.slice(3);
    if (!rest) return `${driveLetter}:/`;
    return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
  }

  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }

  return encoded;
}

/** Get project name from path */
export function getProjectName(projectPath: string): string {
  const parts = projectPath.trim().split(/[/\\]/).filter(Boolean);
  const filtered = parts.filter(p => !/^[A-Za-z]:$/.test(p));
  return filtered[filtered.length - 1] || 'unknown';
}

// ============================================================================
// Directory Scanning
// ============================================================================

/** List all project directories in Claude's projects folder */
export async function listProjectDirs(): Promise<string[]> {
  try {
    const entries = await readdir(CLAUDE_PROJECTS_DIR);
    const dirs: string[] = [];

    for (const entry of entries) {
      const fullPath = join(CLAUDE_PROJECTS_DIR, entry);
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          dirs.push(fullPath);
        }
      } catch {
        // Skip inaccessible entries
      }
    }

    return dirs;
  } catch {
    return [];
  }
}

/** List JSONL session files in a directory */
export async function listSessionFiles(projectDir: string): Promise<string[]> {
  try {
    const files = await readdir(projectDir);
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => join(projectDir, f));
  } catch {
    return [];
  }
}

/** Get metadata for a session file */
export async function getSessionMetadata(filePath: string): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length === 0) return null;

    const fileName = basename(filePath, '.jsonl');
    let messageCount = 0;
    let firstTimestamp: Date | null = null;
    let lastTimestamp: Date | null = null;
    const inputTokenCounts: number[] = [];
    const seenMessageIds = new Set<string>();

    for (const line of lines) {
      const parsed = parseJSONLLine(line);
      if (parsed && (parsed.type === 'user' || parsed.type === 'assistant')) {
        if (parsed.type === 'assistant') {
          const msgId = parsed.message?.id;
          if (msgId) {
            if (seenMessageIds.has(msgId)) continue;
            seenMessageIds.add(msgId);
          }
        }

        messageCount++;
        const ts = new Date(parsed.timestamp);

        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;

        if (parsed.type === 'assistant' && parsed.message.usage?.input_tokens) {
          inputTokenCounts.push(parsed.message.usage.input_tokens);
        }
      }
    }

    if (!firstTimestamp || !lastTimestamp) return null;

    const projectDirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(projectDirName);
    const durationSeconds = Math.floor(
      (lastTimestamp.getTime() - firstTimestamp.getTime()) / 1000,
    );

    let avgContextUtilization: number | undefined;
    let maxContextUtilization: number | undefined;

    if (inputTokenCounts.length > 0) {
      const avgTokens = inputTokenCounts.reduce((sum, t) => sum + t, 0) / inputTokenCounts.length;
      const maxTokens = Math.max(...inputTokenCounts);
      avgContextUtilization = Math.round((avgTokens / CONTEXT_WINDOW_SIZE) * 100);
      maxContextUtilization = Math.round((maxTokens / CONTEXT_WINDOW_SIZE) * 100);
    }

    return {
      sessionId: fileName,
      projectPath,
      projectName: getProjectName(projectPath),
      timestamp: firstTimestamp,
      messageCount,
      durationSeconds,
      filePath,
      avgContextUtilization,
      maxContextUtilization,
    };
  } catch {
    return null;
  }
}

/** List all sessions across all projects, sorted by recency */
export async function listAllSessions(): Promise<SessionMetadata[]> {
  const projectDirs = await listProjectDirs();
  const sessions: SessionMetadata[] = [];

  for (const dir of projectDirs) {
    const files = await listSessionFiles(dir);
    for (const file of files) {
      const metadata = await getSessionMetadata(file);
      if (metadata) {
        sessions.push(metadata);
      }
    }
  }

  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return sessions;
}

// ============================================================================
// Scan Cache
// ============================================================================

/** Store parsed sessions in scan cache for subsequent tools */
export async function cacheParsedSessions(
  sessions: SessionMetadata[],
): Promise<string> {
  await mkdir(SCAN_CACHE_DIR, { recursive: true });

  const cachePath = join(SCAN_CACHE_DIR, 'sessions.json');
  await writeFile(cachePath, JSON.stringify(sessions, null, 2), 'utf-8');
  return cachePath;
}

/** Read cached session metadata */
export async function readCachedSessions(): Promise<SessionMetadata[]> {
  try {
    const cachePath = join(SCAN_CACHE_DIR, 'sessions.json');
    const content = await readFile(cachePath, 'utf-8');
    const raw = JSON.parse(content) as Array<SessionMetadata & { timestamp: string }>;
    return raw.map(s => ({ ...s, timestamp: new Date(s.timestamp) }));
  } catch {
    return [];
  }
}
