/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Reuses the shared database connection from results-db to avoid
 * dual-connection write contention on the same results.db file.
 *
 * @module plugin/lib/stage-db
 */
import { getDb as getSharedDb } from './results-db.js';
let migratedDb = null;
export const REQUIRED_STAGE_NAMES = [
    'sessionSummaries',
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'projectSummaries',
    'weeklyInsights',
    'typeClassification',
    'evidenceVerification',
    'contentWriter',
];
function getDb() {
    const db = getSharedDb();
    if (migratedDb !== db) {
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

      CREATE TABLE IF NOT EXISTS stage_statuses (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id        INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        stage         TEXT NOT NULL,
        required      INTEGER NOT NULL DEFAULT 0,
        status        TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error    TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(run_id, stage)
      );

      CREATE INDEX IF NOT EXISTS idx_stage_statuses_run ON stage_statuses(run_id);
      CREATE INDEX IF NOT EXISTS idx_stage_statuses_stage ON stage_statuses(stage);
    `);
        migratedDb = db;
    }
    return db;
}
function isRequiredStage(stage) {
    return REQUIRED_STAGE_NAMES.includes(stage);
}
export function recordStageStatus(runId, stage, params) {
    const database = getDb();
    database
        .prepare(`
      INSERT INTO stage_statuses (
        run_id,
        stage,
        required,
        status,
        attempt_count,
        last_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
      ON CONFLICT(run_id, stage) DO UPDATE SET
        required = excluded.required,
        status = excluded.status,
        attempt_count = stage_statuses.attempt_count + 1,
        last_error = excluded.last_error,
        updated_at = datetime('now')
    `)
        .run(runId, stage, (params.required ?? isRequiredStage(stage)) ? 1 : 0, params.status, params.lastError ?? null);
}
export function getStageStatuses(runId) {
    const database = getDb();
    const rows = database
        .prepare(`
      SELECT run_id, stage, required, status, attempt_count, last_error, updated_at, created_at
      FROM stage_statuses
      WHERE run_id = ?
      ORDER BY stage
    `)
        .all(runId);
    return rows.map(row => ({
        runId: row.run_id,
        stage: row.stage,
        required: row.required === 1,
        status: row.status,
        attemptCount: row.attempt_count,
        lastError: row.last_error,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
    }));
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
export function getStageGateIssues(runId) {
    const statuses = getStageStatuses(runId);
    const statusLookup = new Map(statuses.map(status => [status.stage, status]));
    const issues = [];
    for (const stage of REQUIRED_STAGE_NAMES) {
        const status = statusLookup.get(stage);
        if (!status) {
            issues.push({
                stage,
                required: true,
                status: 'missing',
                attemptCount: 0,
                lastError: null,
                updatedAt: null,
            });
            continue;
        }
        if (status.status !== 'validated') {
            issues.push({
                stage,
                required: status.required,
                status: status.status,
                attemptCount: status.attemptCount,
                lastError: status.lastError,
                updatedAt: status.updatedAt,
            });
        }
    }
    return issues;
}
/** No-op: connection lifecycle is managed by results-db. */
export function closeStageDb() {
    // Connection is shared via results-db; call closeResultsDb() instead.
    migratedDb = null;
}
//# sourceMappingURL=stage-db.js.map