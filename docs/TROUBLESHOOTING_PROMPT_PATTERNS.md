# Troubleshooting: Communication Patterns

## Problem Summary

Communication Patterns section displays incorrect content (AI responses, system messages, empty examples) instead of unique developer utterances.

---

## Architecture Quick Reference

```
JSONL → Phase 1 (DataExtractor) → Phase 2 (Workers) → Phase 3 (ContentWriter) → UI
              ↓                          ↓                    ↓
        developerUtterances        agentOutputs         promptPatterns
        (id, text, displayText)    (Your Insights)      (Comm. Patterns)
```

### Key Files

| File | Role |
|------|------|
| `data-extractor-worker.ts` | Phase 1 - Utterance extraction + filtering |
| `content-writer.ts` | Phase 3 - topUtterances selection |
| `content-writer-prompts.ts` | Phase 3 - LLM prompt for examplesData |
| `evaluation-assembler.ts` | sanitizePromptPatterns + utteranceLookup |

### Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., "7fdbb780_5")
- **examplesData**: `"utteranceId|analysis;utteranceId|analysis;..."`
- **displayText**: LLM-sanitized text for UI display
- **text**: Original raw text (may contain errors, stack traces)

---

## Change Log

| Date | Issue | Solution | Files Modified |
|------|-------|----------|----------------|
| 2026-01-31 | Empty Communication Patterns examples | LLM prompt table format + explicit examplesData rules | `content-writer-prompts.ts` |
| 2026-01-31 | topUtterances length bias | Removed `characterCount > 200` filter, use `displayText` | `content-writer.ts` |
| 2026-01-31 | Single-char utterances (".", "ㅇ") | Added `length <= 1` check in `isKnownSystemMetadata()` | `data-extractor-worker.ts` |
| 2026-01-31 | Error stacks in examples | Added regex patterns for `^Error:`, stack traces | `data-extractor-worker.ts` |
| 2026-01-31 | Server logs in examples | Added regex patterns for HTTP request logs | `data-extractor-worker.ts` |
| 2026-01-31 | LLM threshold too high | Changed `LLM_FILTER_MIN_LENGTH`: 100 → 10 | `data-extractor-worker.ts` |
| 2026-01-30 | AI responses in examples | Added fallback verification in `sanitizePromptPatterns()` | `evaluation-assembler.ts` |

---

## Contamination Entry Points

| Priority | Location | Issue | Status |
|----------|----------|-------|--------|
| High | LLM filter failure | All data classified as "developer" on LLM failure | Open |
| Medium | Paraphrased quotes | Substring match failure → passes through | Open |
| Low | Regex patterns | New system metadata patterns may emerge | Ongoing |

---

## Debug Commands

```bash
# Enable debug logging
DEBUG_PROMPT_PATTERNS=true npx tsx scripts/debug-analysis.ts

# Analyze utterance lengths
npx tsx scripts/analyze-utterance-lengths.ts <jsonl-path>
```

---

## Prevention Checklist

1. ✅ Always verify fallback data against developer corpus
2. ✅ Use utteranceId references, not raw quotes
3. ✅ Build verification corpora (devTexts, aiTexts)
4. ✅ Test with multiple JSONL files for unique examples
