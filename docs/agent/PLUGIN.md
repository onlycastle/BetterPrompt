# Plugin (Agent Reference)

Claude Code plugin at `packages/plugin/`. MCP server + queued auto-analysis hooks + local report pipeline + multi-source session scanner.

## File Map

| File | Purpose |
|------|---------|
| `mcp/server-entry.ts` | Bootstrap entry point — installs native deps (better-sqlite3) then dynamically imports server.ts. Enables single-session install-to-result flow |
| `mcp/server.ts` | MCP server, stdio transport, registers 15 tools (12 local-first + 3 server-backed) |
| `mcp/tools/scan-sessions.ts` | Tool: scan Claude Code + Cursor session logs, return metadata |
| `mcp/tools/extract-data.ts` | Tool: deterministic Phase 1 extraction + scoring |
| `mcp/tools/save-domain-results.ts` | Tool: save domain analysis with Zod validation + quality gates |
| `mcp/tools/get-domain-results.ts` | Tool: read saved domain results (one or all) |
| `mcp/tools/get-run-progress.ts` | Tool: inspect current run progress and resume point |
| `mcp/tools/classify-developer-type.ts` | Tool: deterministic type classification (5x3 matrix) |
| `mcp/tools/verify-evidence.ts` | Tool: deterministic evidence verification + stage persistence |
| `mcp/tools/generate-report.ts` | Tool: generate HTML report + localhost server |
| `mcp/tools/sync-to-team.ts` | Tool: sync results to team server (optional) |
| `mcp/tools/save-stage-output.ts` | Tool: save pipeline stage output with schema validation |
| `mcp/tools/get-stage-output.ts` | Tool: read pipeline stage outputs (one or all) |
| `mcp/tools/get-prompt-context.ts` | Tool: stage/domain-specific prompt payloads for skills |
| `mcp/tools/get-developer-profile.ts` | Tool (server-backed): profile type, scores, personality |
| `mcp/tools/get-growth-areas.ts` | Tool (server-backed): growth areas, optional domain filter |
| `mcp/tools/get-recent-insights.ts` | Tool (server-backed): strengths / anti-patterns / KPT |
| `lib/logger.ts` | Dual-destination logger (`debug`/`info`/`error`). All levels write to `~/.betterprompt/debug.log` (timestamped). Stderr: `debug` requires `BETTERPROMPT_DEBUG=1`; `info` and `error` always emit |
| `lib/config.ts` | Plugin settings reader, path helpers |
| `lib/cache.ts` | SQLite cache (better-sqlite3, WAL mode) |
| `lib/results-db.ts` | SQLite results database for canonical analysis runs |
| `lib/stage-db.ts` | SQLite stage outputs + status tracking (shares `results.db` connection) |
| `lib/prompt-context.ts` | Prompt context builders for each pipeline stage/domain |
| `lib/report-template.ts` | Standalone HTML report generator |
| `lib/evaluation-assembler.ts` | Assembles canonical run from results DB |
| `lib/api-client.ts` | HTTP client, `fetchUserSummary()`, `verifyAuth()` |
| `lib/prefs.ts` | User preferences (`~/.betterprompt/prefs.json`), first-run detection |
| `lib/debounce.ts` | Debounce rules, state file read/write |
| `lib/background-analyzer.ts` | Deprecated cutover stub kept only to fail loudly if invoked |
| `lib/core/session-scanner.ts` | Claude Code JSONL parsing and local data-dir helpers |
| `lib/core/multi-source-session-scanner.ts` | Multi-source scanner coordinator (Claude Code + Cursor) |
| `lib/core/data-extractor.ts` | Phase 1 utterance extraction from parsed sessions |
| `lib/core/deterministic-scorer.ts` | Rubric-based deterministic scoring |
| `lib/core/deterministic-type-mapper.ts` | 5x3 type matrix classification |
| `lib/core/types.ts` | Shared type definitions |
| `lib/scanner/index.ts` | Multi-source scanner registry + `SourceRegistry` / `MultiSourceScanner` |
| `lib/scanner/sources/base.ts` | `SessionSource` interface + `BaseSessionSource` |
| `lib/scanner/sources/claude-code.ts` | Claude Code JSONL source |
| `lib/scanner/sources/claude-discovery.ts` | Waterfall discovery of Claude data dirs |
| `lib/scanner/sources/cursor.ts` | Cursor AI chat source (SQLite) |
| `lib/scanner/sources/cursor-composer.ts` | Cursor Composer source (SQLite) |
| `lib/scanner/sources/cursor-paths.ts` | Cursor path resolution |
| `lib/scanner/sources/sqlite-loader.ts` | Shared SQLite loader for Cursor sources |
| `lib/scanner/tool-mapping.ts` | Tool name normalization across sources |
| `hooks/post-session-handler.ts` | `SessionEnd` hook, <1.5s, queues the next local analysis run |
| `lib/native-deps.ts` | Shared `ensureNativeDeps({ pluginRoot?, fatal? })` — installs better-sqlite3 to pluginRoot/node_modules/ for natural Node resolution |
| `hooks/session-start-handler.ts` | `SessionStart` hook, first-run detection + queued `bp analyze` context |
| `hooks/hooks.json` | Hook registration (`SessionStart` + `SessionEnd`) |
| `skills/bp-setup/SKILL.md` | Guided onboarding wizard skill (7 integer steps, includes project selection) |
| `skills/bp-analyze/SKILL.md` | Full analysis pipeline orchestrator skill |
| `.claude-plugin/plugin.json` | Plugin metadata + config schema |
| `.mcp.json` | MCP server config (stdio transport) |

