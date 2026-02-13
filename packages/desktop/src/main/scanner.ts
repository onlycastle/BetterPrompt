/**
 * Session Scanner
 *
 * Scans ~/.claude/projects/ for Claude Code session logs,
 * parses JSONL into structured sessions, and prepares for analysis.
 *
 * Auto-selection algorithm combines three factors:
 * 1. Recency (recent sessions show current patterns)
 * 2. Token count (more content = richer analysis)
 * 3. Project diversity (different projects = broader picture)
 *
 * Based on CLI package implementation, adapted for Electron (CJS).
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parseSessionContent, type ParsedSession } from './session-formatter';

export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Gemini 3 Flash pricing (per token)
 */
const GEMINI_INPUT_PRICE = 0.5 / 1_000_000; // $0.50 per 1M tokens

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
  tokenCount: number;  // Estimated raw token count from content
}

/**
 * Session with parsed content ready for analysis
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
 * Summary of auto-selected sessions for UI display
 */
export interface ScanSummary {
  sessionCount: number;
  projectCount: number;
  totalTokens: number;
  totalMessages: number;
  estimatedCost: string;
  dateRange: {
    oldest: string;
    newest: string;
  };
  /** File paths for analysis */
  sessionPaths: string[];
}

/**
 * Decode project path from Claude's encoding.
 * Handles both Unix and Windows formats.
 */
function decodeProjectPath(encoded: string): string {
  // Windows: 'C--alphacut' → 'C:/alphacut'
  if (/^[A-Za-z]--/.test(encoded)) {
    const driveLetter = encoded[0];
    const rest = encoded.slice(3);
    if (!rest) return `${driveLetter}:/`;
    return `${driveLetter}:/${rest.replace(/-/g, '/')}`;
  }

  // Unix: '-Users-dev-app' → '/Users/dev/app'
  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }

  return encoded;
}

/**
 * Get project name from path (supports both Unix and Windows paths)
 */
function getProjectName(projectPath: string): string {
  const parts = projectPath.split(/[/\\]/).filter(Boolean);
  // Filter out drive letter (e.g. 'C:')
  const filtered = parts.filter(p => !/^[A-Za-z]:$/.test(p));
  return filtered[filtered.length - 1] || 'unknown';
}

/**
 * Extract project info from a session file path
 * Returns decoded project path and project name
 *
 * Note: Desktop app uses simple decode+split for now.
 * The CLI's resolveProjectName() provides more accurate names
 * via filesystem probing but requires sync fs access.
 */
function getProjectInfoFromPath(filePath: string): { projectPath: string; projectName: string } {
  const projectDirName = basename(join(filePath, '..'));
  const projectPath = decodeProjectPath(projectDirName);
  const projectName = getProjectName(projectPath);
  return { projectPath, projectName };
}

/**
 * Estimate token count from raw text content
 * Uses ~4 chars per token heuristic with adjustments
 */
function estimateTokenCount(content: string): number {
  if (!content) return 0;

  let baseCount = content.length / 4;

  // Code blocks are token-heavy
  const codeBlockMatches = content.match(/```[\s\S]*?```/g);
  if (codeBlockMatches) baseCount += codeBlockMatches.length * 50;

  // JSON structure overhead
  const jsonBraceMatches = content.match(/[{}[\]]/g);
  if (jsonBraceMatches) baseCount += jsonBraceMatches.length * 0.5;

  return Math.ceil(baseCount);
}

/**
 * Format estimated cost for display
 */
function formatEstimatedCost(tokenCount: number): string {
  const cost = tokenCount * GEMINI_INPUT_PRICE;
  return `$${cost.toFixed(4)}`;
}

/**
 * Auto-select optimal sessions combining:
 * 1. Recency (recent sessions)
 * 2. Token count (content-rich sessions)
 * 3. Project diversity (different projects)
 */
function autoSelectSessions(
  sessions: SessionMetadata[],
  targetCount: number = 15
): SessionMetadata[] {
  if (sessions.length <= targetCount) {
    return [...sessions];
  }

  // Group by project
  const byProject = new Map<string, SessionMetadata[]>();
  for (const session of sessions) {
    const key = session.projectPath;
    if (!byProject.has(key)) {
      byProject.set(key, []);
    }
    byProject.get(key)!.push(session);
  }

  // Sort each project's sessions by combined score (tokens + recency)
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  for (const projectSessions of byProject.values()) {
    projectSessions.sort((a, b) => {
      // Recency score: 0-1 (1 = today, 0 = 30+ days old)
      const recencyA = Math.max(0, 1 - (now - a.timestamp.getTime()) / maxAge);
      const recencyB = Math.max(0, 1 - (now - b.timestamp.getTime()) / maxAge);

      // Token score: normalize by max tokens in dataset
      const maxTokens = Math.max(...projectSessions.map((s) => s.tokenCount));
      const tokenScoreA = maxTokens > 0 ? a.tokenCount / maxTokens : 0;
      const tokenScoreB = maxTokens > 0 ? b.tokenCount / maxTokens : 0;

      // Combined score: 40% recency, 60% token count
      const scoreA = recencyA * 0.4 + tokenScoreA * 0.6;
      const scoreB = recencyB * 0.4 + tokenScoreB * 0.6;

      return scoreB - scoreA;
    });
  }

  const selected: SessionMetadata[] = [];
  const selectedIds = new Set<string>();

  // Phase 1: Pick best session from each project (diversity)
  // Sort projects by their best session's score
  const sortedProjects = Array.from(byProject.entries()).sort(([, a], [, b]) => {
    return b[0].tokenCount - a[0].tokenCount;
  });

  for (const [, projectSessions] of sortedProjects) {
    if (selected.length >= targetCount) break;
    const best = projectSessions[0];
    selected.push(best);
    selectedIds.add(best.sessionId);
  }

  // Phase 2: Fill remaining slots with highest token sessions
  if (selected.length < targetCount) {
    const remaining = sessions
      .filter((s) => !selectedIds.has(s.sessionId))
      .sort((a, b) => b.tokenCount - a.tokenCount);

    for (const session of remaining) {
      if (selected.length >= targetCount) break;
      selected.push(session);
    }
  }

  return selected;
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
 * Check if a line is a conversation message
 */
function isConversationLine(parsed: { type: string } | null): boolean {
  return parsed !== null && (parsed.type === 'user' || parsed.type === 'assistant');
}

/**
 * Update timestamp bounds with a new timestamp
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
 * Get metadata for a session file (quick scan without full parsing)
 */
async function getSessionMetadata(filePath: string): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

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

    const { projectPath, projectName } = getProjectInfoFromPath(filePath);
    const durationSeconds = Math.floor(
      (timestamps.last.getTime() - timestamps.first.getTime()) / 1000
    );

    // Estimate token count from raw content
    const tokenCount = estimateTokenCount(content);

    return {
      sessionId: fileName,
      projectPath,
      projectName,
      timestamp: timestamps.first,
      messageCount,
      durationSeconds,
      filePath,
      tokenCount,
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
    return files.filter((f) => f.endsWith('.jsonl')).map((f) => join(projectDir, f));
  } catch {
    return [];
  }
}

