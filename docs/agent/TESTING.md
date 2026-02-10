# Testing (Agent Reference)

Local test scripts for the multi-phase orchestrator pipeline. All scripts are in `scripts/`.

## Test Scripts

| File | Purpose |
|------|---------|
| `scripts/test-phase1.ts` | Phase 1 (DataExtractor) testing |
| `scripts/test-phase2.ts` | Phase 2 (Insight Workers) testing |
| `scripts/test-phase3.ts` | Phase 3 (ContentWriter) testing |
| `scripts/test-phase4.ts` | Phase 4 (Translator) testing |
| `scripts/test-cursor-scanner.ts` | Cursor Source (legacy .cursor/chats/) testing |
| `scripts/test-cursor-composer.ts` | Cursor Composer Source (state.vscdb) testing |
| `scripts/generate-phase1-cache.ts` | Phase 1 cache generator |
| `scripts/generate-phase2-cache.ts` | Phase 2 cache generator |
| `scripts/generate-phase3-cache.ts` | Phase 3 cache generator |
| `scripts/test-evaluation-assembly.ts` | Evaluation assembly testing |
| `scripts/utils/test-utils.ts` | Shared utilities |
| `scripts/fixtures/phase1-cache/phase1-cache.json` | Cached Phase 1 output (gitignored) |
| `scripts/fixtures/phase2-cache/phase2-cache.json` | Cached Phase 2 output (gitignored) |
| `scripts/fixtures/phase3-cache/phase3-cache.json` | Cached Phase 3 output (gitignored) |

## Prerequisites

```bash
GOOGLE_GEMINI_API_KEY=your_api_key   # Required for LLM phases
cp .env.example .env                  # Ensure .env is configured
```

## Script Usage

### test-phase1.ts (DataExtractor)

```bash
npx tsx scripts/test-phase1.ts                           # Default: hardcoded JSONL file
npx tsx scripts/test-phase1.ts /path/to/session.jsonl    # Specific file
npx tsx scripts/test-phase1.ts -n=10                     # Latest N sessions from ~/.claude/projects
npx tsx scripts/test-phase1.ts --utterances-only         # Skip AI responses output
npx tsx scripts/test-phase1.ts -n=30 --utterances-only   # Combined
```

### test-phase2.ts (Insight Workers)

```bash
npx tsx scripts/test-phase2.ts                                    # Default JSONL (runs Phase 1 first)
npx tsx scripts/test-phase2.ts --use-cache                        # Use Phase 1 cache (fast)
npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality  # Specific worker + cache
npx tsx scripts/test-phase2.ts --worker=LearningBehavior          # Specific worker only
npx tsx scripts/test-phase2.ts --worker=ContextEfficiency
npx tsx scripts/test-phase2.ts --worker=TypeClassifier
```

| Worker Option | Phase | Description |
|---------------|-------|-------------|
| `ThinkingQuality` | 2 | Critical thinking, verification, trust patterns |
| `CommunicationPatterns` | 2 | Communication patterns, signature quotes |
| `LearningBehavior` | 2 | Learning progress, knowledge gaps |
| `ContextEfficiency` | 2 | Context usage, inefficiency patterns |
| `SessionOutcome` | 2 | Goals, friction, success rates |
| `TypeClassifier` | 2.5 | Developer type classification (5x3) |

### test-phase3.ts (ContentWriter)

```bash
npx tsx scripts/test-phase3.ts                       # Full pipeline (Phase 1 -> 2 -> 3)
npx tsx scripts/test-phase3.ts --use-cache           # Phase 1 cache, run Phase 2 -> 3
npx tsx scripts/test-phase3.ts --use-phase2-cache    # Phase 2 cache only (fastest)
npx tsx scripts/test-phase3.ts /path/to/session.jsonl
```

### test-phase4.ts (Translator)

```bash
npx tsx scripts/test-phase4.ts                                # Auto-detect language
npx tsx scripts/test-phase4.ts --lang=ko                      # Force Korean
npx tsx scripts/test-phase4.ts --lang=ja                      # Force Japanese
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko   # Fastest + Korean
```

| Language Option | Description |
|-----------------|-------------|
| `--lang=en` | Force English (skips Phase 4) |
| `--lang=ko` | Force Korean |
| `--lang=ja` | Force Japanese |
| `--lang=zh` | Force Chinese |
| (none) | Auto-detect from utterances |

### Cache Generators