## MCP Tools

### Local-First Tools (no server needed)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `scan_sessions` | `includeProjects?: string[]` | `{ sessionCount, projectCount, projects, allProjects, sources, totalMessages, dateRange, analysisState }` |
| `extract_data` | `maxSessions?: number` (default 50), `includeProjects?: string[]` | `{ runId, metrics, deterministicScores }` |
| `save_domain_results` | `domain: enum`, `overallScore`, `strengths[]`, `growthAreas[]`, `data?: {}` | `{ domain, score, runId }` |
| `get_domain_results` | `domain?: enum` | Single domain or all saved domains |
| `get_run_progress` | none | `{ runId, completionStatus, nextStep, stages[] }` |
| `verify_evidence` | `threshold?` | `{ totalEvidence, keptCount, filteredCount, domainStats[] }` |
| `classify_developer_type` | none | `{ primaryType, controlLevel, matrixName, matrixEmoji, distribution }` |
| `generate_report` | `port?: number`, `openBrowser?: boolean`, `allowIncomplete?: boolean` | `{ url, reportPath }` |
| `sync_to_team` | `serverUrl?: string` | `{ serverUrl }` |
| `save_stage_output` | `stage: enum`, `data: {}` | `{ stage, runId }` |
| `get_stage_output` | `stage?: string` | Single stage output or all stages |
| `get_prompt_context` | `kind: enum`, `domain?: enum` | Stage/domain-specific prompt payload |

Domain enum: `thinkingQuality`, `communicationPatterns`, `learningBehavior`, `contextEfficiency`, `sessionOutcome`, `content`

Stage enum: `sessionSummaries`, `projectSummaries`, `weeklyInsights`, `typeClassification`, `evidenceVerification`, `contentWriter`, `translator`

Prompt context kinds: `sessionSummaries`, `domainAnalysis`, `projectSummaries`, `weeklyInsights`, `typeClassification`, `evidenceVerification`, `contentWriter`, `translation`

### Server-Backed Tools (backward compatible)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_developer_profile` | none | `{ primaryType, controlLevel, matrixName, personalitySummary, domainScores, analyzedAt }` |
| `get_growth_areas` | `domain?: enum` | `{ growthAreas: [{ title, domain, severity, recommendation }], totalCount, analyzedAt }` |
| `get_recent_insights` | `category?: "strengths" \| "anti_patterns" \| "kpt"` | Category-specific JSON (default: `kpt`) |

