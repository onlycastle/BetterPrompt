/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Extends the results database with a stage_outputs table for
 * storing non-domain stage results (session summaries, project
 * summaries, weekly insights, etc.).
 *
 * @module plugin/lib/stage-db
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_DATA_DIR } from './core/session-scanner.js';
const DB_FILE = 'results.db';
let db = null;
function getDb() {
    if (db)
        return db;
    mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
    db = new Database(join(PLUGIN_DATA_DIR, DB_FILE));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Ensure stage_outputs table exists (migration-safe)
    db.exec(`
    CREATE TABLE IF NOT EXISTS stage_outputs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      stage       TEXT NOT NULL,
      data_json   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(run_id, stage)
    );

    CREATE INDEX IF NOT EXISTS idx_stage_outputs_run ON stage_outputs(run_id);
    CREATE INDEX IF NOT EXISTS idx_stage_outputs_stage ON stage_outputs(stage);
  `);
    return db;
}
/** Save a stage output. Replaces existing output for same run+stage. */
export function saveStageOutput(runId, stage, data) {
    const database = getDb();
    database
        .prepare(`INSERT OR REPLACE INTO stage_outputs (run_id, stage, data_json)
       VALUES (?, ?, ?)`)
        .run(runId, stage, JSON.stringify(data));
}
/** Get a stage output for a run. Returns null if not found. */
export function getStageOutput(runId, stage) {
    const database = getDb();
    const row = database
        .prepare('SELECT data_json FROM stage_outputs WHERE run_id = ? AND stage = ?')
        .get(runId, stage);
    return row ? JSON.parse(row.data_json) : null;
}
/** Get all stage outputs for a run. */
export function getAllStageOutputs(runId) {
    const database = getDb();
    const rows = database
        .prepare('SELECT stage, data_json FROM stage_outputs WHERE run_id = ? ORDER BY stage')
        .all(runId);
    const result = {};
    for (const row of rows) {
        result[row.stage] = JSON.parse(row.data_json);
    }
    return result;
}
/** Close the database connection. */
export function closeStageDb() {
    if (db) {
        db.close();
        db = null;
    }
}
//# sourceMappingURL=stage-db.js.map