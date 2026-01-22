/**
 * Session Scanner
 *
 * Scans ~/.claude/projects/ for Claude Code session logs,
 * parses JSONL into structured sessions, and prepares for analysis.
 *
 * Memory-efficient 4-phase implementation:
 * - Phase 1: Collect file metadata (size, mtime) using fs.stat only
 * - Phase 2: Pre-filter to top ~100 candidates based on size + recency heuristics
 * - Phase 3: Full quality scoring only on candidates
 * - Phase 4: Parse only the final selected sessions
 *
 * This reduces memory usage from potentially GBs to ~100MB
 * when users have thousands of session files.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parseSessionContent, type ParsedSession } from './session-formatter.js';
import { extractQualityMetrics, calculateQualityScore } from './session-scoring.js';

export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Pre-filtering thresholds for candidate selection
 */
const PREFILTER_CONFIG = {
  // Files smaller than this are likely too short to be meaningful
  MIN_FILE_SIZE: 10 * 1024, // 10KB
  // Files larger than this are suspicious or would dominate memory
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  // How many candidates to fully read for quality scoring
  MAX_CANDIDATES: 100,
  // Weight for size score vs recency score in pre-filtering
  SIZE_WEIGHT: 0.3,
  RECENCY_WEIGHT: 0.7,
  // Ideal file size range for size scoring (100KB - 5MB)
  IDEAL_SIZE_MIN: 100 * 1024,
  IDEAL_SIZE_MAX: 5 * 1024 * 1024,
};

/**
 * Selection configuration for diversity-aware session selection
 */
const SELECTION_CONFIG = {
  // Time distribution
  RECENCY_WINDOW_DAYS: 14, // 2-week window
  TIME_BUCKETS: 4, // Divide into 4 buckets (3.5 days each)

  // Project diversity
  MIN_PROJECTS: 3, // Target minimum 3 projects
  MAX_PER_PROJECT: 10, // Maximum sessions per project (for 30 total)

  // Quality thresholds
  MIN_MESSAGE_COUNT: 5, // Minimum messages to consider

  // Final selection
  MAX_SESSIONS: 30, // Default max sessions
};

/**
 * Lightweight file metadata for pre-filtering (no content read)
 */
interface FileMetadata {
  filePath: string;
  fileSize: number;
  mtime: Date;
  projectDirName: string;
}

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
 * Phase 1: Collect lightweight file metadata (no content read)
 * Only uses fs.stat, so memory usage is minimal.
 */