## Server API Dependency

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/api/analysis/user/summary` | GET | `api-client.ts` → `fetchUserSummary()` |
| `/api/auth/me` | GET | `api-client.ts` → `verifyAuth()` |
| `/api/analysis/sync` | POST | `sync_to_team` / canonical run persistence |

Route implementation: `app/api/analysis/user/summary/route.ts`

## Config (Plugin Settings + Runtime Defaults)

| Surface | Key | Default |
|---------|-----|---------|
| Plugin setting | `serverUrl` | `http://localhost:3000` |
| Plugin setting | `autoAnalyze` | `true` |
| Plugin setting | `analyzeThreshold` | `5` |
| Runtime default | Local data dir | `~/.betterprompt` |
| Runtime default | Claude Code discovery | `~/.claude/`, then `.claude*` prefix scan |
| Env var | `BETTERPROMPT_DEBUG` | `1` to enable debug-level stderr logging |

## Local Files

| Path | Format | Content |
|------|--------|---------|
| `~/.betterprompt/insight-cache.db` | SQLite | `cached_insights(user_id, result_id, profile_json, growth_json, insights_json, fetched_at)` |
| `~/.betterprompt/results.db` | SQLite | `analysis_runs`, `domain_results`, `stage_outputs`, `stage_statuses` |
| `~/.betterprompt/phase1-output.json` | JSON | Phase 1 extraction output (utterances, metrics, scores) |
| `~/.betterprompt/current-run-id.txt` | Text | Active analysis run ID for cross-tool coordination |
| `~/.betterprompt/scan-cache/` | JSON | Parsed session cache from multi-source scanner |
| `~/.betterprompt/reports/` | HTML | Generated reports (`report-{timestamp}.html`, `latest.html`) |
| `~/.betterprompt/prefs.json` | JSON | User preferences: `welcomeCompleted`, `welcomeVersion`, `starAsked`, `selectedProjects` |
| `~/.betterprompt/plugin-state.json` | JSON | Lifecycle state: `idle/pending/running/complete/failed` + timestamps |
| `~/.betterprompt/plugin-errors.log` | Text | Timestamped hook/deprecation errors |
| `~/.betterprompt/debug.log` | Text | All logger output (debug/info/error) with ISO timestamps, written unconditionally |

## Cache Behavior

```
getSummaryWithCache(userId):
  cached && fresh? → return cached
  try server refresh → success? → store + return
  server fail? → return stale cached
  no cache at all? → return null
```

TTL: 24 hours (`CACHE_TTL_MS`).

## Debounce Rules

Evaluated in order by `shouldTriggerAnalysis(sessionDurationMs)`:

| # | Rule | Threshold |
|---|------|-----------|
| 1 | Guard — no analysis in progress | `analysisInProgress === false` |
| 2 | Duration — session was long enough | `≥ 3 minutes` |
| 3 | Cooldown — enough time since last | `≥ 4 hours` |
| 4 | Threshold — enough new sessions | `≥ analyzeThreshold` (default 5) |

Session count: scans `~/.claude/projects/*/` for `.jsonl` files (filesystem only, no content reading).

## Native Dependency Resolution

`ensureNativeDeps({ pluginRoot })` installs `better-sqlite3` to `<pluginRoot>/node_modules/`. Both `server-entry.ts` and `session-start-handler.ts` derive `pluginRoot` by walking up 2 directories from their `dist/` location. Node's standard module resolution finds the native addon by walking up from `dist/mcp/server-entry.js` → `node_modules/better-sqlite3/`.

No `NODE_PATH` or `CLAUDE_PLUGIN_DATA` env vars are needed. The `.mcp.json` uses a clean config without env overrides.

## Queued Auto-Analysis Flow

```
SessionEnd hook → shouldTriggerAnalysis() → markAnalysisPending()
SessionStart hook → inject queued `bp analyze` context
extract_data → markAnalysisStarted()
generate_report / sync_to_team → markAnalysisComplete()
```

## Local-First Analysis Pipeline

```
scan_sessions → extract_data → [agent-dispatched skills] →
  classify_developer_type → verify_evidence →
  generate_report → (optional) sync_to_team
```

### Agent-Based Dispatch

