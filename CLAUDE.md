# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Vision & Strategy

> **Core**: A B2B service that assesses and educates developers' AI utilization capabilities
>
> **Strategy**: B2C (viral personality test) → B2B (enterprise capability assessment/training)

### Business Objective

Continuously assess developers' AI utilization capabilities and provide appropriate educational materials, ultimately monetizing as a **B2B enterprise employee capability assessment and education service**.

### GTM Strategy

1. **Phase 1 - B2C**: Attract individual developers with "What's Your AI Coding Style?" viral personality test
2. **Phase 2 - B2B**: Transition to enterprise services using accumulated assessment data and criteria

### Search Agent Role

The Search Agent is core infrastructure for improving the product's **assessment quality**:

1. **Establishing Assessment Criteria**: Continuously update the definition of "a developer who uses AI well" according to industry trends
2. **Educational Content Sourcing**: Collect and recommend learning materials suitable for developer improvement areas

---

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

### Core Pipeline (Default: LLM-powered Verbose Analysis)

```
Session JSONL → SessionParser → SessionSelector → CostEstimator → VerboseAnalyzer → React SPA (web-ui/)
```

1. **SessionParser** (`src/parser/`) - Reads JSONL files from `~/.claude/projects/{encoded-path}/{session-id}.jsonl`
2. **SessionSelector** (`src/parser/session-selector.ts`) - Selects optimal sessions (5-min minimum, max 10)
3. **CostEstimator** (`src/analyzer/cost-estimator.ts`) - Token counting and API cost calculation
4. **VerboseAnalyzer** (`src/analyzer/verbose-analyzer.ts`) - LLM-powered hyper-personalized multi-session analysis
5. **React SPA** (`web-ui/`) - Unified web dashboard with terminal-style analysis report

### Key Implementation Details

**Structured Outputs**: The analyzer uses Anthropic's beta feature (`anthropic-beta: structured-outputs-2025-11-13`) with forced tool use to guarantee valid JSON. Zod schemas in `src/models/` are converted to JSON Schema via `src/analyzer/schema-converter.ts`.

**JSONL Parsing**: Session logs contain multiple message types (`user`, `assistant`, `queue-operation`, `file-history-snapshot`). Only `user` and `assistant` types are relevant for analysis. Content blocks can be `text`, `tool_use`, or `tool_result`.

**Path Encoding**: Claude Code encodes project paths by replacing `/` with `-`. The parser handles this via `encodeProjectPath`/`decodeProjectPath` in `src/parser/jsonl-reader.ts`.

### Directory Structure

```
commands/           # Claude Code plugin commands (*.md with YAML frontmatter)
src/
├── analyzer/       # LLM analysis (verbose-analyzer.ts, unified-analyzer.ts)
├── api/            # REST API server (Express, port 3001)
├── cli/output/     # CLI rendering components (spinner, verbose-report, type-result)
├── config/         # ConfigManager for ~/.nomoreaislop/config.json
├── models/         # Zod schemas (verbose-evaluation, unified-report, session, config)
├── parser/         # JSONL session parsing
└── utils/          # Reporter, storage, helpers

web-ui/             # React SPA (Vite, port 5173 dev)
├── src/pages/      # Route pages (AnalysisReport, Dashboard, Browse, Learn)
├── src/components/ # React components (report/, verbose/, enterprise/, ui/)
└── src/hooks/      # Custom hooks (useScrollNavigation, useAnalysisReport)
```

## Data Models

All schemas are defined with Zod in `src/models/`:
- **VerboseEvaluation** - Hyper-personalized analysis with personality summary, strengths, growth areas, prompt patterns
- **UnifiedReport** - Complete assessment with 6 dimensions, insights, and recommendations
- **ParsedSession** - Normalized session data with messages and stats
- **StoredAnalysis** - Persisted analysis with evaluation + metadata (legacy compatibility)

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