async function collectFileMetadata(): Promise<FileMetadata[]> {
  const projectDirs = await listProjectDirs();
  const allFiles: FileMetadata[] = [];

  for (const dir of projectDirs) {
    const files = await listSessionFiles(dir);
    for (const file of files) {
      try {
        const stats = await stat(file);
        if (stats.isFile()) {
          allFiles.push({
            filePath: file,
            fileSize: stats.size,
            mtime: stats.mtime,
            projectDirName: basename(dir),
          });
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  return allFiles;
}

/**
 * Calculate pre-filter score based on file size and recency.
 * This is a heuristic to select likely-good candidates without reading content.
 */
function calculatePrefilterScore(file: FileMetadata, newestMtime: number, oldestMtime: number): number {
  // Size score: files in the "ideal" range get higher scores
  let sizeScore: number;
  if (file.fileSize < PREFILTER_CONFIG.IDEAL_SIZE_MIN) {
    // Small files: linear scale from 0 to 50
    sizeScore = (file.fileSize / PREFILTER_CONFIG.IDEAL_SIZE_MIN) * 50;
  } else if (file.fileSize <= PREFILTER_CONFIG.IDEAL_SIZE_MAX) {
    // Ideal range: full score
    sizeScore = 100;
  } else {
    // Large files: gradually decrease score
    const overSize = file.fileSize - PREFILTER_CONFIG.IDEAL_SIZE_MAX;
    const maxOverSize = PREFILTER_CONFIG.MAX_FILE_SIZE - PREFILTER_CONFIG.IDEAL_SIZE_MAX;
    sizeScore = Math.max(30, 100 - (overSize / maxOverSize) * 70);
  }

  // Recency score: linear scale based on mtime
  const mtimeRange = newestMtime - oldestMtime;
  const recencyScore = mtimeRange > 0
    ? ((file.mtime.getTime() - oldestMtime) / mtimeRange) * 100
    : 100;

  // Weighted combination
  return sizeScore * PREFILTER_CONFIG.SIZE_WEIGHT + recencyScore * PREFILTER_CONFIG.RECENCY_WEIGHT;
}

/**
 * Phase 2: Pre-filter files to top candidates based on size + recency heuristics.
 * This dramatically reduces the number of files we need to fully read.
 */
function prefilterCandidates(allFiles: FileMetadata[]): FileMetadata[] {
  // Filter out files that are too small or too large
  const validFiles = allFiles.filter(
    f => f.fileSize >= PREFILTER_CONFIG.MIN_FILE_SIZE &&
         f.fileSize <= PREFILTER_CONFIG.MAX_FILE_SIZE
  );

  if (validFiles.length === 0) return [];

  // Calculate time range for recency scoring
  const mtimes = validFiles.map(f => f.mtime.getTime());
  const newestMtime = Math.max(...mtimes);
  const oldestMtime = Math.min(...mtimes);

  // Score and sort candidates
  const scored = validFiles.map(file => ({
    file,
    score: calculatePrefilterScore(file, newestMtime, oldestMtime),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Return top candidates
  return scored
    .slice(0, PREFILTER_CONFIG.MAX_CANDIDATES)
    .map(s => s.file);
}

/**
 * Phase 3: Full quality scoring on candidates.
 * Reads file content but only for pre-filtered candidates.
 */
async function scoreCandidates(
  candidates: FileMetadata[]
): Promise<Array<{ metadata: SessionMetadata; content: string }>> {
  const results: Array<{ metadata: SessionMetadata; content: string }> = [];

  for (const file of candidates) {
    try {
      const content = await readFile(file.filePath, 'utf-8');
      const metadata = extractMetadataFromContent(file.filePath, content);

      if (metadata && metadata.messageCount >= 5) {
        // Calculate quality score
        const qualityMetrics = extractQualityMetrics(content);
        metadata.qualityScore = calculateQualityScore(qualityMetrics);
        results.push({ metadata, content });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

/**
 * Scored session for diversity selection
 */
interface ScoredSession {
  metadata: SessionMetadata;
  content: string;
}

/**
 * Distribute sessions across time buckets for temporal diversity.
 * Divides the recency window into equal buckets and selects from each.
 */
function distributeByTimeBuckets(
  sessions: ScoredSession[],
  maxSessions: number
): ScoredSession[] {
  const now = Date.now();
  const cutoffMs = SELECTION_CONFIG.RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = now - cutoffMs;

  // Filter to recent sessions only
  const recentSessions = sessions.filter(
    s => s.metadata.timestamp.getTime() >= cutoffDate
  );

  // If not enough recent sessions, include all
  if (recentSessions.length <= maxSessions) {
    // Sort by quality within each bucket, but return all
    recentSessions.sort((a, b) =>
      (b.metadata.qualityScore ?? 0) - (a.metadata.qualityScore ?? 0)
    );
    return recentSessions;
  }

  // Create time buckets
  const bucketSizeMs = cutoffMs / SELECTION_CONFIG.TIME_BUCKETS;
  const buckets: ScoredSession[][] = Array.from(
    { length: SELECTION_CONFIG.TIME_BUCKETS },
    () => []
  );

  for (const session of recentSessions) {
    const ageMs = now - session.metadata.timestamp.getTime();
    const bucketIndex = Math.min(
      Math.floor(ageMs / bucketSizeMs),
      SELECTION_CONFIG.TIME_BUCKETS - 1
    );
    buckets[bucketIndex].push(session);
  }

  // Sort each bucket by quality score
  for (const bucket of buckets) {
    bucket.sort((a, b) =>
      (b.metadata.qualityScore ?? 0) - (a.metadata.qualityScore ?? 0)
    );
  }

  // Select from each bucket proportionally
  const perBucket = Math.ceil(maxSessions / SELECTION_CONFIG.TIME_BUCKETS);
  const selected: ScoredSession[] = [];

  for (const bucket of buckets) {
    selected.push(...bucket.slice(0, perBucket));
  }

  return selected.slice(0, maxSessions);
}

/**
 * Distribute sessions across projects using round-robin selection.
 * Ensures diversity across different codebases.
 */
function distributeByProjects(
  sessions: ScoredSession[],
  maxSessions: number
): ScoredSession[] {
  // Group by project
  const byProject = new Map<string, ScoredSession[]>();

  for (const session of sessions) {
    const project = session.metadata.projectName;
    if (!byProject.has(project)) {
      byProject.set(project, []);
    }
    byProject.get(project)!.push(session);
  }

  // Sort each project's sessions by quality
  for (const projectSessions of byProject.values()) {
    projectSessions.sort((a, b) =>
      (b.metadata.qualityScore ?? 0) - (a.metadata.qualityScore ?? 0)
    );
  }

  // Round-robin selection across projects
  const selected: ScoredSession[] = [];
  const projects = Array.from(byProject.keys());
  let round = 0;

  while (selected.length < maxSessions) {
    let addedThisRound = false;

    for (const project of projects) {
      const projectSessions = byProject.get(project)!;
      if (
        round < projectSessions.length &&
        round < SELECTION_CONFIG.MAX_PER_PROJECT
      ) {
        selected.push(projectSessions[round]);
        addedThisRound = true;

        if (selected.length >= maxSessions) break;
      }
    }

    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

/**
 * Select optimal sessions using diversity-aware strategy.
 *
 * 1. Time bucket distribution (ensures temporal diversity)
 * 2. Project diversity (round-robin across projects)
 * 3. Final quality-based sorting
 */
function selectOptimalSessions(
  candidates: ScoredSession[],
  maxSessions: number
): ScoredSession[] {
  // Step 1: Time bucket distribution
  const timeDistributed = distributeByTimeBuckets(candidates, maxSessions * 2);

  // Step 2: Project diversity
  const projectDistributed = distributeByProjects(timeDistributed, maxSessions);

  // Step 3: Final sort by quality with recency as tiebreaker
  projectDistributed.sort((a, b) => {
    const qualityDiff =
      (b.metadata.qualityScore ?? 0) - (a.metadata.qualityScore ?? 0);
    // Use recency as tiebreaker only if scores are within 5 points
    if (Math.abs(qualityDiff) > 5) return qualityDiff;
    return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
  });

  return projectDistributed.slice(0, maxSessions);
}

/**
 * Scan all sessions and parse them for analysis.
 *
 * Uses a 4-phase memory-efficient approach:
 * 1. Collect lightweight file metadata (no content read)
 * 2. Pre-filter to top candidates based on size + recency
 * 3. Full quality scoring only on candidates
 * 4. Parse only the final selected sessions
 */
export async function scanSessions(maxSessions: number = 30): Promise<ScanResult> {
  // Phase 1: Collect file metadata (memory efficient - no content read)
  const allFiles = await collectFileMetadata();

  // Phase 2: Pre-filter to top candidates
  const candidates = prefilterCandidates(allFiles);

  if (candidates.length === 0) {
    return { sessions: [], totalMessages: 0, totalDurationMinutes: 0 };
  }

  // Phase 3: Full quality scoring on candidates only
  const scoredCandidates = await scoreCandidates(candidates);

  // Phase 3.5: Diversity-aware selection
  // Uses time bucket distribution + project diversity + quality sorting
  const selected = selectOptimalSessions(scoredCandidates, maxSessions);

  // Phase 4: Parse content for selected sessions
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
