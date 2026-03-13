# Plugin (Agent Reference)

Claude Code plugin at `packages/plugin/`. MCP server + post-session hook + background analyzer.

## File Map

| File | Purpose |
|------|---------|
| `mcp/server.ts` | MCP entry point, stdio transport, registers 3 tools |
| `mcp/tools/get-developer-profile.ts` | Tool: profile type, scores, personality |
| `mcp/tools/get-growth-areas.ts` | Tool: growth areas, optional domain filter |
| `mcp/tools/get-recent-insights.ts` | Tool: strengths / anti-patterns / KPT |
| `lib/config.ts` | Env var reader, path helpers |
| `lib/cache.ts` | SQLite cache (better-sqlite3, WAL mode) |
| `lib/api-client.ts` | HTTP client, `fetchUserSummary()`, `verifyAuth()` |
| `lib/debounce.ts` | Debounce rules, state file read/write |
| `lib/background-analyzer.ts` | Detached child process, dynamic CLI imports |
| `hooks/post-session-handler.ts` | Stop hook, <100ms, spawns background analyzer |
| `hooks/hooks.json` | Hook registration (`stop` event) |
| `.claude-plugin/plugin.json` | Plugin metadata + config schema |
| `.mcp.json` | MCP server config (stdio transport) |

## MCP Tools

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_developer_profile` | none | `{ primaryType, controlLevel, matrixName, personalitySummary, domainScores, analyzedAt }` |
| `get_growth_areas` | `domain?: enum` | `{ growthAreas: [{ title, domain, severity, recommendation }], totalCount, analyzedAt }` |
| `get_recent_insights` | `category?: "strengths" \| "anti_patterns" \| "kpt"` | Category-specific JSON (default: `kpt`) |

Domain enum: `thinkingQuality`, `communicationPatterns`, `learningBehavior`, `contextEfficiency`, `sessionOutcome`

## Server API Dependency

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/api/analysis/user/summary` | GET | `api-client.ts` → `fetchUserSummary()` |
| `/api/auth/me` | GET | `api-client.ts` → `verifyAuth()` |
| `/api/analysis/run` | POST | `background-analyzer.ts` (via CLI uploader) |

Route implementation: `app/api/analysis/user/summary/route.ts`

## Config (Environment Variables)

| Variable | Fallback | Default |
|----------|----------|---------|
| `BETTERPROMPT_SERVER_URL` | `BETTERPROMPT_API_URL` | `http://localhost:3000` |
| `BETTERPROMPT_AUTH_TOKEN` | `BETTERPROMPT_AUTH_TOKEN` | `""` |
| `BETTERPROMPT_AUTO_ANALYZE` | — | `true` |
| `BETTERPROMPT_ANALYZE_THRESHOLD` | — | `5` |

## Local Files

| Path | Format | Content |
|------|--------|---------|
| `~/.betterprompt/insight-cache.db` | SQLite | `cached_insights(user_id, result_id, profile_json, growth_json, insights_json, fetched_at)` |
| `~/.betterprompt/plugin-state.json` | JSON | `{ lastAnalysisTimestamp, lastAnalysisSessionCount, analysisInProgress }` |
| `~/.betterprompt/plugin-errors.log` | Text | Timestamped error log from background analyzer |

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

## Background Analyzer Flow

```
verifyAuth() → loadCliModules() → scanSessions() → uploadForAnalysis() → refreshCache() → markAnalysisComplete()
```

CLI module loading: dynamic import, tries `betterprompt/scanner` (npm) first, falls back to `../../cli/src/scanner.js` (monorepo dev). No compile-time CLI dependency — uses local interface definitions.

## Hook Execution

- Event: `stop` (Claude Code session ends)
- Command: `node ./dist/hooks/post-session-handler.js`
- Must exit in <100ms
- Spawns `background-analyzer.js` via `spawn('node', [...], { detached: true, stdio: 'ignore' })` + `child.unref()`

## Build

```bash
cd packages/plugin
npm run build     # tsc → dist/
npm run dev       # tsc --watch
npm start         # node dist/mcp/server.js
```

Output: `packages/plugin/dist/` (ESM, ES2022/NodeNext)

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server + stdio transport + Zod (transitive) |
| `better-sqlite3` | Insight cache SQLite |

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
