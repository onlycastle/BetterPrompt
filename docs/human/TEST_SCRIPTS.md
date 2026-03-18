# Testing

> Testing tools for the BetterPrompt analysis pipeline

## Overview

Analysis pipeline testing has moved from manual CLI test scripts to automated unit tests via **vitest**.

## Running Tests

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## Test Structure

```
tests/
  unit/              # Unit tests (models, parser, plugin parity, search agent)
  e2e/               # Playwright browser tests (report rendering, scroll nav)
  integration.test.ts # Session parsing integration test
  fixtures/          # Real session logs and evaluation data
  utils/             # Test factories and helpers
```

## Plugin Testing

The analysis pipeline runs inside the Claude Code plugin (`packages/plugin/`). Plugin-specific tests live alongside the plugin source:

```bash
cd packages/plugin
npm test
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [LLM_FLOW.md](./LLM_FLOW.md) - LLM integration details
- [Agent Testing Guide](../agent/TESTING.md) - Agent-facing test reference
