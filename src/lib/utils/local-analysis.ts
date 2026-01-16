/**
 * Local Analysis Storage Utility
 *
 * Provides functions for saving and loading analysis results locally.
 * Used by the CLI to store reports that can be viewed in the React SPA.
 *
 * Storage location: ~/.nomoreaislop/reports/{id}.json
 *
 * @module utils/local-analysis
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { UnifiedReport } from '../models/unified-report';
import type { VerboseEvaluation } from '../models/verbose-evaluation';

/** Analysis type identifier */
export type AnalysisType = 'verbose' | 'unified';

/** Information about a single analyzed session */
export interface SessionFileInfo {
  fileName: string;
  sessionId: string;
  projectName: string;
  startTime: string;
  messageCount: number;
  durationMinutes: number;
}

/** Metadata associated with an analysis */
export interface AnalysisMetadata {
  sessionCount?: number;
  projectPath?: string;
  version?: string;
  /** List of session files that were analyzed */
  sessionFiles?: SessionFileInfo[];
}

/**
 * Local analysis data structure
 */
export interface LocalAnalysis {
  /** Unique identifier for the analysis */
  id: string;
  /** Type of analysis */
  type: AnalysisType;
  /** When the analysis was created */
  createdAt: string;
  /** When the analysis expires (optional) */
  expiresAt?: string;
  /** The analysis data */
  data: VerboseEvaluation | UnifiedReport;
  /** Optional metadata */
  metadata?: AnalysisMetadata;
}

/** Summary of an analysis (without full data) */
export interface AnalysisSummary {
  id: string;
  type: AnalysisType;
  createdAt: string;
  expiresAt?: string;
  metadata?: AnalysisMetadata;
}

/**
 * Configuration for local storage
 */
const CONFIG = {
  /** Base directory for storage */
  baseDir: path.join(os.homedir(), '.nomoreaislop'),
  /** Reports subdirectory */
  reportsDir: 'reports',
  /** Default expiration in days (0 = never expires) */
  defaultExpirationDays: 30,
  /** Maximum number of stored reports */
  maxReports: 100,
} as const;

/** Lazily computed reports directory path */
function getReportsPath(): string {
  return path.join(CONFIG.baseDir, CONFIG.reportsDir);
}

/**
 * Ensure the reports directory exists
 */
async function ensureReportsDir(): Promise<string> {
  const reportsPath = getReportsPath();
  await fs.mkdir(reportsPath, { recursive: true });
  return reportsPath;
}

/**
 * Check if an analysis has expired
 */
function isExpired(analysis: LocalAnalysis): boolean {
  if (!analysis.expiresAt) return false;
  return new Date(analysis.expiresAt) < new Date();
}

/**
 * Generate a unique ID for an analysis
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * Calculate expiration date
 */
