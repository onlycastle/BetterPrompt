/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Reuses the shared database connection from results-db to avoid
 * dual-connection write contention on the same results.db file.
 *
 * @module plugin/lib/stage-db
 */
import { getDb as getSharedDb } from './results-db.js';
let migrated = false;
function getDb() {
    const db = getSharedDb();
    if (!migrated) {
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
        migrated = true;
    }
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
/** No-op: connection lifecycle is managed by results-db. */
export function closeStageDb() {
    // Connection is shared via results-db; call closeResultsDb() instead.
}
//# sourceMappingURL=stage-db.js.map