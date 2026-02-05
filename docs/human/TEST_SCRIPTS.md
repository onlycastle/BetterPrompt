# Pipeline Test Scripts

> Local testing tools for the 4-Phase Orchestrator Pipeline

This document describes the local test scripts for debugging and developing the analysis pipeline workers.

## Overview

```
scripts/
├── test-phase1.ts              # Phase 1 (DataExtractor) testing
├── test-phase2.ts              # Phase 2 (Insight Workers) testing
├── test-phase3.ts              # Phase 3 (ContentWriter) testing
├── test-phase4.ts              # Phase 4 (Translator) testing
├── test-cursor-scanner.ts      # Cursor Source (legacy .cursor/chats/) testing
├── test-cursor-composer.ts     # Cursor Composer Source (state.vscdb) testing
├── generate-phase1-cache.ts    # Phase 1 cache generator
├── generate-phase2-cache.ts    # Phase 2 cache generator
├── utils/
│   └── test-utils.ts           # Shared utilities (cache loaders, helpers)
└── fixtures/
    ├── phase1-cache/
    │   ├── phase1-cache.json   # Cached Phase 1 output (gitignored)
    │   └── README.md           # Cache usage documentation
    └── phase2-cache/
        └── phase2-cache.json   # Cached Phase 2 output (gitignored)
```

## Prerequisites

```bash
# Required environment variable
GOOGLE_GEMINI_API_KEY=your_api_key_here

# Ensure .env is configured
cp .env.example .env
```

## test-phase1.ts

Tests the **DataExtractorWorker** (Phase 1) which extracts developer utterances and AI responses from session files.

### Usage

```bash
# Default: single hardcoded JSONL file
npx tsx scripts/test-phase1.ts

# Specify a custom JSONL file
npx tsx scripts/test-phase1.ts /path/to/session.jsonl

# Multiple files
npx tsx scripts/test-phase1.ts /path/to/session1.jsonl /path/to/session2.jsonl

# Latest N sessions from ~/.claude/projects
npx tsx scripts/test-phase1.ts -n=10
npx tsx scripts/test-phase1.ts -n=30

# Utterances only (skip AI responses output)
npx tsx scripts/test-phase1.ts --utterances-only
npx tsx scripts/test-phase1.ts -n=30 --utterances-only
```

### Output

- Developer utterances with structural metadata (character count, word count, code blocks, questions)
- AI responses with response type and tool usage
- Session metrics (total messages, date range, tool usage counts)
- Token usage statistics

### Example Output

```
================================================================================
Phase 1 Test - DataExtractor
================================================================================
Sessions: 30 file(s)
  - session1.jsonl
  - session2.jsonl
  ...

Parsing JSONL files...
Parsed: 30 sessions, 5800 messages

Executing DataExtractorWorker...
Execution time: 15234ms

Developer Utterances (131 extracted):
#  1 | chars:    45 | words:   8 | code: ✗ | question: ✗
      | displayText: "이건 잘 되었어"

AI Responses (350 extracted):
#  1 | type: code_generation | tools:  3 | error: ✗ | success: ✓
      | tools: [Read, Edit, Bash]
```

## test-phase2.ts

Tests the **Phase 2 Workers** (Insight Workers + TypeClassifier) using either a single JSONL file or cached Phase 1 output.

### Usage

```bash
# Default: single hardcoded JSONL file (runs Phase 1 first)
npx tsx scripts/test-phase2.ts

# Specify a custom JSONL file
npx tsx scripts/test-phase2.ts /path/to/session.jsonl

# Test specific worker only
npx tsx scripts/test-phase2.ts --worker=ThinkingQuality
npx tsx scripts/test-phase2.ts --worker=LearningBehavior
npx tsx scripts/test-phase2.ts --worker=ContextEfficiency
npx tsx scripts/test-phase2.ts --worker=TypeClassifier

# Use cached Phase 1 output (FAST - recommended for iterative testing)
npx tsx scripts/test-phase2.ts --use-cache
npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality
```

### Available Workers

| Worker | Description | Phase |
|--------|-------------|-------|
| ThinkingQuality | Critical thinking, verification behavior, trust patterns | 2 |
| LearningBehavior | Learning progress, knowledge gaps, skill development | 2 |
| ContextEfficiency | Context usage, inefficiency patterns, productivity | 2 |
| TypeClassifier | Developer type classification (5x3 matrix) | 2.5 |

