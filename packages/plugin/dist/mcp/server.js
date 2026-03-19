#!/usr/bin/env node
import {
  CONTEXT_WINDOW_SIZE,
  DomainGrowthAreaSchema,
  DomainStrengthSchema,
  MultitaskingPatternSchema,
  STAGE_SCHEMAS,
  __require,
  assembleCanonicalAnalysisRun,
  buildReportActivitySessions,
  clearAnalysisPending,
  computeDeterministicScores,
  computeDeterministicType,
  getAnalysisLifecycleState,
  getCacheDbPath,
  getConfig,
  getPluginDataDir,
  getScanCacheDir,
  isAnalysisPending,
  markAnalysisComplete,
  markAnalysisFailed,
  markAnalysisStarted,
  recoverStaleAnalysisState
} from "../chunk-EUSLREZV.js";

// mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z5 } from "zod";

// lib/cache.ts
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

// lib/api-client.ts
async function fetchUserSummary() {
  const config = getConfig();
  const url = `${config.serverUrl}/api/analysis/user/summary`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Server error (${response.status}): ${body.message ?? "Unknown error"}`
    );
  }
  const data = await response.json();
  return data.summary;
}
async function verifyAuth() {
  const config = getConfig();
  try {
    const response = await fetch(`${config.serverUrl}/api/auth/me`, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

// lib/cache.ts
var CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var db = null;
function getDb() {
  if (db) return db;
  const dbPath = getCacheDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_insights (
      user_id     TEXT PRIMARY KEY,
      result_id   TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      growth_json  TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      fetched_at   TEXT NOT NULL
    )
  `);
  return db;
}
function setCachedSummary(userId, summary) {
  const database = getDb();
  database.prepare(
    `INSERT OR REPLACE INTO cached_insights
       (user_id, result_id, profile_json, growth_json, insights_json, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    summary.resultId,
    JSON.stringify({
      resultId: summary.resultId,
      analyzedAt: summary.analyzedAt,
      profile: summary.profile
    }),
    JSON.stringify(summary.growthAreas),
    JSON.stringify({
      strengths: summary.strengths,
      antiPatterns: summary.antiPatterns,
      kpt: summary.kpt
    }),
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function getCachedSummary(userId) {
  const database = getDb();
  const row = database.prepare("SELECT * FROM cached_insights WHERE user_id = ?").get(userId);
  if (!row) return null;
  const profile = JSON.parse(row.profile_json);
  const growthAreas = JSON.parse(row.growth_json);
  const insights = JSON.parse(row.insights_json);
  return {
    resultId: profile.resultId,
    analyzedAt: profile.analyzedAt,
    profile: profile.profile,
    growthAreas,
    strengths: insights.strengths,
    antiPatterns: insights.antiPatterns,
    kpt: insights.kpt
  };
}
function isCacheStale(userId) {
  const database = getDb();
  const row = database.prepare("SELECT fetched_at FROM cached_insights WHERE user_id = ?").get(userId);
  if (!row) return true;
  const fetchedAt = new Date(row.fetched_at).getTime();
  return Date.now() - fetchedAt > CACHE_TTL_MS;
}
async function getSummaryWithCache(userId) {
  const cached = getCachedSummary(userId);
  if (cached && !isCacheStale(userId)) {
    return cached;
  }
  try {
    const fresh = await fetchUserSummary();
    if (fresh) {
      setCachedSummary(userId, fresh);
      return fresh;
    }
    return cached;
  } catch {
    return cached;
  }
}
function closeCache() {
  if (db) {
    db.close();
    db = null;
  }
}

// lib/results-db.ts
import Database2 from "better-sqlite3";
import { mkdirSync as mkdirSync2, readFileSync } from "fs";
import { join } from "path";

// lib/stage-db.ts
var migratedDb = null;
var REQUIRED_STAGE_NAMES = [
  "sessionSummaries",
  "thinkingQuality",
  "communicationPatterns",
  "learningBehavior",
  "contextEfficiency",
  "sessionOutcome",
  "projectSummaries",
  "weeklyInsights",
  "typeClassification",
  "evidenceVerification",
  "contentWriter"
];
function getDb3() {
  const db3 = getDb2();
  if (migratedDb !== db3) {
    db3.exec(`
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
    migratedDb = db3;
  }
  return db3;
}
function isRequiredStage(stage) {
  return REQUIRED_STAGE_NAMES.includes(stage);
}
function recordStageStatus(runId, stage, params) {
  const database = getDb3();
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
  const database = getDb3();
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
  const database = getDb3();
  database.prepare(
    `INSERT OR REPLACE INTO stage_outputs (run_id, stage, data_json)
       VALUES (?, ?, ?)`
  ).run(runId, stage, JSON.stringify(data));
}
function getStageOutput(runId, stage) {
  const database = getDb3();
  const row = database.prepare("SELECT data_json FROM stage_outputs WHERE run_id = ? AND stage = ?").get(runId, stage);
  return row ? JSON.parse(row.data_json) : null;
}
function getAllStageOutputs(runId) {
  const database = getDb3();
  const rows = database.prepare("SELECT stage, data_json FROM stage_outputs WHERE run_id = ? ORDER BY stage").all(runId);
  const result = {};
  for (const row of rows) {
    result[row.stage] = JSON.parse(row.data_json);
  }
  return result;
}
function closeStageDb() {
  migratedDb = null;
}

// lib/results-db.ts
var DB_FILE = "results.db";
var db2 = null;
function ensureColumn(database, tableName, columnName, definition14) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition14}`);
  }
}
function getDb2() {
  if (db2) return db2;
  const dataDir = getPluginDataDir();
  mkdirSync2(dataDir, { recursive: true });
  db2 = new Database2(join(dataDir, DB_FILE));
  db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON");
  db2.exec(`
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
  ensureColumn(db2, "analysis_runs", "phase1_output_json", "TEXT");
  ensureColumn(db2, "analysis_runs", "activity_sessions_json", "TEXT");
  ensureColumn(db2, "analysis_runs", "evaluation_json", "TEXT");
  return db2;
}
function createAnalysisRun(params) {
  const database = getDb2();
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
  const database = getDb2();
  const row = database.prepare("SELECT id FROM analysis_runs ORDER BY id DESC LIMIT 1").get();
  return row?.id ?? null;
}
function getAnalysisRun(runId) {
  const database = getDb2();
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
  const database = getDb2();
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
  const database = getDb2();
  const rows = database.prepare("SELECT data_json FROM domain_results WHERE run_id = ? ORDER BY domain").all(runId);
  return rows.map((row) => JSON.parse(row.data_json));
}
function getDomainResult(runId, domain) {
  const database = getDb2();
  const row = database.prepare("SELECT data_json FROM domain_results WHERE run_id = ? AND domain = ?").get(runId, domain);
  return row ? JSON.parse(row.data_json) : null;
}
function saveTypeResult(runId, typeResult) {
  const database = getDb2();
  database.prepare("UPDATE analysis_runs SET type_json = ? WHERE id = ?").run(JSON.stringify(typeResult), runId);
}
function saveAssembledArtifacts(runId, activitySessions, evaluation) {
  const database = getDb2();
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
function closeResultsDb() {
  if (db2) {
    db2.close();
    db2 = null;
  }
}

// mcp/tools/get-developer-profile.ts
var definition = {
  name: "get_developer_profile",
  description: "Get the current developer's AI collaboration profile \u2014 their primary type (architect/analyst/conductor/speedrunner/trendsetter), control level (navigator/collaborator/delegator), domain scores (0-100), and a brief personality summary. Use this to understand how the developer works with AI.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};
function formatResult(summary) {
  if (!summary) {
    return JSON.stringify({
      status: "no_data",
      message: "No analysis available yet. The developer needs to run at least one analysis first."
    });
  }
  const { profile } = summary;
  return JSON.stringify({
    primaryType: profile.primaryType,
    controlLevel: profile.controlLevel,
    matrixName: profile.matrixName,
    personalitySummary: profile.personalitySummary,
    domainScores: profile.domainScores,
    analyzedAt: summary.analyzedAt
  });
}

// mcp/tools/get-growth-areas.ts
var definition2 = {
  name: "get_growth_areas",
  description: "Get the developer's top growth areas \u2014 specific areas where they can improve their AI collaboration skills. Each area includes a title, domain, severity, and actionable recommendation. Optionally filter by domain (thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome).",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Filter by domain key. One of: thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome",
        enum: [
          "thinkingQuality",
          "communicationPatterns",
          "learningBehavior",
          "contextEfficiency",
          "sessionOutcome"
        ]
      }
    },
    required: []
  }
};
function formatResult2(summary, args) {
  if (!summary) {
    return JSON.stringify({
      status: "no_data",
      message: "No analysis available yet. The developer needs to run at least one analysis first."
    });
  }
  let areas = summary.growthAreas;
  if (args.domain) {
    areas = areas.filter((a) => a.domain === args.domain);
  }
  const top = areas.slice(0, 3);
  return JSON.stringify({
    growthAreas: top.map((a) => ({
      title: a.title,
      domain: a.domain,
      severity: a.severity,
      recommendation: a.recommendation
    })),
    totalCount: areas.length,
    analyzedAt: summary.analyzedAt
  });
}

// mcp/tools/get-recent-insights.ts
var definition3 = {
  name: "get_recent_insights",
  description: `Get the developer's recent analysis insights. Choose a category: "strengths" for top skills, "anti_patterns" for inefficiency patterns to avoid, or "kpt" for a Keep/Problem/Try summary. Defaults to "kpt" which gives the most actionable overview.`,
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: 'Category of insights to return. "strengths" = top strengths by domain, "anti_patterns" = inefficiency patterns detected, "kpt" = Keep/Problem/Try actionable summary',
        enum: ["strengths", "anti_patterns", "kpt"],
        default: "kpt"
      }
    },
    required: []
  }
};
function formatResult3(summary, args) {
  if (!summary) {
    return JSON.stringify({
      status: "no_data",
      message: "No analysis available yet. The developer needs to run at least one analysis first."
    });
  }
  const category = args.category ?? "kpt";
  switch (category) {
    case "strengths":
      return JSON.stringify({
        strengths: summary.strengths.map((s) => ({
          domain: s.domain,
          domainLabel: s.domainLabel,
          topStrength: s.topStrength,
          score: s.domainScore
        })),
        analyzedAt: summary.analyzedAt
      });
    case "anti_patterns":
      return JSON.stringify({
        antiPatterns: summary.antiPatterns.map((ap) => ({
          pattern: ap.pattern,
          frequency: ap.frequency,
          impact: ap.impact
        })),
        analyzedAt: summary.analyzedAt
      });
    case "kpt":
    default:
      return JSON.stringify({
        keep: summary.kpt.keep,
        problem: summary.kpt.problem,
        tryNext: summary.kpt.tryNext,
        analyzedAt: summary.analyzedAt
      });
  }
}

// lib/core/multi-source-session-scanner.ts
import { mkdir, readFile as readFile2, writeFile } from "fs/promises";
import { join as join7 } from "path";

// lib/scanner/project-name-resolver.ts
import { readdirSync, statSync } from "fs";
import { join as join2 } from "path";
import { homedir } from "os";

// lib/scanner/levenshtein.ts
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// lib/scanner/path-encoding.ts
function isWindowsEncodedPath(encoded) {
  return /^[A-Za-z]--/.test(encoded);
}
function decodeProjectPathCrossPlatform(encoded) {
  if (isWindowsEncodedPath(encoded)) {
    const driveLetter = encoded[0];
    const rest = encoded.slice(3);
    if (!rest) return `${driveLetter}:/`;
    return `${driveLetter}:/${rest.replace(/-/g, "/")}`;
  }
  if (encoded.startsWith("-")) {
    return encoded.replace(/-/g, "/");
  }
  return encoded;
}

// lib/scanner/project-name-resolver.ts
var UNIX_TEMP_PREFIXES = ["-private-var-", "-tmp-", "-temp-", "-var-folders-"];
var WINDOWS_TEMP_SEGMENTS = ["appdata-local-temp", "temp", "tmp"];
var CONTAINER_DIRS = /* @__PURE__ */ new Set([
  "projects",
  "repos",
  "code",
  "src",
  "work",
  "dev",
  "workspace",
  "github",
  "development",
  "coding",
  "repo",
  "git"
]);
var cache = /* @__PURE__ */ new Map();
function dirExists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function findClosestDirectory(parentPath, targetName) {
  try {
    const entries = readdirSync(parentPath, { withFileTypes: true });
    let bestMatch = null;
    let bestDistance = Infinity;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dist = levenshteinDistance(entry.name.toLowerCase(), targetName.toLowerCase());
      if (dist > 0 && dist <= 1 && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = entry.name;
      }
    }
    return bestMatch;
  } catch {
    return null;
  }
}
function resolveSegments(basePath, segments) {
  if (segments.length === 0) return [];
  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join("-");
    const candidatePath = basePath ? join2(basePath, candidate) : `/${candidate}`;
    if (dirExists(candidatePath)) {
      const rest = resolveSegments(candidatePath, segments.slice(len));
      return [candidate, ...rest];
    }
  }
  const fallbackName = segments.join("-");
  if (basePath && fallbackName.length >= 4) {
    const fuzzyMatch = findClosestDirectory(basePath, fallbackName);
    if (fuzzyMatch) return [fuzzyMatch];
  }
  return [fallbackName];
}
function resolveProjectName(encodedDirName) {
  const cached = cache.get(encodedDirName);
  if (cached !== void 0) return cached;
  const result = resolveProjectNameUncached(encodedDirName);
  cache.set(encodedDirName, result);
  return result;
}
function resolveProjectNameUncached(encodedDirName) {
  if (isWindowsEncodedPath(encodedDirName)) {
    return resolveWindowsPath(encodedDirName);
  }
  if (!encodedDirName.startsWith("-")) {
    return encodedDirName || "unknown";
  }
  const lower = encodedDirName.toLowerCase();
  for (const prefix of UNIX_TEMP_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return "(temp)";
    }
  }
  const segments = encodedDirName.slice(1).split("-").filter(Boolean);
  if (segments.length === 0) return "unknown";
  const home = homedir();
  const homeParts = home.split(/[/\\]/).filter(Boolean);
  let startSegments = segments;
  if (homeParts.length > 0 && segments.length > homeParts.length) {
    let matchesHome = true;
    for (let i = 0; i < homeParts.length; i++) {
      if (segments[i] !== homeParts[i]) {
        matchesHome = false;
        break;
      }
    }
    if (matchesHome) {
      startSegments = segments.slice(homeParts.length);
      if (startSegments.length === 0) return "unknown";
      const resolved2 = resolveSegments(home, startSegments);
      return stripContainerDirs(resolved2);
    }
  }
  const resolved = resolveSegments("", segments);
  if (resolved.length === 0) return "unknown";
  return stripContainerDirs(resolved);
}
function resolveWindowsPath(encodedDirName) {
  const driveLetter = encodedDirName[0];
  const rest = encodedDirName.slice(3);
  if (!rest) return "unknown";
  const segments = rest.split("-").filter(Boolean);
  if (segments.length === 0) return "unknown";
  const lowerRest = rest.toLowerCase();
  for (const tempSeg of WINDOWS_TEMP_SEGMENTS) {
    if (lowerRest.startsWith(tempSeg)) {
      return "(temp)";
    }
  }
  const home = homedir();
  const homeParts = home.split(/[/\\]/).filter(Boolean);
  const homePartsNoDrive = homeParts[0]?.match(/^[A-Za-z]:$/) ? homeParts.slice(1) : homeParts;
  if (homePartsNoDrive.length > 0 && segments.length > homePartsNoDrive.length) {
    let matchesHome = true;
    for (let i = 0; i < homePartsNoDrive.length; i++) {
      if (segments[i] !== homePartsNoDrive[i]) {
        matchesHome = false;
        break;
      }
    }
    if (matchesHome) {
      const afterHome = segments.slice(homePartsNoDrive.length);
      if (afterHome.length === 0) return "unknown";
      const resolved2 = resolveSegments(home, afterHome);
      return stripContainerDirs(resolved2);
    }
  }
  const driveRoot = `${driveLetter}:/`;
  const resolved = resolveSegments(driveRoot, segments);
  if (resolved.length === 0) return "unknown";
  return stripContainerDirs(resolved);
}
function stripContainerDirs(parts) {
  if (parts.length === 0) return "unknown";
  let start = 0;
  while (start < parts.length - 1 && CONTAINER_DIRS.has(parts[start].toLowerCase())) {
    start++;
  }
  const remaining = parts.slice(start);
  return remaining.join("/") || "unknown";
}

// lib/scanner/sources/base.ts
var BaseSessionSource = class {
  /**
   * Decode project path from encoded directory name.
   * Handles both Unix (-Users-dev-app) and Windows (C--alphacut) formats.
   */
  decodeProjectPath(encoded) {
    return decodeProjectPathCrossPlatform(encoded);
  }
  /**
   * Resolve project name from encoded directory name using filesystem probing
   */
  resolveProjectName(encodedDirName) {
    return resolveProjectName(encodedDirName);
  }
  /**
   * Get project name from path (last segment)
   * @deprecated Use resolveProjectName() for accurate names
   */
  getProjectName(projectPath) {
    const parts = projectPath.split(/[/\\]/).filter(Boolean);
    const filtered = parts.filter((p) => !/^[A-Za-z]:$/.test(p));
    return filtered[filtered.length - 1] || "unknown";
  }
  /**
   * Calculate session duration in seconds
   */
  calculateDuration(startTime, endTime) {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1e3);
  }
  /**
   * Compute session statistics from parsed messages
   */
  computeStats(messages) {
    let userMessageCount = 0;
    let assistantMessageCount = 0;
    let toolCallCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolsUsed = /* @__PURE__ */ new Set();
    for (const msg of messages) {
      if (msg.role === "user") {
        userMessageCount++;
      } else {
        assistantMessageCount++;
        if (msg.toolCalls) {
          toolCallCount += msg.toolCalls.length;
          for (const tool of msg.toolCalls) {
            toolsUsed.add(tool.name);
          }
        }
        if (msg.tokenUsage) {
          totalInputTokens += msg.tokenUsage.input;
          totalOutputTokens += msg.tokenUsage.output;
        }
      }
    }
    return {
      userMessageCount,
      assistantMessageCount,
      toolCallCount,
      uniqueToolsUsed: Array.from(toolsUsed).sort(),
      totalInputTokens,
      totalOutputTokens
    };
  }
};