function calculateExpiration(days: number): string | undefined {
  if (days <= 0) return undefined;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Save an analysis result locally.
 *
 * @param data - The analysis data (VerboseEvaluation or UnifiedReport)
 * @param options - Save options
 * @returns The generated analysis ID
 *
 * @example
 * ```ts
 * const analysisId = await saveAnalysisLocally(verboseResult, {
 *   type: 'verbose',
 *   metadata: { sessionCount: 5 }
 * });
 * // Open in browser: http://localhost:5173/analysis?local={analysisId}
 * ```
 */
export async function saveAnalysisLocally(
  data: VerboseEvaluation | UnifiedReport,
  options: {
    type?: AnalysisType;
    expirationDays?: number;
    metadata?: AnalysisMetadata;
  } = {}
): Promise<string> {
  const {
    type = 'verbose',
    expirationDays = CONFIG.defaultExpirationDays,
    metadata,
  } = options;

  const reportsDir = await ensureReportsDir();
  const id = generateId();

  const analysis: LocalAnalysis = {
    id,
    type,
    createdAt: new Date().toISOString(),
    expiresAt: calculateExpiration(expirationDays),
    data,
    metadata,
  };

  const filePath = path.join(reportsDir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf-8');

  // Cleanup old reports if over limit
  await cleanupOldReports();

  return id;
}

/**
 * Load an analysis result from local storage.
 *
 * @param id - The analysis ID
 * @returns The analysis data or null if not found/expired
 *
 * @example
 * ```ts
 * const analysis = await loadAnalysisLocally('abc123');
 * if (analysis) {
 *   console.log(analysis.data);
 * }
 * ```
 */
export async function loadAnalysisLocally(id: string): Promise<LocalAnalysis | null> {
  try {
    const filePath = getAnalysisPath(id);
    const content = await fs.readFile(filePath, 'utf-8');
    const analysis: LocalAnalysis = JSON.parse(content);

    if (isExpired(analysis)) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }

    return analysis;
  } catch {
    return null;
  }
}

/**
 * Delete an analysis from local storage.
 *
 * @param id - The analysis ID
 * @returns true if deleted, false if not found
 */
export async function deleteAnalysisLocally(id: string): Promise<boolean> {
  try {
    await fs.unlink(getAnalysisPath(id));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract summary from a full analysis
 */
function toSummary(analysis: LocalAnalysis): AnalysisSummary {
  return {
    id: analysis.id,
    type: analysis.type,
    createdAt: analysis.createdAt,
    expiresAt: analysis.expiresAt,
    metadata: analysis.metadata,
  };
}

/**
 * List all local analyses.
 *
 * @param options - List options
 * @returns Array of analysis summaries (without full data)
 */
export async function listLocalAnalyses(
  options: {
    includeExpired?: boolean;
    limit?: number;
  } = {}
): Promise<AnalysisSummary[]> {
  const { includeExpired = false, limit = 50 } = options;

  try {
    const reportsDir = await ensureReportsDir();
    const files = await fs.readdir(reportsDir);
    const analyses: AnalysisSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(reportsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const analysis: LocalAnalysis = JSON.parse(content);

        if (!includeExpired && isExpired(analysis)) {
          continue;
        }

        analyses.push(toSummary(analysis));

        if (analyses.length >= limit) break;
      } catch {
        // Skip invalid files
      }
    }

    // Sort by creation date (newest first)
    analyses.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return analyses;
  } catch {
    return [];
  }
}

/** File info for cleanup operations */
interface FileInfo {
  name: string;
  mtime: Date;
  expired: boolean;
}

/**
 * Read file info for cleanup purposes
 */
async function readFileInfo(reportsDir: string, file: string): Promise<FileInfo | null> {
  try {
    const filePath = path.join(reportsDir, file);
    const [stat, content] = await Promise.all([
      fs.stat(filePath),
      fs.readFile(filePath, 'utf-8'),
    ]);
    const analysis: LocalAnalysis = JSON.parse(content);

    return {
      name: file,
      mtime: stat.mtime,
      expired: isExpired(analysis),
    };
  } catch {
    return null;
  }
}

/**
 * Cleanup old/expired reports to stay under limit
 */
async function cleanupOldReports(): Promise<void> {
  try {
    const reportsDir = await ensureReportsDir();
    const files = await fs.readdir(reportsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const fileInfos = await Promise.all(
      jsonFiles.map((file) => readFileInfo(reportsDir, file))
    );
    const validFiles = fileInfos.filter((f): f is FileInfo => f !== null);

    // Delete expired files
    const expiredFiles = validFiles.filter((f) => f.expired);
    await Promise.all(
      expiredFiles.map((file) =>
        fs.unlink(path.join(reportsDir, file.name)).catch(() => {})
      )
    );

    // If still over limit, delete oldest files
    const remaining = validFiles.filter((f) => !f.expired);
    if (remaining.length > CONFIG.maxReports) {
      remaining.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
      const toDelete = remaining.slice(0, remaining.length - CONFIG.maxReports);

      await Promise.all(
        toDelete.map((file) =>
          fs.unlink(path.join(reportsDir, file.name)).catch(() => {})
        )
      );
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get the full path to a local analysis file
 */
export function getAnalysisPath(id: string): string {
  return path.join(getReportsPath(), `${id}.json`);
}

/**
 * Check if an analysis exists locally
 */
export async function analysisExists(id: string): Promise<boolean> {
  try {
    const filePath = getAnalysisPath(id);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
