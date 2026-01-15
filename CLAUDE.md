# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Vision

> **Core**: B2B service that assesses and educates developers' AI utilization capabilities
>
> **Strategy**: B2C (viral personality test) → B2B (enterprise capability assessment/training)

NoMoreAISlop analyzes developer-AI collaboration sessions from `~/.claude/projects/`, evaluates coding style using LLM analysis, and generates personalized reports.

## Commands

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type check without emitting
npm test               # Run all tests
npm run ui             # Start API (3001) + React SPA (5173)
```

## Key Implementation Details

**Two-Stage Pipeline**: Uses Gemini 3 Flash (`gemini-3-flash-preview`) for both analysis stages:
- Stage 1 (Data Analyst): Extracts structured behavioral data
- Stage 2 (Content Writer): Transforms data into personalized narrative
- Prompts use PTCF framework (Persona · Task · Context · Format)
- Temperature: 1.0 (Gemini's recommended default)

**Structured Outputs**: Gemini stages use `responseJsonSchema` with `responseMimeType: "application/json"`. Zod schemas in `src/models/` → JSON Schema via `zod-to-json-schema`. Legacy single-stage mode uses Anthropic's beta feature.

**JSONL Parsing**: Session logs contain `user`, `assistant`, `queue-operation`, `file-history-snapshot` types. Only `user` and `assistant` are analyzed. Content blocks: `text`, `tool_use`, `tool_result`.

**Path Encoding**: Claude Code encodes paths by replacing `/` with `-`. See `encodeProjectPath`/`decodeProjectPath` in `src/parser/jsonl-reader.ts`.

## Plugin Commands

Commands in `commands/*.md` with YAML frontmatter:
- `/noslop` - Analyze current session
- `/noslop:analyze <id>` - Analyze specific session
- `/noslop:sessions` - List available sessions

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Required for two-stage pipeline (Gemini 3 Flash) |
| `ANTHROPIC_API_KEY` | Required for legacy single-stage mode or fallback |
| `NOSLOP_MODEL` | Override model (legacy mode only) |

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design, pipelines, and components.
