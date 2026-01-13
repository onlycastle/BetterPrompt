# Knowledge Base Web UI 구현 계획

## 프로젝트 개요

**목표**: AI 코딩 지식을 수집하고 탐색할 수 있는 프리미엄 Web UI 구축

**기술 스택**:
- Frontend: React 18 + Vite + TypeScript
- Backend: Express.js API (search-agent 래핑)
- Styling: CSS Modules + CSS Variables (Apple HIG)
- Icons: Lucide React (SF Symbols 대체)

**배포**: 로컬 전용 (localhost:5173 + localhost:3001)

---

## 아키텍처 설계

```
┌─────────────────────────────────────────────────────────────────┐
│                    Knowledge Base Web UI                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Browse    │    │   Learn     │    │  Dashboard  │        │
│  │    Page     │    │    Page     │    │    Page     │        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                │
│  ┌──────┴──────────────────┴──────────────────┴──────┐        │
│  │              React Components                      │        │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │        │
│  │  │SearchBar│ │KnowCard│ │InputForm│ │StatsCard│    │        │
│  │  └────────┘ └────────┘ └────────┘ └────────┘     │        │
│  └───────────────────────┬───────────────────────────┘        │
│                          │                                     │
│  ┌───────────────────────┴───────────────────────────┐        │
│  │                  API Client                        │        │
│  │         (fetch wrapper + React Query)              │        │
│  └───────────────────────┬───────────────────────────┘        │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTP (localhost:3001)
┌──────────────────────────┼─────────────────────────────────────┐
│                          │                                     │
│  ┌───────────────────────┴───────────────────────────┐        │
│  │              Express API Server                    │        │
│  │                                                   │        │
│  │  GET  /api/knowledge          List/Search items   │        │
│  │  GET  /api/knowledge/:id      Get single item     │        │
│  │  GET  /api/knowledge/stats    Get statistics      │        │
│  │  GET  /api/knowledge/metrics  Get quality metrics │        │
│  │  POST /api/learn/youtube      Learn from YouTube  │        │
│  │  POST /api/learn/url          Learn from URL      │        │
│  │  GET  /api/influencers        List influencers    │        │
│  │  POST /api/influencers        Add influencer      │        │
│  └───────────────────────┬───────────────────────────┘        │
│                          │                                     │
│  ┌───────────────────────┴───────────────────────────┐        │
│  │              Search Agent Module                   │        │
│  │  (knowledgeStore, influencerRegistry, skills)     │        │
│  └───────────────────────────────────────────────────┘        │
│                                                                │
│                    Express API Server                          │
└────────────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조

```
nomoreaislop/
├── src/
│   ├── search-agent/          # 기존 모듈
│   └── api/                   # NEW: Express API
│       ├── server.ts          # Express 앱 설정
│       ├── routes/
│       │   ├── knowledge.ts   # /api/knowledge 라우트
│       │   ├── learn.ts       # /api/learn 라우트
│       │   └── influencers.ts # /api/influencers 라우트
│       └── index.ts           # 서버 시작점
│
├── web-ui/                    # NEW: React 프론트엔드
│   ├── src/
│   │   ├── main.tsx           # 앱 엔트리
│   │   ├── App.tsx            # 라우터 설정
│   │   ├── api/               # API 클라이언트
│   │   │   └── client.ts
│   │   ├── pages/             # 페이지 컴포넌트
│   │   │   ├── BrowsePage.tsx
│   │   │   ├── LearnPage.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── components/        # 공유 컴포넌트
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── knowledge/
│   │   │   │   ├── KnowledgeCard.tsx
│   │   │   │   ├── KnowledgeList.tsx
│   │   │   │   └── KnowledgeDetail.tsx
│   │   │   ├── learn/
│   │   │   │   ├── YouTubeInput.tsx
│   │   │   │   ├── UrlInput.tsx
│   │   │   │   └── LearningProgress.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── PlatformChart.tsx
│   │   │   │   └── RecentItems.tsx
│   │   │   └── ui/            # 기본 UI 컴포넌트
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Spinner.tsx
│   │   │       └── Toast.tsx
│   │   ├── styles/            # 글로벌 스타일
│   │   │   ├── variables.css  # CSS 변수 (Apple HIG 컬러)
│   │   │   ├── reset.css      # CSS 리셋
│   │   │   └── global.css     # 글로벌 스타일
│   │   ├── hooks/             # 커스텀 훅
│   │   │   ├── useKnowledge.ts
│   │   │   └── useLearn.ts
│   │   └── types/             # 타입 정의
│   │       └── index.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── scripts/
│   └── start-ui.ts            # NEW: 통합 시작 스크립트
│
└── package.json               # 루트 (workspaces 설정)
```

---

## UI 디자인 시스템 (Apple HIG 기반)

### 컬러 팔레트

```css
:root {
  /* Primary */
  --color-primary: #007AFF;
  --color-primary-hover: #0056CC;

  /* Background */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F5F5F7;
  --color-bg-tertiary: #E8E8ED;

  /* Text */
  --color-text-primary: #1D1D1F;
  --color-text-secondary: #86868B;
  --color-text-tertiary: #AEAEB2;

  /* Semantic */
  --color-success: #34C759;
  --color-warning: #FF9500;
  --color-error: #FF3B30;

  /* Platform Colors */
  --color-youtube: #FF0000;
  --color-twitter: #1DA1F2;
  --color-reddit: #FF4500;
  --color-linkedin: #0A66C2;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
                 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-md: 15px;
  --font-size-lg: 17px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;
  --font-size-3xl: 34px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Shadow */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

  /* Transition */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #1C1C1E;
    --color-bg-secondary: #2C2C2E;
    --color-bg-tertiary: #3A3A3C;
    --color-text-primary: #FFFFFF;
    --color-text-secondary: #8E8E93;
  }
}
```

### 핵심 UI 컴포넌트

#### 1. Button

```tsx
// 세 가지 variant: primary, secondary, ghost
<Button variant="primary" size="md" loading={false}>
  Learn from YouTube
