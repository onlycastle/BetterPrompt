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
| 2 | 3 Insight Workers | 3 | Parallel analysis (ThinkingQuality, LearningBehavior, ContextEfficiency) |
| 2.5 | TypeClassifier | 1 | Developer type classification (5x3 matrix) |
| 3 | ContentWriter | 1 | Personalized narrative generation |
| 4 | Translator | 0-1 | Conditional translation (non-English only) |

- **Total**: 5 LLM calls (English), 6 LLM calls (non-English)
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

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design, pipelines, and components.
