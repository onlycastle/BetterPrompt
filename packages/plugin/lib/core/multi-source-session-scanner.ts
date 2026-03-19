/**
 * Multi-source session scanner wrapper for the plugin.
 *
 * Uses the plugin's scanner library to discover and parse sessions from
 * multiple AI coding assistant sources (Claude Code, Cursor) into a
 * canonical parsed-session format.
 *
 * @module plugin/lib/core/multi-source-session-scanner
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { multiSourceScanner } from '../scanner/index.js';
import type {
  SourcedParsedSession,
} from '../scanner/index.js';
import type { ParsedSession } from './types.js';
import { getScanCacheDir } from './session-scanner.js';

function getParsedSessionsCachePath(): string {
  return join(getScanCacheDir(), 'parsed-sessions.json');
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function serializeParsedSession(session: SourcedParsedSession): ParsedSession {
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
export async function scanAndCacheParsedSessions(): Promise<ParsedSession[]> {
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

export async function cacheParsedSessions(sessions: ParsedSession[]): Promise<string> {
  const scanCacheDir = getScanCacheDir();
  const cachePath = getParsedSessionsCachePath();
  await mkdir(scanCacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(sessions, null, 2), 'utf-8');
  return cachePath;
}

export async function readCachedParsedSessions(): Promise<ParsedSession[]> {
  try {
    const raw = await readFile(getParsedSessionsCachePath(), 'utf-8');
    return JSON.parse(raw) as ParsedSession[];
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