### Cache Mode vs Fresh Mode

| Mode | Command | Phase 1 Time | Use Case |
|------|---------|--------------|----------|
| Fresh | `npx tsx scripts/test-phase2.ts` | 5-15 sec | Single file analysis |
| Cache | `npx tsx scripts/test-phase2.ts --use-cache` | ~1 ms | Iterative worker development |

### Example Output

```
================================================================================
Phase 2 Test - Insight Workers
================================================================================
Mode: CACHE (using cached Phase 1 output)
Selected Worker: TrustVerification

Step 1: Loading cached Phase 1 output...
Cache loaded in 1ms
Generated at: 2026-02-01T16:13:57.563Z
Sessions: 30
Total messages: 5800
Utterances: 131
AI responses: 350

Step 3: Running Phase 2 Workers...
--------------------------------------------------------------------------------

[1/5] TrustVerification Worker...

────────────────────────────────────────────────────────────
TrustVerification Worker Output
────────────────────────────────────────────────────────────
Trust Health Score: 62/100
Confidence: 95.0%

Verification Level: occasional_review
...

================================================================================
Phase 2 Summary
================================================================================

Execution Times:
  Phase 1 (DataExtractor): 1ms
  TrustVerification: 31350ms
  TOTAL: 31351ms

Token Usage:
  Phase 1: 240328 tokens (121043 prompt, 14465 completion)
  TrustVerification: 98595 tokens (94145 prompt, 1789 completion)
  TOTAL: 339923 tokens
```

## test-phase3.ts

Tests the **ContentWriterStage** (Phase 3) which generates personalized narrative content from Phase 2 worker outputs.

### Usage

```bash
# Full pipeline (Phase 1 → 2 → 3) - slowest
npx tsx scripts/test-phase3.ts

# Use Phase 1 cache, run Phase 2 → 3
npx tsx scripts/test-phase3.ts --use-cache

# Use Phase 2 cache (fastest) - recommended for iterative testing
npx tsx scripts/test-phase3.ts --use-phase2-cache

# Specify a custom JSONL file
npx tsx scripts/test-phase3.ts /path/to/session.jsonl
```

### Cache Options

| Option | Description | Speed |
|--------|-------------|-------|
| `--use-phase2-cache` | Load Phase 2 cache directly (skip Phase 1 & 2) | ⚡ Fastest |
| `--use-cache` | Load Phase 1 cache, run Phase 2 | 🏃 Medium |
| (none) | Fresh run: Parse JSONL → Phase 1 → Phase 2 → Phase 3 | 🐢 Slowest |

### Output

- Personality summary (personalized narrative text)
- Top focus areas with priority scores and actionable recommendations
- Prompt patterns analysis (optional fallback)
- Token usage and cost estimation

---

## test-phase4.ts

Tests the **TranslatorStage** (Phase 4) which translates English ContentWriter output into the target language.

### Usage

```bash
# Full pipeline with auto-detected language
npx tsx scripts/test-phase4.ts

# Force Korean translation
npx tsx scripts/test-phase4.ts --lang=ko

# Force Japanese translation
npx tsx scripts/test-phase4.ts --lang=ja

# Use Phase 2 cache with forced language
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko
```

### Cache Options

Same as `test-phase3.ts`:

| Option | Description |
|--------|-------------|
| `--use-phase2-cache` | Load Phase 2 cache directly (fastest) |
| `--use-cache` | Load Phase 1 cache, run Phase 2 |
| (none) | Fresh run (Phase 1 → 2 → 3 → 4) |

### Language Options

| Option | Description |
|--------|-------------|
| `--lang=en` | Force English (skips Phase 4) |
| `--lang=ko` | Force Korean translation |
| `--lang=ja` | Force Japanese translation |
| `--lang=zh` | Force Chinese translation |
| (none) | Auto-detect from developer utterances |

### Output

- Side-by-side comparison of English and translated content
- Translation quality metrics
- Token usage and cost estimation

> **Note**: If the target language is English (auto-detected or forced), Phase 4 is skipped entirely.

---

## generate-phase1-cache.ts

Generates cached Phase 1 output for faster testing of Phase 2, 3, and 4.

### Usage

```bash
# Generate cache (30 sessions by default)
npx tsx scripts/generate-phase1-cache.ts

# Specify number of sessions
npx tsx scripts/generate-phase1-cache.ts --max-sessions=20

# Overwrite existing cache
npx tsx scripts/generate-phase1-cache.ts --force
```

