/**
 * Session Scanner
 *
 * Scans ~/.claude/projects/ for Claude Code session logs
 * and extracts data for analysis.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { countTokensAccurate } from './cost-estimator.js';

export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
}

export interface SessionData {
  metadata: SessionMetadata;
  content: string; // Raw JSONL content
}

export interface SessionWithTokens extends SessionData {
  tokenCount: number;
}

export interface ScanResult {
  sessions: SessionWithTokens[];
  totalMessages: number;
  totalDurationMinutes: number;
}

/**
 * Decode project path from Claude's encoding
 * Claude encodes paths by replacing '/' with '-'
 */
function decodeProjectPath(encoded: string): string {
  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }
  return encoded;
}

/**
 * Get project name from path
 */
function getProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

/**
 * Parse a single line of JSONL to extract basic info
 */
function parseJSONLLine(line: string): { type: string; timestamp?: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return {
      type: parsed.type,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a line is a conversation message (user or assistant)
 */
function isConversationLine(parsed: { type: string } | null): boolean {
  return parsed !== null && (parsed.type === 'user' || parsed.type === 'assistant');
}

/**
 * Update timestamp bounds (min/max) with a new timestamp
 */
function updateTimestampBounds(
  timestamp: string,
  bounds: { first: Date | null; last: Date | null }
): void {
  const ts = new Date(timestamp);
  if (!bounds.first || ts < bounds.first) bounds.first = ts;
  if (!bounds.last || ts > bounds.last) bounds.last = ts;
}

/**
 * Get metadata for a session file
 */
async function getSessionMetadata(filePath: string): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length === 0) return null;

    const fileName = basename(filePath, '.jsonl');
    let messageCount = 0;
    const timestamps = { first: null as Date | null, last: null as Date | null };

    for (const line of lines) {
      const parsed = parseJSONLLine(line);
      if (isConversationLine(parsed)) {
        messageCount++;
        if (parsed?.timestamp) {
          updateTimestampBounds(parsed.timestamp, timestamps);
        }
      }
    }

    if (!timestamps.first || !timestamps.last) return null;

    const projectDirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(projectDirName);
    const durationSeconds = Math.floor(
      (timestamps.last.getTime() - timestamps.first.getTime()) / 1000
    );

    return {
      sessionId: fileName,
      projectPath,
      projectName: getProjectName(projectPath),
      timestamp: timestamps.first,
      messageCount,
      durationSeconds,
      filePath,
    };
  } catch {
    return null;
  }
}

/**
 * List all project directories
 */
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

/**
 * List session files in a directory
 */
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

/**
 * Scan all sessions and select the best ones for analysis
 */
export async function scanSessions(maxSessions: number = 10): Promise<ScanResult> {
  const projectDirs = await listProjectDirs();
  const allMetadata: SessionMetadata[] = [];

  for (const dir of projectDirs) {
    const files = await listSessionFiles(dir);
    for (const file of files) {
      const metadata = await getSessionMetadata(file);
      if (metadata && metadata.messageCount >= 5) {
        allMetadata.push(metadata);
      }
    }
  }

  // Sort by duration (longer sessions first) then by recency
  allMetadata.sort((a, b) => {
    const durationDiff = b.durationSeconds - a.durationSeconds;
    if (Math.abs(durationDiff) > 60) return durationDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Select top sessions
  const selected = allMetadata.slice(0, maxSessions);

  // Read content for selected sessions and calculate tokens
  const sessions: SessionWithTokens[] = [];
  let totalMessages = 0;
  let totalDurationMinutes = 0;

  for (const metadata of selected) {
    try {
      const content = await readFile(metadata.filePath, 'utf-8');
      const tokenCount = countTokensAccurate(content);
      sessions.push({ metadata, content, tokenCount });
      totalMessages += metadata.messageCount;
      totalDurationMinutes += Math.round(metadata.durationSeconds / 60);
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by token count ascending (smallest first)
  sessions.sort((a, b) => a.tokenCount - b.tokenCount);

  return {
    sessions,
    totalMessages,
    totalDurationMinutes,
  };
}

/**
 * Check if Claude projects directory exists
 */
export async function hasClaudeProjects(): Promise<boolean> {
  try {
    await stat(CLAUDE_PROJECTS_DIR);
    return true;
  } catch {
    return false;
  }
}
