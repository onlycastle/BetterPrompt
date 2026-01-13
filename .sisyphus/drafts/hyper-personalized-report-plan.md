# Hyper-Personalized Report System 구현 계획

> **Version**: 1.0.0 | **Risk Level**: Aggressive (A)
> **Created**: 2026-01-13 | **Status**: Draft

## Executive Summary

기존에 구현된 6개 분석 차원과 Knowledge Base를 통합하여, 사용자의 실제 대화 내용을 기반으로 **hyper-personalized** 리포트를 생성하는 시스템을 구축한다.

### 핵심 목표

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERSONALIZED FEEDBACK LOOP                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   A) 6 Dimensions        "어디가 강점이고 어디가 약점인가?"      │
│        ↓                  Context Engineering: 85/100 ✅         │
│                           Skill Resilience: 45/100 ⚠️            │
│                                                                  │
│   C) 대화 기반 조언                                              │
│        ↓                                                         │
│        ├── 강점: "5번째 메시지에서 파일 경로를 명확히 지정한     │
│        │         것이 훌륭합니다. 계속 이렇게 하세요!"           │
│        │                                                         │
│        └── 개선: "3번째 메시지에서 '그 파일'이라고 했는데,       │
│                  src/utils:45 처럼 명시하면 더 좋습니다"         │
│                                                                  │
│   B) KB 동적 연동                                                │
│        ↓                                                         │
│        ├── 강점용: "Context Engineering을 더 심화하려면          │
│        │           Anthropic의 고급 가이드를 참고하세요 [링크]"  │
│        │                                                         │
│        └── 개선용: "Skill Resilience 향상을 위해 VCP Paper의     │
│                    Cold Start 연습을 시작해보세요 [링크]"        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 현재 상태 분석

### 구현됨 ✅

| 컴포넌트 | 위치 | 상태 |
|----------|------|------|
| 6개 분석 차원 | `src/analyzer/dimensions/` | 완전 구현, 미사용 |
| VerboseAnalyzer | `src/analyzer/verbose-analyzer.ts` | 작동, 차원 미통합 |
| Knowledge Base | `src/search-agent/` | 완전 구현, 리포트 미연동 |
| 웹 템플릿 (6탭) | `src/web/template.ts` | 탭 구조 있음, 데이터 미연결 |
| Professional Insights | `src/search-agent/models/knowledge.ts` | 10개 사전 정의 |

### 누락됨 ❌

| 컴포넌트 | 필요 이유 |
|----------|-----------|
| 통합 리포트 스키마 | 기존 스키마들이 분산됨 |
| 인사이트 생성기 | KB + 대화 → 개인화 조언 |
| 차원-KB 매핑 | 어떤 차원에 어떤 KB 항목 연결할지 |
| 후처리 LLM 파이프라인 | 분석 → 인사이트 변환 |

---

## 아키텍처 설계

