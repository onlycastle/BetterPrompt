import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  JSONLLineSchema,
  type JSONLLine,
  type SessionMetadata,
} from '../models/index.js';

/**
 * Claude Code session log directory
 */
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Parse a single line of JSONL
 * Returns null for invalid or empty lines (skipped silently)
 */
export function parseJSONLLine(line: string): JSONLLine | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const result = JSONLLineSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSONL file
 */
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

  return parsed;
}

/**
 * Decode project path from Claude's encoding
 * Claude encodes paths by replacing '/' with '-'
 */
export function decodeProjectPath(encoded: string): string {
  // The encoded path starts with '-' for absolute paths
  // e.g., '-Users-dev-projects-myapp' -> '/Users/dev/projects/myapp'
  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }
  return encoded;
}

/**
 * Encode a project path for Claude's format
 */
export function encodeProjectPath(path: string): string {
  return path.replace(/\//g, '-');
}

/**
 * Get project name from path
 */
export function getProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

/**
 * List all session files in a project directory
 */
export async function listSessionFiles(
  projectDir: string
): Promise<string[]> {
  try {
    const files = await readdir(projectDir);
    return files
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => join(projectDir, f));
  } catch {
    return [];
  }
}

/**
 * List all project directories in Claude's projects folder
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
 * Get metadata for a session file without fully parsing it
 * Reads only the first and last few lines for efficiency
 */
export async function getSessionMetadata(
  filePath: string
): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    if (lines.length === 0) {
      return null;
    }

    // Get session ID from filename
    const fileName = basename(filePath, '.jsonl');

    // Parse first line for session info
    const firstLine = parseJSONLLine(lines[0]);
    if (!firstLine || (firstLine.type !== 'user' && firstLine.type !== 'assistant')) {
      return null;
    }

    // Count messages
    let messageCount = 0;
    let firstTimestamp: Date | null = null;
    let lastTimestamp: Date | null = null;

    for (const line of lines) {
      const parsed = parseJSONLLine(line);
      if (parsed && (parsed.type === 'user' || parsed.type === 'assistant')) {
        messageCount++;
        const ts = new Date(parsed.timestamp);

        if (!firstTimestamp || ts < firstTimestamp) {
          firstTimestamp = ts;
        }
        if (!lastTimestamp || ts > lastTimestamp) {
          lastTimestamp = ts;
        }
      }
    }

    if (!firstTimestamp || !lastTimestamp) {
      return null;
    }

    // Get project path from directory name
    const projectDirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(projectDirName);

    const durationSeconds = Math.floor(
      (lastTimestamp.getTime() - firstTimestamp.getTime()) / 1000
    );

    return {
      sessionId: fileName,
      projectPath,
      projectName: getProjectName(projectPath),
      timestamp: firstTimestamp,
      messageCount,
      durationSeconds,
      filePath,
    };
  } catch {
    return null;
  }
}

/**
 * Find session file by ID across all projects
 */
export async function findSessionFile(
  sessionId: string
): Promise<string | null> {
  const projectDirs = await listProjectDirs();

  for (const dir of projectDirs) {
    const sessionPath = join(dir, `${sessionId}.jsonl`);
    try {
      await stat(sessionPath);
      return sessionPath;
    } catch {
      // File doesn't exist in this dir
    }
  }

  return null;
}

/**
 * List all sessions across all projects
 */
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

  // Sort by timestamp, most recent first
  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return sessions;
}