### Cache Location

```
scripts/fixtures/phase1-cache/phase1-cache.json
```

This file is **gitignored** because it contains user-specific session data.

### When to Regenerate

1. **Phase1Output schema changes** - Cached data won't match expected schema
2. **DataExtractorWorker logic changes** - Extraction logic updated
3. **Different sessions needed** - Claude projects changed significantly

### Performance Impact

| Without Cache | With Cache |
|---------------|------------|
| Phase 1: ~13 min | Phase 1: ~1 ms |
| 240K tokens consumed | 0 tokens (cached) |

---

## generate-phase2-cache.ts

Generates cached Phase 2 output (all Insight Workers + TypeClassifier) for faster testing of Phase 3 and 4.

### Prerequisites

Phase 1 cache must exist. If not, generate it first:

```bash
npx tsx scripts/generate-phase1-cache.ts
```

### Usage

```bash
# Generate Phase 2 cache
npx tsx scripts/generate-phase2-cache.ts

# Overwrite existing cache
npx tsx scripts/generate-phase2-cache.ts --force
```

### Cache Location

```
scripts/fixtures/phase2-cache/phase2-cache.json
```

This file is **gitignored** because it contains user-specific analysis data.

### What's Included

The Phase 2 cache contains:
- Phase 1 output (from Phase 1 cache)
- ThinkingQuality worker output
- LearningBehavior worker output
- ContextEfficiency worker output
- TypeClassifier output (Phase 2.5)

### When to Regenerate

1. **Phase 2 worker logic/prompts change** - Worker outputs need refresh
2. **Phase1Output schema changes** - Regenerate Phase 1 first, then Phase 2
3. **AgentOutputs schema changes** - Cached data won't match expected schema

---

## Cache Architecture

The caching system is hierarchical, allowing you to skip expensive LLM calls:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Flow                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  JSONL Files ──→ Phase 1 ──→ Phase 1 Cache                          │
│                     │             │                                  │
│                     ↓             ↓                                  │
│               Phase 2 Workers ←───┘                                  │
│                     │                                                │
│                     ↓                                                │
│               Phase 2 Cache ────────────────────────────────┐       │
│                     │                                        │       │
│                     ↓                                        ↓       │
│  test-phase2.ts ←───┴──→ test-phase3.ts ──→ test-phase4.ts         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

Cache Dependency:
  Phase 1 Cache ← generate-phase1-cache.ts
       ↓
  Phase 2 Cache ← generate-phase2-cache.ts (requires Phase 1 Cache)
```

### Cache Usage Summary

| Script | `--use-cache` | `--use-phase2-cache` |
|--------|---------------|----------------------|
| test-phase2.ts | ✅ Load Phase 1 cache | ❌ N/A |
| test-phase3.ts | ✅ Load Phase 1 cache, run Phase 2 | ✅ Load Phase 2 cache |
| test-phase4.ts | ✅ Load Phase 1 cache, run Phase 2 | ✅ Load Phase 2 cache |

---

## Common Workflows

### Workflow 1: Developing a Phase 2 Worker

```bash
# 1. Generate cache once
npx tsx scripts/generate-phase1-cache.ts

# 2. Iterate on worker development
npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality
# Make changes...
npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality
# Repeat...
```

### Workflow 2: Developing Phase 3 (ContentWriter)

```bash
# 1. Generate both caches
npx tsx scripts/generate-phase1-cache.ts
npx tsx scripts/generate-phase2-cache.ts

# 2. Iterate on ContentWriter development (fastest)
npx tsx scripts/test-phase3.ts --use-phase2-cache
# Make changes...
npx tsx scripts/test-phase3.ts --use-phase2-cache
# Repeat...
```

### Workflow 3: Developing Phase 4 (Translator)

```bash
# 1. Ensure Phase 2 cache exists
npx tsx scripts/generate-phase2-cache.ts

# 2. Iterate on Translator with forced language
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko
# Make changes...
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ja
# Test different languages...
```

### Workflow 4: Testing Phase 1 Changes

```bash
# Test with specific sessions
npx tsx scripts/test-phase1.ts -n=10

