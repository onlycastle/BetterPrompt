# LLM Pipeline Improvement Plan

> Specialized Agents (Economist, CodeReviewer, Librarian, Educator, Communicator)를 추가하여 분석 파이프라인 강화

## 현재 구조 vs 개선 구조

**현재 (3-Stage Pipeline):**
```
ParsedSession[] → Module A (DataAnalyst) → Module B (Personality) → Stage 2 (ContentWriter)
```

**개선 (3-Stage + 5 Agents):**
```
                    ┌─────────────────────────┐
                    │    ParsedSession[]       │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │  Module A    │   │  Module B    │   │  5 Agents    │
    │ DataAnalyst  │   │ Personality  │   │  (parallel)  │
    └──────────────┘   └──────────────┘   └──────────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   Stage 2: ContentWriter │
                    └─────────────────────────┘
```

## 설계 원칙

1. **병렬 실행**: Agent들은 Module A/B와 동시에 실행 (순차 아님)
2. **MVP 접근**: RAG/VectorDB 없이 Gemini 직접 분석
3. **조건부 실행**: Tier와 세션 내용에 따라 실행 여부 결정
4. **Gemini 제약 준수**: 5-level nesting limit → flattened schemas 사용
5. **네이밍 컨벤션**: 역할 기반 이름 (DataAnalyst, ContentWriter와 동일 패턴)

## 5개의 새로운 Agent

| Agent | 역할 | Min Tier | 실행 조건 |
|-------|------|----------|-----------|
| **Economist** | 토큰 효율성, 비용 분석, ROI | Premium | 항상 |
| **CodeReviewer** | 보안 취약점, 코드 품질 | Enterprise | 코드 패턴 있을 때 |
| **Librarian** | 지식 갭, 학습 패턴 분석 | Premium | 항상 |
| **Educator** | 학습 가이드, 연습 문제 생성 | Premium | 성장 영역 감지 시 |
| **Communicator** | 프롬프트 패턴, 커뮤니케이션 효과성 | Premium | 항상 |

## Communicator Agent: Bottom-up 패턴 발견

### 접근법
- ❌ 카테고리 정의 후 패턴 찾기 (Top-down)
- ✅ 반복 패턴 발견 후 카테고라이징 (Bottom-up)

### 패턴 발견 방식: AI 기반

**N-gram 방식의 한계:**
- "해줘" ≠ "해주세요" ≠ "부탁해"로 인식 (문자열 매칭)
- 한국어 토크나이저 필요
- 컨텍스트 이해 불가

**AI 기반 방식의 장점:**
- "해줘", "해주세요", "부탁해" → 같은 의도의 패턴으로 인식
- 한국어+영어 혼용 자연스럽게 처리
- 컨텍스트 기반 효과성 평가까지 한 번에 가능

### 처리 단계

```
Step 1: AI가 모든 user 메시지에서 의미적으로 반복되는 패턴 발견
        - 비슷한 의도의 표현들을 그룹핑
        - 문장 구조 패턴 (질문형, 명령형, 설명형)
        - 컨텍스트 제공 방식 패턴

Step 2: 빈도/영향력 기준으로 상위 패턴 선별
        - 의미적으로 3회 이상 반복된 패턴
        - AI 응답 품질에 영향을 준 패턴

Step 3: 발견된 패턴 사후 카테고라이징
        - 카테고리는 데이터에서 도출 (미리 정의 안 함)

Step 4: 각 패턴의 효과성 평가 + 개선 제안
```

### 출력 예시

```
발견된 패턴 #1: "이거 해줘" (12회 반복)
- 카테고리: 요청 방식
- 효과성: ⚠️ 낮음 - 목표/컨텍스트 누락으로 AI가 추가 질문 필요
- 대안: "X를 위해 Y 기능을 구현해줘. 현재 상태는 Z야"

발견된 패턴 #2: 코드 블록만 전송 (8회 반복)
- 카테고리: 컨텍스트 제공
- 효과성: ⚠️ 중간 - 코드는 있지만 의도 불명확
- 대안: "이 코드에서 [문제점] 때문에 [원하는 결과]가 안 돼"
```

## 파일 구조

### 새로 생성할 파일

```
src/lib/analyzer/
├── agents/                           # NEW
│   ├── base-agent.ts                 # BaseAgent abstract class
│   ├── economist.ts
│   ├── code-reviewer.ts
│   ├── librarian.ts
│   ├── educator.ts
│   ├── communicator.ts               # Bottom-up pattern discovery
│   ├── agent-prompts.ts              # PTCF prompts for each agent
│   └── index.ts

src/lib/models/
└── agent-outputs.ts                  # Agent output Zod schemas
```

