/**
 * Results Database - Local SQLite storage for canonical analysis runs.
 *
 * @module plugin/lib/results-db
 */
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_DATA_DIR } from './core/session-scanner.js';
import { assembleCanonicalAnalysisRun } from './evaluation-assembler.js';
import { getAllStageOutputs } from './stage-db.js';
const DB_FILE = 'results.db';
const DATA_DIR = PLUGIN_DATA_DIR;
let db = null;
function ensureColumn(database, tableName, columnName, definition) {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some(column => column.name === columnName)) {
        database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}
function getDb() {
    if (db)
        return db;
    mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(join(DATA_DIR, DB_FILE));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      analyzed_at            TEXT NOT NULL,
      metrics_json           TEXT NOT NULL,
      scores_json            TEXT NOT NULL,
      type_json              TEXT,
      content_json           TEXT,
      phase1_output_json     TEXT,
      activity_sessions_json TEXT,
      evaluation_json        TEXT,
      created_at             TEXT NOT NULL DEFAULT (datetime('now'))
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
    ensureColumn(db, 'analysis_runs', 'phase1_output_json', 'TEXT');
    ensureColumn(db, 'analysis_runs', 'activity_sessions_json', 'TEXT');
    ensureColumn(db, 'analysis_runs', 'evaluation_json', 'TEXT');
    return db;
}
export function createAnalysisRun(params) {
    const database = getDb();
    const analyzedAt = params.analyzedAt ?? new Date().toISOString();
    const result = database.prepare(`
      INSERT INTO analysis_runs (
        analyzed_at,
        metrics_json,
        scores_json,
        phase1_output_json,
        activity_sessions_json
      )
      VALUES (?, ?, ?, ?, ?)
    `)
        .run(analyzedAt, JSON.stringify(params.metrics), JSON.stringify(params.scores), params.phase1Output ? JSON.stringify(params.phase1Output) : null, params.activitySessions ? JSON.stringify(params.activitySessions) : null);
    return Number(result.lastInsertRowid);
}
export function getCurrentRunId() {
    try {
        const runIdStr = readFileSync(join(DATA_DIR, 'current-run-id.txt'), 'utf-8');
        return parseInt(runIdStr.trim(), 10);
    }
    catch {
        return getLatestRunId();
    }
}
export function getLatestRunId() {
    const database = getDb();
    const row = database
        .prepare('SELECT id FROM analysis_runs ORDER BY id DESC LIMIT 1')
        .get();
    return row?.id ?? null;
}
export function getAnalysisRun(runId) {
    const database = getDb();
    const row = database
        .prepare('SELECT * FROM analysis_runs WHERE id = ?')
        .get(runId);
    if (!row)
        return null;
    return {
        id: row.id,
        analyzedAt: row.analyzed_at,
        metrics: JSON.parse(row.metrics_json),
        scores: JSON.parse(row.scores_json),
        typeResult: row.type_json ? JSON.parse(row.type_json) : null,
        phase1Output: row.phase1_output_json ? JSON.parse(row.phase1_output_json) : null,
        activitySessions: row.activity_sessions_json
            ? JSON.parse(row.activity_sessions_json)
            : null,
        evaluation: row.evaluation_json ? JSON.parse(row.evaluation_json) : null,
        content: row.content_json ? JSON.parse(row.content_json) : null,
    };
}
export function saveDomainResult(runId, result) {
    const database = getDb();
    database
        .prepare(`
      INSERT OR REPLACE INTO domain_results (run_id, domain, score, confidence, data_json)
      VALUES (?, ?, ?, ?, ?)
    `)
        .run(runId, result.domain, result.overallScore, result.confidenceScore, JSON.stringify(result));
}
export function getDomainResults(runId) {
    const database = getDb();
    const rows = database
        .prepare('SELECT data_json FROM domain_results WHERE run_id = ? ORDER BY domain')
        .all(runId);
    return rows.map(row => JSON.parse(row.data_json));
}
export function getDomainResult(runId, domain) {
    const database = getDb();
    const row = database
        .prepare('SELECT data_json FROM domain_results WHERE run_id = ? AND domain = ?')
        .get(runId, domain);
    return row ? JSON.parse(row.data_json) : null;
}
export function saveTypeResult(runId, typeResult) {
    const database = getDb();
    database
        .prepare('UPDATE analysis_runs SET type_json = ? WHERE id = ?')
        .run(JSON.stringify(typeResult), runId);
}
export function saveContent(runId, content) {
    const database = getDb();
    database
        .prepare('UPDATE analysis_runs SET content_json = ? WHERE id = ?')
        .run(JSON.stringify(content), runId);
}
export function saveEvaluation(runId, evaluation) {
    const database = getDb();
    database
        .prepare('UPDATE analysis_runs SET evaluation_json = ? WHERE id = ?')
        .run(JSON.stringify(evaluation), runId);
}
function saveAssembledArtifacts(runId, activitySessions, evaluation) {
    const database = getDb();
    database
        .prepare(`
      UPDATE analysis_runs
      SET activity_sessions_json = ?, evaluation_json = ?
      WHERE id = ?
    `)
        .run(JSON.stringify(activitySessions), JSON.stringify(evaluation), runId);
}
export function assembleCanonicalRun(runId = getLatestRunId() ?? undefined) {
    if (!runId)
        return null;
    const run = getAnalysisRun(runId);
    if (!run?.phase1Output)
        return null;
    const stageOutputs = getAllStageOutputs(runId);
    const assembledRun = assembleCanonicalAnalysisRun({
        runId,
        analyzedAt: run.analyzedAt,
        phase1Output: run.phase1Output,
        deterministicScores: run.scores,
        stageOutputs,
        typeResult: run.typeResult,
        domainResults: getDomainResults(runId),
    });
    saveAssembledArtifacts(runId, assembledRun.activitySessions, assembledRun.evaluation);
    return assembledRun;
}
export function closeResultsDb() {
    if (db) {
        db.close();
        db = null;
    }
}
//# sourceMappingURL=results-db.js.map