```bash
npx tsx scripts/generate-phase1-cache.ts                     # Generate Phase 1 cache
npx tsx scripts/generate-phase1-cache.ts --max-sessions=20   # Custom session count
npx tsx scripts/generate-phase1-cache.ts --force             # Overwrite existing
npx tsx scripts/generate-phase2-cache.ts                     # Generate Phase 2 cache (requires Phase 1)
npx tsx scripts/generate-phase2-cache.ts --force             # Overwrite existing
npx tsx scripts/generate-phase3-cache.ts                     # Generate Phase 3 cache (requires Phase 2)
npx tsx scripts/generate-phase3-cache.ts --force             # Overwrite existing
```

### Scanner Test Scripts

```bash
# Cursor Composer (state.vscdb)
npx tsx scripts/test-cursor-composer.ts                                   # List top 10 sessions
npx tsx scripts/test-cursor-composer.ts -n=5                              # Top N sessions
npx tsx scripts/test-cursor-composer.ts --composer=<session-id>           # Specific session
npx tsx scripts/test-cursor-composer.ts --debug                           # Raw bubble data

# Cursor Legacy (.cursor/chats/)
npx tsx scripts/test-cursor-scanner.ts                      # Latest 3 sessions
npx tsx scripts/test-cursor-scanner.ts -n=5                 # Latest N sessions
npx tsx scripts/test-cursor-scanner.ts --compare            # Compare with Claude Code format
npx tsx scripts/test-cursor-scanner.ts --debug              # Blob parsing debug
npx tsx scripts/test-cursor-scanner.ts /path/to/store.db    # Specific DB file
```

## Cache Usage Summary

| Script | `--use-cache` | `--use-phase2-cache` |
|--------|---------------|----------------------|
| test-phase2.ts | Load Phase 1 cache | N/A |
| test-phase3.ts | Load Phase 1 cache, run Phase 2 | Load Phase 2 cache (fastest) |
| test-phase4.ts | Load Phase 1 cache, run Phase 2 | Load Phase 2 cache (fastest) |

Cache files are gitignored (contain user-specific data). Regenerate when schemas or worker logic change.

## Common Workflows

### Developing a Phase 2 Worker

```bash
npx tsx scripts/generate-phase1-cache.ts                                   # Once
npx tsx scripts/test-phase2.ts --use-cache --worker=ThinkingQuality        # Iterate
```

### Developing Phase 3 (ContentWriter)

```bash
npx tsx scripts/generate-phase1-cache.ts && npx tsx scripts/generate-phase2-cache.ts   # Once
npx tsx scripts/test-phase3.ts --use-phase2-cache                                       # Iterate
```

### Developing Phase 4 (Translator)

```bash
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko   # Iterate with Korean
```

### Full Pipeline Test

```bash
npx tsx scripts/test-phase4.ts --use-phase2-cache --lang=ko   # With caches (fast)
npx tsx scripts/test-phase4.ts /path/to/session.jsonl --lang=ko  # Fresh (slow)
```

### Debugging Specific Session

```bash
npx tsx scripts/test-phase1.ts /path/to/session.jsonl
npx tsx scripts/test-phase2.ts /path/to/session.jsonl --worker=ThinkingQuality
npx tsx scripts/test-phase3.ts /path/to/session.jsonl
npx tsx scripts/test-phase4.ts /path/to/session.jsonl --lang=ko
```

## Unit Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode (re-run on changes)
npm run test:coverage       # Run with coverage report
npm run test:integration    # Run integration tests only
npm run typecheck           # Type check without emitting
```

Test directories:

| Directory | Coverage |
|-----------|----------|
| `tests/unit/analyzer/workers/` | Phase 1-2 worker tests |
| `tests/unit/analyzer/stages/` | Phase 1.5-4 stage tests (session-summarizer, content-writer, translator, evaluation-assembler, evidence-verifier, knowledge-resource-matcher, phase3-summarizer) |
| `tests/unit/analyzer/orchestrator/` | Orchestrator + types tests |
| `tests/unit/analyzer/dimensions/` | Dimension calculation tests |
| `tests/unit/models/` | Zod schema validation tests (verbose-evaluation, agent-outputs, worker-insights, schema-nesting-depth) |
| `tests/unit/parser/` | JSONL reader tests |
| `tests/unit/cli/` | CLI-specific tests (segment-detector, session-scoring, project-name-resolver) |
| `tests/unit/desktop/` | Desktop app tests (scanner, session-formatter) |
| `tests/unit/config/` | Config manager tests |
| `tests/unit/search-agent/` | Search agent tests (knowledge, relevance, judge criteria) |
| `tests/unit/utils/` | Utility tests (insight-deduplication) |
| `tests/unit/lib/` | Library tests (result) |