// lib/scanner/sources/claude-code.ts
import { readFile, readdir, stat } from "fs/promises";
import { join as join3, basename } from "path";
import { homedir as homedir2 } from "os";
var CLAUDE_PROJECTS_DIR = join3(homedir2(), ".claude", "projects");
var ClaudeCodeSource = class extends BaseSessionSource {
  name = "claude-code";
  displayName = "Claude Code";
  baseDir;
  constructor(baseDir) {
    super();
    this.baseDir = baseDir ?? CLAUDE_PROJECTS_DIR;
  }
  getBaseDir() {
    return this.baseDir;
  }
  async isAvailable() {
    try {
      await stat(this.baseDir);
      return true;
    } catch {
      return false;
    }
  }
  async collectFileMetadata(config) {
    const minSize = config?.minFileSize ?? 0;
    const maxSize = config?.maxFileSize ?? Infinity;
    const projectDirs = await this.listProjectDirs();
    const allFiles = [];
    for (const dir of projectDirs) {
      const files = await this.listSessionFiles(dir);
      for (const file of files) {
        try {
          const stats = await stat(file);
          if (stats.isFile() && stats.size >= minSize && stats.size <= maxSize) {
            allFiles.push({
              filePath: file,
              fileSize: stats.size,
              mtime: stats.mtime,
              projectDirName: basename(dir),
              source: this.name
            });
          }
        } catch {
        }
      }
    }
    return allFiles;
  }
  async extractMetadata(filePath, content) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;
    const fileName = basename(filePath, ".jsonl");
    let messageCount = 0;
    let firstTimestamp = null;
    let lastTimestamp = null;
    for (const line of lines) {
      const parsed = this.parseJSONLLine(line);
      if (parsed && (parsed.type === "user" || parsed.type === "assistant")) {
        messageCount++;
        const ts = new Date(parsed.timestamp);
        if (!firstTimestamp || ts < firstTimestamp) {
          firstTimestamp = ts;
        }
        if (!lastTimestamp || ts > lastTimestamp) {
          lastTimestamp = ts;
        }
      }
    }
    if (!firstTimestamp || !lastTimestamp) return null;
    const projectDirName = basename(join3(filePath, ".."));
    const projectPath = this.decodeProjectPath(projectDirName);
    const durationSeconds = this.calculateDuration(firstTimestamp, lastTimestamp);
    return {
      sessionId: fileName,
      projectPath,
      projectName: this.resolveProjectName(projectDirName),
      timestamp: firstTimestamp,
      messageCount,
      durationSeconds,
      filePath,
      source: this.name
    };
  }
  async parseSessionContent(sessionId, projectPath, projectName, content) {
    const lines = this.parseJSONLContent(content);
    if (lines.length === 0) return null;
    const timestamps = lines.map((m) => new Date(m.timestamp));
    const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    const durationSeconds = this.calculateDuration(startTime, endTime);
    const claudeCodeVersion = lines[0].version || "unknown";
    const toolResultsMap = /* @__PURE__ */ new Map();
    for (const line of lines) {
      if (line.type === "user") {
        const msgContent = line.message.content;
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "tool_result" && "tool_use_id" in block) {
              const resultContent = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
              toolResultsMap.set(block.tool_use_id, {
                content: resultContent,
                isError: block.is_error ?? false
              });
            }
          }
        }
      }
    }
    const messages = [];
    for (const line of lines) {
      if (line.type === "user") {
        const textContent = this.extractTextContent(line.message.content);
        if (!textContent.trim()) continue;
        messages.push({
          uuid: line.uuid,
          role: "user",
          timestamp: new Date(line.timestamp),
          content: textContent
        });
      } else if (line.type === "assistant") {
        const textContent = this.extractTextContent(line.message.content);
        const toolCalls = Array.isArray(line.message.content) ? this.extractToolCalls(line.message.content, toolResultsMap) : void 0;
        messages.push({
          uuid: line.uuid,
          role: "assistant",
          timestamp: new Date(line.timestamp),
          content: textContent,
          toolCalls,
          tokenUsage: line.message.usage ? {
            input: line.message.usage.input_tokens,
            output: line.message.usage.output_tokens
          } : void 0
        });
      }
    }
    if (messages.length === 0) return null;
    const stats = this.computeStats(messages);
    return {
      sessionId,
      projectPath,
      startTime,
      endTime,
      durationSeconds,
      claudeCodeVersion,
      messages,
      stats,
      source: this.name
    };
  }
  async readSessionContent(filePath) {
    return readFile(filePath, "utf-8");
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────
  async listProjectDirs() {
    try {
      const entries = await readdir(this.baseDir);
      const dirs = [];
      for (const entry of entries) {
        const fullPath = join3(this.baseDir, entry);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
        }
      }
      return dirs;
    } catch {
      return [];
    }
  }
  async listSessionFiles(projectDir) {
    try {
      const files = await readdir(projectDir);
      return files.filter((f) => f.endsWith(".jsonl")).map((f) => join3(projectDir, f));
    } catch {
      return [];
    }
  }
  parseJSONLLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  parseJSONLContent(content) {
    const lines = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === "user" || parsed.type === "assistant") {
          lines.push(parsed);
        }
      } catch {
      }
    }
    return lines;
  }
  extractTextContent(content) {
    if (typeof content === "string") return content;
    const textParts = [];
    for (const block of content) {
      if (block.type === "text" && "text" in block) {
        textParts.push(block.text);
      }
    }
    return textParts.join("\n");
  }
  extractToolCalls(content, toolResultsMap) {
    const toolCalls = [];
    for (const block of content) {
      if (block.type === "tool_use" && "id" in block && "name" in block) {
        const result = toolResultsMap.get(block.id);
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input || {},
          result: result?.content,
          isError: result?.isError
        });
      }
    }
    return toolCalls.length > 0 ? toolCalls : void 0;
  }
};
var claudeCodeSource = new ClaudeCodeSource();

// lib/scanner/sources/cursor.ts
import { readdir as readdir2, stat as stat2 } from "fs/promises";
import { join as join4, basename as basename2, dirname as dirname2 } from "path";
import { homedir as homedir3 } from "os";

// lib/scanner/tool-mapping.ts
var TOOL_MAPPING = {
  /**
   * Claude Code uses PascalCase tool names
   * No mapping needed - this is the canonical format
   */
  "claude-code": {},
  /**
   * Cursor uses snake_case tool names
   * Map to Claude Code equivalents
   */
  "cursor": {
    // File operations
    "read_file": "Read",
    "write_file": "Write",
    "edit_file": "Edit",
    "list_dir": "Bash",
    // ls equivalent
    "list_directory": "Bash",
    "LS": "Bash",
    // Cursor's PascalCase variant
    // Search operations
    "grep_search": "Grep",
    "file_search": "Glob",
    "codebase_search": "Grep",
    "search": "Grep",
    // Terminal operations
    "run_terminal_cmd": "Bash",
    "run_command": "Bash",
    "terminal": "Bash",
    // Web operations
    "web_search": "WebSearch",
    "fetch_url": "WebFetch",
    "browser": "WebFetch",
    // Code operations
    "code_edit": "Edit",
    "apply_diff": "Edit",
    "insert_code": "Edit",
    "replace_code": "Edit",
    "ApplyPatch": "Edit",
    // Cursor's PascalCase variant
    // Shell operations (Cursor uses 'Shell' directly)
    "Shell": "Bash",
    // Notebook operations
    "notebook_edit": "NotebookEdit",
    "jupyter": "NotebookEdit",
    // MCP/Plugin operations
    "mcp_call": "Skill",
    "plugin": "Skill",
    // Task/Agent operations
    "spawn_agent": "Task",
    "delegate": "Task",
    // Misc
    "ask_user": "AskUserQuestion",
    "user_input": "AskUserQuestion"
  },
  /**
   * Cursor Composer uses the same snake_case tool names as Cursor
   * Reuses the same mapping for consistency
   */
  "cursor-composer": {
    // File operations
    "read_file": "Read",
    "write_file": "Write",
    "edit_file": "Edit",
    "list_dir": "Bash",
    "list_directory": "Bash",
    "LS": "Bash",
    // Search operations
    "grep_search": "Grep",
    "file_search": "Glob",
    "codebase_search": "Grep",
    "search": "Grep",
    // Terminal operations
    "run_terminal_cmd": "Bash",
    "run_command": "Bash",
    "terminal": "Bash",
    // Web operations
    "web_search": "WebSearch",
    "fetch_url": "WebFetch",
    "browser": "WebFetch",
    // Code operations
    "code_edit": "Edit",
    "apply_diff": "Edit",
    "insert_code": "Edit",
    "replace_code": "Edit",
    "ApplyPatch": "Edit",
    // Shell operations
    "Shell": "Bash",
    // Notebook operations
    "notebook_edit": "NotebookEdit",
    "jupyter": "NotebookEdit",
    // MCP/Plugin operations
    "mcp_call": "Skill",
    "plugin": "Skill",
    // Task/Agent operations
    "spawn_agent": "Task",
    "delegate": "Task",
    // Misc
    "ask_user": "AskUserQuestion",
    "user_input": "AskUserQuestion"
  }
};
function normalizeToolName(toolName, source) {
  const mapping = TOOL_MAPPING[source];
  if (mapping && toolName in mapping) {
    return mapping[toolName];
  }
  return toolName;
}
var CURSOR_COMPOSER_TOOL_IDS = {
  15: "run_terminal_cmd",
  38: "edit_file",
  39: "list_dir",
  40: "write_file"
};
function resolveComposerToolId(numericId) {
  const toolName = CURSOR_COMPOSER_TOOL_IDS[numericId];
  if (toolName) {
    return normalizeToolName(toolName, "cursor-composer");
  }
  return `tool_${numericId}`;
}

// lib/scanner/sources/sqlite-loader.ts
var cachedConstructor = null;
var loadAttempted = false;
async function loadSqlite() {
  if (loadAttempted) return cachedConstructor;
  loadAttempted = true;
  try {
    const sqlite = await import("better-sqlite3");
    cachedConstructor = sqlite.default ?? sqlite;
    return cachedConstructor;
  } catch {
    return null;
  }
}