### 새로운 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                      NEW ANALYSIS PIPELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Sessions (JSONL)                                                │
│       ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PHASE 1: Core Analysis (LLM Call #1)                   │    │
│  │                                                          │    │
│  │  VerboseAnalyzer.analyze()                               │    │
│  │    ├── 5 Style Types (distribution)                      │    │
│  │    ├── 3 Control Levels                                  │    │
│  │    ├── Personality Summary                               │    │
│  │    ├── Strengths (with quotes)                           │    │
│  │    ├── Growth Areas (with quotes)                        │    │
│  │    └── Prompt Patterns                                   │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PHASE 2: Dimension Calculation (Local, No LLM)         │    │
│  │                                                          │    │
│  │  calculateAllDimensions(sessions)                        │    │
│  │    ├── AI Collaboration Mastery (0-100)                  │    │
│  │    ├── Context Engineering (0-100)                       │    │
│  │    ├── Tool Mastery (0-100)                              │    │
│  │    ├── Burnout Risk (0-100)                              │    │
│  │    ├── AI Control Index (0-100)                          │    │
│  │    └── Skill Resilience (0-100)                          │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PHASE 3: Knowledge Retrieval (DB Query, No LLM)        │    │
│  │                                                          │    │
│  │  ★ 강점과 개선점 모두 다룸!                              │    │
│  │                                                          │    │
│  │  For EACH dimension:                                     │    │
│  │    ├── IF score >= 70 (STRENGTH):                        │    │
│  │    │   └── searchKnowledge(dimension, 'reinforcement')   │    │
│  │    │       ├── "계속 이렇게 하세요" 메시지               │    │
│  │    │       ├── 심화 학습 리소스                          │    │
│  │    │       └── 고급 기법 추천                            │    │
│  │    │                                                     │    │
│  │    └── IF score < 70 (GROWTH AREA):                      │    │
│  │        └── searchKnowledge(dimension, 'improvement')     │    │
│  │            ├── 기초 학습 리소스                          │    │
│  │            ├── 실천 가능한 팁                            │    │
│  │            └── 단계별 개선 가이드                        │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PHASE 4: Insight Generation (LLM Call #2)              │    │
│  │                                                          │    │
│  │  InsightGenerator.generate(analysis, dimensions, kb)     │    │
│  │                                                          │    │
│  │  ★ 강점 인사이트:                                        │    │
│  │    ├── "5번째 메시지에서 파일 경로를 명확히 지정한 것이  │    │
│  │    │    훌륭합니다. 이 습관이 Context Engineering 85점의 │    │
│  │    │    핵심 요인입니다."                                │    │
│  │    └── "더 발전시키려면 Anthropic의 고급 가이드 참고"    │    │
│  │                                                          │    │
│  │  ★ 개선 인사이트:                                        │    │
│  │    ├── "3번째 메시지에서 '그 파일'이라고 했는데,         │    │
│  │    │    src/utils:45 처럼 명시하면 더 좋습니다"          │    │
│  │    └── "VCP Paper의 Cold Start 연습 추천"                │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PHASE 5: Report Assembly                               │    │
│  │                                                          │    │
│  │  UnifiedReport = {                                       │    │
│  │    profile: { type, controlLevel, distribution },        │    │
│  │    dimensions: DimensionResult[6],                       │    │
│  │    insights: {                                           │    │
│  │      strengths: PersonalizedInsight[],  // 잘한 것!      │    │
│  │      growthAreas: PersonalizedInsight[] // 개선할 것     │    │
│  │    },                                                    │    │
│  │    evidence: EvidenceQuote[],                            │    │
│  │    recommendations: ActionableRecommendation[]           │    │
│  │  }                                                       │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  OUTPUT: CLI + Web (localhost:3000)                     │    │
│  │                                                          │    │
│  │  Tab 0: Overview (profile + summary)                     │    │
│  │  Tab 1-6: Dimension Details                              │    │
│  │    ├── 강점이면: 🌟 "Keep it up!" + 심화 리소스          │    │
│  │    └── 개선이면: 💡 "Try this!" + 기초 리소스            │    │
│  │  Tab 7: Recommendations + Resources                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 새로운 통합 스키마 설계

### UnifiedReport Schema

```typescript
// src/models/unified-report.ts

import { z } from 'zod';

// ============================================
// PART 1: Profile (기존 TypeResult 확장)
// ============================================

const CodingStyleType = z.enum([
  'architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'
]);

const ControlLevel = z.enum(['vibe-coder', 'developing', 'ai-master']);

const ProfileSchema = z.object({
  primaryType: CodingStyleType,
  controlLevel: ControlLevel,
  matrixName: z.string(),        // "Systems Architect", "Yolo Coder" etc.
  matrixEmoji: z.string(),       // 🏛️, 🎲 etc.
  distribution: z.object({
    architect: z.number(),
    scientist: z.number(),
    collaborator: z.number(),
    speedrunner: z.number(),
    craftsman: z.number(),
  }),
  personalitySummary: z.string().min(200).max(1000),
});

// ============================================
// PART 2: Dimensions (6개 차원 통합)
// ============================================

const DimensionLevel = z.enum(['novice', 'developing', 'proficient', 'expert']);

// ★ 강점/개선 모두를 위한 인사이트 스키마
const DimensionInsightSchema = z.object({
  type: z.enum(['reinforcement', 'improvement']), // 강점용 vs 개선용

  conversationBased: z.object({
    quote: z.string(),           // 실제 대화에서 인용
    messageIndex: z.number(),    // 몇 번째 메시지인지
    advice: z.string(),          // 개인화된 조언
    sentiment: z.enum(['praise', 'encouragement', 'suggestion']),
  }).optional(),

  researchBased: z.object({
    source: z.string(),          // "VCP Paper", "Anthropic" etc.
    insight: z.string(),         // 연구 기반 조언
    url: z.string().optional(),  // 원문 링크
  }).optional(),

  learningResource: z.object({
    title: z.string(),
    url: z.string(),
    platform: z.string(),        // "YouTube", "Blog" etc.
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    relevanceScore: z.number(),  // 0-1
  }).optional(),
});

const DimensionResultSchema = z.object({
  name: z.enum([
    'aiCollaboration',
    'contextEngineering',
    'toolMastery',
    'burnoutRisk',
    'aiControl',
    'skillResilience'
  ]),
  displayName: z.string(),       // "AI Collaboration Mastery"
  score: z.number().min(0).max(100),
  level: DimensionLevel,
  isStrength: z.boolean(),       // score >= 70
  trend: z.enum(['improving', 'stable', 'declining']).optional(),
  breakdown: z.record(z.number()), // 하위 지표들

  // ★ 강점과 개선점 모두 포함!
  highlights: z.object({
    strengths: z.array(z.string()),    // 이 차원에서 잘한 것들
    growthAreas: z.array(z.string()),  // 이 차원에서 개선할 것들
  }),

  insights: z.array(DimensionInsightSchema), // 개인화된 인사이트!
  interpretation: z.string(),
});

// ============================================
// PART 3: Evidence (대화 기반 증거)
// ============================================

const EvidenceQuoteSchema = z.object({
  quote: z.string().min(10).max(500),
  messageIndex: z.number(),
  timestamp: z.string().optional(),
  category: z.enum(['strength', 'growth', 'pattern']),
  dimension: z.string().optional(), // 관련 차원
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  analysis: z.string(),          // 왜 이 인용이 중요한지
});

// ============================================
// PART 4: Recommendations (실행 가능한 추천)
// ============================================

const RecommendationSchema = z.object({
  priority: z.number().min(1).max(5),
  type: z.enum(['reinforce', 'improve']), // ★ 강화 vs 개선
  title: z.string(),
  description: z.string(),
  relatedDimension: z.string(),
  actionItems: z.array(z.string()),
  resources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    type: z.enum(['article', 'video', 'documentation', 'example']),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
  })),
  expectedImpact: z.string(),
});

// ============================================
// PART 5: Premium Content (잠금 컨텐츠)
// ============================================

const PremiumContentSchema = z.object({
  toolUsageDeepDive: z.array(z.object({
    tool: z.string(),
    usagePercentage: z.number(),
    insight: z.string(),
    recommendation: z.string(),
  })).optional(),
  tokenEfficiency: z.object({
    score: z.number(),
    avgTokensPerSession: z.number(),
    savingsOpportunity: z.string(),
  }).optional(),
  growthRoadmap: z.object({
    milestones: z.array(z.object({
      title: z.string(),
      description: z.string(),
      completed: z.boolean(),
    })),
  }).optional(),
  comparativeInsights: z.array(z.object({
    metric: z.string(),
    yourScore: z.number(),
    percentile: z.number(),
    interpretation: z.string(),
  })).optional(),
  sessionTrends: z.array(z.object({
    metric: z.string(),
    trend: z.enum(['improving', 'stable', 'declining']),
    change: z.number(),
    interpretation: z.string(),
  })).optional(),
});

// ============================================
// MAIN SCHEMA: UnifiedReport
// ============================================

export const UnifiedReportSchema = z.object({
  // Metadata
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  sessionsAnalyzed: z.number(),

  // Core Analysis
  profile: ProfileSchema,
  dimensions: z.array(DimensionResultSchema).length(6),

  // ★ 강점과 개선점을 명확히 구분!
  summary: z.object({
    topStrengths: z.array(z.object({
      dimension: z.string(),
      score: z.number(),
      highlight: z.string(),
    })).min(1).max(3),
    topGrowthAreas: z.array(z.object({
      dimension: z.string(),
      score: z.number(),
      highlight: z.string(),
    })).min(1).max(3),
    overallMessage: z.string(),
  }),

  // Personalized Content
  evidence: z.array(EvidenceQuoteSchema).min(5).max(20),
  recommendations: z.array(RecommendationSchema).min(3).max(10),

  // Premium (티어에 따라 잠금)
  premium: PremiumContentSchema.optional(),

  // Tier Control
  tier: z.enum(['free', 'pro', 'premium', 'enterprise']),
});

export type UnifiedReport = z.infer<typeof UnifiedReportSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type DimensionInsight = z.infer<typeof DimensionInsightSchema>;
export type EvidenceQuote = z.infer<typeof EvidenceQuoteSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type PremiumContent = z.infer<typeof PremiumContentSchema>;
```

---

## 구현 계획

### Phase 0: 스키마 및 기반 작업

**목표**: 새로운 통합 스키마 정의 및 기존 코드와의 브릿지 생성

**작업**:
1. `src/models/unified-report.ts` 생성 (위 스키마)
2. 기존 스키마들과의 변환 함수 작성
   - `VerboseEvaluation` → `Profile`
   - `FullAnalysisResult` → `DimensionResult[]`
3. 테스트 작성

**파일**:
```
src/models/
├── unified-report.ts          # NEW: 통합 스키마
├── schema-bridge.ts           # NEW: 변환 함수
└── index.ts                   # 업데이트: export 추가
```

**예상 LOC**: ~500줄

---

### Phase 1: Knowledge Base - 차원 매핑 (강점/개선 모두)

**목표**: 각 분석 차원과 KB 항목 간의 연결 시스템 구축 (강점과 개선점 모두 커버)

**작업**:
1. 차원별 키워드 매핑 정의 (강점용 + 개선용)
2. KB 검색 쿼리 최적화
3. Professional Insights와 차원 연결
4. 관련성 점수 기반 필터링
5. 난이도별 리소스 분류 (beginner/intermediate/advanced)

**새로운 파일**:
```
src/analyzer/
├── knowledge-linker.ts        # NEW: 차원-KB 연결
└── dimension-keywords.ts      # NEW: 차원별 검색 키워드
```

**차원-키워드 매핑 예시**:
```typescript
const DIMENSION_KEYWORDS = {
  contextEngineering: {
    // 강점일 때: 심화 학습용 키워드
    reinforcement: {
      keywords: ['advanced context', 'token optimization', 'multi-context'],
      professionalInsightIds: ['pi-006-advanced'],
      categories: ['context-engineering'],
      level: 'advanced',
    },
    // 개선 필요할 때: 기초 학습용 키워드
    improvement: {
      keywords: ['context basics', 'WRITE strategy', 'file references'],
      professionalInsightIds: ['pi-002', 'pi-006'],
      categories: ['context-engineering', 'prompt-engineering'],
      level: 'beginner',
    },
  },
  skillResilience: {
    reinforcement: {
      keywords: ['independent coding', 'cold start mastery'],
      professionalInsightIds: ['pi-001-advanced'],
      categories: ['best-practices'],
      level: 'advanced',
    },
    improvement: {
      keywords: ['skill atrophy', 'VCP', 'cold start practice'],
      professionalInsightIds: ['pi-001'],
      categories: ['best-practices'],
      level: 'beginner',
    },
  },
  // ... 나머지 4개 차원
};
```

**예상 LOC**: ~400줄

---

### Phase 2: 인사이트 생성기 (후처리 LLM)

**목표**: 분석 결과 + KB 컨텍스트를 받아 개인화된 인사이트 생성 (강점 칭찬 + 개선 제안)

**작업**:
1. `InsightGenerator` 클래스 구현
2. 인사이트 생성 프롬프트 설계 (강점/개선 균형)
3. 대화 기반 조언 추출 로직
4. 연구 기반 조언 포맷팅
5. 학습 리소스 추천 로직 (난이도별)

**새로운 파일**:
```
src/analyzer/
├── insight-generator.ts       # NEW: 인사이트 생성기
├── insight-prompts.ts         # NEW: 프롬프트 템플릿
└── quote-extractor.ts         # NEW: 대화 인용 추출
```

**프롬프트 전략**:
```
SYSTEM: You are a supportive AI coding coach who provides balanced feedback.

Your feedback style:
1. CELEBRATE strengths with specific examples
2. SUGGEST improvements with encouragement
3. ALWAYS include concrete conversation quotes

Given:
1. Developer's analysis results (dimensions, scores)
2. Their actual conversation quotes
3. Relevant knowledge base items (for both strengths AND growth areas)

Generate insights that:

FOR STRENGTHS (score >= 70):
- Praise specifically: "In your 5th message, you excellently specified
  the file path as 'src/utils/helper.ts:45'. This is exactly why your
  Context Engineering score is 85!"
- Encourage continuation: "Keep doing this - it's working!"
- Suggest advancement: "To level up further, check out [advanced resource]"

FOR GROWTH AREAS (score < 70):
- Be encouraging: "You're on the right track, here's how to improve..."
- Quote specific moments: "In your 3rd message, you said '...' - try..."
- Provide actionable steps: "Start with [beginner resource]"

TONE: Supportive coach, not critical judge. 70% encouragement, 30% suggestions.
```

**예상 LOC**: ~700줄

---

### Phase 3: 통합 분석 파이프라인

**목표**: 기존 VerboseAnalyzer를 확장하여 전체 파이프라인 통합

**작업**:
1. `UnifiedAnalyzer` 클래스 생성 (VerboseAnalyzer 확장)
2. 5단계 파이프라인 구현
3. 강점/개선 분류 로직
4. 에러 처리 및 폴백 로직
5. 캐싱 전략 구현

**수정/생성 파일**:
```
src/analyzer/
├── unified-analyzer.ts        # NEW: 통합 분석기
├── verbose-analyzer.ts        # 수정: UnifiedAnalyzer에서 호출
└── index.ts                   # 수정: export 추가
```

**파이프라인 구현**:
```typescript
class UnifiedAnalyzer {
  async analyze(sessions: ParsedSession[]): Promise<UnifiedReport> {
    // Phase 1: Core Analysis (LLM #1)
    const verboseResult = await this.verboseAnalyzer.analyze(sessions);

    // Phase 2: Dimension Calculation (Local)
    const dimensions = calculateAllDimensions(sessions);

    // Phase 3: Knowledge Retrieval (DB) - ★ 강점과 개선 모두!
    const knowledgeContext = await this.getKnowledgeForAllDimensions(dimensions);

    // Phase 4: Insight Generation (LLM #2)
    const insights = await this.insightGenerator.generate(
      verboseResult,
      dimensions,
      knowledgeContext,
      sessions
    );

    // Phase 5: Report Assembly
    return this.assembleReport(verboseResult, dimensions, insights);
  }

  private async getKnowledgeForAllDimensions(dimensions: FullAnalysisResult) {
    const knowledgeContext = {
      reinforcements: [],  // 강점용 KB 항목
      improvements: [],    // 개선용 KB 항목
    };

    for (const [name, result] of Object.entries(dimensions)) {
      const isStrength = result.score >= 70;
      const kb = await this.knowledgeLinker.findRelevant(
        name,
        isStrength ? 'reinforcement' : 'improvement'
      );

      if (isStrength) {
        knowledgeContext.reinforcements.push({ dimension: name, ...kb });
      } else {
        knowledgeContext.improvements.push({ dimension: name, ...kb });
      }
    }

    return knowledgeContext;
  }
}
```

**예상 LOC**: ~600줄

---

### Phase 4: 웹 템플릿 업데이트

**목표**: 새로운 UnifiedReport 스키마에 맞게 웹 템플릿 수정 (강점 강조 UI)

**작업**:
1. `template.ts` 수정 - 새 스키마 렌더링
2. 강점 차원: 🌟 배지 + 초록색 테마 + "Keep it up!" 메시지
3. 개선 차원: 💡 배지 + 노란색 테마 + "Try this!" 메시지
4. 대화 인용 하이라이팅
5. 학습 리소스 링크 (난이도별 구분)
6. Premium 잠금 UI 구현

**수정 파일**:
```
src/web/
├── template.ts                # 수정: UnifiedReport 렌더링
├── server.ts                  # 수정: 새 타입 처리
└── components/                # NEW: 재사용 가능한 HTML 생성 함수
    ├── dimension-tab.ts
    ├── insight-card.ts
    ├── evidence-quote.ts
    └── recommendation-list.ts
```

**UI 구조**:
```
Tab 0: Overview
├── Profile Card (type, emoji, summary)
├── 🏆 Top Strengths (score >= 70인 차원들)
│   └── "Context Engineering 85점! 계속 이렇게 하세요!"
├── 💪 Growth Opportunities (score < 70인 차원들)
│   └── "Skill Resilience를 올리면 더 강해집니다"
└── Quick Actions (top 3 recommendations)

Tab 1-6: Dimension Details
├── Score Badge
│   ├── 강점: 🌟 + 초록 테마
│   └── 개선: 💡 + 노란 테마
├── Breakdown Chart
├── What You're Doing Great (with quotes) ← 강점 강조!
├── Where You Can Grow (with quotes)
├── Personalized Insights
│   ├── 💬 "5번째 메시지에서 훌륭했어요..."
│   ├── 📚 "Anthropic 가이드에 따르면..."
│   └── 🔗 Learning Resources
│       ├── 강점이면: Advanced 리소스
│       └── 개선이면: Beginner 리소스
└── Related KB Items

Tab 7: Action Plan
├── 🌟 Keep Doing (강점 유지 추천)
├── 🚀 Level Up (개선 추천)
├── All Learning Resources (난이도별 정렬)
└── Premium Unlock CTA
```

**예상 LOC**: ~900줄 (기존 템플릿 수정)

---

### Phase 5: CLI 출력 업데이트

**목표**: CLI에서 새로운 UnifiedReport 렌더링 (강점 칭찬 포함)

**작업**:
1. `unified-report.ts` CLI 컴포넌트 생성
2. 강점 차원: 🌟 + 초록색 + 칭찬 메시지
3. 개선 차원: 💡 + 노란색 + 격려 메시지
4. 대화 인용 포맷팅

**수정/생성 파일**:
```
src/cli/output/
├── unified-report.ts          # NEW: CLI 렌더링
└── components/
    ├── dimension-detail.ts    # NEW
    ├── insight-block.ts       # NEW
    └── quote-block.ts         # NEW
```

**CLI 출력 예시**:
```
╔══════════════════════════════════════════════════════════════╗
║  🏛️ Systems Architect (AI Master)                            ║
╚══════════════════════════════════════════════════════════════╝

🏆 YOUR STRENGTHS
─────────────────
🌟 Context Engineering ████████████████░░░░ 85/100
   "5번째 메시지에서 파일 경로를 정확히 지정했어요.
    이것이 당신의 강점입니다! 계속 이렇게 하세요."

🌟 Tool Mastery ██████████████████░░ 78/100
   "Task 도구를 적절히 활용하고 있어요. Great job!"

💪 GROWTH OPPORTUNITIES
─────────────────────────
💡 Skill Resilience ██████████░░░░░░░░░░ 45/100
   "3번째 메시지에서 '이거 어떻게 하는거지'라고 했는데,
    먼저 시도해보고 막히면 질문하는 습관을 길러보세요."

   📚 추천: VCP Paper - Cold Start Practice
```

**예상 LOC**: ~500줄

---

### Phase 6: 통합 테스트 및 마무리

**목표**: E2E 테스트, 문서화, 최적화

**작업**:
1. E2E 테스트 작성
2. 비용 최적화 (캐싱, 조건부 LLM 호출)
3. 문서 업데이트
4. 에러 처리 강화

**파일**:
```
tests/
├── unified-analyzer.test.ts   # NEW
├── insight-generator.test.ts  # NEW
└── knowledge-linker.test.ts   # NEW

docs/
└── UNIFIED_REPORT.md          # NEW: 새 시스템 문서
```

**예상 LOC**: ~500줄

---

## 인사이트 유형 정리

### 강점 인사이트 (Reinforcement)

| 유형 | 예시 | 목적 |
|------|------|------|
| **대화 기반 칭찬** | "5번째 메시지에서 파일 경로를 정확히 지정한 것이 훌륭합니다!" | 구체적 행동 강화 |
| **연구 기반 검증** | "Anthropic에 따르면 이것이 Context Engineering의 핵심입니다" | 신뢰성 부여 |
| **심화 리소스** | "더 발전시키려면 고급 가이드를 참고하세요 [링크]" | 성장 기회 제공 |

### 개선 인사이트 (Improvement)

| 유형 | 예시 | 목적 |
|------|------|------|
| **대화 기반 제안** | "3번째 메시지에서 '그 파일'이라고 했는데, 경로를 명시하면 더 좋아요" | 구체적 개선점 |
| **연구 기반 가이드** | "VCP Paper에 따르면 Cold Start 연습이 도움됩니다" | 검증된 방법 제시 |
| **기초 리소스** | "시작하려면 이 가이드를 참고하세요 [링크]" | 진입점 제공 |

---

## 위험 관리

### 높은 위험 (🔴)

| 위험 | 완화 전략 |
|------|-----------|
| LLM 인용 정확도 | 메시지 인덱스 검증, 폴백 로직 |
| 범위 초과 | 타임박싱, 핵심 기능 우선 |
| 통합 복잡성 | 명확한 인터페이스, 단계별 테스트 |

### 중간 위험 (🟡)

| 위험 | 완화 전략 |
|------|-----------|
| LLM 비용 증가 | 캐싱, 조건부 호출, Premium 전용 |
| KB 검색 품질 | 키워드 튜닝, 수동 검증 |
| 강점/개선 균형 | 톤 가이드라인, 프롬프트 튜닝 |

---

## 성공 기준

### 기능적 요구사항

- [ ] 6개 차원 모두 리포트에 표시
- [ ] 각 강점 차원에 칭찬 인사이트 포함
- [ ] 각 개선 차원에 격려 인사이트 포함
- [ ] 대화 인용 최소 5개 (강점 + 개선 합산)
- [ ] KB 기반 학습 리소스 추천 (난이도별)
- [ ] Free/Premium 티어 구분 작동

### 품질 요구사항

- [ ] 인용 정확도 95% 이상
- [ ] 전체 분석 시간 15초 이내
- [ ] LLM 비용 분석당 $0.10 이내
- [ ] 테스트 커버리지 80% 이상
- [ ] 강점:개선 인사이트 비율 약 60:40 (긍정적 톤 유지)

---

## 예상 산출물

| Phase | 파일 | LOC |
|-------|------|-----|
| 0 | 스키마 + 브릿지 | ~500 |
| 1 | KB 링커 (강점/개선) | ~400 |
| 2 | 인사이트 생성기 | ~700 |
| 3 | 통합 분석기 | ~600 |
| 4 | 웹 템플릿 | ~900 |
| 5 | CLI 출력 | ~500 |
| 6 | 테스트 + 문서 | ~500 |
| **Total** | | **~4,100** |

---

## 의존성

### 기존 모듈 (수정 없이 사용)

- `src/analyzer/dimensions/*` - 6개 차원 계산
- `src/search-agent/db/knowledge.ts` - KB 쿼리
- `src/analyzer/verbose-analyzer.ts` - 기존 분석 (Phase 1용)

### 새로 필요한 의존성

없음 (기존 스택으로 충분)

---

## 실행 순서

```
Phase 0 (스키마) ──────────────────────┐
                                       ↓
Phase 1 (KB 링커 - 강점/개선) ←───────┤
                                       ↓
Phase 2 (인사이트 생성기) ←───────────┤
                                       ↓
Phase 3 (통합 분석기) ←───────────────┘
         │
         ├── Phase 4 (웹 템플릿) ──→ 병렬 가능
         │
         └── Phase 5 (CLI 출력) ───→ 병렬 가능
                    │
                    ↓
              Phase 6 (테스트)
```

---

## 검증 방법

### 단위 테스트

```bash
npm test -- --grep "UnifiedAnalyzer"
npm test -- --grep "InsightGenerator"
npm test -- --grep "KnowledgeLinker"
```

### 통합 테스트

```bash
# 실제 세션으로 테스트
npx tsx scripts/analyze-style.ts --verbose

# 웹 리포트 확인
# → localhost:3000에서 모든 탭 검증
```

### 수동 검증 체크리스트

- [ ] 6개 차원 탭 모두 데이터 표시
- [ ] 강점 차원: 🌟 배지 + 칭찬 메시지 존재
- [ ] 개선 차원: 💡 배지 + 격려 메시지 존재
- [ ] "당신은 X에서 Y라고 했는데" 형태의 조언 (강점/개선 모두)
- [ ] 학습 리소스 난이도 적절 (강점=고급, 개선=기초)
- [ ] Premium 잠금 UI 정상 작동
- [ ] CLI 출력과 웹 리포트 일치
- [ ] 전체 톤이 긍정적이고 격려하는 느낌

---

## 다음 단계

계획 승인 후:
1. Phase 0 시작 - 스키마 정의
2. 병렬로 Phase 1-2 진행 가능
3. Phase 3에서 통합
4. Phase 4-5 병렬 진행
5. Phase 6으로 마무리

---

*이 계획은 Prometheus에 의해 생성되었습니다.*
*강점 강화 피드백이 추가되었습니다 (v1.0.1)*
