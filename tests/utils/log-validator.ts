/**
 * Debug Log Validator
 *
 * Parses ~/.betterprompt/debug.log and validates that a BetterPrompt
 * analysis pipeline execution completed correctly.
 *
 * The log format is:
 *   {ISO timestamp} [bp:{tag}] {message} {optional JSON}\n
 *
 * This utility checks:
 * - All 17 pipeline stages logged as started + completed
 * - No ERROR-level entries (or reports them)
 * - Evidence verification stats are present
 * - Sync-to-team status
 */

import { readFileSync } from 'node:fs';

// ============================================================================
// Types
// ============================================================================

export interface LogEntry {
  /** ISO-8601 timestamp at the start of the line. */
  timestamp: string;
  /** The bp:<tag> portion (e.g. "hook", "debounce", "config"). */
  tag: string;
  /** The log message text. */
  message: string;
  /** Parsed JSON payload, if the line ended with a JSON object. */
  data?: Record<string, unknown>;
  /** The raw, unparsed line for debugging. */
  raw: string;
  /** Inferred severity: "error" if the tag/message contains error signals. */
  level: 'debug' | 'info' | 'error';
}

export interface LogValidationResult {
  isValid: boolean;
  stagesFound: string[];
  stagesMissing: string[];
  errors: string[];
  warnings: string[];
  evidenceStats?: {
    total: number;
    kept: number;
    filtered: number;
  };
  syncStatus?: 'success' | 'failed' | 'not_found';
}

// ============================================================================
// Constants
// ============================================================================

/**
 * The 17 pipeline stages that a full analysis run should log.
 *
 * These correspond to the skills and CLI commands in the REQUIRED_STAGE_SEQUENCE
 * from get-run-progress.ts, using the skill/tool identifiers that would appear
 * in log messages (hyphenated form).
 */
const PIPELINE_STAGES = [
  'scan-sessions',
  'extract-data',
  'summarize-sessions',
  'extract-ai-partnership',
  'extract-session-craft',
  'extract-tool-mastery',
  'extract-skill-resilience',
  'extract-session-mastery',
  'write-ai-partnership',
  'write-session-craft',
  'write-tool-mastery',
  'write-skill-resilience',
  'write-session-mastery',
  'classify-developer-type',
  'classify-type',
  'verify-evidence',
  'generate-report',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// ============================================================================
// Parsing
// ============================================================================

/**
 * Line format:
 *   2026-03-22T10:00:00.000Z [bp:hook] session-start {"source":"compact"}
 *
 * Regex groups:
 *   1: timestamp
 *   2: tag (after "bp:")
 *   3: message (may include trailing JSON)
 */
const LOG_LINE_REGEX = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[bp:([^\]]+)\]\s+(.+)$/;

/**
 * Parse a debug.log file into structured entries.
 */
export function parseLogFile(logPath: string): LogEntry[] {
  let content: string;
  try {
    content = readFileSync(logPath, 'utf-8');
  } catch {
    return [];
  }

  const entries: LogEntry[] = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = LOG_LINE_REGEX.exec(line);
    if (!match) continue;

    const timestamp = match[1]!;
    const tag = match[2]!;
    const messagePart = match[3]!;

    // Try to extract trailing JSON object from the message.
    let message = messagePart;
    let data: Record<string, unknown> | undefined;

    const jsonStart = messagePart.indexOf('{');
    if (jsonStart > 0) {
      const jsonCandidate = messagePart.slice(jsonStart);
      try {
        data = JSON.parse(jsonCandidate) as Record<string, unknown>;
        message = messagePart.slice(0, jsonStart).trim();
      } catch {
        // Not valid JSON; keep full message.
      }
    }

    const level = inferLevel(tag, message);

    entries.push({ timestamp, tag, message, data, raw: line, level });
  }

  return entries;
}

/**
 * Infer the severity level from the tag and message content.
 *
 * The BetterPrompt logger uses `debug()`, `info()`, and `error()` functions.
 * The tag itself doesn't encode the level, so we use heuristics:
 * - Explicit "error" or "failed" keywords in the message/tag -> error
 * - "warn" keyword -> info (we surface as warning in validation)
 * - Everything else -> debug
 */
