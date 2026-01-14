# Template.ts Refactoring Plan

## Overview

**목표**: `src/web/template.ts` (3,373줄, 37K 토큰)를 기능별로 분리하여 유지보수성 향상

**원칙**:
- Public API 유지 (`generateReportHTML`, `generateUnifiedReportHTML`, `ReportOptions`, `ExtendedAnalysisData`)
- 각 파일 100-200줄 이내 유지
- 단일 책임 원칙 적용

---

## Target Structure

```
src/web/
├── index.ts                    # Barrel (public API - 수정)
├── server.ts                   # 유지
├── components.ts               # 유지 + 확장
│
├── styles/
│   └── terminal-theme.ts       # CSS (~1,100줄)
│
├── scripts/
│   └── scroll-navigation.ts    # JS 스크롤 (~180줄)
│
├── sections/
│   ├── index.ts                # Barrel
│   ├── main-result.ts
│   ├── ai-collaboration.ts
│   ├── context-engineering.ts
│   ├── burnout-risk.ts
│   ├── tool-mastery.ts
│   ├── ai-control.ts
│   ├── skill-resilience.ts
│   ├── share.ts
│   ├── locked.ts
│   └── footer.ts
│
├── verbose/
│   ├── index.ts                # Barrel
│   ├── personality-summary.ts
│   ├── dimension-insights.ts
│   ├── prompt-patterns.ts
│   └── locked-teasers.ts
│
├── templates/
│   ├── report.ts               # generateReportHTML
│   └── unified-report.ts       # generateUnifiedReportHTML
│
└── types.ts                    # 공통 타입
```

---

## Implementation Steps

### Phase 1: Foundation (인프라 구축)

#### 1.1 Create types.ts
- [ ] `ExtendedAnalysisData` interface 이동
- [ ] `ReportOptions` interface 이동
- [ ] `CssLevelClass` type 이동
- [ ] 공통 유틸리티 타입 정의

#### 1.2 Create styles/terminal-theme.ts
- [ ] `getEnhancedStyles()` 함수 추출 (라인 244-1363)
- [ ] CSS 변수, reset, 각 컴포넌트 스타일 포함
- [ ] Export: `getEnhancedStyles`

#### 1.3 Create scripts/scroll-navigation.ts
- [ ] `getScrollScript()` 함수 추출 (라인 1364-1547)
- [ ] 스크롤 네비게이션, 키보드 핸들링 로직
- [ ] Export: `getScrollScript`

### Phase 2: Section Renderers (섹션 분리)

#### 2.1 Create sections/main-result.ts
- [ ] `renderMainResultSection()` 추출 (라인 1580-1618)
- [ ] 의존성: TYPE_METADATA

#### 2.2 Create sections/ai-collaboration.ts
- [ ] `renderAICollaborationSection()` 추출 (라인 1620-1699)
- [ ] 의존성: components.ts 함수들

#### 2.3 Create sections/context-engineering.ts
- [ ] `renderContextEngineeringSection()` 추출 (라인 1701-1800)

#### 2.4 Create sections/burnout-risk.ts
- [ ] `renderBurnoutRiskSection()` 추출 (라인 1802-1877)

#### 2.5 Create sections/tool-mastery.ts
- [ ] `renderToolMasterySection()` 추출 (라인 1879-1936)

#### 2.6 Create sections/ai-control.ts
- [ ] `renderAIControlSection()` 추출 (라인 1938-2041)

#### 2.7 Create sections/skill-resilience.ts
- [ ] `renderSkillResilienceSection()` 추출 (라인 2043-2149)

#### 2.8 Create sections/share.ts
- [ ] `renderShareSection()` 추출 (라인 2151-2269)
- [ ] `renderDashboardButtons()` 추출 (라인 2271-2344)

#### 2.9 Create sections/locked.ts
- [ ] `renderLockedSection()` 추출 (라인 2346-2401)

#### 2.10 Create sections/footer.ts
- [ ] `renderFooter()` 추출 (라인 2403-2423)

#### 2.11 Create sections/index.ts
- [ ] 모든 섹션 re-export

### Phase 3: Verbose Renderers (Verbose 분리)