# After confirming changes, regenerate ALL caches
npx tsx scripts/generate-phase1-cache.ts --force
npx tsx scripts/generate-phase2-cache.ts --force
```

### Workflow 5: Full Pipeline Test (with caches)

```bash
# Most efficient full pipeline test
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko

# Or without translation (English)
npx tsx scripts/test-phase3.ts --use-phase2-cache
```

### Workflow 6: Full Pipeline Test (fresh)

```bash
# Fresh run without any cache (slowest, uses real data)
npx tsx scripts/test-phase4.ts /path/to/session.jsonl --lang=ko
```

### Workflow 7: Debugging Specific Session

```bash
# Test specific session file through each phase
npx tsx scripts/test-phase1.ts /path/to/problematic-session.jsonl
npx tsx scripts/test-phase2.ts /path/to/problematic-session.jsonl --worker=ThinkingQuality
npx tsx scripts/test-phase3.ts /path/to/problematic-session.jsonl
npx tsx scripts/test-phase4.ts /path/to/problematic-session.jsonl --lang=ko
```

## Scanner Test Scripts

These scripts test the multi-source session scanner, which discovers sessions from AI coding assistants beyond Claude Code.

### test-cursor-composer.ts

Tests the **CursorComposerSource** which reads Cursor Composer sessions from `globalStorage/state.vscdb` (SQLite key-value store).

#### Usage

```bash
# List all composer sessions (default: top 10)
npx tsx scripts/test-cursor-composer.ts

# Show top N sessions
npx tsx scripts/test-cursor-composer.ts -n=5

# Parse a specific composer session
npx tsx scripts/test-cursor-composer.ts --composer=7985e2a5-fd77-47a0-a4b9-1b50c0ba8392

# Show raw bubble data for debugging
npx tsx scripts/test-cursor-composer.ts --debug

# Show help
npx tsx scripts/test-cursor-composer.ts --help
```

#### CLI Options

| Option | Description |
|--------|-------------|
| `-n=<count>` | Show top N sessions (default: 10) |
| `--composer=<id>` | Parse and display a specific composer session by ID |
| `--debug` | Show raw bubble data from state.vscdb for debugging |
| `--help` | Show help message |

#### What It Validates

- **Schema validation** (82+ checks): sessionId, source type, timestamps, message format, tool calls
- **Bubble parsing**: Converts `bubbleId:` KV entries into `ParsedMessage[]`
- **Tool ID resolution**: Maps Cursor Composer numeric tool IDs to normalized tool names via `CURSOR_COMPOSER_TOOL_IDS`

#### Requirements

- Cursor IDE installed with Composer session data
- `better-sqlite3` package installed (`npm install better-sqlite3`)

### test-cursor-scanner.ts

Tests the **CursorSource** which reads legacy Cursor chat sessions from `~/.cursor/chats/**/*.db` (SQLite blob storage).

#### Usage

```bash
# Scan latest 3 sessions (default)
npx tsx scripts/test-cursor-scanner.ts

# Scan latest N sessions
npx tsx scripts/test-cursor-scanner.ts -n=5

# Compare output format with Claude Code
npx tsx scripts/test-cursor-scanner.ts --compare

# Show blob parsing debug info
npx tsx scripts/test-cursor-scanner.ts --debug

# Test specific store.db file
npx tsx scripts/test-cursor-scanner.ts /path/to/store.db
```

---

## Troubleshooting

### "GOOGLE_GEMINI_API_KEY is required"

```bash
# Check environment variable
echo $GOOGLE_GEMINI_API_KEY

# Or add to .env
echo "GOOGLE_GEMINI_API_KEY=your_key" >> .env
```

### "Phase 1 cache file not found"

```bash
# Generate the Phase 1 cache first
npx tsx scripts/generate-phase1-cache.ts
```

### "Phase 2 cache file not found"

```bash
# Generate Phase 1 cache first (if not exists)
npx tsx scripts/generate-phase1-cache.ts

# Then generate Phase 2 cache
npx tsx scripts/generate-phase2-cache.ts
```

### "No sessions found"

Ensure Claude projects exist:

```bash
ls ~/.claude/projects/
```

### Worker Timeout

Large datasets may cause timeouts. Try with fewer sessions:

```bash
npx tsx scripts/generate-phase1-cache.ts --max-sessions=10 --force
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and pipeline overview
- [LLM_FLOW.md](./LLM_FLOW.md) - LLM integration details
- [TESTING.md](./TESTING.md) - E2E dashboard testing