</Button>
```

#### 2. Card

```tsx
// 깔끔한 흰색 카드, 미세한 그림자
<Card padding="lg" hover>
  <CardHeader>
    <Badge platform="youtube" />
    <Title>Video Title</Title>
  </CardHeader>
  <CardContent>
    Summary text...
  </CardContent>
  <CardFooter>
    <Tag>prompt-engineering</Tag>
  </CardFooter>
</Card>
```

#### 3. Input

```tsx
// Apple 스타일 둥근 입력 필드
<Input
  icon={<SearchIcon />}
  placeholder="Search knowledge..."
  value={query}
  onChange={setQuery}
/>
```

---

## 페이지별 상세 설계

### 1. Browse Page (지식 탐색)

**레이아웃:**
```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar]  │  ┌─────────────────────────────────────┐  │
│             │  │  🔍 Search Knowledge...              │  │
│  Browse ●   │  └─────────────────────────────────────┘  │
│  Learn      │                                           │
│  Dashboard  │  Filters: [All ▼] [Platform ▼] [Score ▼] │
│             │                                           │
│  ─────────  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  Categories │  │  Card   │ │  Card   │ │  Card   │    │
│  ● All      │  │ YouTube │ │ Twitter │ │ Reddit  │    │
│  ○ Prompt   │  └─────────┘ └─────────┘ └─────────┘    │
│  ○ Context  │                                           │
│  ○ Tools    │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│             │  │  Card   │ │  Card   │ │  Card   │    │
│             │  └─────────┘ └─────────┘ └─────────┘    │
└─────────────┴───────────────────────────────────────────┘
```

**기능:**
- 실시간 검색 (debounced)
- 플랫폼/카테고리/점수 필터
- 무한 스크롤 또는 페이지네이션
- 카드 클릭 시 상세 모달

### 2. Learn Page (데이터 입력)

**레이아웃:**
```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar]  │                                           │
│             │  ┌─────────────────────────────────────┐  │
│  Browse     │  │       Add New Knowledge             │  │
│  Learn ●    │  └─────────────────────────────────────┘  │
│  Dashboard  │                                           │
│             │  ┌─────────────────────────────────────┐  │
│             │  │  📺 YouTube                         │  │
│             │  │  ┌─────────────────────────────┐   │  │
│             │  │  │ https://youtube.com/...     │   │  │
│             │  │  └─────────────────────────────┘   │  │
│             │  │  [ ] Process entire playlist       │  │
│             │  │  [    Learn from Video    ]        │  │
│             │  └─────────────────────────────────────┘  │
│             │                                           │
│             │  ┌─────────────────────────────────────┐  │
│             │  │  🔗 Web URL (X, Reddit, LinkedIn)  │  │
│             │  │  ┌─────────────────────────────┐   │  │
│             │  │  │ https://x.com/...           │   │  │
│             │  │  └─────────────────────────────┘   │  │
│             │  │  [    Learn from URL     ]         │  │
│             │  └─────────────────────────────────────┘  │
│             │                                           │
│             │  ─────── Recent Learning ───────          │
│             │  ✅ Andrej Karpathy - Vibe Coding (2분전) │
│             │  ⏳ Processing: OpenAI DevDay...          │
└─────────────┴───────────────────────────────────────────┘
```

**기능:**
- YouTube URL 입력 및 분석
- 웹 URL 입력 (WebSearch 활용)
- 플레이리스트 옵션
- 실시간 진행 상태 표시
- 최근 학습 이력

### 3. Dashboard Page (통계)

**레이아웃:**
```
┌─────────────────────────────────────────────────────────┐
│  [Sidebar]  │                                           │
│             │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ │
│  Browse     │  │ Total │ │ High  │ │Recent │ │ Influ │ │
│  Learn      │  │  127  │ │Quality│ │  12   │ │ encer │ │
│  Dashboard●│  │ items │ │  89   │ │7 days │ │  34   │ │
│             │  └───────┘ └───────┘ └───────┘ └───────┘ │
│             │                                           │
│             │  ┌─────────────────┐ ┌─────────────────┐ │
│             │  │ Platform Dist.  │ │ Category Dist.  │ │
│             │  │   ████ YT 45%   │ │ ██ Prompt 30%   │ │
│             │  │   ███ X  30%    │ │ ██ Context 25%  │ │
│             │  │   ██ Reddit 15% │ │ █ Tools 20%     │ │
│             │  │   █ LinkedIn 10%│ │ █ Best Prac 25% │ │
│             │  └─────────────────┘ └─────────────────┘ │
│             │                                           │
│             │  ─────── Top Influencers ───────         │
│             │  🌟 Andrej Karpathy - 12 items           │
│             │  🌟 Simon Willison - 8 items             │
│             │  ⭐ Swyx - 5 items                        │
└─────────────┴───────────────────────────────────────────┘
```

**기능:**
- 총 아이템 수, 고품질 아이템, 최근 추가 등 핵심 지표
- 플랫폼별 분포 차트
- 카테고리별 분포 차트
- 상위 인플루언서 목록
- 평균 relevance 점수

---

## API 엔드포인트 설계

### Knowledge API

```typescript
// GET /api/knowledge
// Query params: platform, category, author, minScore, query, limit, offset, sortBy
interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
  page: number;
  pageSize: number;
}

