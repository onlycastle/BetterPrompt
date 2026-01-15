# Verbose Analyzer Enhancement Plan

> **Status**: Planning Complete - Ready for Implementation
> **Created**: 2025-01-15
> **Last Updated**: 2025-01-15

## 🎯 Overview

세 가지 주요 개선 작업을 통해 분석 품질과 사용자 경험을 향상시킵니다.

| # | Goal | Summary | Status |
|---|------|---------|--------|
| 1 | **Knowledge Linking** | `INITIAL_INSIGHTS` + dimension keywords를 시스템 프롬프트에 주입 | ⏳ Pending |
| 2 | **Remove Free Tier Framing** | 전체 분석 생성 후 후처리로 콘텐츠 게이팅 | ⏳ Pending |
| 3 | **Two-Stage Pipeline** | Data Analyst → Content Writer 분리 | ⏳ Pending |

---

## 📊 Current State Analysis

### 핵심 파일
| File | Purpose | Lines |
|------|---------|-------|
| `src/analyzer/verbose-prompts.ts` | 시스템 프롬프트 + 유저 프롬프트 빌더 | 317 |
| `src/analyzer/verbose-analyzer.ts` | 단일 LLM 호출 오케스트레이터 | 394 |
| `src/domain/models/knowledge.ts` | `INITIAL_INSIGHTS` (10개) - **미사용** | 513 |
| `src/analyzer/dimension-keywords.ts` | 행동 신호 키워드 - **미사용** | 247 |

### 현재 파이프라인
```
Sessions → buildVerboseUserPrompt() → Single LLM Call (temp 0.4, 8192 tokens) → Sanitize → Output
```

### 식별된 문제점
1. **Knowledge base 미주입** - `INITIAL_INSIGHTS`가 존재하지만 시스템 프롬프트에서 사용되지 않음
2. **Free tier 언어** - 프롬프트에 수익화 관련 언어가 명시적으로 포함됨 (Lines 23-25, 249-260)
3. **단일 페르소나** - 하나의 LLM 호출이 데이터 추출과 스토리텔링을 모두 수행

---

## 🔧 Implementation Plan

### Phase 1: Knowledge Context Enhancement (Goal 1)

**목표**: 기존 지식 자산을 시스템 프롬프트에 주입하여 더 정교한 분석 제공

**새 파일: `src/analyzer/verbose-knowledge-context.ts`**

기존 자산에서 주입 가능한 지식 컨텍스트 생성:
- `INITIAL_INSIGHTS`를 전문가 지식 XML로 포맷
- `DIMENSION_KEYWORDS` 행동 신호 포맷
- 시스템 프롬프트 섹션으로 통합

**수정: `src/analyzer/verbose-prompts.ts`**

`<analysis_approach>` 다음에 지식 컨텍스트 주입:
```xml
<expert_knowledge>
  <research_insights>
    <insight title="Skill Atrophy Self-Diagnosis" source="VCP Research (arXiv:2601.02410)">
      Key: Heavy AI reliance can lead to skill decay
      Signals: Can't start coding without AI, can't explain generated code
    </insight>
    <!-- ... 9 more insights ... -->
  </research_insights>

  <behavioral_signals>
    <dimension name="aiCollaboration">
      <strength>TodoWrite usage, Task delegation, parallel agents</strength>
      <growth>No task breakdown, no verification</growth>
    </dimension>
    <!-- ... 5 more dimensions ... -->
  </behavioral_signals>
</expert_knowledge>
```

**토큰 예산**: 현재 ~2500 + 새로운 ~1500 = ~4000 토큰 (허용 범위)

---

### Phase 2: Remove Free Tier Framing (Goal 2)

**목표**: Free tier 제한 없이 전체 분석 생성 후, 후처리로 콘텐츠 게이팅

**수정: `src/analyzer/verbose-prompts.ts`**

제거/교체:
- Lines 23-25: "FREE content"와 "purchase" 관련 `<motivation>` 섹션
- Lines 249-260: Premium tier skeleton 지시사항
- Line 259-260: Free tier 품질 관련 `<reminder>`

교체 내용:
```xml
<output_philosophy>
Your goal is to produce the most thorough, evidence-based analysis possible.
Extract ALL relevant quotes. Identify ALL patterns. Miss nothing.
Quality and completeness are your metrics for success.
</output_philosophy>
```

**새 파일: `src/analyzer/content-gateway.ts`**

티어 기반 필터링을 위한 후처리:
```typescript
export class ContentGateway {
  filter(evaluation: VerboseEvaluation, tier: Tier): VerboseEvaluation {
    // Free: 상위 2개 dimension 상세, 나머지 요약
    // Premium: 모든 dimension, prompt patterns, tool analysis
    // Enterprise: comparatives, trends, full roadmap
  }

  createPremiumPreview(evaluation: VerboseEvaluation): PremiumPreview {
    // 잠긴 섹션의 티저 콘텐츠 생성
  }
}
```

---

### Phase 3: Two-Stage LLM Pipeline (Goal 3)

**목표**: 정확한 데이터 추출과 매력적인 콘텐츠 작성을 분리

**아키텍처**
```
Sessions + Metrics
       │
       ▼
┌─────────────────────────────────┐
│  STAGE 1: Data Analyst              │
│  Model: claude-3-5-haiku (fast/$)   │
│  Temp: 0.2 (accuracy)               │
│  Output: StructuredAnalysisData     │
│  Focus: Extract, structure, evidence│
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  STAGE 2: Content Writer            │
│  Model: claude-sonnet-4 (quality)   │
│  Temp: 0.6 (creativity)             │
│  Input: Stage 1 data                │
│  Output: VerboseEvaluation          │
│  Focus: Narrative, engagement, tone │
└─────────────────────────────────┘
       │
       ▼
ContentGateway.filter()
       │
       ▼
Final Output
```

