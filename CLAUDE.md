# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Vision

> **Core**: B2B service that assesses and educates AI builders' capabilities
>
> **Strategy**: B2C (viral personality test) → B2B (enterprise capability assessment/training)

BetterPrompt analyzes AI builder sessions from `~/.claude/projects/`, evaluates collaboration style using LLM analysis, and generates personalized reports.

## Language Policy

> ⚠️ **IMPORTANT**: All content in this codebase MUST be written in English.

- **LLM Prompts**: All prompts for LLM analysis (Anthropic, etc.) must be in English
- **Code**: All code, variable names, function names, and comments must be in English
- **Docstrings**: All documentation strings and JSDoc comments must be in English
- **Commit messages**: All git commit messages must be in English

This ensures consistency across the codebase and maintains compatibility with LLM models which perform best with English prompts.

## Commands (for contributors)

```bash
npm run dev            # Start Next.js development server (port 3000)
npm run build          # Build production bundle
npm run typecheck      # Type check without emitting
npm test               # Run all tests
```

## Key Implementation Details

**Plugin-Based Analysis**: All LLM analysis runs locally via the Claude Code plugin (`packages/plugin/`). The server receives finished results via `POST /api/analysis/sync` and serves them to the dashboard. See `docs/agent/PLUGIN.md` for the plugin pipeline architecture.

**JSONL Parsing**: Session logs contain `user`, `assistant`, `queue-operation`, `file-history-snapshot` types. Only `user` and `assistant` are analyzed. Content blocks: `text`, `tool_use`, `tool_result`.

**Path Encoding**: Claude Code encodes paths by replacing `/` with `-`. See `encodeProjectPath`/`decodeProjectPath` in `src/lib/parser/jsonl-reader.ts`.

> ⚠️ **Continuous Scroll Layout**: The report page renders ALL worker sections sequentially (no tabs). `useScrollSpy` hook drives the active section indicator in the `FloatingProgressDots` component. `InsightPreviewCard` is replaced by inline insight rendering within `GrowthCard`.
>
> **How it works** (in `TabbedReportContainer.tsx`):
> 1. All sections (Activity, Thinking, Communication, Learning, Context, Session) render simultaneously
> 2. `useScrollSpy` with IntersectionObserver detects which section is in viewport
> 3. `FloatingProgressDots` (fixed right side) highlights the active section
> 4. Professional insights render inline within `GrowthCard` (no sidebar, no click needed)
>
> **Key files**: `useScrollSpy.ts`, `FloatingProgressDots.tsx`, `WorkerInsightsSection.tsx` (inline insights in GrowthCard)

## No Fallback Policy

> ⚠️ **CRITICAL**: This codebase follows a strict "No Fallback" policy.

**Principle**: When errors occur, they must be thrown immediately. Never silently hide errors by returning default/empty data.

**Why**:
- Fallbacks hide bugs and make debugging extremely difficult
- Silent failures lead to incorrect analysis results being stored in the database
- Users get misleading data without knowing something went wrong

**Implementation**:
- Plugin analysis skills let errors propagate instead of returning empty data
- Frontend should show clear error states, not fake/empty results

**Do NOT**:
```typescript
// BAD: Silent fallback hides errors
try {
  return await analyze();
} catch (error) {
  return createDefaultOutput(); // User gets empty data, thinks analysis succeeded
}
```

**Do**:
```typescript
// GOOD: Let errors propagate
return await analyze(); // Error surfaces to user, root cause can be identified
```

## Intentional Backward Compatibility

These deprecated code paths are kept intentionally for data migration. Do NOT remove.

| Location | Purpose |
|----------|---------|
| `src/lib/domain/models/knowledge.ts` TopicCategorySchema | Legacy topic categories for SQLite migration compatibility |
| `src/lib/models/verbose-evaluation.ts` pipe-delimited parsers | Legacy format parsers for cached analysis data from pre-structured-JSON era |

## Runtime Defaults

See `docs/agent/DEPLOYMENT.md` for the current self-hosted runtime model and defaults.

## Release Workflow

**Self-hosted**: `npm run build && npm start`

## Git Workflow

> ⚠️ **Post-merge cleanup**: After merging a PR, always switch back to `main` and pull latest:
> ```bash
> git checkout main && git pull origin main
> ```
> This prevents accidentally continuing work on a stale feature branch.

## Plugin Testing

> ⚠️ **Clean Environment Required**: When testing the BetterPrompt plugin, **always remove all previous installations first** to test the full flow including the installation step. A test that skips install doesn't reflect what a real user encounters.
>
> **Cleanup checklist** (all must be done before testing):
> 1. `~/.claude/settings.json` — set `enabledPlugins["betterprompt@betterprompt"]` to `false`, clear `extraKnownMarketplaces`
> 2. `~/.claude/plugins/installed_plugins.json` — remove `betterprompt@betterprompt` entry
> 3. `~/.claude/plugins/known_marketplaces.json` — remove `betterprompt` entry
> 4. Delete `~/.claude/plugins/cache/betterprompt/` and `temp_local_*` dirs
> 5. Delete `~/.claude/plugins/marketplaces/betterprompt/`
> 6. Clear any project-level `settings.local.json` with betterprompt entries
> 7. Check for and remove any plugin state databases (`bp-results*`, `bp-stage*`)
> 8. Delete `~/.betterprompt/prefs.json` to reset first-run onboarding state
> 9. Validate all JSON files after edits (trailing comma issues are common)

## Documentation

> ⚠️ **Context Loading**: Before exploring the codebase for architecture, pipeline, file locations, or debugging context, **read `docs/agent/` first**. These docs are optimized for fast lookups (concise, table-based) and cover most questions about system structure, key files, test workflows, and known issues. Only dive into source files when `docs/agent/` doesn't have the specific detail you need.

| Document | When to Read |
|----------|--------------|
| [docs/agent/ARCHITECTURE.md](./docs/agent/ARCHITECTURE.md) | Understanding system structure, pipeline phases, finding key files, API routes, data models |
| [docs/agent/TESTING.md](./docs/agent/TESTING.md) | Running tests, test script options, cache workflows, plugin testing cleanup |
| [docs/agent/DEPLOYMENT.md](./docs/agent/DEPLOYMENT.md) | Self-hosted deployment, runtime defaults |
| [docs/agent/TROUBLESHOOTING.md](./docs/agent/TROUBLESHOOTING.md) | Debugging issues, known pitfalls, prevention checklists |

Detailed human-readable docs: [docs/human/](./docs/human/)

> ⚠️ **Keep Agent Docs Updated**: When you add new files, change directory structure, modify the pipeline, add/remove API routes, or update test scripts, **update the relevant `docs/agent/` doc** in the same change. These docs are the primary reference for future sessions — stale docs lead to wrong assumptions and wasted context.
