# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Vision

> **Core**: B2B service that assesses and educates developers' AI utilization capabilities
>
> **Strategy**: B2C (viral personality test) → B2B (enterprise capability assessment/training)

NoMoreAISlop analyzes developer-AI collaboration sessions from `~/.claude/projects/`, evaluates coding style using LLM analysis, and generates personalized reports.

## Language Policy

> ⚠️ **IMPORTANT**: All content in this codebase MUST be written in English.

- **LLM Prompts**: All prompts for LLM analysis (Gemini, Anthropic, etc.) must be in English
- **Code**: All code, variable names, function names, and comments must be in English
- **Docstrings**: All documentation strings and JSDoc comments must be in English
- **Commit messages**: All git commit messages must be in English

This ensures consistency across the codebase and maintains compatibility with LLM models which perform best with English prompts.

## Commands

```bash
npm run dev            # Start Next.js development server (port 3000)
npm run build          # Build production bundle
npm run typecheck      # Type check without emitting
npm test               # Run all tests
```

## Key Implementation Details

**4-Phase Orchestrator Pipeline**: Uses Gemini 3 Flash (`gemini-3-flash-preview`) for all LLM stages:

| Phase | Component | LLM Calls | Description |
|-------|-----------|-----------|-------------|
| 1 | DataExtractor | 0 | Deterministic extraction (no LLM) |
| 2 | 4 Insight Workers | 4 | Parallel analysis (ThinkingQuality, CommunicationPatterns, LearningBehavior, ContextEfficiency) |
| 2.5 | TypeClassifier | 1 | Developer type classification (5x3 matrix) |
| 2.75 | KnowledgeResourceMatcher | 0 | Deterministic resource matching from curated database |
| 3 | ContentWriter | 1 | Personalized narrative generation |
| 4 | Translator | 0-1 | Conditional translation (non-English only) |

- **Total**: 6 LLM calls (English), 7 LLM calls (non-English)
- Prompts use PTCF framework (Persona · Task · Context · Format)
- Temperature: 1.0 (Gemini's recommended default)

**Structured Outputs**: Gemini stages use `responseJsonSchema` with `responseMimeType: "application/json"`. Zod schemas in `src/lib/models/` → JSON Schema via `zod-to-json-schema`.

> ⚠️ **Gemini Schema Nesting Limit**: Gemini API has a **maximum nesting depth of 4 levels** for `responseJsonSchema`.
>
> **Key Finding (2026-02-01)**: Only `object` (`{}`) counts toward nesting depth. `array` (`[]`) does NOT count.
>
> ```
> ✅ VALID (4 object levels):
> root{} → antiPatterns[] → pattern{} → examples[] → example{}
>   L1                        L2                        L3 (array skipped) L4
>
> ❌ INVALID (5 object levels):
> root{} → config{} → settings{} → options{} → nested{}
>   L1       L2          L3          L4          L5 (exceeds limit)
> ```
>
> **Guidelines**:
> - `z.array(z.object({...}))` is safe - arrays don't add nesting
> - Avoid `z.object({ nested: z.object({ deep: z.object({...}) }) })` chains
> - Structured arrays preferred over semicolon-separated strings for type safety
>
> Error symptom: `"A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth"`

**JSONL Parsing**: Session logs contain `user`, `assistant`, `queue-operation`, `file-history-snapshot` types. Only `user` and `assistant` are analyzed. Content blocks: `text`, `tool_use`, `tool_result`.

**Path Encoding**: Claude Code encodes paths by replacing `/` with `-`. See `encodeProjectPath`/`decodeProjectPath` in `src/lib/parser/jsonl-reader.ts`.

> ⚠️ **Worker Aggregation Checklist**: When adding or modifying Phase 2 Workers, ensure `aggregateWorkerInsights()` in `src/lib/models/agent-outputs.ts` handles all workers.
>
> **Required Updates**:
> 1. Worker output schema in `src/lib/models/` (e.g., `communication-patterns-data.ts`)
> 2. `AgentOutputs` type in `agent-outputs.ts` (add worker output field)
> 3. `aggregateWorkerInsights()` function (add domain processing block)
> 4. `AggregatedWorkerInsights` type in `worker-insights.ts` (add domain field)
> 5. `WORKER_DOMAIN_CONFIGS` in `worker-insights.ts` (add UI config)
>
> **Bug History (2026-02-04)**: `CommunicationPatterns` worker was missing from `aggregateWorkerInsights()`, causing Communication tab to not display despite data being generated.

## No Fallback Policy

> ⚠️ **CRITICAL**: This codebase follows a strict "No Fallback" policy.

**Principle**: When errors occur, they must be thrown immediately. Never silently hide errors by returning default/empty data.

**Why**:
- Fallbacks hide bugs and make debugging extremely difficult
- Silent failures lead to incorrect analysis results being stored in the database
- Users get misleading data without knowing something went wrong

**Implementation**:
- Workers throw errors instead of returning empty data via `createFailedResult`
- Orchestrator uses `Promise.all()` (not `Promise.allSettled()`) to fail fast
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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Required for 4-phase orchestrator pipeline (Gemini 3 Flash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

## Release Workflow

**Web/API (Vercel)**: Push to `main` → Vercel auto-deploys

**Lambda (SST)**: Push to `main` with changes in `lambda/`, `infra/`, or `sst.config.ts` → auto-deploys

> ⚠️ **NEVER use local SST deployment** (`npx sst deploy`). Local SST has critical bugs causing routing failures and inconsistent deployments. Always use GitHub Actions for Lambda deployment.

## Documentation

> ⚠️ **Context Loading**: Before exploring the codebase for architecture, pipeline, file locations, or debugging context, **read `docs/agent/` first**. These docs are optimized for fast lookups (concise, table-based) and cover most questions about system structure, key files, test workflows, and known issues. Only dive into source files when `docs/agent/` doesn't have the specific detail you need.

| Document | When to Read |
|----------|--------------|
| [docs/agent/ARCHITECTURE.md](./docs/agent/ARCHITECTURE.md) | Understanding system structure, pipeline phases, finding key files, API routes, data models |
| [docs/agent/TESTING.md](./docs/agent/TESTING.md) | Running tests, test script options, cache workflows |
| [docs/agent/DEPLOYMENT.md](./docs/agent/DEPLOYMENT.md) | Lambda/Vercel deployment, environment variables, infrastructure |
| [docs/agent/TROUBLESHOOTING.md](./docs/agent/TROUBLESHOOTING.md) | Debugging issues, known pitfalls, prevention checklists |

Detailed human-readable docs: [docs/human/](./docs/human/)

> ⚠️ **Keep Agent Docs Updated**: When you add new files, change directory structure, modify the pipeline, add/remove API routes, or update test scripts, **update the relevant `docs/agent/` doc** in the same change. These docs are the primary reference for future sessions — stale docs lead to wrong assumptions and wasted context.
