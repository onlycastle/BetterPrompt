# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Core Vision

> **Core**: B2B service that assesses and educates developers' AI utilization capabilities
>
> **Strategy**: B2C (viral personality test) → B2B (enterprise capability assessment/training)

NoMoreAISlop analyzes developer-AI collaboration sessions from `~/.claude/projects/`, evaluates coding style using LLM analysis, and generates personalized reports.

## Commands

```bash
npm run dev            # Start Next.js development server (port 3000)
npm run build          # Build production bundle
npm run typecheck      # Type check without emitting
npm test               # Run all tests
```

## Key Implementation Details

**Three-Stage Pipeline**: Uses Gemini 3 Flash (`gemini-3-flash-preview`) for all analysis stages:
- Module A (Data Analyst): Extracts structured behavioral data
- Module B (Personality Analyst): Extracts personality profile for storytelling
- Stage 2 (Content Writer): Transforms both outputs into personalized narrative
- Prompts use PTCF framework (Persona · Task · Context · Format)
- Temperature: 1.0 (Gemini's recommended default)

**Structured Outputs**: Gemini stages use `responseJsonSchema` with `responseMimeType: "application/json"`. Zod schemas in `src/lib/models/` → JSON Schema via `zod-to-json-schema`. Legacy single-stage mode uses Anthropic's beta feature.

**JSONL Parsing**: Session logs contain `user`, `assistant`, `queue-operation`, `file-history-snapshot` types. Only `user` and `assistant` are analyzed. Content blocks: `text`, `tool_use`, `tool_result`.

**Path Encoding**: Claude Code encodes paths by replacing `/` with `-`. See `encodeProjectPath`/`decodeProjectPath` in `src/lib/parser/jsonl-reader.ts`.

## Plugin Commands

Commands in `commands/*.md` with YAML frontmatter:
- `/noslop` - Analyze current session
- `/noslop:analyze <id>` - Analyze specific session
- `/noslop:sessions` - List available sessions

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Required for three-stage pipeline (Gemini 3 Flash) |
| `ANTHROPIC_API_KEY` | Required for legacy single-stage mode or fallback |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NOSLOP_MODEL` | Override model (legacy mode only) |

## Release Workflow

**Web/API (Vercel)**: Push to `main` → Vercel auto-deploys

**Lambda (SST)**: Push to `main` with changes in `lambda/`, `infra/`, or `sst.config.ts` → auto-deploys

**NPM CLI Package** (`no-ai-slop`):

Option 1 - Tag-based (recommended):
```bash
# 1. Update version in package.json FIRST
cd packages/cli
npm version patch --no-git-tag-version  # or minor/major

# 2. Commit the version bump
git add packages/cli/package.json
git commit -m "chore(cli): bump version to X.X.X"

# 3. Create and push tag (must match package.json version)
git tag cli-vX.X.X
git push origin main --tags  # Triggers GitHub Actions → npm publish
```

⚠️ **Important**: The tag version must match package.json version. GitHub Actions does NOT auto-update package.json for tag triggers.

Option 2 - Manual trigger:
Go to Actions → "Publish CLI to npm" → Run workflow → Select version type

Option 3 - Local script (legacy):
```bash
cd packages/cli
npm run release          # patch bump
npm run release:minor    # minor bump
npm run release:major    # major bump
```

**Required GitHub Secret**: `NPM_TOKEN` - npm access token with publish permission

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design, pipelines, and components.
