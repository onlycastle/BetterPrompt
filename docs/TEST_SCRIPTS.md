# Pipeline Test Scripts

> Local testing tools for the 4-Phase Orchestrator Pipeline

This document describes the local test scripts for debugging and developing the analysis pipeline workers.

## Overview

```
scripts/
├── test-phase1.ts              # Phase 1 (DataExtractor) testing
├── test-phase2.ts              # Phase 2 (Insight Workers) testing
├── generate-phase1-cache.ts    # Cache generator for faster Phase 2 testing
└── fixtures/
    └── phase1-cache/
        ├── phase1-cache.json   # Cached Phase 1 output (gitignored)
        └── README.md           # Cache usage documentation
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
npx tsx scripts/test-phase2.ts --worker=TrustVerification
npx tsx scripts/test-phase2.ts --worker=WorkflowHabit
npx tsx scripts/test-phase2.ts --worker=KnowledgeGap
npx tsx scripts/test-phase2.ts --worker=ContextEfficiency
npx tsx scripts/test-phase2.ts --worker=CommunicationPatterns
npx tsx scripts/test-phase2.ts --worker=TypeClassifier

# Use cached Phase 1 output (FAST - recommended for iterative testing)
npx tsx scripts/test-phase2.ts --use-cache
npx tsx scripts/test-phase2.ts --use-cache --worker=TrustVerification
```

### Available Workers

| Worker | Description | Phase |
|--------|-------------|-------|
| TrustVerification | Trust patterns, anti-patterns, verification behavior | 2 |
| WorkflowHabit | Planning habits, critical thinking, multitasking | 2 |
| KnowledgeGap | Knowledge gaps, learning progress, resources | 2 |
| ContextEfficiency | Context usage, inefficiency patterns, productivity | 2 |
| CommunicationPatterns | Communication styles, effectiveness | 2 |
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

## generate-phase1-cache.ts

Generates cached Phase 1 output for faster `test-phase2.ts` execution.

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

## Common Workflows

### Workflow 1: Developing a Phase 2 Worker

```bash
# 1. Generate cache once
npx tsx scripts/generate-phase1-cache.ts

# 2. Iterate on worker development
npx tsx scripts/test-phase2.ts --use-cache --worker=TrustVerification
# Make changes...
npx tsx scripts/test-phase2.ts --use-cache --worker=TrustVerification
# Repeat...
```

### Workflow 2: Testing Phase 1 Changes

```bash
# Test with specific sessions
npx tsx scripts/test-phase1.ts -n=10

# After confirming changes, regenerate cache
npx tsx scripts/generate-phase1-cache.ts --force
```

### Workflow 3: Full Pipeline Test

```bash
# Fresh run (no cache)
npx tsx scripts/test-phase2.ts /path/to/session.jsonl

# Or run all workers with cache
npx tsx scripts/test-phase2.ts --use-cache
```

### Workflow 4: Debugging Specific Session

```bash
# Test specific session file
npx tsx scripts/test-phase1.ts /path/to/problematic-session.jsonl
npx tsx scripts/test-phase2.ts /path/to/problematic-session.jsonl --worker=TrustVerification
```

## Troubleshooting

### "GOOGLE_GEMINI_API_KEY is required"

```bash
# Check environment variable
echo $GOOGLE_GEMINI_API_KEY

# Or add to .env
echo "GOOGLE_GEMINI_API_KEY=your_key" >> .env
```

### "Cache file not found"

```bash
# Generate the cache first
npx tsx scripts/generate-phase1-cache.ts
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
