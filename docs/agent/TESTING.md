# Testing (Agent Reference)

## Commands

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode (re-run on changes)
npm run test:coverage       # Run with coverage report
npm run test:integration    # Run integration tests only
npm run typecheck           # Type check without emitting
```

## Test Directories

| Directory | Coverage |
|-----------|----------|
| `tests/unit/models/` | Zod schema validation tests (verbose-evaluation, agent-outputs, worker-insights, schema-nesting-depth) |
| `tests/unit/parser/` | JSONL reader tests |
| `tests/unit/search-agent/` | Search agent tests (knowledge, relevance, judge criteria) |
| `tests/unit/utils/` | Utility tests (insight-deduplication) |
| `tests/unit/lib/` | Library tests (result) |

## Plugin Tests

The plugin has its own test suite in `packages/plugin/`:

```bash
cd packages/plugin && npm test
```

See `packages/plugin/README.md` for plugin-specific test workflows.