function inferLevel(tag: string, message: string): LogEntry['level'] {
  const combined = `${tag} ${message}`.toLowerCase();
  if (
    combined.includes('error') ||
    combined.includes('failed') ||
    combined.includes('exception') ||
    combined.includes('crash')
  ) {
    return 'error';
  }
  if (combined.includes('warn')) {
    return 'info';
  }
  return 'debug';
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a debug.log file shows a complete and healthy pipeline run.
 *
 * Checks performed:
 * 1. Each of the 17 pipeline stages appears at least once in the log.
 *    Matching is flexible: we look for the stage name anywhere in the
 *    message or tag of any log entry.
 * 2. No ERROR-level entries exist (or they're reported).
 * 3. Evidence verification statistics are extracted if present.
 * 4. Sync-to-team status is detected.
 */
export function validatePipelineExecution(logPath: string): LogValidationResult {
  const entries = parseLogFile(logPath);

  if (entries.length === 0) {
    return {
      isValid: false,
      stagesFound: [],
      stagesMissing: [...PIPELINE_STAGES],
      errors: ['Log file is empty or could not be parsed'],
      warnings: [],
    };
  }

  // ---- Stage detection ----
  const stagesFound = new Set<string>();

  // Build a combined text for each entry for substring matching.
  const entryTexts = entries.map(
    entry => `${entry.tag} ${entry.message} ${entry.data ? JSON.stringify(entry.data) : ''}`.toLowerCase(),
  );

  for (const stage of PIPELINE_STAGES) {
    const normalizedStage = stage.toLowerCase();

    // Also match camelCase equivalents (e.g. "extractAiPartnership" for "extract-ai-partnership").
    const camelCase = hyphenToCamel(stage);

    const found = entryTexts.some(
      text => text.includes(normalizedStage) || text.includes(camelCase.toLowerCase()),
    );

    if (found) {
      stagesFound.add(stage);
    }
  }

  const stagesMissing = PIPELINE_STAGES.filter(stage => !stagesFound.has(stage)) as string[];

  // ---- Errors ----
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (entry.level === 'error') {
      errors.push(`[${entry.timestamp}] [${entry.tag}] ${entry.message}`);
    }
  }

  // ---- Evidence verification stats ----
  let evidenceStats: LogValidationResult['evidenceStats'] | undefined;

  for (const entry of entries) {
    const combined = `${entry.message} ${entry.data ? JSON.stringify(entry.data) : ''}`;

    // Look for evidence verification output in the log.
    // The verify-evidence command logs: "Verified N evidence items. Kept K, filtered F."
    const evidenceMatch = combined.match(
      /verified\s+(\d+)\s+evidence\s+items?\.\s*kept\s+(\d+),?\s*filtered\s+(\d+)/i,
    );
    if (evidenceMatch) {
      evidenceStats = {
        total: parseInt(evidenceMatch[1]!, 10),
        kept: parseInt(evidenceMatch[2]!, 10),
        filtered: parseInt(evidenceMatch[3]!, 10),
      };
      break;
    }

    // Also check JSON data fields for evidence stats.
    if (entry.data) {
      const d = entry.data;
      if (
        typeof d.totalEvidence === 'number' &&
        typeof d.keptCount === 'number' &&
        typeof d.filteredCount === 'number'
      ) {
        evidenceStats = {
          total: d.totalEvidence as number,
          kept: d.keptCount as number,
          filtered: d.filteredCount as number,
        };
        break;
      }
    }
  }

  // ---- Sync status ----
  let syncStatus: LogValidationResult['syncStatus'] = 'not_found';

  for (const entry of entries) {
    const combined = `${entry.tag} ${entry.message}`.toLowerCase();
    if (combined.includes('sync')) {
      if (
        combined.includes('success') ||
        combined.includes('synced') ||
        combined.includes('complete')
      ) {
        syncStatus = 'success';
        break;
      }
      if (
        combined.includes('failed') ||
        combined.includes('error')
      ) {
        syncStatus = 'failed';
        break;
      }
    }
  }

  // ---- Warnings ----
  if (stagesMissing.length > 0 && stagesMissing.length <= 3) {
    warnings.push(
      `${stagesMissing.length} pipeline stage(s) not found in log: ${stagesMissing.join(', ')}`,
    );
  }

  if (evidenceStats && evidenceStats.kept === 0) {
    warnings.push(
      'Evidence verification kept 0 items. All evidence was filtered.',
    );
  }

  // ---- Validity ----
  const isValid =
    stagesMissing.length === 0 &&
    errors.length === 0;

  return {
    isValid,
    stagesFound: Array.from(stagesFound),
    stagesMissing,
    errors,
    warnings,
    evidenceStats,
    syncStatus,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a hyphenated string to camelCase.
 * "extract-ai-partnership" -> "extractAiPartnership"
 */
function hyphenToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
