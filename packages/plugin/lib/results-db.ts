/**
 * Results Database - Local SQLite storage for analysis results
 *
 * Stores domain analysis results, type classification, and report data
 * at ~/.betterprompt/results.db. Separate from the insight cache DB
 * (insight-cache.db) which stores server-fetched summaries.
 *
 * @module plugin/lib/results-db
 */

import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_DATA_DIR } from './core/session-scanner.js';
import type {
  DomainResult,
  DeterministicScores,
  DeterministicTypeResult,
  Phase1SessionMetrics,
  AnalysisReport,
} from './core/types.js';

const DB_FILE = 'results.db';
const DATA_DIR = PLUGIN_DATA_DIR;

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(join(DATA_DIR, DB_FILE));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      analyzed_at   TEXT NOT NULL,
      metrics_json  TEXT NOT NULL,
      scores_json   TEXT NOT NULL,
      type_json     TEXT,
      content_json  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS domain_results (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      domain      TEXT NOT NULL,
      score       REAL NOT NULL,
      confidence  REAL NOT NULL DEFAULT 0.0,
      data_json   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(run_id, domain)
    );

    CREATE INDEX IF NOT EXISTS idx_domain_results_domain ON domain_results(domain);
    CREATE INDEX IF NOT EXISTS idx_domain_results_run ON domain_results(run_id);
  `);

  return db;
}

// ============================================================================
// Analysis Run Management
// ============================================================================

/** Create a new analysis run. Returns the run ID. */
export function createAnalysisRun(
  metrics: Phase1SessionMetrics,
  scores: DeterministicScores,
): number {
  const database = getDb();
  const result = database
    .prepare(
      `INSERT INTO analysis_runs (analyzed_at, metrics_json, scores_json)
       VALUES (?, ?, ?)`,
    )
    .run(
      new Date().toISOString(),
      JSON.stringify(metrics),
      JSON.stringify(scores),
    );
  return Number(result.lastInsertRowid);
}

/** Get the current run ID from file cache, falling back to latest DB run */
export function getCurrentRunId(): number | null {
  try {
    const runIdStr = readFileSync(join(DATA_DIR, 'current-run-id.txt'), 'utf-8');
    return parseInt(runIdStr.trim(), 10);
  } catch {
    return getLatestRunId();
  }
}

/** Get the latest analysis run ID */
export function getLatestRunId(): number | null {
  const database = getDb();
  const row = database
    .prepare('SELECT id FROM analysis_runs ORDER BY id DESC LIMIT 1')
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

/** Get analysis run by ID */
export function getAnalysisRun(runId: number): {
  id: number;
  analyzedAt: string;
  metrics: Phase1SessionMetrics;
  scores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  content: AnalysisReport['content'] | null;
} | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM analysis_runs WHERE id = ?')
    .get(runId) as {
      id: number;
      analyzed_at: string;
      metrics_json: string;
      scores_json: string;
      type_json: string | null;
      content_json: string | null;
    } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    analyzedAt: row.analyzed_at,
    metrics: JSON.parse(row.metrics_json),
    scores: JSON.parse(row.scores_json),
    typeResult: row.type_json ? JSON.parse(row.type_json) : null,
    content: row.content_json ? JSON.parse(row.content_json) : null,
  };
}

// ============================================================================
// Domain Result Storage
// ============================================================================

/** Save a domain analysis result */
export function saveDomainResult(runId: number, result: DomainResult): void {
  const database = getDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO domain_results (run_id, domain, score, confidence, data_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      runId,
      result.domain,
      result.overallScore,
      result.confidenceScore,
      JSON.stringify(result),
    );
}

/** Get all domain results for a run */
export function getDomainResults(runId: number): DomainResult[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT data_json FROM domain_results WHERE run_id = ? ORDER BY domain')
    .all(runId) as Array<{ data_json: string }>;

  return rows.map(row => JSON.parse(row.data_json));
}

/** Get a specific domain result */
export function getDomainResult(runId: number, domain: string): DomainResult | null {
  const database = getDb();
  const row = database
    .prepare('SELECT data_json FROM domain_results WHERE run_id = ? AND domain = ?')
    .get(runId, domain) as { data_json: string } | undefined;

  return row ? JSON.parse(row.data_json) : null;
}

// ============================================================================
// Type Classification Storage
// ============================================================================

/** Save type classification result */
export function saveTypeResult(runId: number, typeResult: DeterministicTypeResult): void {
  const database = getDb();
  database
    .prepare('UPDATE analysis_runs SET type_json = ? WHERE id = ?')
    .run(JSON.stringify(typeResult), runId);
}

/** Save content (topFocusAreas, personalitySummary) */
export function saveContent(runId: number, content: AnalysisReport['content']): void {
  const database = getDb();
  database
    .prepare('UPDATE analysis_runs SET content_json = ? WHERE id = ?')
    .run(JSON.stringify(content), runId);
}

// ============================================================================
// Full Report Assembly
// ============================================================================

/** Assemble a complete analysis report from the latest run */
export function assembleReport(): AnalysisReport | null {
  const latestRunId = getLatestRunId();
  if (!latestRunId) return null;

  const run = getAnalysisRun(latestRunId);
  if (!run) return null;

  const domainResults = getDomainResults(latestRunId);

  return {
    userId: 'local',
    analyzedAt: run.analyzedAt,
    phase1Metrics: run.metrics,
    deterministicScores: run.scores,
    typeResult: run.typeResult ?? null,
    domainResults,
    content: run.content ?? undefined,
  };
}

/** Close the database connection */
export function closeResultsDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