// lib/scanner/sources/cursor.ts
var CURSOR_CHATS_DIR = join4(homedir3(), ".cursor", "chats");
var CursorSource = class extends BaseSessionSource {
  name = "cursor";
  displayName = "Cursor";
  baseDir;
  constructor(baseDir) {
    super();
    this.baseDir = baseDir ?? CURSOR_CHATS_DIR;
  }
  getBaseDir() {
    return this.baseDir;
  }
  async isAvailable() {
    try {
      await stat2(this.baseDir);
      const Database3 = await loadSqlite();
      return Database3 !== null;
    } catch {
      return false;
    }
  }
  async collectFileMetadata(config) {
    const minSize = config?.minFileSize ?? 0;
    const maxSize = config?.maxFileSize ?? Infinity;
    const allFiles = [];
    try {
      const workspaceDirs = await this.listWorkspaceDirs();
      for (const workspaceDir of workspaceDirs) {
        const sessionDirs = await this.listSessionDirs(workspaceDir);
        for (const sessionDir of sessionDirs) {
          const storeDbPath = join4(sessionDir, "store.db");
          try {
            const stats = await stat2(storeDbPath);
            if (stats.isFile() && stats.size >= minSize && stats.size <= maxSize) {
              const workspaceHash = basename2(workspaceDir);
              allFiles.push({
                filePath: storeDbPath,
                fileSize: stats.size,
                mtime: stats.mtime,
                projectDirName: workspaceHash,
                source: this.name
              });
            }
          } catch {
          }
        }
      }
    } catch {
    }
    return allFiles;
  }
  async extractMetadata(filePath, _content) {
    const Database3 = await loadSqlite();
    if (!Database3) return null;
    try {
      const db3 = new Database3(filePath);
      try {
        const conversation = this.parseConversation(db3);
        if (!conversation || conversation.messages.length === 0) {
          db3.close();
          return null;
        }
        const messages = conversation.messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        );
        if (messages.length === 0) {
          db3.close();
          return null;
        }
        const timestamps = messages.map((m) => this.extractTimestamp(m)).filter((t) => t !== null);
        if (timestamps.length === 0) {
          db3.close();
          return null;
        }
        const firstTimestamp = new Date(
          Math.min(...timestamps.map((t) => t.getTime()))
        );
        const lastTimestamp = new Date(
          Math.max(...timestamps.map((t) => t.getTime()))
        );
        const sessionDir = dirname2(filePath);
        const sessionId = basename2(sessionDir);
        const workspaceDir = dirname2(sessionDir);
        const workspaceHash = basename2(workspaceDir);
        const projectPath = conversation.metadata?.workspacePath ?? conversation.metadata?.projectPath ?? this.decodeProjectPath(workspaceHash);
        db3.close();
        return {
          sessionId,
          projectPath,
          projectName: this.getProjectName(projectPath),
          timestamp: firstTimestamp,
          messageCount: messages.length,
          durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
          filePath,
          source: this.name
        };
      } catch {
        db3.close();
        return null;
      }
    } catch {
      return null;
    }
  }
  async parseSessionContent(sessionId, projectPath, _projectName, _content) {
    return null;
  }
  /**
   * Parse session directly from SQLite file
   */
  async parseFromFile(filePath) {
    const Database3 = await loadSqlite();
    if (!Database3) return null;
    let db3 = null;
    try {
      db3 = new Database3(filePath);
      const conversation = this.parseConversation(db3);
      if (!conversation || conversation.messages.length === 0) {
        return null;
      }
      const sessionDir = dirname2(filePath);
      const sessionId = basename2(sessionDir);
      const workspaceDir = dirname2(sessionDir);
      const workspaceHash = basename2(workspaceDir);
      const projectPath = conversation.metadata?.workspacePath ?? conversation.metadata?.projectPath ?? this.decodeProjectPath(workspaceHash);
      const toolResultsMap = /* @__PURE__ */ new Map();
      for (const msg of conversation.messages) {
        if (msg.role === "tool") {
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "tool-result") {
                const resultBlock = block;
                if (resultBlock.toolCallId) {
                  const resultText = resultBlock.result || "";
                  const isError = resultText.toLowerCase().includes("error");
                  toolResultsMap.set(resultBlock.toolCallId, {
                    content: resultText,
                    isError,
                    toolName: resultBlock.toolName || "unknown"
                  });
                }
              }
            }
          }
          if (msg.toolResults) {
            for (const result of msg.toolResults) {
              const toolId = result.tool_use_id ?? result.toolCallId;
              if (toolId) {
                toolResultsMap.set(toolId, {
                  content: result.content,
                  isError: result.isError ?? result.is_error ?? false,
                  toolName: "unknown"
                });
              }
            }
          }
        }
      }
      const messages = [];
      for (const msg of conversation.messages) {
        if (msg.role === "user") {
          const content = typeof msg.content === "string" ? msg.content : msg.text ?? "";
          if (!content.trim()) continue;
          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: "user",
            timestamp: this.extractTimestamp(msg) ?? /* @__PURE__ */ new Date(),
            content
          });
        } else if (msg.role === "assistant") {
          const { textContent, toolCallBlocks } = this.parseAssistantContent(msg);
          const toolCalls = this.extractToolCallsFromBlocks(toolCallBlocks, toolResultsMap);
          const legacyToolCalls = this.extractLegacyToolCalls(msg, toolResultsMap);
          const allToolCalls = toolCalls.length > 0 ? toolCalls : legacyToolCalls && legacyToolCalls.length > 0 ? legacyToolCalls : void 0;
          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: "assistant",
            timestamp: this.extractTimestamp(msg) ?? /* @__PURE__ */ new Date(),
            content: textContent,
            toolCalls: allToolCalls
          });
        }
      }
      if (messages.length === 0) return null;
      const timestamps = messages.map((m) => m.timestamp);
      const startTime = new Date(
        Math.min(...timestamps.map((t) => t.getTime()))
      );
      const endTime = new Date(
        Math.max(...timestamps.map((t) => t.getTime()))
      );
      const stats = this.computeStats(messages);
      return {
        sessionId,
        projectPath,
        startTime,
        endTime,
        durationSeconds: this.calculateDuration(startTime, endTime),
        claudeCodeVersion: "cursor",
        // Use 'cursor' as version identifier
        messages,
        stats,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db3?.close();
    }
  }
  async readSessionContent(filePath) {
    return "";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * List all subdirectories within a given directory
   */
  async listSubdirectories(parentDir) {
    try {
      const entries = await readdir2(parentDir);
      const dirs = [];
      for (const entry of entries) {
        const fullPath = join4(parentDir, entry);
        try {
          const stats = await stat2(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
        }
      }
      return dirs;
    } catch {
      return [];
    }
  }
  async listWorkspaceDirs() {
    return this.listSubdirectories(this.baseDir);
  }
  async listSessionDirs(workspaceDir) {
    return this.listSubdirectories(workspaceDir);
  }
  parseConversation(db3) {
    try {
      const stmt = db3.prepare("SELECT id, data FROM blobs");
      const rows = stmt.all();
      if (rows.length === 0) return null;
      const messages = [];
      let metadata;
      for (const row of rows) {
        try {
          const data = this.parseBlob(row.data);
          if (!data) continue;
          if (data.messages && Array.isArray(data.messages)) {
            messages.push(...data.messages);
          } else if (data.role) {
            const msg = {
              id: data.id ?? row.id,
              role: data.role,
              // Preserve content array for assistant messages (contains tool-call blocks)
              content: data.content,
              text: data.text,
              timestamp: data.timestamp,
              createdAt: data.createdAt,
              toolCalls: data.toolCalls ?? data.tool_calls,
              signature: data.signature
            };
            if (Array.isArray(data.content) && msg.role === "tool") {
              for (const block of data.content) {
                if (block.type === "tool-result" && typeof block.result === "string") {
                  const toolId = block.toolCallId;
                  if (toolId) {
                    msg.toolResults = msg.toolResults ?? [];
                    msg.toolResults.push({
                      toolCallId: toolId,
                      content: block.result,
                      isError: block.result.toLowerCase().includes("error")
                    });
                  }
                }
              }
            }
            if (msg.role !== "system") {
              messages.push(msg);
            }
          }
          if (data.metadata || data.workspacePath) {
            metadata = {
              workspacePath: data.workspacePath ?? data.metadata?.workspacePath,
              projectPath: data.projectPath ?? data.metadata?.projectPath,
              createdAt: data.createdAt ?? data.metadata?.createdAt,
              updatedAt: data.updatedAt ?? data.metadata?.updatedAt
            };
          }
        } catch {
        }
      }
      messages.sort((a, b) => {
        const tsA = this.extractTimestamp(a);
        const tsB = this.extractTimestamp(b);
        if (!tsA || !tsB) return 0;
        return tsA.getTime() - tsB.getTime();
      });
      return {
        id: this.generateUUID(),
        messages,
        metadata
      };
    } catch {
      return null;
    }
  }
  parseBlob(data) {
    try {
      const text = data.toString("utf-8");
      return JSON.parse(text);
    } catch {
    }
    try {
      const zlib = __require("zlib");
      const decompressed = zlib.inflateSync(data);
      return JSON.parse(decompressed.toString("utf-8"));
    } catch {
    }
    try {
      return this.parseProtobuf(data);
    } catch {
    }
    return null;
  }
  /**
   * Parse a varint from buffer at given offset
   * Protobuf uses variable-length encoding for integers
   */
  parseVarint(data, offset) {
    if (offset >= data.length) return null;
    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    const MAX_VARINT_BYTES = 10;
    while (offset + bytesRead < data.length) {
      const byte = data[offset + bytesRead];
      value |= (byte & 127) << shift;
      bytesRead++;
      const isLastByte = (byte & 128) === 0;
      if (isLastByte) break;
      shift += 7;
      if (bytesRead > MAX_VARINT_BYTES) return null;
    }
    return { value, bytesRead };
  }
  /**
   * Parse Cursor protobuf blob format
   *
   * Cursor stores some messages in a simple protobuf format:
   * - field1 (wire2): text content (message body, tool results)
   * - field2 (wire2): UUID (message ID)
   * - field3 (wire2): usually empty
   * - field4 (wire2): nested JSON (full message object)
   *
   * Wire type 2 = length-delimited (string, bytes, embedded messages)
   */
  parseProtobuf(data) {
    const fields = /* @__PURE__ */ new Map();
    let offset = 0;
    while (offset < data.length) {
      const tagVarint = this.parseVarint(data, offset);
      if (!tagVarint) break;
      const tag = tagVarint.value;
      const fieldNumber = tag >> 3;
      const wireType = tag & 7;
      offset += tagVarint.bytesRead;
      let fieldContent;
      switch (wireType) {
        case 0: {
          const varint = this.parseVarint(data, offset);
          if (!varint) break;
          fieldContent = varint.value;
          offset += varint.bytesRead;
          break;
        }
        case 1: {
          if (offset + 8 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 8);
          offset += 8;
          break;
        }
        case 2: {
          const lengthVarint = this.parseVarint(data, offset);
          if (!lengthVarint) return null;
          const length = lengthVarint.value;
          offset += lengthVarint.bytesRead;
          if (offset + length > data.length) return null;
          fieldContent = data.subarray(offset, offset + length);
          offset += length;
          break;
        }
        case 5: {
          if (offset + 4 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 4);
          offset += 4;
          break;
        }
        default:
          return null;
      }
      if (!fields.has(fieldNumber)) {
        fields.set(fieldNumber, []);
      }
      fields.get(fieldNumber).push({ wireType, content: fieldContent });
    }
    return this.mapProtobufFields(fields);
  }
  /**
   * Map protobuf fields to a message-like structure
   */
  mapProtobufFields(fields) {
    const field4 = fields.get(4);
    if (field4 && field4.length > 0) {
      for (const { content } of field4) {
        if (Buffer.isBuffer(content)) {
          try {
            const jsonStr = content.toString("utf-8");
            const parsed = JSON.parse(jsonStr);
            if (parsed && (parsed.role || parsed.messages || parsed.content)) {
              return parsed;
            }
          } catch {
          }
        }
      }
    }
    const result = {};
    const field1 = fields.get(1);
    if (field1 && field1.length > 0) {
      const { content } = field1[0];
      if (Buffer.isBuffer(content)) {
        const text = content.toString("utf-8");
        if (text.length > 0 && this.isPrintableText(text)) {
          result.text = text;
        }
      }
    }
    const field2 = fields.get(2);
    if (field2 && field2.length > 0) {
      const { content } = field2[0];
      if (Buffer.isBuffer(content)) {
        const uuid = content.toString("utf-8");
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
          result.id = uuid;
        }
      }
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
    return null;
  }
  /**
   * Check if a string is printable text (not binary garbage)
   */
  isPrintableText(str) {
    const sample = str.substring(0, 100);
    return /^[\x20-\x7E\n\r\t\u00A0-\uFFFF]+$/.test(sample);
  }
  /**
   * Convert Unix timestamp to Date, handling both seconds and milliseconds
   */
  unixToDate(timestamp) {
    const MILLISECONDS_THRESHOLD = 1e12;
    const normalizedTs = timestamp > MILLISECONDS_THRESHOLD ? timestamp : timestamp * 1e3;
    return new Date(normalizedTs);
  }
  extractTimestamp(msg) {
    if (msg.timestamp) return new Date(msg.timestamp);
    if (msg.createdAt) return this.unixToDate(msg.createdAt);
    return null;
  }
  /**
   * Parse assistant message content array to extract text and tool-call blocks
   * Cursor stores tool calls in the content array with type: 'tool-call'
   */
  parseAssistantContent(msg) {
    const textParts = [];
    const toolCallBlocks = [];
    if (typeof msg.content === "string") {
      return { textContent: msg.content, toolCallBlocks: [] };
    }
    if (!Array.isArray(msg.content)) {
      return { textContent: msg.text ?? "", toolCallBlocks: [] };
    }
    for (const block of msg.content) {
      if (block.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block.type === "reasoning" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block.type === "tool-call") {
        const toolBlock = block;
        if (toolBlock.toolCallId && toolBlock.toolName) {
          toolCallBlocks.push(toolBlock);
        }
      }
    }
    return {
      textContent: textParts.join("\n"),
      toolCallBlocks
    };
  }
  /**
   * Extract tool calls from Cursor's tool-call blocks
   */
  extractToolCallsFromBlocks(blocks, toolResultsMap) {
    const toolCalls = [];
    for (const block of blocks) {
      const id = block.toolCallId;
      const name = block.toolName;
      const input = block.args || {};
      const result = toolResultsMap.get(id);
      const normalizedName = normalizeToolName(name, this.name);
      toolCalls.push({
        id,
        name: normalizedName,
        input,
        result: result?.content,
        isError: result?.isError
      });
    }
    return toolCalls;
  }
  /**
   * Extract tool calls from legacy toolCalls/tool_calls fields
   */
  extractLegacyToolCalls(msg, toolResultsMap) {
    const rawCalls = msg.toolCalls ?? msg.tool_calls ?? [];
    if (rawCalls.length === 0) return void 0;
    const toolCalls = [];
    for (const call of rawCalls) {
      const name = call.name ?? call.function?.name ?? "unknown";
      const id = call.id ?? this.generateUUID();
      let input = {};
      if (call.input) {
        input = call.input;
      } else if (call.arguments) {
        try {
          input = typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments;
        } catch {
          input = { raw: call.arguments };
        }
      } else if (call.function?.arguments) {
        try {
          input = typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments;
        } catch {
          input = { raw: call.function.arguments };
        }
      }
      const result = toolResultsMap.get(id);
      const normalizedName = normalizeToolName(name, this.name);
      toolCalls.push({
        id,
        name: normalizedName,
        input,
        result: result?.content,
        isError: result?.isError
      });
    }
    return toolCalls.length > 0 ? toolCalls : void 0;
  }
  generateUUID() {
    return "cursor-" + Math.random().toString(36).substring(2, 15);
  }
};
var cursorSource = new CursorSource();

// lib/scanner/sources/cursor-composer.ts
import { stat as stat3 } from "fs/promises";

// lib/scanner/sources/cursor-paths.ts
import { join as join5 } from "path";
import { homedir as homedir4, platform } from "os";
function getCursorUserDir() {
  const home = homedir4();
  switch (platform()) {
    case "darwin":
      return join5(home, "Library", "Application Support", "Cursor", "User");
    case "win32":
      return join5(process.env.APPDATA ?? join5(home, "AppData", "Roaming"), "Cursor", "User");
    default:
      return join5(home, ".config", "Cursor", "User");
  }
}
function getCursorGlobalStoragePath() {
  return join5(getCursorUserDir(), "globalStorage");
}
function getCursorGlobalStateDbPath() {
  return join5(getCursorGlobalStoragePath(), "state.vscdb");
}

// lib/scanner/sources/cursor-composer.ts
var CursorComposerSource = class extends BaseSessionSource {
  name = "cursor-composer";
  displayName = "Cursor Composer";
  dbPath;
  constructor(dbPath) {
    super();
    this.dbPath = dbPath ?? getCursorGlobalStateDbPath();
  }
  getBaseDir() {
    return this.dbPath;
  }
  async isAvailable() {
    try {
      await stat3(this.dbPath);
      const Database3 = await loadSqlite();
      return Database3 !== null;
    } catch {
      return false;
    }
  }
  /**
   * Collect file metadata for all composer sessions in state.vscdb.
   *
   * Each composerId becomes a virtual "file" entry with a synthetic path
   * of the form: state.vscdb#{composerId}
   */
  async collectFileMetadata(config) {
    const Database3 = await loadSqlite();
    if (!Database3) return [];
    let db3 = null;
    try {
      db3 = new Database3(this.dbPath, { readonly: true });
      const composerIds = this.listComposerIds(db3);
      const results = [];
      for (const composerId of composerIds) {
        try {
          const data = this.getComposerData(db3, composerId);
          if (!data) continue;
          const bubbleCount = this.countBubbles(db3, composerId);
          const estimatedSize = bubbleCount * 2048;
          if (config?.minFileSize && estimatedSize < config.minFileSize) continue;
          if (config?.maxFileSize && estimatedSize > config.maxFileSize) continue;
          const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbles(db3, composerId) ?? "unknown";
          const createdAt = data.createdAt ? new Date(data.createdAt) : /* @__PURE__ */ new Date();
          const lastUpdated = data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : createdAt;
          results.push({
            filePath: `${this.dbPath}#${composerId}`,
            fileSize: estimatedSize,
            mtime: lastUpdated,
            projectDirName: this.encodeProjectDir(projectDir),
            source: this.name
          });
        } catch {
        }
      }
      return results;
    } catch {
      return [];
    } finally {
      db3?.close();
    }
  }
  async extractMetadata(filePath, _content) {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;
    const Database3 = await loadSqlite();
    if (!Database3) return null;
    let db3 = null;
    try {
      db3 = new Database3(this.dbPath, { readonly: true });
      const data = this.getComposerData(db3, composerId);
      if (!data) return null;
      const bubbles = this.getBubbles(db3, composerId);
      const conversationBubbles = bubbles.filter((b) => b.type === 1 || b.type === 2);
      if (conversationBubbles.length === 0) return null;
      const timestamps = conversationBubbles.map((b) => b.createdAt ? new Date(b.createdAt) : null).filter((t) => t !== null && !isNaN(t.getTime()));
      if (timestamps.length === 0) return null;
      const firstTimestamp = new Date(Math.min(...timestamps.map((t) => t.getTime())));
      const lastTimestamp = new Date(Math.max(...timestamps.map((t) => t.getTime())));
      const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbleList(bubbles) ?? "unknown";
      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        timestamp: firstTimestamp,
        messageCount: conversationBubbles.length,
        durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
        filePath,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db3?.close();
    }
  }
  async parseSessionContent(_sessionId, _projectPath, _projectName, _content) {
    return null;
  }
  /**
   * Parse a composer session directly from state.vscdb
   */
  async parseFromFile(filePath) {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;
    const Database3 = await loadSqlite();
    if (!Database3) return null;
    let db3 = null;
    try {
      db3 = new Database3(this.dbPath, { readonly: true });
      const data = this.getComposerData(db3, composerId);
      if (!data) return null;
      const bubbles = this.getBubbles(db3, composerId);
      if (bubbles.length === 0) return null;
      const messages = this.convertBubblesToMessages(bubbles);
      if (messages.length === 0) return null;
      const timestamps = messages.map((m) => m.timestamp);
      const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
      const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
      const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbleList(bubbles) ?? "unknown";
      const stats = this.computeStats(messages);
      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        startTime,
        endTime,
        durationSeconds: this.calculateDuration(startTime, endTime),
        claudeCodeVersion: "cursor-composer",
        messages,
        stats,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db3?.close();
    }
  }
  async readSessionContent(_filePath) {
    return "";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Database query helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * List all composer IDs from composerData:* keys
   */
  listComposerIds(db3) {
    const stmt = db3.prepare(
      "SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%'"
    );
    const rows = stmt.all();
    return rows.map((r) => r.key.replace("composerData:", ""));
  }
  /**
   * Get composer metadata for a specific composer ID
   */
  getComposerData(db3, composerId) {
    const stmt = db3.prepare(
      "SELECT value FROM cursorDiskKV WHERE key = ?"
    );
    const row = stmt.get(`composerData:${composerId}`);
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  /**
   * Count bubbles for a composer session
   */
  countBubbles(db3, composerId) {
    const stmt = db3.prepare(
      "SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE ?"
    );
    const row = stmt.get(`bubbleId:${composerId}:%`);
    return row?.count ?? 0;
  }
  /**
   * Get all bubbles for a composer session, sorted by creation time
   */
  getBubbles(db3, composerId) {
    const stmt = db3.prepare(
      "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?"
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`);
    const bubbles = [];
    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value);
        bubbles.push(bubble);
      } catch {
      }
    }
    bubbles.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    return bubbles;
  }
  /**
   * Get project directory from the first bubble that has workspaceProjectDir
   */
  getProjectDirFromBubbles(db3, composerId) {
    const stmt = db3.prepare(
      "SELECT value FROM cursorDiskKV WHERE key LIKE ? LIMIT 20"
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`);
    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value);
        if (bubble.workspaceProjectDir) {
          return bubble.workspaceProjectDir;
        }
      } catch {
      }
    }
    return null;
  }
  /**
   * Get project directory from already-loaded bubbles
   */
  getProjectDirFromBubbleList(bubbles) {
    for (const bubble of bubbles) {
      if (bubble.workspaceProjectDir) {
        return bubble.workspaceProjectDir;
      }
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Bubble → ParsedMessage conversion
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Convert sorted bubbles into ParsedMessages.
   *
   * Conversion rules:
   * - User bubbles (type=1): → ParsedMessage { role: 'user' }
   * - Assistant text bubbles (type=2, has text): → ParsedMessage { role: 'assistant' }
   * - Assistant tool bubbles (type=2, has toolFormerData): → append toolCall to previous assistant message
   * - Thinking bubbles (type=2, has thinking): → skip (not relevant for analysis)
   * - Empty bubbles (type=2, no text, no tool): → skip
   *
   * Consecutive assistant tool bubbles are merged into the preceding text message.
   */
  convertBubblesToMessages(bubbles) {
    const messages = [];
    let currentAssistant = null;
    for (const bubble of bubbles) {
      if (bubble.type === 1) {
        const text = bubble.text?.trim();
        if (!text) continue;
        currentAssistant = null;
        messages.push({
          uuid: this.generateUUID(),
          role: "user",
          timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
          content: text
        });
      } else if (bubble.type === 2) {
        const hasText = bubble.text && bubble.text.trim().length > 0;
        const hasTool = bubble.toolFormerData != null;
        const hasThinking = bubble.thinking?.text != null;
        if (hasThinking && !hasText && !hasTool) {
          continue;
        }
        if (hasText) {
          currentAssistant = {
            uuid: this.generateUUID(),
            role: "assistant",
            timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
            content: bubble.text.trim(),
            toolCalls: [],
            tokenUsage: this.extractTokenUsage(bubble)
          };
          messages.push(currentAssistant);
        }
        if (hasTool) {
          const toolCall = this.convertToolFormerData(bubble.toolFormerData);
          if (toolCall) {
            if (currentAssistant) {
              if (!currentAssistant.toolCalls) {
                currentAssistant.toolCalls = [];
              }
              currentAssistant.toolCalls.push(toolCall);
            } else {
              currentAssistant = {
                uuid: this.generateUUID(),
                role: "assistant",
                timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
                content: "",
                toolCalls: [toolCall],
                tokenUsage: this.extractTokenUsage(bubble)
              };
              messages.push(currentAssistant);
            }
          }
        }
        if (bubble.tokenCount && currentAssistant) {
          const usage = this.extractTokenUsage(bubble);
          if (usage && (usage.input > 0 || usage.output > 0)) {
            currentAssistant.tokenUsage = usage;
          }
        }
      }
    }
    for (const msg of messages) {
      if (msg.toolCalls && msg.toolCalls.length === 0) {
        delete msg.toolCalls;
      }
    }
    return messages;
  }
  /**
   * Convert toolFormerData to a ToolCall
   */
  convertToolFormerData(toolData) {
    const toolName = resolveComposerToolId(toolData.tool);
    let input = {};
    if (toolData.rawArgs) {
      try {
        input = JSON.parse(toolData.rawArgs);
      } catch {
        input = { raw: toolData.rawArgs };
      }
    }
    return {
      id: toolData.toolCallId ?? this.generateUUID(),
      name: toolName,
      input
    };
  }
  /**
   * Extract token usage from bubble
   */
  extractTokenUsage(bubble) {
    if (!bubble.tokenCount) return void 0;
    const input = bubble.tokenCount.inputTokens ?? 0;
    const output = bubble.tokenCount.outputTokens ?? 0;
    if (input === 0 && output === 0) return void 0;
    return { input, output };
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Utility helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Extract composerId from synthetic file path: state.vscdb#{composerId}
   */
  extractComposerId(filePath) {
    const hashIndex = filePath.indexOf("#");
    if (hashIndex === -1) return null;
    return filePath.substring(hashIndex + 1);
  }
  /**
   * Encode a project directory path into a safe directory name.
   * Replaces '/' with '-' for consistency with ClaudeCodeSource encoding.
   */
  encodeProjectDir(projectDir) {
    return projectDir.replace(/\//g, "-");
  }
  generateUUID() {
    return "composer-" + Math.random().toString(36).substring(2, 15);
  }
};
var cursorComposerSource = new CursorComposerSource();

// lib/scanner/sources/claude-discovery.ts
import { readdir as readdir3, stat as stat4, realpath } from "fs/promises";
import { join as join6 } from "path";
import { homedir as homedir5 } from "os";
async function validateClaudeDataDir(dir) {
  try {
    const projectsDir = join6(dir, "projects");
    const projectsStat = await stat4(projectsDir);
    if (!projectsStat.isDirectory()) return false;
    const entries = await readdir3(projectsDir);
    for (const entry of entries) {
      if (!entry.startsWith("-") && !isWindowsEncodedPath(entry)) continue;
      const entryPath = join6(projectsDir, entry);
      const entryStat = await stat4(entryPath);
      if (!entryStat.isDirectory()) continue;
      const files = await readdir3(entryPath);
      if (files.some((f) => f.endsWith(".jsonl"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
async function discoverClaudeDataDirs() {
  const discovered = /* @__PURE__ */ new Map();
  const addIfValid = async (dir) => {
    try {
      const projectsDir = join6(dir, "projects");
      const resolved = await realpath(projectsDir);
      if (discovered.has(resolved)) return true;
      if (await validateClaudeDataDir(dir)) {
        discovered.set(resolved, projectsDir);
        return true;
      }
    } catch {
    }
    return false;
  };
  const defaultDir = join6(homedir5(), ".claude");
  await addIfValid(defaultDir);
  if (discovered.size > 0) {
    return Array.from(discovered.values());
  }
  try {
    const home = homedir5();
    const entries = await readdir3(home);
    for (const entry of entries) {
      if (!entry.startsWith(".claude")) continue;
      if (entry === ".claude") continue;
      const candidateDir = join6(home, entry);
      try {
        const s = await stat4(candidateDir);
        if (s.isDirectory()) {
          await addIfValid(candidateDir);
        }
      } catch {
      }
    }
  } catch {
  }
  return Array.from(discovered.values());
}

// lib/scanner/index.ts
var SourceRegistry = class {
  sources = [];
  claudeInitialized = false;
  constructor() {
    this.register(new CursorSource());
    this.register(new CursorComposerSource());
  }
  /**
   * Register a new session source
   */
  register(source) {
    this.sources.push(source);
  }
  /**
   * Get all registered sources
   */
  getAll() {
    return [...this.sources];
  }
  /**
   * Get available sources (directory exists, dependencies met).
   * Lazily initializes Claude Code sources on first call.
   */
  async getAvailable() {
    if (!this.claudeInitialized) {
      await this.initClaudeSources();
      this.claudeInitialized = true;
    }
    const available = [];
    for (const source of this.sources) {
      if (await source.isAvailable()) {
        available.push(source);
      }
    }
    return available;
  }
  /**
   * Get a specific source by name
   */
  get(name) {
    return this.sources.find((s) => s.name === name);
  }
  /**
   * Discover and register Claude Code sources from available data directories.
   */
  async initClaudeSources() {
    const dirs = await discoverClaudeDataDirs();
    for (const dir of dirs) {
      this.register(new ClaudeCodeSource(dir));
    }
  }
};
var sourceRegistry = new SourceRegistry();
var MultiSourceScanner = class {
  constructor(registry = sourceRegistry) {
    this.registry = registry;
  }
  /**
   * Collect file metadata from all available sources
   */
  async collectAllFileMetadata(config) {
    const sources = await this.getFilteredSources(config);
    const allFiles = [];
    const sourceStats = /* @__PURE__ */ new Map();
    for (const source of sources) {
      const files = await source.collectFileMetadata({
        minFileSize: config?.minFileSize,
        maxFileSize: config?.maxFileSize
      });
      allFiles.push(...files);
      sourceStats.set(source.name, files.length);
    }
    return { files: allFiles, sourceStats };
  }
  /**
   * Extract metadata for a file from the appropriate source
   */
  async extractMetadata(file) {
    const source = this.registry.get(file.source);
    if (!source) return null;
    try {
      const content = await source.readSessionContent(file.filePath);
      return source.extractMetadata(file.filePath, content);
    } catch {
      return null;
    }
  }
  /**
   * Parse a session from the appropriate source
   */
  async parseSession(metadata) {
    const source = this.registry.get(metadata.source);
    if (!source) return null;
    try {
      if (metadata.source === "cursor") {
        const cursorSource2 = source;
        return cursorSource2.parseFromFile(metadata.filePath);
      }
      if (metadata.source === "cursor-composer") {
        const composerSource = source;
        return composerSource.parseFromFile(metadata.filePath);
      }
      const content = await source.readSessionContent(metadata.filePath);
      return source.parseSessionContent(
        metadata.sessionId,
        metadata.projectPath,
        metadata.projectName,
        content
      );
    } catch {
      return null;
    }
  }
  /**
   * Get available source names
   */
  async getAvailableSources() {
    const sources = await this.registry.getAvailable();
    return sources.map((s) => s.name);
  }
  /**
   * Check source availability status.
   * Triggers lazy Claude source init if not yet done.
   */
  async getSourceStatus() {
    const available = await this.registry.getAvailable();
    const status = /* @__PURE__ */ new Map();
    for (const source of this.registry.getAll()) {
      status.set(source.name, available.some((s) => s === source));
    }
    return status;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────
  async getFilteredSources(config) {
    let sources = await this.registry.getAvailable();
    if (config?.includeSources && config.includeSources.length > 0) {
      sources = sources.filter((s) => config.includeSources.includes(s.name));
    }
    if (config?.excludeSources && config.excludeSources.length > 0) {
      sources = sources.filter((s) => !config.excludeSources.includes(s.name));
    }
    return sources;
  }
};
var multiSourceScanner = new MultiSourceScanner();

// lib/core/multi-source-session-scanner.ts
function getParsedSessionsCachePath() {
  return join7(getScanCacheDir(), "parsed-sessions.json");
}
function isNonNull(value) {
  return value !== null;
}
function serializeParsedSession(session) {
  return {
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    durationSeconds: session.durationSeconds,
    claudeCodeVersion: session.claudeCodeVersion,
    messages: session.messages.map((message) => ({
      uuid: message.uuid,
      role: message.role,
      timestamp: message.timestamp.toISOString(),
      content: message.content,
      toolCalls: message.toolCalls,
      tokenUsage: message.tokenUsage
    })),
    stats: session.stats,
    source: session.source
  };
}
async function scanAndCacheParsedSessions() {
  const { files } = await multiSourceScanner.collectAllFileMetadata({
    minFileSize: 1024,
    maxFileSize: 50 * 1024 * 1024
  });
  const metadata = (await Promise.all(files.map((file) => multiSourceScanner.extractMetadata(file)))).filter(isNonNull).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const parsedSessions = (await Promise.all(metadata.map((item) => multiSourceScanner.parseSession(item)))).filter(isNonNull).map(serializeParsedSession).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  await cacheParsedSessions(parsedSessions);
  return parsedSessions;
}
async function cacheParsedSessions(sessions) {
  const scanCacheDir = getScanCacheDir();
  const cachePath = getParsedSessionsCachePath();
  await mkdir(scanCacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(sessions, null, 2), "utf-8");
  return cachePath;
}
async function readCachedParsedSessions() {
  try {
    const raw = await readFile2(getParsedSessionsCachePath(), "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// mcp/tools/scan-sessions.ts
var definition4 = {
  name: "scan_sessions",
  description: "Scan Claude Code and Cursor session logs on this machine. Returns session metadata (count, date range, projects, total messages, and sources). Use this as the first step before running extract_data. Does not return full session content."
};
async function execute(_args) {
  const sessions = await scanAndCacheParsedSessions();
  if (sessions.length === 0) {
    return JSON.stringify({
      status: "no_sessions",
      message: "No supported Claude Code or Cursor sessions found on this machine."
    });
  }
  const projectNames = [...new Set(sessions.map((s) => s.projectName ?? "unknown"))];
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const sourceCounts = sessions.reduce((acc, session) => {
    const source = session.source ?? "unknown";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const earliest = sessions[sessions.length - 1];
  const latest = sessions[0];
  const pending = isAnalysisPending();
  const analysisState = getAnalysisLifecycleState();
  return JSON.stringify({
    status: "ok",
    sessionCount: sessions.length,
    projectCount: projectNames.length,
    projects: projectNames.slice(0, 10),
    sources: sourceCounts,
    totalMessages,
    totalDurationMinutes: Math.round(totalDuration / 60),
    dateRange: {
      earliest: earliest.startTime,
      latest: latest.startTime
    },
    avgMessagesPerSession: Math.round(totalMessages / sessions.length),
    analysisState,
    analysisPending: pending,
    message: pending ? `Found ${sessions.length} sessions. A queued BetterPrompt analysis is pending and will be injected on the next session start. You can also run the analyze skill now.` : `Found ${sessions.length} sessions across ${projectNames.length} projects. Call extract_data to run Phase 1 extraction.`
  });
}

// mcp/tools/extract-data.ts
import { writeFile as writeFile2, mkdir as mkdir2 } from "fs/promises";
import { join as join8 } from "path";

// lib/core/data-extractor.ts
var MAX_TEXT_LENGTH = 2e3;
var KNOWN_SLASH_COMMANDS = /* @__PURE__ */ new Set([
  "plan",
  "review",
  "commit",
  "compact",
  "clear",
  "help",
  "init",
  "sisyphus",
  "orchestrator",
  "ultrawork",
  "ralph-loop",
  "deepsearch",
  "analyze",
  "prometheus",
  "cancel-ralph",
  "update",
  "bug",
  "config",
  "cost",
  "doctor",
  "login",
  "logout",
  "memory",
  "model",
  "permissions",
  "project",
  "status",
  "terminal-setup",
  "vim",
  "fast"
]);
var CLEAR_COMMAND_PATTERNS = [
  /^\/clear\b/m,
  /<command-name>\/clear<\/command-name>/
];
var INSIGHT_BLOCK_PATTERN = /`★\s*Insight\s*─+`\n([\s\S]*?)\n`─+`/g;
function stripSystemTags(content) {
  return content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1").replace(/<EXTREMELY_IMPORTANT>[\s\S]*?<\/EXTREMELY_IMPORTANT>/g, "").replace(/<tool_result>[\s\S]*?<\/tool_result>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "... [truncated]";
}
function countWords(text) {
  const cleaned = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}
function hasCodeBlock(text) {
  return /```/.test(text);
}
function hasQuestion(text) {
  return /\?/.test(text);
}
function isContinuation(text) {
  const lower = text.toLowerCase().trim();
  return /^(continue|go ahead|proceed|keep going|next|yes|ok|okay|sure|do it|let's go)/i.test(lower);
}
function isClearCommand(content) {
  return CLEAR_COMMAND_PATTERNS.some((p) => p.test(content));
}
function extractSlashCommands(rawContent) {
  const commands = [];
  const xmlPattern = /<command-name>\/([\w-]+)<\/command-name>/g;
  let match;
  while ((match = xmlPattern.exec(rawContent)) !== null) {
    commands.push(match[1]);
  }
  const plainPattern = /^\/(\w[\w-]*)/gm;
  while ((match = plainPattern.exec(rawContent)) !== null) {
    const cmd = match[1];
    if (KNOWN_SLASH_COMMANDS.has(cmd)) {
      commands.push(cmd);
    }
  }
  return commands;
}
function extractTextFromContent(content) {
  if (typeof content === "string") return content;
  return content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}
function assistantHadError(assistantContent) {
  return assistantContent.some((block) => block.type === "tool_result" && block.is_error);
}
function extractToolCallNames(assistantContent) {
  return assistantContent.filter((block) => block.type === "tool_use").map((block) => block.name);
}
var REJECTION_PATTERNS = [
  /\bno\b/i,
  /\bwrong\b/i,
  /\bincorrect\b/i,
  /\btry again\b/i,
  /\bthat's not right\b/i,
  /\bnot what i/i,
  /\bdon't\b.*\bthat\b/i,
  /\bundo\b/i,
  /\brevert\b/i
];
var FRUSTRATION_PATTERNS = [
  /\bagain\b/i,
  /\bstill not working\b/i,
  /\bsame error\b/i,
  /\bfrustrat/i,
  /\bugh\b/i,
  /\bwhy (won't|doesn't|isn't)/i
];
function isRejection(text) {
  const lower = text.toLowerCase();
  if (lower.length > 200) return false;
  return REJECTION_PATTERNS.some((p) => p.test(lower));
}
function isFrustration(text) {
  return FRUSTRATION_PATTERNS.some((p) => p.test(text));
}
function toRawSessionData(session) {
  return {
    sessionId: session.sessionId,
    messages: session.messages.map((message) => {
      if (message.role === "user") {
        return {
          role: "user",
          rawContent: message.content,
          content: [{ type: "text", text: message.content }],
          timestamp: new Date(message.timestamp)
        };
      }
      const content = [];
      if (message.content) {
        content.push({ type: "text", text: message.content });
      }
      for (const toolCall of message.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name
        });
        if (toolCall.result !== void 0) {
          content.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: toolCall.result,
            is_error: toolCall.isError
          });
        }
      }
      return {
        role: "assistant",
        rawContent: message.content,
        content,
        timestamp: new Date(message.timestamp),
        tokenUsage: message.tokenUsage
      };
    })
  };
}
function extractFromSession(session) {
  const utterances = [];
  const slashCommands = [];
  const insightBlocks = [];
  const seenKeys = /* @__PURE__ */ new Set();
  let precedingAssistantContent = null;
  for (let i = 0; i < session.messages.length; i++) {
    const message = session.messages[i];
    if (message.role === "user") {
      const rawText = extractTextFromContent(
        message.content
      );
      slashCommands.push(...extractSlashCommands(message.rawContent || rawText));
      if (isClearCommand(rawText)) {
        precedingAssistantContent = null;
        continue;
      }
      const cleanText = stripSystemTags(rawText);
      if (!cleanText.trim()) continue;
      const dedupeKey = `${message.timestamp.toISOString()}|${cleanText.slice(0, 200)}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      const text = truncateText(cleanText, MAX_TEXT_LENGTH);
      const id = `${session.sessionId}_${i}`;
      utterances.push({
        id,
        text,
        timestamp: message.timestamp.toISOString(),
        sessionId: session.sessionId,
        turnIndex: i,
        characterCount: cleanText.length,
        wordCount: countWords(cleanText),
        hasCodeBlock: hasCodeBlock(cleanText),
        hasQuestion: hasQuestion(cleanText),
        isSessionStart: utterances.length === 0,
        isContinuation: isContinuation(cleanText),
        precedingAIToolCalls: precedingAssistantContent ? extractToolCallNames(precedingAssistantContent) : void 0,
        precedingAIHadError: precedingAssistantContent ? assistantHadError(precedingAssistantContent) : void 0
      });
      precedingAssistantContent = null;
    } else if (message.role === "assistant") {
      precedingAssistantContent = message.content;
      const assistantText = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      let match;
      const pattern = new RegExp(INSIGHT_BLOCK_PATTERN.source, "g");
      while ((match = pattern.exec(assistantText)) !== null) {
        const content = match[1].trim().slice(0, 500);
        if (content) {
          insightBlocks.push({
            sessionId: session.sessionId,
            turnIndex: i,
            content,
            triggeringUtteranceId: utterances.length > 0 ? utterances[utterances.length - 1].id : void 0
          });
        }
      }
    }
  }
  return { utterances, slashCommands, insightBlocks };
}
function computeFrictionSignals(sessions, utterances) {
  let toolFailureCount = 0;
  let userRejectionSignals = 0;
  let excessiveIterationSessions = 0;
  let contextOverflowSessions = 0;
  let frustrationExpressionCount = 0;
  let bareRetryAfterErrorCount = 0;
  let errorChainMaxLength = 0;
  for (const session of sessions) {
    let sessionUserMessages = 0;
    let sessionHadOverflow = false;
    let currentErrorChain = 0;
    for (const message of session.messages) {
      if (message.role === "user") {
        sessionUserMessages++;
      } else if (message.role === "assistant") {
        for (const block of message.content) {
          if (block.type === "tool_result" && block.is_error) {
            toolFailureCount++;
            currentErrorChain++;
            errorChainMaxLength = Math.max(errorChainMaxLength, currentErrorChain);
          }
        }
        if (message.tokenUsage && message.tokenUsage.input / CONTEXT_WINDOW_SIZE >= 0.9) {
          sessionHadOverflow = true;
        }
      }
      if (message.role === "assistant") {
        const hasError = message.content.some((b) => b.type === "tool_result" && b.is_error);
        if (!hasError) currentErrorChain = 0;
      }
    }
    if (sessionUserMessages >= 10) excessiveIterationSessions++;
    if (sessionHadOverflow) contextOverflowSessions++;
  }
  for (const u of utterances) {
    if (isRejection(u.text)) userRejectionSignals++;
    if (isFrustration(u.text)) frustrationExpressionCount++;
    if (u.precedingAIHadError && u.wordCount < 10) {
      bareRetryAfterErrorCount++;
    }
  }
  const errorPatterns = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === "assistant") {
        for (const block of message.content) {
          if (block.type === "tool_result" && block.is_error) {
            const errText = typeof block.content === "string" ? block.content : "";
            const fingerprint = errText.replace(/\/[\w/.-]+/g, "<path>").replace(/\d{4}-\d{2}-\d{2}/g, "<date>").slice(0, 100);
            errorPatterns.set(fingerprint, (errorPatterns.get(fingerprint) ?? 0) + 1);
          }
        }
      }
    }
  }
  const repeatedToolErrorPatterns = [...errorPatterns.values()].filter((c) => c >= 2).length;
  return {
    toolFailureCount,
    userRejectionSignals,
    excessiveIterationSessions,
    contextOverflowSessions,
    frustrationExpressionCount,
    repeatedToolErrorPatterns,
    bareRetryAfterErrorCount,
    errorChainMaxLength
  };
}
function computeSessionHints(sessions) {
  let totalUserTurns = 0;
  let shortSessions = 0;
  let mediumSessions = 0;
  let longSessions = 0;
  for (const session of sessions) {
    const userTurns = session.messages.filter((m) => m.role === "user").length;
    totalUserTurns += userTurns;
    if (userTurns <= 3) shortSessions++;
    else if (userTurns <= 10) mediumSessions++;
    else longSessions++;
  }
  return {
    avgTurnsPerSession: sessions.length > 0 ? totalUserTurns / sessions.length : 0,
    shortSessions,
    mediumSessions,
    longSessions
  };
}
function computeContextFillMetrics(sessions) {
  const fillPercentages = [];
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === "assistant" && message.tokenUsage?.input) {
        fillPercentages.push(message.tokenUsage.input / CONTEXT_WINDOW_SIZE * 100);
      }
    }
  }
  if (fillPercentages.length === 0) return {};
  const avgFill = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
  const maxFill = Math.max(...fillPercentages);
  return {
    avgContextFillPercent: Math.round(avgFill * 10) / 10,
    maxContextFillPercent: Math.round(maxFill * 10) / 10,
    contextFillExceeded90Count: fillPercentages.filter((p) => p >= 90).length
  };
}
async function extractPhase1DataFromParsedSessions(sessions) {
  const allUtterances = [];
  const allSlashCommands = [];
  const allInsightBlocks = [];
  const allSessions = [];
  if (sessions.length === 0) {
    throw new Error("No parsed sessions available for Phase 1 extraction.");
  }
  for (const parsedSession of sessions) {
    const session = toRawSessionData(parsedSession);
    allSessions.push(session);
    const { utterances, slashCommands, insightBlocks } = extractFromSession(session);
    allUtterances.push(...utterances);
    allSlashCommands.push(...slashCommands);
    allInsightBlocks.push(...insightBlocks);
  }
  const totalMessages = allSessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalUserMessages = allSessions.reduce(
    (sum, s) => sum + s.messages.filter((m) => m.role === "user").length,
    0
  );
  const questionCount = allUtterances.filter((u) => u.hasQuestion).length;
  const codeBlockCount = allUtterances.filter((u) => u.hasCodeBlock).length;
  const slashCommandCounts = {};
  for (const cmd of allSlashCommands) {
    slashCommandCounts[cmd] = (slashCommandCounts[cmd] ?? 0) + 1;
  }
  const timestamps = allUtterances.map((u) => u.timestamp).sort();
  const contextFillMetrics = computeContextFillMetrics(allSessions);
  const frictionSignals = computeFrictionSignals(allSessions, allUtterances);
  const sessionHints = computeSessionHints(allSessions);
  const sessionMetrics = {
    totalSessions: allSessions.length,
    totalMessages,
    totalDeveloperUtterances: allUtterances.length,
    totalAIResponses: totalMessages - totalUserMessages,
    avgMessagesPerSession: allSessions.length > 0 ? totalMessages / allSessions.length : 0,
    avgDeveloperMessageLength: allUtterances.length > 0 ? allUtterances.reduce((sum, u) => sum + u.characterCount, 0) / allUtterances.length : 0,
    questionRatio: allUtterances.length > 0 ? questionCount / allUtterances.length : 0,
    codeBlockRatio: allUtterances.length > 0 ? codeBlockCount / allUtterances.length : 0,
    dateRange: {
      earliest: timestamps[0] ?? (/* @__PURE__ */ new Date()).toISOString(),
      latest: timestamps[timestamps.length - 1] ?? (/* @__PURE__ */ new Date()).toISOString()
    },
    ...Object.keys(slashCommandCounts).length > 0 ? { slashCommandCounts } : {},
    ...contextFillMetrics,
    frictionSignals,
    sessionHints,
    ...allInsightBlocks.length > 0 ? { aiInsightBlockCount: allInsightBlocks.length } : {}
  };
  const activitySessions = allSessions.map((session, idx) => {
    const parsedSession = sessions[idx];
    const userMessages = session.messages.filter((m) => m.role === "user");
    const assistantMessages = session.messages.filter((m) => m.role === "assistant");
    const sessionTimestamps = session.messages.map((m) => m.timestamp.getTime()).sort();
    const startTime = sessionTimestamps.length > 0 ? new Date(sessionTimestamps[0]).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const endTime = sessionTimestamps.length > 0 ? sessionTimestamps[sessionTimestamps.length - 1] : Date.now();
    const durationSeconds = sessionTimestamps.length > 1 ? (endTime - sessionTimestamps[0]) / 1e3 : parsedSession.durationSeconds;
    const totalInputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.input ?? 0), 0);
    const totalOutputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.output ?? 0), 0);
    const firstUserMsg = userMessages[0]?.rawContent?.slice(0, 200) ?? "";
    return {
      sessionId: session.sessionId,
      projectName: parsedSession.projectName ?? "unknown",
      ...parsedSession.projectPath ? { projectPath: parsedSession.projectPath } : {},
      startTime,
      durationSeconds: Math.round(durationSeconds),
      messageCount: session.messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      totalInputTokens,
      totalOutputTokens,
      ...firstUserMsg ? { firstUserMessage: firstUserMsg } : {}
    };
  });
  return {
    developerUtterances: allUtterances,
    sessionMetrics,
    ...allInsightBlocks.length > 0 ? { aiInsightBlocks: allInsightBlocks } : {},
    activitySessions,
    sessions
  };
}

// mcp/tools/extract-data.ts
var definition5 = {
  name: "extract_data",
  description: "Run deterministic Phase 1 data extraction on scanned sessions. Extracts developer utterances, computes session metrics, friction signals, and deterministic scores. Must call scan_sessions first. Returns summary metrics and creates an analysis run for subsequent domain analysis."
};
async function execute2(args) {
  const maxSessions = args.maxSessions ?? 50;
  const sessions = await readCachedParsedSessions();
  if (sessions.length === 0) {
    return JSON.stringify({
      status: "no_data",
      message: "No cached parsed sessions. Call scan_sessions first."
    });
  }
  clearAnalysisPending();
  markAnalysisStarted();
  try {
    const selectedSessions = sessions.slice(0, maxSessions);
    const phase1Output = await extractPhase1DataFromParsedSessions(selectedSessions);
    const scores = computeDeterministicScores(phase1Output);
    const activitySessions = buildReportActivitySessions(phase1Output);
    const pluginDataDir = getPluginDataDir();
    await mkdir2(pluginDataDir, { recursive: true });
    const phase1Path = join8(pluginDataDir, "phase1-output.json");
    await writeFile2(phase1Path, JSON.stringify(phase1Output, null, 2), "utf-8");
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores,
      phase1Output,
      activitySessions
    });
    const runIdPath = join8(pluginDataDir, "current-run-id.txt");
    await writeFile2(runIdPath, String(runId), "utf-8");
    const metrics = phase1Output.sessionMetrics;
    return JSON.stringify({
      status: "ok",
      runId,
      phase1OutputPath: phase1Path,
      metrics: {
        totalSessions: metrics.totalSessions,
        totalUtterances: metrics.totalDeveloperUtterances,
        totalMessages: metrics.totalMessages,
        avgMessagesPerSession: Math.round(metrics.avgMessagesPerSession),
        avgMessageLength: Math.round(metrics.avgDeveloperMessageLength),
        questionRatio: Math.round(metrics.questionRatio * 100),
        codeBlockRatio: Math.round(metrics.codeBlockRatio * 100),
        dateRange: metrics.dateRange
      },
      deterministicScores: {
        thinkingQuality: scores.thinkingQuality,
        communicationPatterns: scores.communicationPatterns,
        learningBehavior: scores.learningBehavior,
        contextEfficiency: scores.contextEfficiency,
        sessionOutcome: scores.sessionOutcome,
        controlScore: scores.controlScore
      },
      message: `Extracted ${metrics.totalDeveloperUtterances} utterances from ${metrics.totalSessions} sessions. Analysis run #${runId} created. Phase 1 data saved to ${phase1Path}. Ready for domain analysis.`
    });
  } catch (error) {
    markAnalysisFailed(error);
    throw error;
  }
}

// mcp/tools/save-domain-results.ts
import { z } from "zod";
var definition6 = {
  name: "save_domain_results",
  description: "Save structured analysis results for a specific domain. Called after analyzing a domain (thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome, or content). Input must include domain name, overall score, strengths, and growth areas."
};
function extractDomainName(args) {
  return typeof args.domain === "string" ? args.domain : null;
}
var ThinkingQualityDataSchema = z.object({
  planningHabits: z.union([
    // Canonical array format: [{ type, frequency, examples, effectiveness }]
    z.array(z.object({
      type: z.string(),
      frequency: z.string().optional(),
      examples: z.array(z.string()).optional(),
      effectiveness: z.string().optional()
    }).passthrough()).min(1),
    // Plugin summary format: { dominantType, typeDistribution, ... }
    z.object({
      dominantType: z.string().optional(),
      typeDistribution: z.record(z.string(), z.number()).optional()
    }).passthrough()
  ]),
  verificationBehavior: z.object({
    level: z.string()
  }).passthrough(),
  criticalThinkingMoments: z.array(z.object({
    type: z.string(),
    quote: z.string().optional(),
    result: z.string().optional(),
    utteranceId: z.string().optional(),
    sessionId: z.string().optional()
  }).passthrough()),
  verificationAntiPatterns: z.array(z.object({
    type: z.string(),
    frequency: z.number().optional(),
    severity: z.string().optional(),
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional(),
    improvement: z.string().optional()
  }).passthrough()),
  planQualityScore: z.number().min(0).max(100).optional(),
  multitaskingPattern: MultitaskingPatternSchema.optional()
}).passthrough();
var CommunicationPatternsDataSchema = z.object({
  communicationPatterns: z.array(z.object({
    // Accept any of: patternName (canonical), patternId, title (plugin)
    patternName: z.string().optional(),
    patternId: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    // Frequency: accept both enum string and number
    frequency: z.union([z.string(), z.number()]).optional(),
    effectiveness: z.string().optional(),
    tip: z.string().optional(),
    // Examples: accept both canonical and plugin evidence format
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional()
  }).passthrough()).min(1),
  signatureQuotes: z.array(z.object({
    utteranceId: z.string()
  }).passthrough()).optional(),
  structuralDistribution: z.record(z.string(), z.number()).optional(),
  contextDistribution: z.record(z.string(), z.number()).optional(),
  questioningDistribution: z.record(z.string(), z.number()).optional()
}).passthrough();
var LearningBehaviorDataSchema = z.object({
  knowledgeGaps: z.array(z.object({
    // Accept both canonical (topic) and plugin (area) field names
    area: z.string().optional(),
    topic: z.string().optional(),
    severity: z.string().optional(),
    trend: z.string().optional(),
    evidence: z.array(z.unknown()).optional(),
    description: z.string().optional(),
    questionCount: z.number().optional(),
    depth: z.string().optional(),
    example: z.string().optional()
  }).passthrough()).optional(),
  repeatedMistakePatterns: z.array(z.object({
    category: z.string(),
    description: z.string().optional(),
    mistakeType: z.string().optional(),
    // Accept both canonical (occurrenceCount) and plugin (frequency)
    frequency: z.number().optional(),
    occurrenceCount: z.number().optional(),
    sessionsAffected: z.array(z.string()).optional(),
    exampleUtteranceIds: z.array(z.string()).optional(),
    evidence: z.array(z.unknown()).optional(),
    recommendation: z.string().optional()
  }).passthrough()).optional(),
  learningProgress: z.array(z.object({
    area: z.string().optional(),
    topic: z.string().optional(),
    startLevel: z.string().optional(),
    currentLevel: z.string().optional(),
    evidence: z.unknown().optional(),
    milestones: z.array(z.string()).optional(),
    description: z.string().optional()
  }).passthrough()).optional(),
  recommendedResources: z.array(z.object({
    name: z.string().optional(),
    topic: z.string().optional(),
    url: z.string().optional(),
    resourceType: z.string().optional(),
    targetGap: z.string().optional(),
    timeInvestment: z.string().optional(),
    priority: z.string().optional()
  }).passthrough()).optional(),
  topInsights: z.array(z.unknown()).optional()
}).passthrough();
var ContextEfficiencyDataSchema = z.object({
  inefficiencyPatterns: z.array(z.object({
    // Accept both canonical (pattern) and plugin (type) field names
    type: z.string().optional(),
    pattern: z.string().optional(),
    frequency: z.number().optional(),
    severity: z.string().optional(),
    impact: z.string().optional(),
    description: z.string().optional(),
    evidence: z.array(z.unknown()).optional()
  }).passthrough()).optional(),
  contextUsagePatterns: z.array(z.object({
    sessionId: z.string().optional(),
    avgFillPercent: z.number().optional(),
    pattern: z.string().optional(),
    trajectory: z.string().optional()
  }).passthrough()).optional(),
  promptLengthTrends: z.unknown().optional(),
  iterationAnalysis: z.unknown().optional(),
  avgContextFillPercent: z.number().optional(),
  topInsights: z.array(z.unknown()).optional()
}).passthrough();
var SessionOutcomeDataSchema = z.object({
  sessionAnalyses: z.array(z.object({
    sessionId: z.string(),
    goals: z.array(z.string()).optional(),
    primaryGoal: z.string().optional(),
    sessionType: z.string(),
    outcome: z.string(),
    satisfaction: z.string().optional(),
    satisfactionSignal: z.string().optional(),
    frictionPoints: z.array(z.unknown()).optional(),
    frictionTypes: z.array(z.string()).optional(),
    outcomeScore: z.number().optional(),
    duration: z.string().optional(),
    utteranceCount: z.number().optional(),
    keyMoment: z.string().optional()
  })).min(1),
  overallSuccessRate: z.number().min(0).max(100).optional(),
  goalDistribution: z.array(z.unknown()).optional(),
  frictionSummary: z.array(z.unknown()).optional(),
  successPatterns: z.array(z.unknown()).optional(),
  failurePatterns: z.array(z.unknown()).optional()
}).passthrough();
var DOMAIN_DATA_SCHEMAS = {
  thinkingQuality: ThinkingQualityDataSchema,
  communicationPatterns: CommunicationPatternsDataSchema,
  learningBehavior: LearningBehaviorDataSchema,
  contextEfficiency: ContextEfficiencyDataSchema,
  sessionOutcome: SessionOutcomeDataSchema
};
var QUALITY_THRESHOLDS = {
  /** Minimum characters for strength/growth area descriptions */
  minDescriptionLength: 300,
  /** Minimum characters for growth area recommendations */
  minRecommendationLength: 150,
  /** Minimum evidence items per strength/growth area */
  minEvidenceCount: 2
};
var DomainResultInputSchema = z.object({
  domain: z.enum([
    "thinkingQuality",
    "communicationPatterns",
    "learningBehavior",
    "contextEfficiency",
    "sessionOutcome",
    "content"
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1).optional(),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain using typed schemas. */
  data: z.record(z.string(), z.unknown()).optional()
});
function validateContentQuality(strengths, growthAreas) {
  const issues = [];
  for (const [i, strength] of strengths.entries()) {
    if (strength.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `strengths[${i}].description`,
        message: `Description for "${strength.title}" is too short (${strength.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required. Use WHAT-WHY-HOW structure: WHAT the pattern is (2-3 sentences), WHY it matters (1-2 sentences), HOW to leverage it (1-2 sentences).`,
        actual: strength.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength
      });
    }
    if (strength.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `strengths[${i}].evidence`,
        message: `Strength "${strength.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${strength.evidence.length}). Search across ALL sessions for additional examples of this pattern.`,
        actual: strength.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount
      });
    }
  }
  for (const [i, area] of growthAreas.entries()) {
    if (area.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `growthAreas[${i}].description`,
        message: `Description for "${area.title}" is too short (${area.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required. Use WHAT-WHY-HOW structure.`,
        actual: area.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength
      });
    }
    if (area.recommendation.length < QUALITY_THRESHOLDS.minRecommendationLength) {
      issues.push({
        field: `growthAreas[${i}].recommendation`,
        message: `Recommendation for "${area.title}" is too short (${area.recommendation.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minRecommendationLength} characters required. Provide step-by-step actionable advice.`,
        actual: area.recommendation.length,
        required: QUALITY_THRESHOLDS.minRecommendationLength
      });
    }
    if (area.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `growthAreas[${i}].evidence`,
        message: `Growth area "${area.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${area.evidence.length}).`,
        actual: area.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount
      });
    }
  }
  return issues;
}
async function execute3(args) {
  const runId = getCurrentRunId();
  const domainName = extractDomainName(args);
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Call extract_data first to start an analysis."
    });
  }
  const parsed = DomainResultInputSchema.safeParse(args);
  if (!parsed.success) {
    if (domainName) {
      recordStageStatus(runId, domainName, {
        status: "failed",
        lastError: "Invalid domain result format."
      });
    }
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid domain result format.",
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }))
    });
  }
  const domainSchema = DOMAIN_DATA_SCHEMAS[parsed.data.domain];
  if (domainSchema && parsed.data.data) {
    const dataResult = domainSchema.safeParse(parsed.data.data);
    if (!dataResult.success) {
      recordStageStatus(runId, parsed.data.domain, {
        status: "failed",
        lastError: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.`
      });
      const missingFields = dataResult.error.issues.map((i) => ({
        path: `data.${i.path.join(".")}`,
        message: i.message
      }));
      return JSON.stringify({
        status: "validation_error",
        message: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid. The data field must contain the required structures for this domain. Review the skill instructions for the expected data format.`,
        errors: missingFields,
        hint: getDomainDataHint(parsed.data.domain)
      });
    }
  } else if (parsed.data.domain !== "content" && !parsed.data.data) {
    recordStageStatus(runId, parsed.data.domain, {
      status: "failed",
      lastError: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures.`
    });
    return JSON.stringify({
      status: "validation_error",
      message: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures. Do not omit the data field.`,
      hint: getDomainDataHint(parsed.data.domain)
    });
  }
  const qualityIssues = validateContentQuality(
    parsed.data.strengths,
    parsed.data.growthAreas
  );
  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, {
      status: "failed",
      lastError: `Quality gate failed for "${parsed.data.domain}" analysis.`
    });
    return JSON.stringify({
      status: "quality_error",
      message: `${qualityIssues.length} quality issue(s) detected. Descriptions must be ${QUALITY_THRESHOLDS.minDescriptionLength}+ chars, recommendations must be ${QUALITY_THRESHOLDS.minRecommendationLength}+ chars, and each insight needs ${QUALITY_THRESHOLDS.minEvidenceCount}+ evidence items. Please expand the flagged fields and call save_domain_results again.`,
      issues: qualityIssues
    });
  }
  const domainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: parsed.data.growthAreas,
    data: parsed.data.data,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveDomainResult(runId, domainResult);
  recordStageStatus(runId, domainResult.domain, {
    status: "validated"
  });
  return JSON.stringify({
    status: "ok",
    domain: domainResult.domain,
    score: domainResult.overallScore,
    strengthCount: domainResult.strengths.length,
    growthAreaCount: domainResult.growthAreas.length,
    runId,
    message: `Saved ${domainResult.domain} analysis (score: ${domainResult.overallScore}/100) to run #${runId}.`
  });
}
function getDomainDataHint(domain) {
  const hints = {
    thinkingQuality: "Required: planningHabits[] (min 1), verificationBehavior, criticalThinkingMoments[], verificationAntiPatterns[]",
    communicationPatterns: "Required: communicationPatterns[] (min 1). Optional: signatureQuotes[], structuralDistribution, contextDistribution, questioningDistribution",
    learningBehavior: "Expected: knowledgeGaps[], repeatedMistakePatterns[], learningProgress[], recommendedResources[]",
    contextEfficiency: "Expected: inefficiencyPatterns[], contextUsagePatterns[], promptLengthTrends, avgContextFillPercent",
    sessionOutcome: "Required: sessionAnalyses[] (min 1, each with sessionId, sessionType, outcome). Optional: overallSuccessRate, goalDistribution[], frictionSummary[]"
  };
  return hints[domain] ?? "";
}

