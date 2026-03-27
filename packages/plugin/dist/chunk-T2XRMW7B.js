import {
  assembleCanonicalAnalysisRun,
  getPluginDataDir
} from "./chunk-UORQZYNI.js";

// lib/results-db.ts
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "fs";
import { join } from "path";
var DB_FILE = "results.db";
var db = null;
function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
function getDb() {
  if (db) return db;
  const dataDir = getPluginDataDir();
  mkdirSync(dataDir, { recursive: true });
  db = new Database(join(dataDir, DB_FILE));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
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
  ensureColumn(db, "analysis_runs", "phase1_output_json", "TEXT");
  ensureColumn(db, "analysis_runs", "activity_sessions_json", "TEXT");
  ensureColumn(db, "analysis_runs", "evaluation_json", "TEXT");
  return db;
}
function createAnalysisRun(params) {
  const database = getDb();
  const analyzedAt = params.analyzedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const result = database.prepare(`
      INSERT INTO analysis_runs (
        analyzed_at,
        metrics_json,
        scores_json,
        phase1_output_json,
        activity_sessions_json
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
    analyzedAt,
    JSON.stringify(params.metrics),
    JSON.stringify(params.scores),
    params.phase1Output ? JSON.stringify(params.phase1Output) : null,
    params.activitySessions ? JSON.stringify(params.activitySessions) : null
  );
  return Number(result.lastInsertRowid);
}
function getCurrentRunId() {
  try {
    const runIdStr = readFileSync(join(getPluginDataDir(), "current-run-id.txt"), "utf-8");
    return parseInt(runIdStr.trim(), 10);
  } catch {
    return getLatestRunId();
  }
}
function getLatestRunId() {
  const database = getDb();
  const row = database.prepare("SELECT id FROM analysis_runs ORDER BY id DESC LIMIT 1").get();
  return row?.id ?? null;
}
function getAnalysisRun(runId) {
  const database = getDb();
  const row = database.prepare("SELECT * FROM analysis_runs WHERE id = ?").get(runId);
  if (!row) return null;
  return {
    id: row.id,
    analyzedAt: row.analyzed_at,
    metrics: JSON.parse(row.metrics_json),
    scores: JSON.parse(row.scores_json),
    typeResult: row.type_json ? JSON.parse(row.type_json) : null,
    phase1Output: row.phase1_output_json ? JSON.parse(row.phase1_output_json) : null,
    activitySessions: row.activity_sessions_json ? JSON.parse(row.activity_sessions_json) : null,
    evaluation: row.evaluation_json ? JSON.parse(row.evaluation_json) : null,
    content: row.content_json ? JSON.parse(row.content_json) : null
  };
}
function saveDomainResult(runId, result) {
  const database = getDb();
  database.prepare(`
      INSERT OR REPLACE INTO domain_results (run_id, domain, score, confidence, data_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
    runId,
    result.domain,
    result.overallScore,
    result.confidenceScore,
    JSON.stringify(result)
  );
}
function getDomainResults(runId) {
  const database = getDb();
  const rows = database.prepare("SELECT data_json FROM domain_results WHERE run_id = ? ORDER BY domain").all(runId);
  return rows.map((row) => JSON.parse(row.data_json));
}
function getDomainResult(runId, domain) {
  const database = getDb();
  const row = database.prepare("SELECT data_json FROM domain_results WHERE run_id = ? AND domain = ?").get(runId, domain);
  return row ? JSON.parse(row.data_json) : null;
}
function saveTypeResult(runId, typeResult) {
  const database = getDb();
  database.prepare("UPDATE analysis_runs SET type_json = ? WHERE id = ?").run(JSON.stringify(typeResult), runId);
}
function saveAssembledArtifacts(runId, activitySessions, evaluation) {
  const database = getDb();
  database.prepare(`
      UPDATE analysis_runs
      SET activity_sessions_json = ?, evaluation_json = ?
      WHERE id = ?
    `).run(JSON.stringify(activitySessions), JSON.stringify(evaluation), runId);
}
function assembleCanonicalRun(runId = getLatestRunId() ?? void 0) {
  if (!runId) return null;
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) return null;
  const stageOutputs = getAllStageOutputs(runId);
  const assembledRun = assembleCanonicalAnalysisRun({
    runId,
    analyzedAt: run.analyzedAt,
    phase1Output: run.phase1Output,
    deterministicScores: run.scores,
    stageOutputs,
    typeResult: run.typeResult,
    domainResults: getDomainResults(runId)
  });
  saveAssembledArtifacts(runId, assembledRun.activitySessions, assembledRun.evaluation);
  return assembledRun;
}

// lib/stage-db.ts
var migratedDb = null;
var REQUIRED_STAGE_NAMES = [
  "sessionSummaries",
  // 5 extractors (v2)
  "extractAiPartnership",
  "extractSessionCraft",
  "extractToolMastery",
  "extractSkillResilience",
  "extractSessionMastery",
  // 5 domain writers (v2)
  "aiPartnership",
  "sessionCraft",
  "toolMastery",
  "skillResilience",
  "sessionMastery",
  // Context + classification
  "projectSummaries",
  "weeklyInsights",
  "typeClassification",
  "evidenceVerification",
  "contentWriter"
];
function getDb2() {
  const db2 = getDb();
  if (migratedDb !== db2) {
    db2.exec(`
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
    migratedDb = db2;
  }
  return db2;
}
function isRequiredStage(stage) {
  return REQUIRED_STAGE_NAMES.includes(stage);
}
function recordStageStatus(runId, stage, params) {
  const database = getDb2();
  database.prepare(`
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
    `).run(
    runId,
    stage,
    params.required ?? isRequiredStage(stage) ? 1 : 0,
    params.status,
    params.lastError ?? null
  );
}
function getStageStatuses(runId) {
  const database = getDb2();
  const rows = database.prepare(`
      SELECT run_id, stage, required, status, attempt_count, last_error, updated_at, created_at
      FROM stage_statuses
      WHERE run_id = ?
      ORDER BY stage
    `).all(runId);
  return rows.map((row) => ({
    runId: row.run_id,
    stage: row.stage,
    required: row.required === 1,
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  }));
}
function saveStageOutput(runId, stage, data) {
  const database = getDb2();
  database.prepare(
    `INSERT OR REPLACE INTO stage_outputs (run_id, stage, data_json)
       VALUES (?, ?, ?)`
  ).run(runId, stage, JSON.stringify(data));
}
function getStageOutput(runId, stage) {
  const database = getDb2();
  const row = database.prepare("SELECT data_json FROM stage_outputs WHERE run_id = ? AND stage = ?").get(runId, stage);
  return row ? JSON.parse(row.data_json) : null;
}
function getAllStageOutputs(runId) {
  const database = getDb2();
  const rows = database.prepare("SELECT stage, data_json FROM stage_outputs WHERE run_id = ? ORDER BY stage").all(runId);
  const result = {};
  for (const row of rows) {
    result[row.stage] = JSON.parse(row.data_json);
  }
  return result;
}

export {
  REQUIRED_STAGE_NAMES,
  recordStageStatus,
  getStageStatuses,
  saveStageOutput,
  getStageOutput,
  getAllStageOutputs,
  createAnalysisRun,
  getCurrentRunId,
  getAnalysisRun,
  saveDomainResult,
  getDomainResults,
  getDomainResult,
  saveTypeResult,
  assembleCanonicalRun
};
//# sourceMappingURL=chunk-T2XRMW7B.js.map