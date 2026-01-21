/**
 * Session Scanner
 *
 * Scans ~/.claude/projects/ for Claude Code session logs,
 * parses JSONL into structured sessions, and prepares for analysis.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parseSessionContent, type ParsedSession } from './session-formatter.js';
import { extractQualityMetrics, calculateQualityScore } from './session-scoring.js';

export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
  qualityScore?: number;
}

/**
 * Scanned session with raw content (for initial scanning)
 */
export interface ScannedSession {
  metadata: SessionMetadata;
  content: string; // Raw JSONL content
}

/**
 * Parsed session ready for analysis
 */
export interface SessionWithParsed {
  metadata: SessionMetadata;
  parsed: ParsedSession;
}

export interface ScanResult {
  sessions: SessionWithParsed[];
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
 * Scan all sessions and parse them for analysis
 * Uses quality-based scoring to select the most meaningful sessions
 */
export async function scanSessions(maxSessions: number = 15): Promise<ScanResult> {
  const projectDirs = await listProjectDirs();
  const allMetadataWithContent: Array<{ metadata: SessionMetadata; content: string }> = [];

  // First pass: collect metadata and content for quality scoring
  for (const dir of projectDirs) {
    const files = await listSessionFiles(dir);
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        const metadata = extractMetadataFromContent(file, content);

        if (metadata && metadata.messageCount >= 5) {
          // Calculate quality score
          const qualityMetrics = extractQualityMetrics(content);
          metadata.qualityScore = calculateQualityScore(qualityMetrics);
          allMetadataWithContent.push({ metadata, content });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Sort by quality score (higher is better), then by recency as tiebreaker
  allMetadataWithContent.sort((a, b) => {
    const scoreDiff = (b.metadata.qualityScore ?? 0) - (a.metadata.qualityScore ?? 0);
    // Only use recency as tiebreaker if scores are within 5 points
    if (Math.abs(scoreDiff) > 5) return scoreDiff;
    return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
  });

  // Select top sessions
  const selected = allMetadataWithContent.slice(0, maxSessions);

  // Parse content for selected sessions
  const sessions: SessionWithParsed[] = [];
  let totalMessages = 0;
  let totalDurationMinutes = 0;

  for (const { metadata, content } of selected) {
    const parsed = parseSessionContent(
      metadata.sessionId,
      metadata.projectPath,
      metadata.projectName,
      content
    );

    if (parsed) {
      sessions.push({ metadata, parsed });
      totalMessages += metadata.messageCount;
      totalDurationMinutes += Math.round(metadata.durationSeconds / 60);
    }
  }

  return {
    sessions,
    totalMessages,
    totalDurationMinutes,
  };
}

/**
 * Extract metadata from already-read content (avoids double file read)
 */
function extractMetadataFromContent(filePath: string, content: string): SessionMetadata | null {
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
