# Phase 3: 통합 분석 파이프라인 구현

> **Status:** ✅ COMPLETED
> **Created:** 2026-01-13
> **Completed:** 2026-01-13
> **Target:** `src/analyzer/unified-analyzer.ts`

## 목표

기존 분석 파이프라인과 Phase 0-2에서 만든 컴포넌트들을 연결하여 완전한 UnifiedReport를 생성하는 통합 분석기 구현

## 현재 상태

### 기존 컴포넌트 (통합 필요)
```
1. VerboseAnalyzer (verbose-analyzer.ts)
   - LLM 기반 VerboseEvaluation 생성
   - 아직 InsightGenerator와 연결 안됨

2. InsightGenerator (insight-generator.ts)
   - KB 링크 + 인용문 추출 + 조언 생성
   - DimensionInsight[] 출력

3. SchemaBridge (schema-bridge.ts)
   - VerboseEvaluation/TypeResult → UnifiedReport 변환
   - dimensions[]에 insights가 빈 배열 []로 남음

4. DimensionQuoteExtractor (dimension-quote-extractor.ts)
   - 세션에서 차원별 인용문 추출
```

### 현재 문제점

```
SchemaBridge.toUnifiedReport() 출력:
{
  dimensions: [
    { name: 'aiCollaboration', insights: [] },  // ❌ 비어있음
    { name: 'contextEngineering', insights: [] },
    ...
  ]
}
```

InsightGenerator가 SchemaBridge와 연결되지 않아 insights가 항상 빈 배열

## 구현 계획

### Step 1: UnifiedAnalyzer 클래스 생성

```typescript
// src/analyzer/unified-analyzer.ts

export class UnifiedAnalyzer {
  constructor(
    private verboseAnalyzer?: VerboseAnalyzer,
    private insightGenerator: InsightGenerator,
    private knowledgeLinker: KnowledgeLinker
  ) {}

  async analyze(sessions: ParsedSession[]): Promise<UnifiedReport>
}
```

### Step 2: 분석 파이프라인 연결

```
ParsedSession[]
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Pattern-based Analysis (existing)                            │
│     - TypeDetector → CodingStyle                                │
│     - DimensionAnalyzer → FullAnalysisResult                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LLM Analysis (optional, --verbose)                          │
│     - VerboseAnalyzer → VerboseEvaluation                       │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Insight Generation (Phase 2 컴포넌트 활용)                   │
│     - InsightGenerator.generateForAllDimensions()               │
│     - DimensionQuoteExtractor (internal)                        │
│     - KnowledgeLinker (internal)                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Schema Conversion (SchemaBridge 확장)                        │
│     - toUnifiedReport() + insights 주입                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
UnifiedReport (complete with insights)
```

### Step 3: 주요 메서드

```typescript
// 1. 전체 분석 실행
async analyze(
  sessions: ParsedSession[],
  options: AnalyzeOptions
): Promise<UnifiedReport>

// 2. 인사이트 생성 및 주입
private async injectInsights(
  dimensions: DimensionResult[],
  sessions: ParsedSession[]
): Promise<DimensionResult[]>

// 3. 결과 검증
private validateReport(report: UnifiedReport): void
```

### Step 4: 테스트 케이스

1. Pattern-only 분석 (insights 포함)
2. Verbose + Pattern 분석 (insights 포함)
3. InsightGenerator 연동 검증
4. Evidence 생성 검증
5. Recommendations 생성 검증

## 파일 변경

### 새 파일
- `src/analyzer/unified-analyzer.ts` - 통합 분석기

### 수정 파일
- `src/models/schema-bridge.ts` - insights 주입 지원 추가
- `src/analyzer/index.ts` - unified-analyzer export 추가

### 테스트 파일
- `tests/unit/analyzer/unified-analyzer.test.ts`

## 구현 순서

1. [x] UnifiedAnalyzer 클래스 스켈레톤 생성
2. [x] Pattern-based 분석 연동
3. [x] InsightGenerator 연동
4. [x] SchemaBridge insights 주입 로직 추가
5. [x] Verbose 모드 연동 (optional)
6. [x] 테스트 작성 (35 tests)
7. [x] index.ts export 추가

## 의존성 그래프

```
UnifiedAnalyzer
├── VerboseAnalyzer (optional)
├── InsightGenerator
│   ├── KnowledgeLinker
│   │   └── dimension-keywords
│   └── DimensionQuoteExtractor
├── SchemaBridge
│   └── unified-report.ts
└── DimensionAnalyzer (existing)
    ├── TypeDetector
    └── Pattern analyzers
```

## 예상 출력

```typescript
const report: UnifiedReport = {
  id: 'uuid',
  createdAt: '2026-01-13T...',
  sessionsAnalyzed: 5,
  profile: { /* CodingStyle + ControlLevel */ },
  dimensions: [
    {
      name: 'aiCollaboration',
      score: 75,
      level: 'proficient',
      insights: [
        {
          type: 'reinforcement',
          conversationBased: {
            quote: "Let me break this down into steps...",
            advice: "Great structured approach!",
            sentiment: 'praise'
          }
        },
        {
          type: 'improvement',
          researchBased: {
            source: 'Simon Willison (Blog)',
            insight: 'Context engineering tip...',
            url: 'https://...'
          }
        }
      ]
    },
    // ... 5 more dimensions with insights
  ],
  summary: { /* strengths, growthAreas, message */ },
  evidence: [ /* quotes from sessions */ ],
  recommendations: [ /* actionable items */ ],
  tier: 'free'
};
```

## 리스크 및 고려사항

1. **성능**: InsightGenerator가 KB를 조회하므로 네트워크 의존성
   - 해결: Mock KB 사용 또는 캐싱

2. **호환성**: 기존 analyze-style.ts 스크립트와의 호환성
   - 해결: UnifiedAnalyzer를 optional wrapper로 구현

3. **테스트**: KB 없이 테스트 가능해야 함
   - 해결: MockKnowledgeLinker 구현

## 완료 기준

- [x] UnifiedReport.dimensions[].insights가 비어있지 않음
- [x] 모든 6개 차원에 insights 생성
- [x] 테스트 통과 (35개 테스트)
- [x] 기존 테스트 통과 유지 (총 593개)

---

## 구현 결과 (2026-01-13)

### Phase 3: UnifiedAnalyzer 구현
- `src/analyzer/unified-analyzer.ts` - 통합 분석기 (290줄)
- `tests/unified-analyzer.test.ts` - 35개 테스트

### Phase 4: 웹 템플릿 리팩토링
- `src/web/components.ts` - 재사용 가능한 HTML 컴포넌트 (520줄)
- `src/web/template.ts` - Insight CSS 추가 + `generateUnifiedReportHTML()` 함수

### Phase 5: CLI 출력 업데이트
- `src/cli/output/components/unified-report-cli.ts` - UnifiedReport CLI 렌더러 (370줄)

### 통계
- 총 테스트: 593개 (모두 통과)
- 새 파일: 3개
- 수정 파일: 4개