// mcp/tools/get-domain-results.ts
import { z as z2 } from "zod";
var definition7 = {
  name: "get_domain_results",
  description: "Read previously saved domain analysis results from the current local analysis run. Provide a domain name to get one domain, or omit it to get all saved domains. Available domains: thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome, content."
};
var GetDomainResultsInputSchema = z2.object({
  domain: z2.enum([
    "thinkingQuality",
    "communicationPatterns",
    "learningBehavior",
    "contextEfficiency",
    "sessionOutcome",
    "content"
  ]).optional()
});
async function execute4(args) {
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Call extract_data first."
    });
  }
  if (args.domain) {
    const result = getDomainResult(runId, args.domain);
    if (!result) {
      return JSON.stringify({
        status: "not_found",
        domain: args.domain,
        runId,
        message: `No ${args.domain} result found for run #${runId}. This domain may not have been analyzed yet.`
      });
    }
    return JSON.stringify({
      status: "ok",
      domain: args.domain,
      runId,
      data: result
    });
  }
  const results = getDomainResults(runId);
  return JSON.stringify({
    status: "ok",
    runId,
    domainsAvailable: results.map((result) => result.domain),
    data: results
  });
}

// mcp/tools/classify-developer-type.ts
import { readFile as readFile3 } from "fs/promises";
import { join as join9 } from "path";
var definition8 = {
  name: "classify_developer_type",
  description: "Classify the developer's AI collaboration type using deterministic rules. Uses the 5x3 type matrix (architect/analyst/conductor/speedrunner/trendsetter x explorer/navigator/cartographer). Requires extract_data to have been run first. Returns the primary type, distribution, control level, and matrix name."
};
async function execute5(_args) {
  const runId = getCurrentRunId();
  let phase1Output;
  const existingRun = runId ? getAnalysisRun(runId) : null;
  if (existingRun?.phase1Output) {
    phase1Output = existingRun.phase1Output;
  } else {
    try {
      const phase1Path = join9(getPluginDataDir(), "phase1-output.json");
      const content = await readFile3(phase1Path, "utf-8");
      phase1Output = JSON.parse(content);
    } catch {
      return JSON.stringify({
        status: "error",
        message: "No Phase 1 data found. Call extract_data first."
      });
    }
  }
  const scores = existingRun?.phase1Output ? existingRun.scores : computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);
  if (runId) {
    saveTypeResult(runId, typeResult);
  }
  return JSON.stringify({
    status: "ok",
    primaryType: typeResult.primaryType,
    controlLevel: typeResult.controlLevel,
    matrixName: typeResult.matrixName,
    matrixEmoji: typeResult.matrixEmoji,
    distribution: typeResult.distribution,
    controlScore: typeResult.controlScore,
    runId,
    message: `Developer type: ${typeResult.matrixEmoji} ${typeResult.matrixName} (${typeResult.primaryType} / ${typeResult.controlLevel}). Distribution: architect ${typeResult.distribution.architect}%, analyst ${typeResult.distribution.analyst}%, conductor ${typeResult.distribution.conductor}%, speedrunner ${typeResult.distribution.speedrunner}%, trendsetter ${typeResult.distribution.trendsetter}%.`
  });
}

