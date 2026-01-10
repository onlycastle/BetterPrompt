# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NoMoreAISlop is a Claude Code plugin that analyzes developer-AI collaboration sessions. It parses Claude Code session logs from `~/.claude/projects/`, sends conversations to Claude for evaluation using Structured Outputs, and generates reports rating developers on Planning, Critical Thinking, and Code Understanding.

## Commands

```bash
# Build
npm run build          # Compile TypeScript to dist/

# Development
npm run dev            # Watch mode compilation
npm run typecheck      # Type check without emitting

# Testing
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage

# Linting
npm run lint           # ESLint on src/
```

## Architecture

### Core Pipeline

```
Session JSONL → SessionParser → LLMAnalyzer → ReportGenerator → Storage
```

1. **SessionParser** (`src/parser/`) - Reads JSONL files from `~/.claude/projects/{encoded-path}/{session-id}.jsonl`
2. **LLMAnalyzer** (`src/analyzer/`) - Uses Anthropic Structured Outputs to get guaranteed JSON evaluations
3. **ReportGenerator** (`src/utils/reporter.ts`) - Formats evaluations as CLI markdown
4. **StorageManager** (`src/utils/storage.ts`) - Persists analyses to `~/.nomoreaislop/analyses/`

### Key Implementation Details

**Structured Outputs**: The analyzer uses Anthropic's beta feature (`anthropic-beta: structured-outputs-2025-11-13`) with forced tool use to guarantee valid JSON. Zod schemas in `src/models/` are converted to JSON Schema via `src/analyzer/schema-converter.ts`.

**JSONL Parsing**: Session logs contain multiple message types (`user`, `assistant`, `queue-operation`, `file-history-snapshot`). Only `user` and `assistant` types are relevant for analysis. Content blocks can be `text`, `tool_use`, or `tool_result`.

**Path Encoding**: Claude Code encodes project paths by replacing `/` with `-`. The parser handles this via `encodeProjectPath`/`decodeProjectPath` in `src/parser/jsonl-reader.ts`.

### Directory Structure

```
commands/           # Claude Code plugin commands (*.md with YAML frontmatter)
src/
├── analyzer/       # LLM analysis (prompts.ts, schema-converter.ts)
├── cli/output/     # CLI rendering components (spinner, ratings, evidence)
├── config/         # ConfigManager for ~/.nomoreaislop/config.json
├── models/         # Zod schemas (evaluation, session, config, storage, telemetry)
├── parser/         # JSONL session parsing
└── utils/          # Reporter, storage, helpers
```

## Data Models

All schemas are defined with Zod in `src/models/`:
- **Evaluation** - Analysis output with ratings (Strong/Developing/Needs Work), clues, and recommendations
- **ParsedSession** - Normalized session data with messages and stats
- **StoredAnalysis** - Persisted analysis with evaluation + metadata

## Plugin Commands

Commands are defined in `commands/*.md` with YAML frontmatter:
- `/noslop` - Analyze current session
- `/noslop:analyze <id>` - Analyze specific session
- `/noslop:sessions` - List available sessions
- `/noslop:history` - View past analyses
- `/noslop:config` - Manage settings

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for analysis |
| `NOSLOP_MODEL` | Override default model (default: claude-sonnet-4-20250514) |
| `NOSLOP_TELEMETRY` | Enable/disable telemetry |