// GET /api/knowledge/:id
interface KnowledgeDetailResponse {
  item: KnowledgeItem;
}

// GET /api/knowledge/stats
interface KnowledgeStatsResponse {
  totalItems: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
}

// GET /api/knowledge/metrics
interface QualityMetricsResponse {
  totalItems: number;
  averageRelevanceScore: number;
  highQualityCount: number;
  influencerContentCount: number;
  platformDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  recentItemsCount: number;
}
```

### Learn API

```typescript
// POST /api/learn/youtube
interface LearnYouTubeRequest {
  url: string;
  processPlaylist?: boolean;
  maxVideos?: number;
}

interface LearnYouTubeResponse {
  success: boolean;
  results: VideoAnalysisResult[];
  savedCount: number;
  errors: { url: string; error: string }[];
}

// POST /api/learn/url
interface LearnUrlRequest {
  url: string;
}

interface LearnUrlResponse {
  success: boolean;
  item?: KnowledgeItem;
  error?: string;
}
```

### Influencer API

```typescript
// GET /api/influencers
interface InfluencerListResponse {
  influencers: Influencer[];
  stats: InfluencerStats;
}

// POST /api/influencers
interface CreateInfluencerRequest {
  name: string;
  description?: string;
  credibilityTier: 'high' | 'medium' | 'standard';
  identifiers: PlatformIdentifier[];
  expertiseTopics: string[];
  affiliation?: string;
}
```

---

## 구현 단계 (Phase)

### Phase 1: 프로젝트 설정 및 API 서버

**목표**: Express API 서버 구축, React 프로젝트 초기화

**작업**:
1. `src/api/` 디렉토리 생성 및 Express 서버 설정
2. CORS, JSON 파싱 미들웨어 설정
3. Knowledge, Learn, Influencer 라우트 구현
4. `web-ui/` React + Vite 프로젝트 초기화
5. 통합 시작 스크립트 작성

**파일**:
- `src/api/server.ts`
- `src/api/routes/knowledge.ts`
- `src/api/routes/learn.ts`
- `src/api/routes/influencers.ts`
- `web-ui/package.json`
- `web-ui/vite.config.ts`
- `scripts/start-ui.ts`

### Phase 2: 디자인 시스템 및 기본 UI

**목표**: Apple HIG 기반 디자인 시스템 및 공통 컴포넌트

**작업**:
1. CSS 변수 설정 (variables.css)
2. 기본 UI 컴포넌트 구현 (Button, Input, Card, Badge, Spinner)
3. 레이아웃 컴포넌트 (Sidebar, Header, Layout)
4. 다크모드 지원

**파일**:
- `web-ui/src/styles/variables.css`
- `web-ui/src/styles/reset.css`
- `web-ui/src/styles/global.css`
- `web-ui/src/components/ui/*.tsx`
- `web-ui/src/components/layout/*.tsx`

### Phase 3: Browse Page 구현

**목표**: 지식 탐색 및 검색 기능

**작업**:
1. KnowledgeCard 컴포넌트
2. KnowledgeList with 필터링
3. 검색 기능 (debounced)
4. 상세 모달/페이지
5. API 연동

**파일**:
- `web-ui/src/pages/BrowsePage.tsx`
- `web-ui/src/components/knowledge/*.tsx`
- `web-ui/src/hooks/useKnowledge.ts`

### Phase 4: Learn Page 구현

**목표**: 데이터 입력 및 학습 기능

**작업**:
1. YouTubeInput 컴포넌트 (URL 입력 + 옵션)
2. UrlInput 컴포넌트
3. LearningProgress 컴포넌트 (실시간 상태)
4. 최근 학습 이력
5. API 연동

**파일**:
- `web-ui/src/pages/LearnPage.tsx`
- `web-ui/src/components/learn/*.tsx`
- `web-ui/src/hooks/useLearn.ts`

### Phase 5: Dashboard Page 구현

**목표**: 통계 및 대시보드

**작업**:
1. StatCard 컴포넌트
2. 차트 컴포넌트 (바 차트, 파이 차트)
3. 인플루언서 목록
4. QualityMetrics 표시
5. API 연동

**파일**:
- `web-ui/src/pages/DashboardPage.tsx`
- `web-ui/src/components/dashboard/*.tsx`

### Phase 6: 마무리 및 테스트

**목표**: 통합 테스트, 버그 수정, 문서화

**작업**:
1. E2E 흐름 테스트
2. 반응형 디자인 검증
3. 다크모드 검증
4. README 업데이트
5. 시작 스크립트 최적화

---

## 검증 방법

### 기능 테스트

1. **API 서버**
   ```bash
   curl http://localhost:3001/api/knowledge/stats
   curl http://localhost:3001/api/knowledge?platform=youtube
   ```

2. **React 앱**
   ```bash
   cd web-ui && npm run dev
   # http://localhost:5173 에서 확인
   ```

3. **통합 테스트**
   ```bash
   npm run start:ui  # API 서버 + React 앱 동시 실행
   ```

### 검증 체크리스트

- [ ] Browse 페이지에서 지식 검색 가능
- [ ] 플랫폼/카테고리 필터 동작
- [ ] Learn 페이지에서 YouTube URL 학습 가능
- [ ] 학습 진행 상태 실시간 표시
- [ ] Dashboard에서 통계 확인 가능
- [ ] 다크모드 전환 정상 동작
- [ ] 반응형 레이아웃 (모바일 대응)

---

## 예상 소요 시간

| Phase | 내용 | 예상 |
|-------|------|------|
| 1 | API 서버 + 프로젝트 설정 | 중 |
| 2 | 디자인 시스템 + UI 컴포넌트 | 중 |
| 3 | Browse Page | 중 |
| 4 | Learn Page | 중 |
| 5 | Dashboard Page | 소 |
| 6 | 마무리 + 테스트 | 소 |

---

## 의존성

### web-ui/package.json

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "lucide-react": "^0.294.0",
    "@tanstack/react-query": "^5.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### src/api 추가 의존성

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0"
  }
}
```

---

## 주요 설계 결정

| 결정 | 이유 |
|------|------|
| React + Vite 선택 | 빠른 HMR, TypeScript 지원, 최신 생태계 |
| Express API 분리 | search-agent와 프론트엔드 분리, 확장성 |
| CSS Modules 사용 | 스코프된 스타일, Apple HIG 커스터마이징 용이 |
| React Query 사용 | 서버 상태 관리, 캐싱, 자동 재검증 |
| Lucide Icons | SF Symbols와 유사한 스타일, React 통합 |
| 로컬 전용 배포 | 개인 용도, 인증 불필요, 단순화 |

---

## 확장 가능성

1. **인증 추가**: JWT 기반 인증으로 멀티유저 지원
2. **실시간 업데이트**: WebSocket으로 학습 진행 상황 실시간 표시
3. **내보내기**: PDF/Markdown 형식으로 지식 내보내기
4. **태그 관리**: 사용자 정의 태그 추가/편집
5. **북마크**: 중요 지식 북마킹 기능
