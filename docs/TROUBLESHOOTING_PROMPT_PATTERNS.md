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
                                        ↓
                              evidence with utteranceId
                              (REQUIRED for verification)
```

### Phase 2 → Phase 3 Data Flow (utteranceId)

```
Phase 2 Workers (분석 담당)
├── developerUtterances 거시적 분석
├── 패턴 발견 (strengths, growthAreas, antiPatterns)
└── evidence에 **utteranceId 필수** 포함
    Format: "utteranceId:quote[:context]"

Phase 3 ContentWriter (검증 담당)
├── Phase 2 결과물 검증
├── utteranceId로 원본 lookup
└── quote를 원본으로 교체 (LLM paraphrase 방지)
```

### Key Files

| File | Role |
|------|------|
| `data-extractor-worker.ts` | Phase 1 - Utterance extraction + filtering |
| `worker-insights.ts` | Phase 2 - Evidence parsing (utteranceId 필수) |
| `content-writer.ts` | Phase 3 - utteranceId 기반 검증 |
| `content-writer-prompts.ts` | Phase 3 - LLM prompt for examplesData |
| `evaluation-assembler.ts` | sanitizePromptPatterns + utteranceLookup |

### Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., "7fdbb780_5") - **Phase 2 evidence에 필수**
- **examplesData**: `"utteranceId|analysis;utteranceId|analysis;..."`
- **displayText**: LLM-sanitized text for UI display
- **text**: Original raw text (may contain errors, stack traces)

---

## Change Log

| Date | Issue | Solution | Files Modified |
|------|-------|----------|----------------|
| 2026-01-31 | **utteranceId 필수화** | Phase 2 evidence에 utteranceId 필수, ID 기반 검증만 사용 | `worker-insights.ts`, `content-writer.ts`, 4개 worker prompts |
| 2026-01-31 | Empty Communication Patterns examples | LLM prompt table format + explicit examplesData rules | `content-writer-prompts.ts` |
| 2026-01-31 | topUtterances length bias | Removed `characterCount > 200` filter, use `displayText` | `content-writer.ts` |
| 2026-01-31 | Single-char utterances (".", "ㅇ") | Added `length <= 1` check in `isKnownSystemMetadata()` | `data-extractor-worker.ts` |
| 2026-01-31 | Error stacks in examples | Added regex patterns for `^Error:`, stack traces | `data-extractor-worker.ts` |
| 2026-01-31 | Server logs in examples | Added regex patterns for HTTP request logs | `data-extractor-worker.ts` |
| 2026-01-31 | LLM threshold too high | Changed `LLM_FILTER_MIN_LENGTH`: 100 → 10 | `data-extractor-worker.ts` |
| 2026-01-30 | AI responses in examples | Added fallback verification in `sanitizePromptPatterns()` | `evaluation-assembler.ts` |

---

## TODO

| Priority | Task | Context |
|----------|------|---------|
| Medium | topUtterances 다양성 샘플링 | 현재 첫 20개 utterances만 선택 → 세션 간 분산 필요 |

---

## Contamination Entry Points

| Priority | Location | Issue | Status |
|----------|----------|-------|--------|
| High | LLM filter failure | All data classified as "developer" on LLM failure | Open |
| ~~Medium~~ | ~~Paraphrased quotes~~ | ~~Substring match failure → passes through~~ | **Resolved** (utteranceId 필수화) |
| Low | Regex patterns | New system metadata patterns may emerge | Ongoing |
| Low | Missing utteranceId | Phase 2 LLM이 utteranceId 없이 evidence 출력 | Mitigated (prompts + parsing) |

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