#### 3.1 Create verbose/personality-summary.ts
- [ ] `renderVerbosePersonalitySummary()` 추출 (라인 2425-2438)

#### 3.2 Create verbose/dimension-insights.ts
- [ ] `renderVerboseDimensionInsights()` 추출 (라인 2440-2887)
- [ ] 가장 큰 함수 (~450줄) - 추가 분리 고려

#### 3.3 Create verbose/prompt-patterns.ts
- [ ] `renderVerbosePromptPatterns()` 추출 (라인 2889-2971)

#### 3.4 Create verbose/locked-teasers.ts
- [ ] `renderVerboseLockedTeasers()` 추출 (라인 2973-3007)

#### 3.5 Create verbose/index.ts
- [ ] 모든 verbose 렌더러 re-export

### Phase 4: Main Templates (메인 템플릿 조합)

#### 4.1 Create templates/report.ts
- [ ] `generateReportHTML()` 재구성 (라인 48-239)
- [ ] 모든 섹션, 스타일, 스크립트 import하여 조합
- [ ] Export: `generateReportHTML`

#### 4.2 Create templates/unified-report.ts
- [ ] `generateUnifiedReportHTML()` 추출 (라인 3044-3151)
- [ ] UnifiedReport 전용 헬퍼 함수들 포함:
  - `getDimensionTabName()`
  - `renderProfileSection()`
  - `renderUnifiedDimensionSection()`
  - `renderSummarySection()`
  - `renderUnifiedShareSection()`
- [ ] Export: `generateUnifiedReportHTML`

### Phase 5: Barrel Updates (Export 정리)

#### 5.1 Update index.ts
- [ ] `./template.js` import를 새 경로로 변경
- [ ] Public API 유지 확인:
  - `generateReportHTML`
  - `generateUnifiedReportHTML`
  - `ExtendedAnalysisData`
  - `ReportOptions`

#### 5.2 Delete template.ts
- [ ] 모든 코드가 이전되었는지 확인
- [ ] 기존 template.ts 삭제

### Phase 6: Verification (검증)

#### 6.1 Type Check
- [ ] `npm run typecheck` 통과 확인

#### 6.2 Build
- [ ] `npm run build` 성공 확인

#### 6.3 Test
- [ ] `npm test` 통과 확인

#### 6.4 Manual Test
- [ ] 실제 리포트 생성 테스트
- [ ] HTML 렌더링 정상 동작 확인

---

## Dependencies Graph

```
templates/report.ts
├── types.ts (ExtendedAnalysisData, ReportOptions)
├── styles/terminal-theme.ts (getEnhancedStyles)
├── scripts/scroll-navigation.ts (getScrollScript)
├── sections/* (모든 섹션 렌더러)
└── verbose/* (모든 verbose 렌더러)

templates/unified-report.ts
├── types.ts
├── styles/terminal-theme.ts
├── scripts/scroll-navigation.ts
└── components.ts (DIMENSION_CONFIG, 헬퍼들)
```

---

## Risk Mitigation

| 위험 | 대응 |
|------|------|
| Import 경로 오류 | TypeScript strict mode로 컴파일 타임 검증 |
| 순환 의존성 | types.ts를 최상위에 두어 방지 |
| 런타임 오류 | 각 단계별 빌드/테스트로 조기 발견 |
| 누락된 export | index.ts barrel에서 일괄 관리 |

---

## Estimated Effort

| Phase | 예상 파일 수 | 복잡도 |
|-------|-------------|--------|
| Phase 1 | 3 files | 낮음 |
| Phase 2 | 11 files | 중간 |
| Phase 3 | 5 files | 중간 |
| Phase 4 | 2 files | 중간 |
| Phase 5 | 1 file | 낮음 |
| Phase 6 | - | 검증 |

**총 22개 파일** 생성/수정

---

## Success Criteria

- [ ] `template.ts` 삭제됨
- [ ] 모든 새 파일이 200줄 이내
- [ ] 기존 Public API 100% 호환
- [ ] `npm run build && npm test` 통과
- [ ] 실제 리포트 렌더링 정상 동작
