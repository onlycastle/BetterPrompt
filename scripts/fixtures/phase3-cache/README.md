# Phase 3 Cache

This directory contains cached output from Phase 3 (ContentWriter) of the analysis pipeline.

## Purpose

Phase 3 cache enables fast testing of:
- **Phase 4 (Translator)**: Skip Phase 1-3 and test translation directly
- **Evaluation Assembly**: Test deterministic assembly with cached narrative content
- **Translation Overlay**: Test `mergeTranslatedFields()` with pre-computed data

## Cache Structure

```json
{
  "metadata": {
    "generatedAt": "2026-02-03T12:00:00.000Z",
    "generatorVersion": "1.0.0",
    "phase2CacheSource": "path/to/phase2-cache.json",
    "stats": {
      "totalUtterances": 242,
      "phase3ExecutionMs": 5000,
      "tokenUsage": {
        "promptTokens": 15000,
        "completionTokens": 3000,
        "totalTokens": 18000,
        "cachedTokens": 5000
      }
    }
  },
  "phase1Output": { /* Phase1Output */ },
  "agentOutputs": { /* AgentOutputs */ },
  "narrativeResponse": {
    "personalitySummary": "...",
    "promptPatterns": [...],
    "topFocusAreas": { ... }
  }
}
```

## Contents

- `phase3-cache.json` - Cached Phase 3 output (generated locally, intentionally gitignored)

## Generation

Generate the cache using:

```bash
# Default: uses Phase 2 cache
npx tsx scripts/generate-phase3-cache.ts

# Force regenerate
npx tsx scripts/generate-phase3-cache.ts --force

# Fresh: run Phase 1+2 first (slower)
npx tsx scripts/generate-phase3-cache.ts --fresh
```

## Usage

Use the cache in test scripts:

```bash
# Test Evaluation Assembly with Phase 3 cache
npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache

# Test with Korean translation
npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache --lang=ko

# Skip translation (English only)
npx tsx scripts/test-evaluation-assembly.ts --use-phase3-cache --skip-translation
```

## Pipeline Stages

```
Phase 1: DataExtractor (deterministic)
    ↓
Phase 2: ThinkingQuality, LearningBehavior, ContextEfficiency (3 LLM calls)
    ↓
Phase 2.5: TypeClassifier (1 LLM call)
    ↓
Phase 3: ContentWriter (1 LLM call) ← THIS CACHE
    ↓ NarrativeLLMResponse
Phase 4: Translator (0-1 LLM call, conditional)
    ↓
Evaluation Assembly + Translation Overlay
    ↓
VerboseEvaluation (final)
```

## Cache Invalidation

Regenerate the cache when:
- ContentWriter prompts change
- NarrativeLLMResponse schema changes
- Phase 2 worker outputs change
- New version of Phase 2 cache is generated

The `generatorVersion` field tracks schema changes for invalidation.

## Security

- Never commit generated cache JSON from real sessions.
- Never store API keys or workstation-specific absolute paths in cache artifacts.