/**
 * Auto-select optimal sessions and return summary for UI
 *
 * Selection criteria:
 * - At least 5 messages
 * - At least 60 seconds duration
 * - Combines recency, token count, and project diversity
 */
export async function scanAndSelectSessions(targetCount: number = 15): Promise<ScanSummary> {
  console.log('[Scanner] Starting scan, target:', targetCount);
  console.log('[Scanner] Projects dir:', CLAUDE_PROJECTS_DIR);

  const projectDirs = await listProjectDirs();
  console.log('[Scanner] Found', projectDirs.length, 'project directories');

  const allMetadata: SessionMetadata[] = [];

  for (const dir of projectDirs) {
    const files = await listSessionFiles(dir);
    let validCount = 0;
    for (const file of files) {
      const metadata = await getSessionMetadata(file);
      // Filter: at least 5 messages AND at least 60 seconds duration
      if (metadata && metadata.messageCount >= 5 && metadata.durationSeconds >= 60) {
        allMetadata.push(metadata);
        validCount++;
      }
    }
    if (validCount > 0) {
      console.log('[Scanner]', basename(dir), ':', validCount, 'valid sessions');
    }
  }

  console.log('[Scanner] Total valid sessions:', allMetadata.length);

  if (allMetadata.length === 0) {
    return {
      sessionCount: 0,
      projectCount: 0,
      totalTokens: 0,
      totalMessages: 0,
      estimatedCost: '$0.0000',
      dateRange: { oldest: '', newest: '' },
      sessionPaths: [],
    };
  }

  // Sort by timestamp, most recent first (for recency scoring)
  allMetadata.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Take top 50 most recent sessions as candidates
  const candidates = allMetadata.slice(0, 50);

  // Auto-select optimal sessions
  const selected = autoSelectSessions(candidates, targetCount);

  // Calculate summary stats
  const projects = new Set(selected.map((s) => s.projectPath));
  const totalTokens = selected.reduce((sum, s) => sum + s.tokenCount, 0);
  const totalMessages = selected.reduce((sum, s) => sum + s.messageCount, 0);

  // Date range
  const timestamps = selected.map((s) => s.timestamp.getTime());
  const oldest = new Date(Math.min(...timestamps));
  const newest = new Date(Math.max(...timestamps));

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const summary = {
    sessionCount: selected.length,
    projectCount: projects.size,
    totalTokens,
    totalMessages,
    estimatedCost: formatEstimatedCost(totalTokens),
    dateRange: {
      oldest: formatDate(oldest),
      newest: formatDate(newest),
    },
    sessionPaths: selected.map((s) => s.filePath),
  };

  console.log('[Scanner] Final selection:', summary.sessionCount, 'sessions from', summary.projectCount, 'projects');
  return summary;
}

/**
 * Load full session data for selected session paths
 */
export async function loadSessionsForAnalysis(
  sessionPaths: string[]
): Promise<ScanResult> {
  const sessions: SessionWithParsed[] = [];
  let totalMessages = 0;
  let totalDurationMinutes = 0;

  for (const filePath of sessionPaths) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const fileName = basename(filePath, '.jsonl');
      const { projectPath, projectName } = getProjectInfoFromPath(filePath);

      const parsed = parseSessionContent(fileName, projectPath, projectName, content);

      if (parsed) {
        const metadata: SessionMetadata = {
          sessionId: fileName,
          projectPath,
          projectName,
          timestamp: parsed.startTime,
          messageCount: parsed.stats.userMessageCount + parsed.stats.assistantMessageCount,
          durationSeconds: parsed.durationSeconds,
          filePath,
          tokenCount: estimateTokenCount(content),
        };

        sessions.push({ metadata, parsed });
        totalMessages += metadata.messageCount;
        totalDurationMinutes += Math.round(parsed.durationSeconds / 60);
      }
    } catch {
      // Skip unreadable files
    }
  }

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
