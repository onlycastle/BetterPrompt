/**
 * Activity Scanner
 *
 * Deterministic scanner that reads ALL recent sessions and extracts
 * lightweight activity metadata. Used to populate the Activity tab
 * with a complete view of the developer's coding activity.
 *
 * Unlike the main scanner which selects top-50 sessions for deep analysis,
 * this scans every session file from the last 30 days and extracts:
 * - Session metadata (id, project, timestamps, message count)
 * - First user message as a summary (truncated to 80 chars)
 *
 * No LLM calls — purely deterministic file reading.
 *
 * @module activity-scanner
 */

import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { multiSourceScanner, type FileMetadata } from './lib/scanner/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ActivitySessionInfo {
  sessionId: string;
  projectName: string;
  startTime: string;       // ISO 8601
  durationMinutes: number;
  messageCount: number;
  summary: string;         // first user message, truncated to 80 chars
  totalInputTokens?: number;   // Sum of input_tokens from assistant messages
  totalOutputTokens?: number;  // Sum of output_tokens from assistant messages
}

// ============================================================================
// Constants
// ============================================================================

const DEBUG = process.env.NOSLOP_DEBUG === '1';
function debugLog(...args: unknown[]) {
  if (DEBUG) console.error('[DEBUG:activity-scanner]', ...args);
}

const DEFAULT_RECENCY_DAYS = 30;
const MAX_SUMMARY_LENGTH = 80;
const SYSTEM_REMINDER_REGEX = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Decode project path from Claude's encoding (replaces '-' with '/')
 */
function decodeProjectPath(encoded: string): string {
  if (encoded.startsWith('-')) {
    return encoded.replace(/-/g, '/');
  }
  return encoded;
}

/**
 * Get project name from decoded path (last segment)
 */
function getProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

/**
 * Strip system-reminder tags from text
 */
export function stripSystemReminders(text: string): string {
  return text.replace(SYSTEM_REMINDER_REGEX, '').trim();
}

/**
 * Truncate text to maxLength at word boundary.
 * If the text is shorter than maxLength, returns it as-is.
 * Otherwise, finds the last space before maxLength and truncates there with "..."
 */
export function truncateAtWordBoundary(text: string, maxLength: number = MAX_SUMMARY_LENGTH): string {
  // Normalize whitespace first
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  // Find last space before maxLength (leave room for "...")
  const cutoff = maxLength - 3;
  const lastSpace = normalized.lastIndexOf(' ', cutoff);

  if (lastSpace > 0) {
    return normalized.slice(0, lastSpace) + '...';
  }

  // No space found — hard truncate
  return normalized.slice(0, cutoff) + '...';
}

/**
 * Extract the first user message text from JSONL content.
 * Parses line by line to find the first "type": "user" entry.
 */
function extractFirstUserMessage(content: string): string | null {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type !== 'user') continue;

      // Extract text from message content
      const message = parsed.message;
      if (!message) continue;

      if (typeof message.content === 'string') {
        return message.content;
      }

      // Content blocks array
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text' && block.text) {
            return block.text;
          }
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return null;
}

/**
 * Extract session metadata from JSONL content.
 * Returns timestamps and message count without parsing full content.
 */