// mcp/tools/generate-report.ts
import { readFileSync as readFileSync2 } from "fs";
import { writeFile as writeFile3, mkdir as mkdir3 } from "fs/promises";
import { join as join10 } from "path";
import { createServer } from "http";
import { exec } from "child_process";

// lib/report-template.ts
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}
function generateRadarSvg(scores, labels, size = 300) {
  const entries = Object.entries(scores);
  const count = entries.length;
  if (count === 0) return "";
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 40;
  const angleStep = 360 / count;
  const gridCircles = [0.25, 0.5, 0.75, 1].map((frac) => {
    const r = maxRadius * frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E8EDF5" stroke-width="1" />`;
  }).join("\n");
  const gridLines = entries.map(([key], i) => {
    const angle = i * angleStep;
    const end = polarToCartesian(cx, cy, maxRadius, angle);
    const labelPos = polarToCartesian(cx, cy, maxRadius + 20, angle);
    const label = labels[key] ?? key;
    return `
        <line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="#E8EDF5" stroke-width="1" />
        <text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle"
              font-size="11" font-family="'Fira Code', monospace" fill="#4A4A5A">${label}</text>
      `;
  }).join("\n");
  const points = entries.map(([, score], i) => {
    const angle = i * angleStep;
    const r = maxRadius * (score / 100);
    const p = polarToCartesian(cx, cy, r, angle);
    return `${p.x},${p.y}`;
  }).join(" ");
  const dots = entries.map(([, score], i) => {
    const angle = i * angleStep;
    const r = maxRadius * (score / 100);
    const p = polarToCartesian(cx, cy, r, angle);
    return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00BCD4" />`;
  }).join("\n");
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      ${gridCircles}
      ${gridLines}
      <polygon points="${points}" fill="rgba(0,188,212,0.15)" stroke="#00BCD4" stroke-width="2" />
      ${dots}
    </svg>
  `;
}
function generateTypeDistributionBar(distribution) {
  const colors = {
    architect: "#3B82F6",
    analyst: "#9C7CF4",
    conductor: "#FFD93D",
    speedrunner: "#4ADE80",
    trendsetter: "#FF6B9D"
  };
  const entries = Object.entries(distribution);
  entries.sort((a, b) => b[1] - a[1]);
  const bars = entries.map(([type, pct]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:100px;font-size:12px;color:#4A4A5A;text-transform:capitalize;">${type}</span>
        <div style="flex:1;height:20px;background:#F0F0F5;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${colors[type]};border-radius:4px;transition:width 0.5s;"></div>
        </div>
        <span style="width:35px;text-align:right;font-size:12px;font-weight:600;color:#1A1A2E;">${pct}%</span>
      </div>
    `).join("");
  return `<div style="margin:16px 0;">${bars}</div>`;
}
var DOMAIN_LABELS = {
  thinkingQuality: { label: "Thinking Quality", emoji: "\u{1F9E0}" },
  communicationPatterns: { label: "Communication", emoji: "\u{1F4AC}" },
  learningBehavior: { label: "Learning", emoji: "\u{1F4DA}" },
  contextEfficiency: { label: "Efficiency", emoji: "\u26A1" },
  sessionOutcome: { label: "Sessions", emoji: "\u{1F3AF}" }
};
function generateDomainSection(result) {
  const meta = DOMAIN_LABELS[result.domain] ?? { label: result.domain, emoji: "\u{1F4CA}" };
  const strengthCards = result.strengths.map((s) => `
      <div class="card strength-card">
        <h4>${escapeHtml(s.title)}</h4>
        <p>${escapeHtml(s.description)}</p>
        ${s.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${s.evidence.length})</summary>
            <ul>
              ${s.evidence.map((e) => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  const growthCards = result.growthAreas.map((g) => `
      <div class="card growth-card">
        <div class="severity-badge severity-${escapeHtml(g.severity)}">${escapeHtml(g.severity)}</div>
        <h4>${escapeHtml(g.title)}</h4>
        <p>${escapeHtml(g.description)}</p>
        <div class="recommendation">${escapeHtml(g.recommendation)}</div>
        ${g.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${g.evidence.length})</summary>
            <ul>
              ${g.evidence.map((e) => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="domain-${result.domain}">
      <h2>${meta.emoji} ${meta.label} <span class="score">${result.overallScore}/100</span></h2>
      ${result.strengths.length > 0 ? `<h3>Strengths</h3><div class="card-grid">${strengthCards}</div>` : ""}
      ${result.growthAreas.length > 0 ? `<h3>Growth Areas</h3><div class="card-grid">${growthCards}</div>` : ""}
    </section>
  `;
}
function generateFocusAreas(content) {
  if (!content?.topFocusAreas?.length) return "";
  const areas = content.topFocusAreas.map((area) => `
      <div class="card focus-card">
        <h3>${escapeHtml(area.title)}</h3>
        <p>${escapeHtml(area.narrative ?? area.description ?? "")}</p>
        ${area.actions ? `
        <div class="actions-grid">
          <div class="action start"><strong>Start:</strong> ${escapeHtml(area.actions.start)}</div>
          <div class="action stop"><strong>Stop:</strong> ${escapeHtml(area.actions.stop)}</div>
          <div class="action continue"><strong>Continue:</strong> ${escapeHtml(area.actions.continue)}</div>
        </div>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="focus-areas">
      <h2>\u{1F3AF} Top Focus Areas</h2>
      ${areas}
    </section>
  `;
}
function generatePersonalitySummary(summary) {
  if (!summary?.trim()) return "";
  return `
    <section class="domain-section" id="personality-summary">
      <h2>\u{1FA9E} Personality Summary</h2>
      <div class="card">
        <p>${escapeHtml(summary).replace(/\n/g, "<br>")}</p>
      </div>
    </section>
  `;
}
function generatePromptPatternsSection(promptPatterns) {
  if (!promptPatterns?.length) return "";
  const items = promptPatterns.map((pattern) => `
      <div class="card">
        <h4>${escapeHtml(pattern.patternName ?? "Pattern")}</h4>
        <p>${escapeHtml(pattern.description ?? "")}</p>
        <p style="margin-top:8px;font-size:12px;"><strong>Frequency:</strong> ${escapeHtml(pattern.frequency ?? "n/a")}</p>
        ${(pattern.examples?.length ?? 0) > 0 ? `
          <details>
            <summary>Examples (${pattern.examples.length})</summary>
            <ul>
              ${pattern.examples.map((example) => `<li>"${escapeHtml(example.quote ?? "")}"${example.analysis ? ` \u2014 ${escapeHtml(example.analysis)}` : ""}</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="prompt-patterns">
      <h2>\u{1F9E9} Prompt Patterns</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function generateProjectSummariesSection(projectSummaries) {
  if (!projectSummaries?.length) return "";
  const items = projectSummaries.map((project) => `
      <div class="card">
        <h4>${escapeHtml(project.projectName)} <span style="color:var(--ink-muted);font-weight:400;">(${project.sessionCount} sessions)</span></h4>
        <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
          ${project.summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </div>
    `).join("");
  return `
    <section class="domain-section" id="project-summaries">
      <h2>\u{1F4C1} Project Summaries</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function generateWeeklyInsightsSection(weeklyInsights) {
  if (!weeklyInsights) return "";
  const stats = weeklyInsights.stats;
  const highlights = weeklyInsights.highlights ?? [];
  const projects = weeklyInsights.projects ?? [];
  const topSessions = weeklyInsights.topProjectSessions ?? [];
  return `
    <section class="domain-section" id="weekly-insights">
      <h2>\u{1F4C6} Weekly Insights</h2>
      ${stats ? `
        <div class="metrics-bar" style="margin-bottom:16px;">
          <div class="metric"><div class="value">${stats.totalSessions ?? 0}</div><div class="label">Sessions</div></div>
          <div class="metric"><div class="value">${Math.round(stats.totalMinutes ?? 0)}</div><div class="label">Minutes</div></div>
          <div class="metric"><div class="value">${Math.round((stats.totalTokens ?? 0) / 1e3)}k</div><div class="label">Tokens</div></div>
          <div class="metric"><div class="value">${stats.activeDays ?? 0}</div><div class="label">Active Days</div></div>
        </div>
      ` : ""}
      ${weeklyInsights.narrative ? `<div class="card"><p>${escapeHtml(weeklyInsights.narrative)}</p></div>` : ""}
      ${projects.length > 0 ? `
        <div class="card">
          <h4>Project Breakdown</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${projects.map((project) => `<li>${escapeHtml(project.projectName)}: ${project.sessionCount} sessions, ${project.percentage}%</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${topSessions.length > 0 ? `
        <div class="card">
          <h4>Top Sessions</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${topSessions.map((session) => `<li>${escapeHtml(session.date)} \xB7 ${Math.round(session.durationMinutes)} min \xB7 ${escapeHtml(session.summary)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${highlights.length > 0 ? `
        <div class="card">
          <h4>Highlights</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    </section>
  `;
}
function generateActivitySection(activitySessions) {
  if (!activitySessions?.length) return "";
  const rows = activitySessions.slice(0, 20).map((session) => `
      <div class="card">
        <h4>${escapeHtml(session.projectName)}</h4>
        <p>${escapeHtml(session.summary)}</p>
        <p style="margin-top:8px;font-size:12px;">
          ${escapeHtml(new Date(session.startTime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }))} \xB7
          ${Math.round(session.durationMinutes)} min \xB7
          ${session.messageCount} messages
        </p>
      </div>
    `).join("");
  return `
    <section class="domain-section" id="activity-sessions">
      <h2>\u{1F5C2} Activity Sessions</h2>
      <div class="card-grid">${rows}</div>
    </section>
  `;
}
function generatePlanningAnalysisSection(planningAnalysis) {
  if (!planningAnalysis) return "";
  const strengths = planningAnalysis.strengths ?? [];
  const opportunities = planningAnalysis.opportunities ?? [];
  return `
    <section class="domain-section" id="planning-analysis">
      <h2>\u{1F5FA} Planning Analysis</h2>
      <div class="card">
        ${planningAnalysis.planningMaturityLevel ? `<p><strong>Maturity:</strong> ${escapeHtml(planningAnalysis.planningMaturityLevel)}</p>` : ""}
        ${planningAnalysis.summary ? `<p>${escapeHtml(planningAnalysis.summary)}</p>` : ""}
      </div>
      ${strengths.length > 0 ? `
        <h3>Observed Strengths</h3>
        <div class="card-grid">
          ${strengths.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? "Planning strength")}</h4>
              <p>${escapeHtml(item.description ?? "")}</p>
              ${item.sophistication ? `<p style="margin-top:8px;font-size:12px;"><strong>Sophistication:</strong> ${escapeHtml(item.sophistication)}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${opportunities.length > 0 ? `
        <h3>Opportunities</h3>
        <div class="card-grid">
          ${opportunities.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? "Planning opportunity")}</h4>
              <p>${escapeHtml(item.description ?? "")}</p>
              ${item.sophistication ? `<p style="margin-top:8px;font-size:12px;"><strong>Sophistication:</strong> ${escapeHtml(item.sophistication)}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function generateCriticalThinkingSection(criticalThinkingAnalysis) {
  if (!criticalThinkingAnalysis) return "";
  const strengths = criticalThinkingAnalysis.strengths ?? [];
  const opportunities = criticalThinkingAnalysis.opportunities ?? [];
  return `
    <section class="domain-section" id="critical-thinking-analysis">
      <h2>\u{1F50D} Critical Thinking</h2>
      <div class="card">
        ${typeof criticalThinkingAnalysis.overallScore === "number" ? `<p><strong>Score:</strong> ${criticalThinkingAnalysis.overallScore}/100</p>` : ""}
        ${criticalThinkingAnalysis.summary ? `<p>${escapeHtml(criticalThinkingAnalysis.summary)}</p>` : ""}
      </div>
      ${strengths.length > 0 ? `
        <div class="card-grid">
          ${strengths.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? "Signal")}</h4>
              <p>${escapeHtml(item.description ?? "")}</p>
              ${item.quality ? `<p style="margin-top:8px;font-size:12px;"><strong>Quality:</strong> ${escapeHtml(item.quality)}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${opportunities.length > 0 ? `
        <div class="card-grid">
          ${opportunities.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? "Opportunity")}</h4>
              <p>${escapeHtml(item.description ?? "")}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function generateAntiPatternsSection(antiPatternsAnalysis) {
  if (!antiPatternsAnalysis) return "";
  const detected = antiPatternsAnalysis.detected ?? [];
  return `
    <section class="domain-section" id="anti-patterns-analysis">
      <h2>\u{1F6A7} Anti-Patterns</h2>
      <div class="card">
        ${typeof antiPatternsAnalysis.overallHealthScore === "number" ? `<p><strong>Health Score:</strong> ${antiPatternsAnalysis.overallHealthScore}/100</p>` : ""}
        ${antiPatternsAnalysis.summary ? `<p>${escapeHtml(antiPatternsAnalysis.summary)}</p>` : ""}
      </div>
      ${detected.length > 0 ? `
        <div class="card-grid">
          ${detected.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? "Anti-pattern")}</h4>
              <p>${escapeHtml(item.description ?? "")}</p>
              <p style="margin-top:8px;font-size:12px;">
                ${item.severity ? `<strong>Severity:</strong> ${escapeHtml(item.severity)} \xB7 ` : ""}
                ${typeof item.occurrences === "number" ? `<strong>Occurrences:</strong> ${item.occurrences}` : ""}
              </p>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}
function generateKnowledgeResourcesSection(knowledgeResources) {
  if (!knowledgeResources?.length) return "";
  return `
    <section class="domain-section" id="knowledge-resources">
      <h2>\u{1F4DA} Knowledge Resources</h2>
      <div class="card-grid">
        ${knowledgeResources.map((group) => `
          <div class="card">
            <h4>${escapeHtml(group.dimensionDisplayName ?? "Recommended Resources")}</h4>
            ${(group.professionalInsights?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Professional Insights</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.professionalInsights.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? "Insight")}${item.keyTakeaway ? `: ${escapeHtml(item.keyTakeaway)}` : ""}</li>`).join("")}
              </ul>
            ` : ""}
            ${(group.knowledgeItems?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Suggested Reading</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.knowledgeItems.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? "Resource")}${item.summary ? `: ${escapeHtml(item.summary)}` : ""}</li>`).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}
function generateReportHtml(report) {
  const { typeResult, deterministicScores, phase1Metrics, domainResults, content } = report;
  const radarScores = {
    thinking: deterministicScores.thinkingQuality,
    communication: deterministicScores.communicationPatterns,
    learning: deterministicScores.learningBehavior,
    efficiency: deterministicScores.contextEfficiency,
    sessions: deterministicScores.sessionOutcome
  };
  const radarLabels = {
    thinking: "Thinking",
    communication: "Communication",
    learning: "Learning",
    efficiency: "Efficiency",
    sessions: "Sessions"
  };
  const radarSvg = generateRadarSvg(radarScores, radarLabels);
  const distributionBar = typeResult ? generateTypeDistributionBar(typeResult.distribution) : '<p style="color:var(--ink-muted);">Type classification not yet performed. Run classify_developer_type first.</p>';
  const domainSections = domainResults.map(generateDomainSection).join("\n");
  const focusAreasSection = generateFocusAreas(content);
  const navDots = [
    { id: "identity", label: "Identity" },
    { id: "scores", label: "Scores" },
    ...domainResults.map((d) => ({
      id: `domain-${d.domain}`,
      label: DOMAIN_LABELS[d.domain]?.label ?? d.domain
    })),
    ...content?.topFocusAreas?.length ? [{ id: "focus-areas", label: "Focus" }] : []
  ];
  const navDotsHtml = navDots.map((d) => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    /* \u2500\u2500 Notebook Sketch Design System \u2500\u2500 */

    :root {
      --bg-paper: #FFFFFF;
      --bg-paper-warm: #FFFEF8;
      --bg-grid-color: #E8EDF5;
      --bg-grid-size: 20px;
      --ink-primary: #1A1A2E;
      --ink-secondary: #4A4A5A;
      --ink-muted: #8A8A9A;
      --sketch-cyan: #00BCD4;
      --sketch-green: #4ADE80;
      --sketch-pink: #FF6B9D;
      --sketch-blue: #3B82F6;
      --sketch-purple: #9C7CF4;
      --sketch-yellow: #FFD93D;
      --sketch-orange: #FB923C;
      --sketch-red: #EF4444;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Fira Code', monospace;
      background: var(--bg-paper-warm);
      background-image:
        linear-gradient(var(--bg-grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--bg-grid-color) 1px, transparent 1px);
      background-size: var(--bg-grid-size) var(--bg-grid-size);
      color: var(--ink-primary);
      line-height: 1.6;
      padding: 40px 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* \u2500\u2500 Header \u2500\u2500 */
    .header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--ink-primary);
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { color: var(--ink-secondary); font-size: 13px; }

    /* \u2500\u2500 Identity Section \u2500\u2500 */
    .identity {
      display: flex;
      gap: 32px;
      align-items: center;
      margin-bottom: 48px;
      padding: 24px;
      background: var(--bg-paper);
      border: 2px solid var(--ink-primary);
      border-radius: 8px;
    }
    .identity .type-info { flex: 1; }
    .identity .type-emoji { font-size: 48px; }
    .identity .type-name { font-size: 22px; font-weight: 700; margin-top: 8px; }
    .identity .type-detail { color: var(--ink-secondary); font-size: 13px; margin-top: 4px; }

    /* \u2500\u2500 Scores Grid \u2500\u2500 */
    .scores-section {
      display: flex;
      gap: 32px;
      margin-bottom: 48px;
      align-items: flex-start;
    }
    .radar-container { flex-shrink: 0; }
    .distribution-container { flex: 1; }

    /* \u2500\u2500 Cards \u2500\u2500 */
    .card {
      background: var(--bg-paper);
      border: 1px solid var(--bg-grid-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .card h4 { font-size: 14px; margin-bottom: 8px; }
    .card p { font-size: 13px; color: var(--ink-secondary); line-height: 1.5; }
    .card-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 640px) { .card-grid { grid-template-columns: 1fr 1fr; } }

    .strength-card { border-left: 3px solid var(--sketch-green); }
    .growth-card { border-left: 3px solid var(--sketch-orange); }
    .focus-card { border-left: 3px solid var(--sketch-cyan); }

    .severity-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .severity-low { background: rgba(74,222,128,0.15); color: #16a34a; }
    .severity-medium { background: rgba(251,146,60,0.15); color: #ea580c; }
    .severity-high { background: rgba(239,68,68,0.15); color: #dc2626; }

    .recommendation {
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(0,188,212,0.08);
      border-radius: 4px;
      font-size: 12px;
      color: var(--ink-secondary);
    }

    details { margin-top: 8px; }
    details summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--ink-muted);
    }
    details ul { margin-top: 4px; padding-left: 20px; font-size: 12px; color: var(--ink-secondary); }
    details li { margin-bottom: 4px; }
    details code { font-size: 11px; background: #f0f0f5; padding: 1px 4px; border-radius: 2px; }

    /* \u2500\u2500 Domain Sections \u2500\u2500 */
    .domain-section {
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--bg-grid-color);
    }
    .domain-section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .domain-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-secondary);
      margin: 16px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .score {
      font-size: 14px;
      font-weight: 400;
      color: var(--sketch-cyan);
      margin-left: auto;
    }

    /* \u2500\u2500 Actions Grid \u2500\u2500 */
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-top: 12px;
    }
    .action {
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--ink-secondary);
    }
    .action.start { background: rgba(74,222,128,0.1); }
    .action.stop { background: rgba(239,68,68,0.1); }
    .action.continue { background: rgba(59,130,246,0.1); }
    .action strong { display: block; font-size: 11px; color: var(--ink-primary); margin-bottom: 4px; }

    /* \u2500\u2500 Metrics Bar \u2500\u2500 */
    .metrics-bar {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 32px;
      padding: 16px;
      background: var(--bg-paper);
      border: 1px solid var(--bg-grid-color);
      border-radius: 8px;
    }
    .metric {
      text-align: center;
    }
    .metric .value { font-size: 24px; font-weight: 700; color: var(--sketch-cyan); }
    .metric .label { font-size: 11px; color: var(--ink-muted); }

    /* \u2500\u2500 Navigation Dots \u2500\u2500 */
    .nav-dots {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 100;
    }
    .nav-dot {
      display: block;
      text-decoration: none;
    }
    .nav-dot .dot {
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--bg-grid-color);
      border: 1px solid var(--ink-muted);
      transition: all 0.2s;
    }
    .nav-dot:hover .dot,
    .nav-dot.active .dot {
      background: var(--sketch-cyan);
      border-color: var(--sketch-cyan);
      transform: scale(1.5);
    }

    /* \u2500\u2500 Footer \u2500\u2500 */
    .footer {
      text-align: center;
      padding: 24px;
      color: var(--ink-muted);
      font-size: 12px;
    }

    @media (max-width: 640px) {
      .identity { flex-direction: column; text-align: center; }
      .scores-section { flex-direction: column; }
      .actions-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <nav class="nav-dots">${navDotsHtml}</nav>

  <div class="container">
    <header class="header">
      <h1>BetterPrompt Analysis</h1>
      <p class="subtitle">Generated ${new Date(report.analyzedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </header>

    <!-- Identity -->
    <section class="identity" id="identity">
      ${typeResult ? `
        <div class="type-emoji">${typeResult.matrixEmoji}</div>
        <div class="type-info">
          <div class="type-name">${escapeHtml(typeResult.matrixName)}</div>
          <div class="type-detail">${escapeHtml(typeResult.primaryType)} / ${escapeHtml(typeResult.controlLevel)} (control: ${typeResult.controlScore})</div>
        </div>
      ` : `
        <div class="type-info">
          <div class="type-name">Type Not Classified</div>
          <div class="type-detail">Run classify_developer_type to determine your collaboration style</div>
        </div>
      `}
    </section>

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric">
        <div class="value">${phase1Metrics.totalSessions}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="metric">
        <div class="value">${phase1Metrics.totalDeveloperUtterances}</div>
        <div class="label">Utterances</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.avgMessagesPerSession)}</div>
        <div class="label">Avg Messages/Session</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.questionRatio * 100)}%</div>
        <div class="label">Questions</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.codeBlockRatio * 100)}%</div>
        <div class="label">Code Blocks</div>
      </div>
    </div>

    <!-- Scores -->
    <section class="scores-section" id="scores">
      <div class="radar-container">
        ${radarSvg}
      </div>
      <div class="distribution-container">
        <h3 style="margin-bottom:12px;">Type Distribution</h3>
        ${distributionBar}
      </div>
    </section>

    <!-- Domain Results -->
    ${domainSections}

    <!-- Focus Areas -->
    ${focusAreasSection}

    <footer class="footer">
      Generated by BetterPrompt Plugin v0.2.0 &mdash; local-first AI collaboration analysis
    </footer>
  </div>

  <script>
    // Scroll spy for navigation dots
    const sections = document.querySelectorAll('section[id], .scores-section[id]');
    const navDots = document.querySelectorAll('.nav-dot');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navDots.forEach(dot => dot.classList.remove('active'));
          const id = entry.target.id;
          const activeDot = document.querySelector('.nav-dot[href="#' + id + '"]');
          if (activeDot) activeDot.classList.add('active');
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));
  </script>
</body>
</html>`;
}
function generateCanonicalReportHtml(run) {
  const evaluation = run.evaluation;
  const personalitySummary = typeof evaluation.personalitySummary === "string" ? evaluation.personalitySummary : "";
  const promptPatterns = Array.isArray(evaluation.promptPatterns) ? evaluation.promptPatterns : [];
  const projectSummaries = Array.isArray(evaluation.projectSummaries) ? evaluation.projectSummaries : [];
  const weeklyInsights = evaluation.weeklyInsights;
  const activitySessions = Array.isArray(run.activitySessions) ? run.activitySessions : [];
  const focusAreas = evaluation.topFocusAreas?.areas;
  const planningAnalysis = evaluation.planningAnalysis;
  const criticalThinkingAnalysis = evaluation.criticalThinkingAnalysis;
  const antiPatternsAnalysis = evaluation.antiPatternsAnalysis;
  const knowledgeResources = Array.isArray(evaluation.knowledgeResources) ? evaluation.knowledgeResources : [];
  const legacyContent = focusAreas ? {
    topFocusAreas: focusAreas.map((area) => ({
      title: area.title,
      narrative: area.narrative,
      description: area.narrative,
      actions: area.actions
    }))
  } : void 0;
  const typeResult = run.typeResult;
  const radarScores = {
    thinking: run.deterministicScores.thinkingQuality,
    communication: run.deterministicScores.communicationPatterns,
    learning: run.deterministicScores.learningBehavior,
    efficiency: run.deterministicScores.contextEfficiency,
    sessions: run.deterministicScores.sessionOutcome
  };
  const radarLabels = {
    thinking: "Thinking",
    communication: "Communication",
    learning: "Learning",
    efficiency: "Efficiency",
    sessions: "Sessions"
  };
  const radarSvg = generateRadarSvg(radarScores, radarLabels);
  const distributionBar = typeResult ? generateTypeDistributionBar(typeResult.distribution) : '<p style="color:var(--ink-muted);">Type classification not yet performed.</p>';
  const domainSections = run.domainResults.map(generateDomainSection).join("\n");
  const focusAreasSection = generateFocusAreas(legacyContent);
  const personalitySummarySection = generatePersonalitySummary(personalitySummary);
  const promptPatternsSection = generatePromptPatternsSection(promptPatterns);
  const projectSummariesSection = generateProjectSummariesSection(projectSummaries);
  const weeklyInsightsSection = generateWeeklyInsightsSection(weeklyInsights);
  const activitySection = generateActivitySection(activitySessions);
  const planningSection = generatePlanningAnalysisSection(planningAnalysis);
  const criticalThinkingSection = generateCriticalThinkingSection(criticalThinkingAnalysis);
  const antiPatternsSection = generateAntiPatternsSection(antiPatternsAnalysis);
  const knowledgeResourcesSection = generateKnowledgeResourcesSection(knowledgeResources);
  const navDots = [
    { id: "identity", label: "Identity" },
    { id: "scores", label: "Scores" },
    ...personalitySummary ? [{ id: "personality-summary", label: "Summary" }] : [],
    ...promptPatterns.length > 0 ? [{ id: "prompt-patterns", label: "Patterns" }] : [],
    ...projectSummaries.length > 0 ? [{ id: "project-summaries", label: "Projects" }] : [],
    ...weeklyInsights ? [{ id: "weekly-insights", label: "Week" }] : [],
    ...activitySessions.length > 0 ? [{ id: "activity-sessions", label: "Activity" }] : [],
    ...planningAnalysis ? [{ id: "planning-analysis", label: "Planning" }] : [],
    ...criticalThinkingAnalysis ? [{ id: "critical-thinking-analysis", label: "Critical" }] : [],
    ...antiPatternsAnalysis ? [{ id: "anti-patterns-analysis", label: "Anti" }] : [],
    ...knowledgeResources.length > 0 ? [{ id: "knowledge-resources", label: "Resources" }] : [],
    ...run.domainResults.map((d) => ({
      id: `domain-${d.domain}`,
      label: DOMAIN_LABELS[d.domain]?.label ?? d.domain
    })),
    ...legacyContent?.topFocusAreas?.length ? [{ id: "focus-areas", label: "Focus" }] : []
  ];
  const navDotsHtml = navDots.map((d) => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    ${generateReportHtml({
    userId: "local",
    analyzedAt: run.analyzedAt,
    phase1Metrics: run.phase1Output.sessionMetrics,
    deterministicScores: run.deterministicScores,
    typeResult: run.typeResult ?? null,
    domainResults: run.domainResults,
    content: legacyContent
  }).match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ""}
  </style>
</head>
<body>
  <nav class="nav-dots">${navDotsHtml}</nav>

  <div class="container">
    <header class="header">
      <h1>BetterPrompt Analysis</h1>
      <p class="subtitle">Generated ${new Date(run.analyzedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </header>

    <section class="identity" id="identity">
      ${typeResult ? `
        <div class="type-emoji">${typeResult.matrixEmoji}</div>
        <div class="type-info">
          <div class="type-name">${escapeHtml(typeResult.matrixName)}</div>
          <div class="type-detail">${escapeHtml(typeResult.primaryType)} / ${escapeHtml(typeResult.controlLevel)} (control: ${typeResult.controlScore})</div>
        </div>
      ` : `
        <div class="type-info">
          <div class="type-name">Type Not Classified</div>
          <div class="type-detail">Run type classification before generating the final report.</div>
        </div>
      `}
    </section>

    <div class="metrics-bar">
      <div class="metric">
        <div class="value">${run.phase1Output.sessionMetrics.totalSessions}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="metric">
        <div class="value">${run.phase1Output.sessionMetrics.totalDeveloperUtterances}</div>
        <div class="label">Utterances</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.avgMessagesPerSession)}</div>
        <div class="label">Avg Messages/Session</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.questionRatio * 100)}%</div>
        <div class="label">Questions</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.codeBlockRatio * 100)}%</div>
        <div class="label">Code Blocks</div>
      </div>
    </div>

    <section class="scores-section" id="scores">
      <div class="radar-container">${radarSvg}</div>
      <div class="distribution-container">
        <h3 style="margin-bottom:12px;">Type Distribution</h3>
        ${distributionBar}
      </div>
    </section>

    ${personalitySummarySection}
    ${promptPatternsSection}
    ${projectSummariesSection}
    ${weeklyInsightsSection}
    ${activitySection}
    ${planningSection}
    ${criticalThinkingSection}
    ${antiPatternsSection}
    ${knowledgeResourcesSection}
    ${domainSections}
    ${focusAreasSection}

    <footer class="footer">
      Generated by BetterPrompt Plugin v0.2.0 - local-first AI collaboration analysis
    </footer>
  </div>

  <script>
    const sections = document.querySelectorAll('section[id], .scores-section[id]');
    const navDots = document.querySelectorAll('.nav-dot');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navDots.forEach(dot => dot.classList.remove('active'));
          const id = entry.target.id;
          const activeDot = document.querySelector('.nav-dot[href="#' + id + '"]');
          if (activeDot) activeDot.classList.add('active');
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));
  </script>
</body>
</html>`;
}

// mcp/tools/generate-report.ts
var definition9 = {
  name: "generate_report",
  description: "Generate a standalone HTML report from all completed domain analyses and serve it on a local HTTP server. Returns the URL to view the report. Call this after all domain analyses and type classification are complete. Pass allowIncomplete=true to override required-stage gating."
};
var activeServer = null;
var shutdownTimer = null;
var SHUTDOWN_TIMEOUT_MS = 30 * 60 * 1e3;
var DOMAIN_STAGE_NAMES = /* @__PURE__ */ new Set([
  "thinkingQuality",
  "communicationPatterns",
  "learningBehavior",
  "contextEfficiency",
  "sessionOutcome"
]);
function resetShutdownTimer() {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  shutdownTimer = setTimeout(() => {
    if (activeServer) {
      activeServer.close();
      activeServer = null;
    }
  }, SHUTDOWN_TIMEOUT_MS);
}
function closeActiveServer() {
  return new Promise((resolve) => {
    if (!activeServer) {
      resolve();
      return;
    }
    activeServer.close(() => {
      activeServer = null;
      resolve();
    });
  });
}
function hasFallbackArtifact(runId, stage) {
  if (DOMAIN_STAGE_NAMES.has(stage)) {
    return getDomainResult(runId, stage) !== null;
  }
  return getStageOutput(runId, stage) !== null;
}
function getRequiredStageGateIssues(runId) {
  const statuses = getStageStatuses(runId);
  const statusLookup = new Map(statuses.map((status) => [status.stage, status]));
  const issues = [];
  for (const stage of REQUIRED_STAGE_NAMES) {
    const status = statusLookup.get(stage);
    if (status) {
      if (status.status !== "validated") {
        issues.push({
          stage,
          required: status.required,
          status: status.status,
          attemptCount: status.attemptCount,
          lastError: status.lastError,
          updatedAt: status.updatedAt
        });
      }
      continue;
    }
    if (!hasFallbackArtifact(runId, stage)) {
      issues.push({
        stage,
        required: true,
        status: "missing",
        attemptCount: 0,
        lastError: null,
        updatedAt: null
      });
    }
  }
  return issues;
}
async function execute6(args) {
  const port = args.port ?? 3456;
  const openBrowser = args.openBrowser ?? true;
  const allowIncomplete = args.allowIncomplete ?? false;
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No analysis results found. Run extract_data and domain analyses first."
    });
  }
  const gateIssues = getRequiredStageGateIssues(runId);
  if (gateIssues.length > 0 && !allowIncomplete) {
    return JSON.stringify({
      status: "blocked",
      message: "Required analysis stages are incomplete. Re-run the missing stages or pass allowIncomplete=true to override.",
      issues: gateIssues
    });
  }
  const run = assembleCanonicalRun(runId);
  if (!run) {
    return JSON.stringify({
      status: "error",
      message: "No analysis results found. Run extract_data and domain analyses first."
    });
  }
  const html = generateCanonicalReportHtml(run);
  const reportsDir = join10(getPluginDataDir(), "reports");
  await mkdir3(reportsDir, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join10(reportsDir, `report-${timestamp}.html`);
  await writeFile3(reportPath, html, "utf-8");
  const latestPath = join10(reportsDir, "latest.html");
  await writeFile3(latestPath, html, "utf-8");
  await closeActiveServer();
  const url = await new Promise((resolve, reject) => {
    const server2 = createServer((req, res) => {
      if (req.url !== "/" && req.url !== "") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }
      resetShutdownTimer();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      });
      try {
        const content = readFileSync2(latestPath, "utf-8");
        res.end(content);
      } catch {
        res.end(html);
      }
    });
    server2.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(`file://${reportPath}`);
      } else {
        reject(err);
      }
    });
    server2.listen(port, () => {
      activeServer = server2;
      resetShutdownTimer();
      resolve(`http://localhost:${port}`);
    });
  });
  if (openBrowser && url.startsWith("http")) {
    try {
      let cmd;
      if (process.platform === "darwin") {
        cmd = `open "${url}"`;
      } else if (process.platform === "win32") {
        cmd = `start "${url}"`;
      } else {
        cmd = `xdg-open "${url}"`;
      }
      exec(cmd);
    } catch {
    }
  }
  markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
  return JSON.stringify({
    status: "ok",
    url,
    reportPath,
    latestPath,
    domainCount: run.domainResults.length,
    type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : "Not classified",
    ...gateIssues.length > 0 ? { warning: "Report generated with incomplete required stages because allowIncomplete=true." } : {},
    message: `Report generated and available at ${url}. Saved to ${reportPath}.`
  });
}

// mcp/tools/sync-to-team.ts
var definition10 = {
  name: "sync_to_team",
  description: "Sync local analysis results to a team BetterPrompt server. Uses the BetterPrompt plugin server URL setting unless serverUrl is passed explicitly. The server receives pre-analyzed results (no LLM work needed server-side). Use this to share your analysis with your team dashboard."
};
async function execute7(args) {
  const serverUrl = (args.serverUrl ?? getConfig().serverUrl)?.replace(/\/$/, "");
  if (!serverUrl) {
    return JSON.stringify({
      status: "not_configured",
      message: "No team server URL is available. Set the BetterPrompt plugin serverUrl setting or pass serverUrl to enable team sync."
    });
  }
  const run = assembleCanonicalRun();
  if (!run) {
    return JSON.stringify({
      status: "no_data",
      message: "No analysis results to sync. Run a full analysis first."
    });
  }
  try {
    const response = await fetch(`${serverUrl}/api/analysis/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        run,
        syncedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return JSON.stringify({
        status: "sync_failed",
        httpStatus: response.status,
        message: `Server returned ${response.status}: ${errorText}`
      });
    }
    const result = await response.json().catch(() => ({}));
    markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
    return JSON.stringify({
      status: "ok",
      serverUrl,
      message: `Successfully synced analysis to ${serverUrl}.`,
      ...result && typeof result === "object" ? result : {}
    });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: `Failed to connect to ${serverUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
}

// mcp/tools/save-stage-output.ts
import { z as z3 } from "zod";
var definition11 = {
  name: "save_stage_output",
  description: "Save output from a pipeline stage. Called after completing a stage (sessionSummaries, projectSummaries, weeklyInsights, typeClassification, evidenceVerification, contentWriter, translator). Input must include stage name and structured data matching the stage schema."
};
var StageOutputInputSchema = z3.object({
  stage: z3.enum([
    "sessionSummaries",
    "projectSummaries",
    "weeklyInsights",
    "typeClassification",
    "evidenceVerification",
    "contentWriter",
    "translator"
  ]),
  data: z3.record(z3.string(), z3.unknown())
});
function extractStageName(args) {
  return typeof args.stage === "string" ? args.stage : null;
}
async function execute8(args) {
  const runId = getCurrentRunId();
  const stageName = extractStageName(args);
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Call extract_data first to start an analysis."
    });
  }
  const parsed = StageOutputInputSchema.safeParse(args);
  if (!parsed.success) {
    if (stageName) {
      recordStageStatus(runId, stageName, {
        status: "failed",
        lastError: "Invalid stage output format."
      });
    }
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid stage output format.",
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }))
    });
  }
  const { stage, data } = parsed.data;
  const normalizedStageName = stage;
  const stageSchema = STAGE_SCHEMAS[normalizedStageName];
  if (stageSchema) {
    const stageValidation = stageSchema.safeParse(data);
    if (!stageValidation.success) {
      recordStageStatus(runId, stage, {
        status: "failed",
        lastError: `Data does not match ${stage} schema.`
      });
      return JSON.stringify({
        status: "validation_error",
        message: `Data does not match ${stage} schema.`,
        errors: stageValidation.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      });
    }
  }
  saveStageOutput(runId, stage, data);
  recordStageStatus(runId, stage, {
    status: "validated"
  });
  return JSON.stringify({
    status: "ok",
    stage,
    runId,
    message: `Saved ${stage} output to run #${runId}.`
  });
}