**새 파일들**
```
src/analyzer/stages/
├── index.ts
├── data-analyst.ts           # Stage 1 구현
├── data-analyst-prompts.ts   # Stage 1 프롬프트
├── content-writer.ts         # Stage 2 구현
└── content-writer-prompts.ts # Stage 2 프롬프트
```

**새 스키마: `src/models/analysis-data.ts`**

Stage 1 중간 출력:
```typescript
StructuredAnalysisDataSchema = z.object({
  typeAnalysis: { primaryType, controlLevel, distribution, reasoning },
  extractedQuotes: [{
    quote, sessionDate, dimension, signal, behavioralMarker, confidence
  }].min(20).max(100),  // 많은 인용구 추출
  detectedPatterns: [{
    patternId, patternType, frequency, examples, significance
  }].min(3).max(15),
  dimensionSignals: [{
    dimension, strengthSignals: string[], growthSignals: string[]  // flattened
  }].length(6),
  analysisMetadata: { totalQuotesAnalyzed, coverageScores: [{dimension, score}], confidenceScore }
});
```

**Stage 1 프롬프트 포커스**
- 정밀한 데이터 추출
- 내러티브 작성 없음
- 모든 증거 수집
- 신뢰도 점수 부여

**Stage 2 프롬프트 포커스**
- 데이터를 내러티브로 변환
- 개발자 친화적 어조
- 사용자가 "이해받는다"고 느끼게
- 인용구를 스토리텔링에 엮기

---

## 📁 File Changes Summary

### 새 파일 (8개)
| File | Purpose |
|------|---------|
| `src/analyzer/verbose-knowledge-context.ts` | Knowledge context 빌더 |
| `src/analyzer/content-gateway.ts` | 티어 기반 콘텐츠 필터링 |
| `src/analyzer/stages/index.ts` | Stage exports |
| `src/analyzer/stages/data-analyst.ts` | Stage 1 구현 |
| `src/analyzer/stages/data-analyst-prompts.ts` | Stage 1 프롬프트 |
| `src/analyzer/stages/content-writer.ts` | Stage 2 구현 |
| `src/analyzer/stages/content-writer-prompts.ts` | Stage 2 프롬프트 |
| `src/models/analysis-data.ts` | Stage 1 스키마 |

### 수정 파일 (2개)
| File | Changes |
|------|---------|
| `src/analyzer/verbose-prompts.ts` | Knowledge 주입, free tier 언어 제거 |
| `src/analyzer/verbose-analyzer.ts` | Two-stage 파이프라인 오케스트레이션 |

---

## 📋 Implementation Order

### Step 1: Phase 1 - Knowledge Linking
- [ ] `verbose-knowledge-context.ts` 생성
- [ ] `verbose-prompts.ts`에 컨텍스트 주입 업데이트
- [ ] 샘플 세션으로 테스트

### Step 2: Phase 2 - Remove Free Tier Framing
- [ ] `verbose-prompts.ts` 정리
- [ ] `content-gateway.ts` 생성
- [ ] Analyzer에 gateway 통합

### Step 3: Phase 3 - Two-Stage Pipeline
- [ ] `analysis-data.ts` 스키마 생성
- [ ] `data-analyst.ts` + 프롬프트 구현
- [ ] `content-writer.ts` + 프롬프트 구현
- [ ] `verbose-analyzer.ts` 오케스트레이션 업데이트
- [ ] 설정 옵션 추가
- [ ] 레거시 모드 폴백 추가

---

## ✅ Verification

1. **Unit Tests**: 각 새 모듈에 대한 테스트 파일
2. **Integration Test**: 엔드투엔드 파이프라인 테스트
3. **Manual Test**: `npm run build && node dist/scripts/analyze-style.js` 실행
4. **Quality Check**: 전후 출력 품질 비교

---

## ⚠️ Risk Mitigations

| Risk | Mitigation |
|------|------------|
| 2x latency (두 번의 LLM 호출) | 품질 향상을 위한 허용 가능한 트레이드오프; 진행 상황 표시 |
| 토큰 비용 증가 | Stage 1 출력 토큰 감소로 총 비용 유사 |
| Breaking changes | 레거시 메서드 유지, 설정 플래그 사용 |
| Stage 1 스키마 검증 실패 | 강력한 정제(sanitization) + 폴백 |

---

## 💡 Configuration Options

```typescript
interface VerboseAnalyzerConfig {
  pipeline: {
    mode: 'single' | 'two-stage';  // Default: 'two-stage'
    stage1: {
      model: 'claude-3-5-haiku-20241022',  // 빠르고 비용 효율적
      temperature: 0.2,  // 높은 정확도
      maxTokens: 6000
    };
    stage2: {
      model: 'claude-sonnet-4-20250514',  // 높은 품질의 글쓰기
      temperature: 0.6,  // 창의적 스토리텔링
      maxTokens: 4000
    };
  };
  tier: 'free' | 'premium' | 'enterprise';
}
```

**비용 비교** (분석당, ~10 세션):
| Mode | Input Tokens | Output Tokens | Est. Cost |
|------|--------------|---------------|-----------|
| Single (Sonnet) | ~15K | ~6K | ~$0.13 |
| Two-stage (Haiku+Sonnet) | ~15K+6K | ~6K+4K | ~$0.10 |

다른 모델을 사용하는 Two-stage는 더 높은 품질의 출력을 생성하면서 **더 저렴**할 수 있습니다.

---

## 📝 Progress Log

| Date | Phase | Task | Status | Notes |
|------|-------|------|--------|-------|
| 2025-01-15 | - | Planning completed | ✅ Done | Model choice: Haiku + Sonnet |
| | | | | |
