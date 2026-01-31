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
├── extractEvidenceUtteranceIds() → Phase 2 evidence에서 utteranceId 추출
├── topUtterances = Phase 2 evidence 기반 필터링 (NOT 첫 20개)
├── utteranceId로 원본 lookup
└── quote를 원본으로 교체 (LLM paraphrase 방지)
```

> ⚠️ **중요**: Phase 2 workers가 분석에 사용한 utteranceId만 Phase 3 topUtterances로 전달됩니다.
> 이를 통해 Communication Patterns 예시가 실제 분석 내용과 의미적으로 일치합니다.

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
| 2026-01-31 | **Phase 2 evidence 기반 topUtterances** | `extractEvidenceUtteranceIds()`로 Phase 2 evidence utteranceId 추출, topUtterances 필터링에 사용 | `content-writer.ts` |
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
| ~~Medium~~ | ~~topUtterances 다양성 샘플링~~ | **Resolved** - Phase 2 evidence 기반 선택으로 해결 |

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
5. ✅ Phase 2 evidence utteranceId를 Phase 3 topUtterances로 연결

---

## Critical Design Principle: Phase 2 Evidence 일관성

> ⚠️ **Phase 2에서 찾아낸 utterances는 끝까지 사용해야 합니다.**

### 문제 배경

기존 구현에서 Phase 2 workers가 분석에 사용한 evidence와 Phase 3 ContentWriter의 topUtterances가 단절되어 있었습니다:

```
Phase 2: "이 utterance가 '계획적 사고' 패턴의 evidence다" (utteranceId: abc_5)
    ↓ (단절)
Phase 3: topUtterances = phase1.slice(0, 20)  ← abc_5가 없을 수 있음!
    ↓
결과: "계획적 사고" 패턴에 무관한 예시 할당
```

### 해결 방안

`extractEvidenceUtteranceIds()`가 Phase 2 workers의 모든 evidence에서 utteranceId를 추출하여 topUtterances를 구성합니다:

```typescript
// content-writer.ts
const evidenceIds = extractEvidenceUtteranceIds(agentOutputs);
const topUtterances = phase1Output.developerUtterances
  .filter(u => evidenceIds.has(u.id))  // Phase 2가 사용한 것만!
  .map(...);
```

### 추출 대상 (Phase 2 Evidence Sources)

| Worker | Evidence Location |
|--------|-------------------|
| TrustVerification | `antiPatterns[].examples[].utteranceId` |
| WorkflowHabit | `criticalThinkingMoments[].utteranceId`, `planningHabits[].examples[].utteranceId` |
| StrengthGrowth | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |
| KnowledgeGap | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |
| ContextEfficiency | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |

### 유의사항

1. **타입 불일치 주의**: `PlanningHabit.examples`는 스키마상 `string[]`이지만, `verifyPhase2WorkerExamples()` 이후 런타임에서 `{ utteranceId, quote }[]`가 됩니다. 런타임 타입 가드 필수:
   ```typescript
   for (const ex of (ph.examples || []) as unknown[]) {
     if (typeof ex === 'object' && ex !== null && 'utteranceId' in ex) {
       ids.add((ex as { utteranceId: string }).utteranceId);
     }
   }
   ```

2. **Fallback 유지**: Phase 2 evidence가 없는 경우(분석 실패 등) 기존 동작(첫 20개)으로 fallback:
   ```typescript
   if (!topUtterances || topUtterances.length === 0) {
     topUtterances = phase1Output.developerUtterances.slice(0, 20).map(...);
   }
   ```

3. **일관성 검증**: Phase 3 promptPatterns의 예시가 Phase 2 분석 내용과 의미적으로 일치하는지 확인 필요