function extractSessionMetadata(content: string): {
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
} {
  const result = {
    firstTimestamp: null as Date | null,
    lastTimestamp: null as Date | null,
    messageCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  const lines = content.split('\n');
  const seenMessageIds = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;

      // Deduplicate by message.id — Claude Code writes multiple JSONL lines
      // for the same assistant turn (one per tool call), each with identical usage.
      // Skip already-seen message IDs to avoid inflating token counts.
      const msgId = parsed.message?.id;
      if (msgId) {
        if (seenMessageIds.has(msgId)) continue;
        seenMessageIds.add(msgId);
      }

      result.messageCount++;

      if (parsed.timestamp) {
        const ts = new Date(parsed.timestamp);
        if (!result.firstTimestamp || ts < result.firstTimestamp) {
          result.firstTimestamp = ts;
        }
        if (!result.lastTimestamp || ts > result.lastTimestamp) {
          result.lastTimestamp = ts;
        }
      }

      // Extract token usage from assistant messages
      if (parsed.type === 'assistant' && parsed.message?.usage) {
        const usage = parsed.message.usage;
        result.totalInputTokens += (usage.input_tokens || 0)
          + (usage.cache_creation_input_tokens || 0)
          + (usage.cache_read_input_tokens || 0);
        result.totalOutputTokens += usage.output_tokens || 0;
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return result;
}

// ============================================================================
// Main Scanner
// ============================================================================

/**
 * Scan all recent sessions and extract activity metadata.
 *
 * Reads every session file from the last `recencyDays` days and extracts
 * lightweight metadata including a summary from each session's first user message.
 *
 * @param recencyDays - Number of days to look back (default: 30)
 * @returns ActivitySessionInfo[] sorted by startTime descending (newest first)
 */
export async function scanActivitySessions(
  recencyDays: number = DEFAULT_RECENCY_DAYS,
  includeSources?: string[],
): Promise<ActivitySessionInfo[]> {
  // Phase 1: Collect all file metadata (same as main scanner)
  const { files } = await multiSourceScanner.collectAllFileMetadata({
    minFileSize: 1024,        // 1KB minimum (more lenient than main scanner)
    maxFileSize: 50 * 1024 * 1024, // 50MB max
    includeSources,
  });
  debugLog(`Phase 1: collected ${files.length} total session files`);

  // Phase 2: Filter by recency
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - recencyDays);

  const recentFiles = files.filter(f => f.mtime >= cutoffDate);
  debugLog(`Phase 2: ${recentFiles.length} files within ${recencyDays}-day recency window (cutoff: ${cutoffDate.toISOString()})`);

  // Phase 3: Read each file and extract activity metadata
  const results: ActivitySessionInfo[] = [];
  let nullCount = 0;

  for (const file of recentFiles) {
    try {
      const info = await extractActivityInfo(file);
      if (info) {
        results.push(info);
      } else {
        nullCount++;
      }
    } catch {
      nullCount++;
    }
  }
  debugLog(`Phase 3: parsed ${results.length} sessions successfully, ${nullCount} skipped (null or error)`);

  // Sort by startTime descending (newest first)
  results.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const oldest = results.length > 0 ? results[results.length - 1].startTime : 'N/A';
  const newest = results.length > 0 ? results[0].startTime : 'N/A';
  debugLog(`Result: ${results.length} activity sessions, date range: ${oldest} → ${newest}`);

  return results;
}

/**
 * Extract activity info from a single session file.
 */
async function extractActivityInfo(file: FileMetadata): Promise<ActivitySessionInfo | null> {
  if (file.source === 'cursor') {
    // Cursor sessions: parse from SQLite
    return extractCursorActivityInfo(file);
  }

  // Claude Code sessions: read JSONL
  return extractClaudeCodeActivityInfo(file);
}

/**
 * Extract activity info from a Claude Code JSONL file.
 */
async function extractClaudeCodeActivityInfo(file: FileMetadata): Promise<ActivitySessionInfo | null> {
  const content = await readFile(file.filePath, 'utf-8');

  // Extract metadata
  const meta = extractSessionMetadata(content);
  if (!meta.firstTimestamp || meta.messageCount < 1) {
    return null;
  }

  // Extract first user message for summary
  const firstUserMessage = extractFirstUserMessage(content);
  let summary = '';
  if (firstUserMessage) {
    const cleaned = stripSystemReminders(firstUserMessage);
    summary = truncateAtWordBoundary(cleaned);
  }

  // Compute fields
  const sessionId = basename(file.filePath, '.jsonl');
  const projectDirName = basename(join(file.filePath, '..'));
  const projectPath = decodeProjectPath(projectDirName);
  const projectName = getProjectName(projectPath);

  const durationMs = meta.lastTimestamp
    ? meta.lastTimestamp.getTime() - meta.firstTimestamp.getTime()
    : 0;

  return {
    sessionId,
    projectName,
    startTime: meta.firstTimestamp.toISOString(),
    durationMinutes: Math.round(durationMs / 60000),
    messageCount: meta.messageCount,
    summary,
    totalInputTokens: meta.totalInputTokens || undefined,
    totalOutputTokens: meta.totalOutputTokens || undefined,
  };
}

/**
 * Extract activity info from a Cursor SQLite session file.
 */
async function extractCursorActivityInfo(file: FileMetadata): Promise<ActivitySessionInfo | null> {
  try {
    const parsed = await multiSourceScanner.parseSession({
      sessionId: basename(file.filePath, '.db'),
      projectPath: decodeProjectPath(file.projectDirName),
      projectName: getProjectName(decodeProjectPath(file.projectDirName)),
      timestamp: file.mtime,
      messageCount: 0,
      durationSeconds: 0,
      filePath: file.filePath,
      source: 'cursor',
    });

    if (!parsed || parsed.messages.length < 1) {
      return null;
    }

    // Sum token usage from assistant messages
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const msg of parsed.messages) {
      if (msg.tokenUsage) {
        totalInputTokens += msg.tokenUsage.input || 0;
        totalOutputTokens += msg.tokenUsage.output || 0;
      }
    }

    // Find first user message
    let summary = '';
    const firstUserMsg = parsed.messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      const text = typeof firstUserMsg.content === 'string'
        ? firstUserMsg.content
        : (firstUserMsg.content as Array<{ type: string; text?: string }>)
            .filter(b => b.type === 'text' && b.text)
            .map(b => b.text!)
            .join(' ');

      const cleaned = stripSystemReminders(text);
      summary = truncateAtWordBoundary(cleaned);
    }

    return {
      sessionId: parsed.sessionId,
      projectName: getProjectName(parsed.projectPath),
      startTime: parsed.startTime.toISOString(),
      durationMinutes: Math.round(parsed.durationSeconds / 60),
      messageCount: parsed.messages.length,
      summary,
      totalInputTokens: totalInputTokens || undefined,
      totalOutputTokens: totalOutputTokens || undefined,
    };
  } catch {
    return null;
  }
}