// mcp/tools/get-stage-output.ts
var definition12 = {
  name: "get_stage_output",
  description: "Read a previously saved pipeline stage output. Provide a stage name to get that specific output, or omit to get all stages. Available stages: sessionSummaries, projectSummaries, weeklyInsights, typeClassification, evidenceVerification, contentWriter, translator."
};
async function execute9(args) {
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Call extract_data first."
    });
  }
  if (args.stage) {
    const data = getStageOutput(runId, args.stage);
    if (!data) {
      return JSON.stringify({
        status: "not_found",
        stage: args.stage,
        runId,
        message: `No ${args.stage} output found for run #${runId}. This stage may not have been executed yet.`
      });
    }
    return JSON.stringify({
      status: "ok",
      stage: args.stage,
      runId,
      data
    });
  }
  const all = getAllStageOutputs(runId);
  const stages = Object.keys(all);
  return JSON.stringify({
    status: "ok",
    runId,
    stagesAvailable: stages,
    data: all
  });
}

// mcp/tools/get-prompt-context.ts
import { z as z4 } from "zod";

// lib/prompt-context.ts
var PROMPT_CONTEXT_KINDS = [
  "sessionSummaries",
  "domainAnalysis",
  "projectSummaries",
  "weeklyInsights",
  "typeClassification",
  "evidenceVerification",
  "contentWriter",
  "translation"
];
function trimText(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}\u2026`;
}
function trimMessages(messages, maxMessages, maxChars) {
  return messages.slice(0, maxMessages).map((message) => ({
    role: message.role,
    timestamp: message.timestamp,
    content: trimText(message.content, maxChars),
    ...Array.isArray(message.toolCalls) && message.toolCalls.length > 0 ? {
      toolCalls: message.toolCalls.slice(0, 5).map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        ...toolCall.isError ? { isError: true } : {}
      }))
    } : {},
    ...message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}
  }));
}
function buildUtteranceLookup(phase1Output) {
  return Object.fromEntries(
    phase1Output.developerUtterances.map((utterance) => [
      utterance.id,
      utterance.displayText || utterance.text
    ])
  );
}
function buildTrimmedSessionInput(phase1Output) {
  return (phase1Output.sessions ?? []).map((session) => ({
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName ?? "unknown",
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds: session.durationSeconds,
    source: session.source,
    stats: session.stats,
    messages: trimMessages(session.messages, 12, 700)
  }));
}
function buildThinkingQualityContext(phase1Output) {
  return {
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      text: trimText(utterance.displayText || utterance.text, 1e3),
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      isSessionStart: utterance.isSessionStart,
      isContinuation: utterance.isContinuation,
      precedingAIHadError: utterance.precedingAIHadError,
      timestamp: utterance.timestamp
    })),
    sessionMetrics: phase1Output.sessionMetrics,
    ...phase1Output.aiInsightBlocks?.length ? {
      aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 20).map((block) => ({
        sessionId: block.sessionId,
        turnIndex: block.turnIndex,
        content: trimText(block.content, 200),
        triggeringUtteranceId: block.triggeringUtteranceId
      }))
    } : {}
  };
}
function buildCommunicationContext(phase1Output) {
  return {
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      text: trimText(utterance.displayText || utterance.text, 1e3),
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      isSessionStart: utterance.isSessionStart,
      isContinuation: utterance.isContinuation,
      timestamp: utterance.timestamp
    })),
    sessionMetrics: phase1Output.sessionMetrics
  };
}
function buildLearningContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      text: trimText(utterance.displayText || utterance.text, 1e3),
      hasQuestion: utterance.hasQuestion,
      precedingAIToolCalls: utterance.precedingAIToolCalls?.slice(0, 8),
      precedingAIHadError: utterance.precedingAIHadError,
      timestamp: utterance.timestamp
    })),
    ...phase1Output.aiInsightBlocks?.length ? {
      aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 40).map((block) => ({
        sessionId: block.sessionId,
        turnIndex: block.turnIndex,
        content: trimText(block.content, 400),
        triggeringUtteranceId: block.triggeringUtteranceId
      }))
    } : {},
    sessions: buildTrimmedSessionInput(phase1Output)
  };
}
function buildEfficiencyContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessions: buildTrimmedSessionInput(phase1Output),
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      text: trimText(utterance.displayText || utterance.text, 800),
      characterCount: utterance.characterCount,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      precedingAIToolCalls: utterance.precedingAIToolCalls?.slice(0, 8),
      timestamp: utterance.timestamp
    }))
  };
}
function buildSessionOutcomeContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessions: buildTrimmedSessionInput(phase1Output)
  };
}
function buildDomainAnalysisContext(domain, phase1Output, deterministicScores) {
  const base = {
    domain,
    deterministicScores,
    dateRange: phase1Output.sessionMetrics.dateRange
  };
  switch (domain) {
    case "thinkingQuality":
      return { ...base, phase1: buildThinkingQualityContext(phase1Output) };
    case "communicationPatterns":
      return { ...base, phase1: buildCommunicationContext(phase1Output) };
    case "learningBehavior":
      return { ...base, phase1: buildLearningContext(phase1Output) };
    case "contextEfficiency":
      return { ...base, phase1: buildEfficiencyContext(phase1Output) };
    case "sessionOutcome":
      return { ...base, phase1: buildSessionOutcomeContext(phase1Output) };
  }
}
function buildPromptContext(input) {
  const {
    kind,
    phase1Output,
    deterministicScores,
    typeResult,
    domainResults,
    stageOutputs,
    domain
  } = input;
  const base = {
    kind,
    availableDomains: domainResults.map((result) => result.domain),
    availableStages: Object.keys(stageOutputs).filter(
      (key) => stageOutputs[key] !== void 0
    )
  };
  switch (kind) {
    case "sessionSummaries":
      return {
        ...base,
        phase1: {
          sessionMetrics: phase1Output.sessionMetrics,
          sessions: buildTrimmedSessionInput(phase1Output),
          activitySessions: phase1Output.activitySessions ?? []
        }
      };
    case "domainAnalysis":
      if (!domain) {
        throw new Error("Domain is required when kind=domainAnalysis.");
      }
      return {
        ...base,
        ...buildDomainAnalysisContext(domain, phase1Output, deterministicScores)
      };
    case "projectSummaries":
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] }
      };
    case "weeklyInsights":
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] }
      };
    case "typeClassification":
      return {
        ...base,
        deterministicScores,
        deterministicType: typeResult,
        sessionMetrics: phase1Output.sessionMetrics,
        domainResults
      };
    case "evidenceVerification":
      return {
        ...base,
        utteranceLookup: buildUtteranceLookup(phase1Output),
        domainResults
      };
    case "contentWriter":
      return {
        ...base,
        deterministicType: typeResult,
        domainResults,
        stageOutputs: {
          typeClassification: stageOutputs.typeClassification,
          weeklyInsights: stageOutputs.weeklyInsights,
          projectSummaries: stageOutputs.projectSummaries,
          evidenceVerification: stageOutputs.evidenceVerification
        }
      };
    case "translation":
      return {
        ...base,
        languageSample: phase1Output.developerUtterances.slice(-50).map((utterance) => utterance.displayText || utterance.text),
        deterministicType: typeResult,
        domainResults,
        stageOutputs
      };
  }
}

// mcp/tools/get-prompt-context.ts
var definition13 = {
  name: "get_prompt_context",
  description: "Read a stage- or domain-specific prompt payload from the current analysis run. Use this instead of reading ~/.betterprompt/phase1-output.json directly. Kinds: sessionSummaries, domainAnalysis, projectSummaries, weeklyInsights, typeClassification, evidenceVerification, contentWriter, translation."
};
var GetPromptContextInputSchema = z4.object({
  kind: z4.enum(PROMPT_CONTEXT_KINDS),
  domain: z4.enum([
    "thinkingQuality",
    "communicationPatterns",
    "learningBehavior",
    "contextEfficiency",
    "sessionOutcome"
  ]).optional()
});
async function execute10(args) {
  const parsed = GetPromptContextInputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid prompt-context request.",
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Call extract_data first."
    });
  }
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: "not_found",
      runId,
      message: `Run #${runId} has no Phase 1 output.`
    });
  }
  try {
    const data = buildPromptContext({
      kind: parsed.data.kind,
      domain: parsed.data.domain,
      phase1Output: run.phase1Output,
      deterministicScores: run.scores,
      typeResult: run.typeResult,
      domainResults: getDomainResults(runId),
      stageOutputs: getAllStageOutputs(runId)
    });
    return JSON.stringify({
      status: "ok",
      runId,
      kind: parsed.data.kind,
      ...parsed.data.domain ? { domain: parsed.data.domain } : {},
      data
    });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      runId,
      message: error instanceof Error ? error.message : "Failed to build prompt context."
    });
  }
}