`bp analyze` dispatches each analysis skill as an **isolated Agent** (via Claude Code's Agent tool) rather than running skills inline. This prevents context accumulation across stages and enables per-stage model selection.

Each agent reads its skill instructions, calls MCP tools (`get_prompt_context`, `save_stage_output`, `save_domain_results`), and returns. The orchestrator tracks progress via `get_run_progress` and dispatches the next agent.

### Model Tiering

| Tier | Model | Skills |
|------|-------|--------|
| Orchestrator | sonnet | bp-analyze |
| Extraction | haiku | extract-ai-partnership, extract-session-craft, extract-tool-mastery, extract-skill-resilience, extract-session-mastery |
| Summarization | haiku | summarize-sessions, summarize-projects, generate-weekly-insights |
| Narrative | sonnet | write-ai-partnership, write-session-craft, write-tool-mastery, write-skill-resilience, write-session-mastery |
| Classification | sonnet | classify-type |
| Content | sonnet | write-content, translate-report |

### Resume

`bp analyze` calls `get_run_progress` before Phase 1. If a prior run is incomplete, it resumes from the first missing required stage instead of rerunning extraction. `nextStep.tool` is used for deterministic stages like `verify_evidence`; `nextStep.skill` is used for agent-dispatched stages.

Writer contract: `write-*` skills must include `severity` on every growth area, include the domain `data` payload, and retry `save_domain_results` locally on validation errors.

### Stage Gate

`generate_report` checks all required stages before generating:

Required stages (5-dimension pipeline): `sessionSummaries`, `extractAiPartnership`, `extractSessionCraft`, `extractToolMastery`, `extractSkillResilience`, `extractSessionMastery`, `aiPartnership`, `sessionCraft`, `toolMastery`, `skillResilience`, `sessionMastery`, `projectSummaries`, `weeklyInsights`, `typeClassification`, `evidenceVerification`, `contentWriter`

Pass `allowIncomplete=true` to override the gate.

## Multi-Source Scanner

The scanner module (`lib/scanner/`) supports multiple session sources:

| Source | Format | Directory |
|--------|--------|-----------|
| `claude-code` | JSONL | `~/.claude/projects/*/` (auto-discovered) |
| `cursor` | SQLite | `~/Library/Application Support/Cursor/User/globalStorage/` |
| `cursor-composer` | SQLite | Same as cursor (composer-specific tables) |

Discovery for Claude Code data dirs uses a waterfall: default `~/.claude/` path, then prefix glob fallback.

## Hook Execution

- Events: `SessionStart`, `SessionEnd`
- Commands:
  - `node ./dist/hooks/session-start-handler.js`
  - `node ./dist/hooks/post-session-handler.js`
- `SessionEnd` queues work; `SessionStart` injects context so Claude Code consumes the queued run in-band
- `SessionStart` priority: (1) skip `compact`, (2) first-run → `bp setup`, (3) pending analysis → `bp analyze`, (4) no-op
- Both hooks derive `pluginRoot` for `ensureNativeDeps()` via `join(dirname(fileURLToPath(import.meta.url)), '..', '..')`

## Build

```bash
cd packages/plugin
npm run build     # tsc → dist/
npm run dev       # tsc --watch
npm start         # node dist/mcp/server-entry.js
```

Output: `packages/plugin/dist/` (ESM, ES2022/NodeNext)

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server + stdio transport |
| `@betterprompt/shared` | Shared Zod schemas (domain results, stage outputs, evidence) |
| `better-sqlite3` | Insight cache + results DB + stage DB |
| `zod` | Input validation for MCP tools |

## Type Contracts

`UserSummary` (shared between `api-client.ts` and `app/api/analysis/user/summary/route.ts`):

```typescript
interface UserSummary {
  resultId: string;
  analyzedAt: string;
  profile: {
    primaryType: string;
    controlLevel: string;
    matrixName: string;
    personalitySummary: string;       // truncated to 200 chars
    domainScores: Record<string, number>;
  };
  growthAreas: Array<{ title, domain, severity, recommendation }>;
  strengths: Array<{ domain, domainLabel, topStrength, domainScore }>;
  antiPatterns: Array<{ pattern, frequency: number, impact }>;
  kpt: { keep: string[], problem: string[], tryNext: string[] };
}
```

Note: `frequency` is `number` (not string) — matches `InefficiencyPattern` type in `src/lib/models/`.