### 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/analyzer/verbose-analyzer.ts` | Agent 오케스트레이션, 병렬 실행 |
| `src/lib/analyzer/stages/content-writer.ts` | AgentOutputs 수용, 서술 통합 |
| `src/lib/analyzer/content-gateway.ts` | Tier별 Agent 필드 필터링 |
| `src/lib/models/verbose-evaluation.ts` | Agent output 스키마 필드 추가 |

## Zod 스키마 (Gemini 5-level nesting 준수)

```typescript
// Flattened schemas - semicolon-separated strings for nested data
export const EconomistAnalysisSchema = z.object({
  tokenEfficiencyScore: z.number().min(0).max(100),
  estimatedMonthlyCost: z.string(),
  costLeakageAreas: z.string(), // "area:severity:suggestion;..."
  roiAssessment: z.string(),
  recommendations: z.string(),
});

export const CodeReviewerAnalysisSchema = z.object({
  securityFindings: z.string(),    // "type:severity:location:fix;..."
  codeQualityScore: z.number().min(0).max(100),
  logicIssues: z.string(),
  bestPracticeViolations: z.string(),
});

export const LibrarianAnalysisSchema = z.object({
  knowledgeGaps: z.string(),       // "topic:evidence:priority;..."
  learningPatterns: z.string(),
  skillProgression: z.string(),
  recommendedResources: z.string(),
});

export const EducatorAnalysisSchema = z.object({
  keyConceptsToLearn: z.string(),
  commonMistakes: z.string(),
  practiceExercises: z.string(),
  studyPriorities: z.string(),
});

export const CommunicatorAnalysisSchema = z.object({
  discoveredPatterns: z.string(),  // "pattern:frequency:category:effectiveness:alternative;..."
  overallCommunicationScore: z.number().min(0).max(100),
  topStrengths: z.string(),
  topImprovements: z.string(),
  promptingStyleSummary: z.string(),
});
```

## 파이프라인 통합

```typescript
private async runSpecializedAgents(
  data: StructuredAnalysisData,
  tier: UserTier
): Promise<AgentOutputs> {
  const agents = [
    new Economist(this.geminiClient, tier),
    new Librarian(this.geminiClient, tier),
    new Educator(this.geminiClient, tier),
    new CodeReviewer(this.geminiClient, tier),
    new Communicator(this.geminiClient, tier),
  ].filter(agent => agent.canRun());

  const results = await Promise.allSettled(
    agents.map(agent => agent.analyze(data))
  );

  return this.mergeAgentResults(results);
}
```

## Tier 접근 권한

| Content | Free | Premium | Enterprise |
|---------|------|---------|------------|
| EconomistAnalysis | - | Summary | Full |
| CodeReviewerAnalysis | - | - | Full |
| LibrarianAnalysis | - | Partial | Full |
| EducatorAnalysis | - | Summary | Full |
| CommunicatorAnalysis | - | Top 3 patterns | Full |

## 비용 추정 (MVP)

| Agent | Est. Tokens | Est. Cost/Call |
|-------|-------------|----------------|
| Economist | 20K | ~$0.015 |
| Librarian | 25K | ~$0.02 |
| Educator | 25K | ~$0.02 |
| CodeReviewer | 35K | ~$0.03 |
| Communicator | 30K | ~$0.025 |
| **Total** | ~135K | **~$0.11** |

**기존 파이프라인:** ~$0.06/분석
**Agent 추가 후:** ~$0.17/분석 (Enterprise, 전체 Agent)

## 향후 계획: RAG 통합 (Optional)

MVP 이후 RAG 추가 시:

1. `src/lib/analyzer/knowledge/` 디렉토리 생성
2. `KnowledgeLayer` 인터페이스 구현:
   ```typescript
   interface KnowledgeLayer {
     retrieve(query: string): Promise<KnowledgeItem[]>;
     getGuruQuotes(context: string): Promise<Quote[]>;
   }
   ```
3. Supabase pgvector로 벡터 검색 구현
4. Agent 생성자에 KnowledgeLayer 주입

## 구현 순서

1. **Phase 1**: 스키마 & 인프라 (`agent-outputs.ts`, `base-agent.ts`)
2. **Phase 2**: Agent 구현 (5개 파일)
3. **Phase 3**: 파이프라인 통합 (`verbose-analyzer.ts` 수정)
4. **Phase 4**: 테스트 & 검증

## 검증 방법

1. `npm run build` 통과
2. `npm run typecheck` 통과
3. `npm test` 통과
4. `noslop analyze`로 수동 테스트:
   - Agent 병렬 실행 확인 (로그)
   - Agent 출력이 최종 리포트에 포함
   - Tier 필터링 정상 동작