// mcp/server.ts
var resolvedUserId = null;
async function getUserId() {
  if (resolvedUserId) return resolvedUserId;
  const user = await verifyAuth();
  if (!user) {
    throw new Error(
      "Could not reach the BetterPrompt server. Check the plugin serverUrl setting and confirm the dashboard server is running."
    );
  }
  resolvedUserId = user.id;
  return resolvedUserId;
}
var server = new McpServer({
  name: "betterprompt",
  version: "0.2.0"
});
function wrapToolExecution(fn) {
  return async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })
        }],
        isError: true
      };
    }
  };
}
server.tool(
  definition4.name,
  definition4.description,
  {},
  wrapToolExecution(() => execute({}))
);
server.tool(definition5.name, definition5.description, {
  maxSessions: z5.number().optional().describe("Maximum number of recent sessions to analyze (default: 50)")
}, wrapToolExecution(execute2));
server.tool(
  definition6.name,
  definition6.description,
  DomainResultInputSchema.shape,
  wrapToolExecution(execute3)
);
server.tool(
  definition7.name,
  definition7.description,
  GetDomainResultsInputSchema.shape,
  wrapToolExecution(execute4)
);
server.tool(
  definition8.name,
  definition8.description,
  {},
  wrapToolExecution(() => execute5({}))
);
server.tool(definition9.name, definition9.description, {
  port: z5.number().optional().describe("Port for the report server (default: 3456)"),
  openBrowser: z5.boolean().optional().describe("Auto-open report in browser (default: true)"),
  allowIncomplete: z5.boolean().optional().describe("Override required-stage gating and generate a report anyway")
}, wrapToolExecution(execute6));
server.tool(definition10.name, definition10.description, {
  serverUrl: z5.string().optional().describe("Override the configured BetterPrompt server URL for this sync call")
}, wrapToolExecution(execute7));
server.tool(
  definition11.name,
  definition11.description,
  StageOutputInputSchema.shape,
  wrapToolExecution(execute8)
);
server.tool(definition12.name, definition12.description, {
  stage: z5.string().optional().describe("Stage name to retrieve (omit for all stages)")
}, wrapToolExecution(execute9));
server.tool(
  definition13.name,
  definition13.description,
  GetPromptContextInputSchema.shape,
  wrapToolExecution(execute10)
);
server.tool(
  definition.name,
  definition.description,
  {},
  wrapToolExecution(async () => {
    const userId = await getUserId();
    const summary = await getSummaryWithCache(userId);
    return formatResult(summary);
  })
);
server.tool(definition2.name, definition2.description, {
  domain: z5.enum(["thinkingQuality", "communicationPatterns", "learningBehavior", "contextEfficiency", "sessionOutcome"]).optional().describe("Filter by domain key")
}, wrapToolExecution(async (args) => {
  const userId = await getUserId();
  const summary = await getSummaryWithCache(userId);
  return formatResult2(summary, args);
}));
server.tool(definition3.name, definition3.description, {
  category: z5.enum(["strengths", "anti_patterns", "kpt"]).optional().default("kpt").describe('Category of insights: "strengths", "anti_patterns", or "kpt" (default)')
}, wrapToolExecution(async (args) => {
  const userId = await getUserId();
  const summary = await getSummaryWithCache(userId);
  return formatResult3(summary, args);
}));
async function main() {
  recoverStaleAnalysisState({
    force: true,
    reason: "Recovered stale running state on MCP server startup."
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});
function cleanup() {
  closeCache();
  closeResultsDb();
  closeStageDb();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
//# sourceMappingURL=server.js.map