# Deep ICP & Market Analysis — February 2026

> NoMoreAISlop 글로벌 시장 진출 전략을 위한 심층 고객·시장 분석
> Data sources: SaaStr, Sacra, a16z, Second Talent, Bubble Survey, Stack Overflow, Menlo Ventures, Roots Analysis, Congruence Market Insights

---

## Part 1: ICP (Ideal Customer Profile) 정의

조사 결과 **4개의 뚜렷한 ICP 세그먼트**가 존재합니다. 각각의 문제, 현재 행동, 지불의사가 완전히 다릅니다.

---

### ICP #1: "The Non-Technical Founder" (비기술 창업자)

#### 인구통계
- **규모**: Lovable 사용자 ~8M 중 비개발자 63% = ~5M명. Replit 40M 사용자 중 비엔지니어 58% = ~23M명
- **프로필**: 25~45세, 사업 아이디어는 있지만 코딩 능력 없음. 도메인 전문성(의료, 교육, 소매 등) 보유
- **지역 분포**: APAC 40.7%, EU 18.1%, NA 13.9%, LATAM 13.8% (인도 단독 16.7%)
- **Bubble 2025 설문**: 전체 vibe coding 사용자의 **36.4%가 창업자**, 22%가 비기술 비즈니스 사용자

#### 핵심 문제 (Jobs to be Done)
1. **"내 아이디어를 프로토타입으로 만들고 싶다"** — 가장 기본적인 JTBD
2. **"프로토타입이 작동하는데 배포를 못 하겠다"** — Deployment Wall
3. **"에러를 고치려다 크레딧만 날렸다"** — Error Loop & Token Drain
4. **"이게 안전한 건지 모르겠다"** — Security Blindspot

#### 현재 행동 (문제를 해결하지 못해서 하는 행동)
| 행동 | 비율 (추정) | 비용 | 만족도 |
|------|-----------|------|-------|
| **Upwork/Fiverr에서 프리랜서 고용** — "AI 코드 수정 전문가" 카테고리 급성장 중 | ~30% | $50~300/건, 반복 발생 | 낮음 (커뮤니케이션 비용, 품질 편차) |
| **더 많은 크레딧 구매 후 재시도** — Lovable/Bolt에서 Fix 버튼 반복 클릭 | ~25% | $20~200/월 추가 소모 | 매우 낮음 (같은 에러 반복) |
| **YouTube/Reddit에서 독학** — "how to deploy Lovable app" 검색 | ~20% | 시간 (수일~수주) | 중간 (학습은 되지만 느림) |
| **프로젝트 포기** — "felt defeated", "shelved the app" | ~15% | 기회비용 (수백~수천 달러 매몰) | 없음 |
| **기술 공동창업자 영입 시도** | ~10% | 지분 희석 (10~50%) | 높음 (찾을 수 있다면) |

#### 지불의사 (Willingness to Pay)
- **현재 지출**: Lovable Pro $20/mo, Replit Core $25/mo, Bolt Pro $20/mo + 추가 크레딧 $20~200/mo
- **프리랜서 비용**: 단순 수정 $50~150, 복잡한 수정 $300~1,000+, 전체 배포 $1,000~5,000
- **추정 WTP for 솔루션**: 월 **$29~99** (프리랜서 비용 대비 명확한 절감 가치가 있다면)
- **핵심 인사이트**: 이 세그먼트는 **결과에 대해 지불**합니다 — "내 앱이 작동하면 돈을 낸다"

#### Pain Intensity Score: ★★★★★ (5/5)
가장 심각한 고통을 겪지만, 가장 높은 지불의사도 보입니다.

---

### ICP #2: "The Vibe Coding Practitioner" (바이브 코딩 실천자)

#### 인구통계
- **규모**: 전 세계 AI 코딩 도구 사용 개발자 ~30M명 중, vibe coding 활발 사용자 ~8~10M명
- **프로필**: 주니어~미드레벨 개발자 (1~5년 경력), 또는 기술적 배경의 비전공자 (디자이너, PM, 데이터 분석가)
- **Stack Overflow 2025**: 84%가 AI 도구 사용 중이지만, 66%가 "almost right" 문제 경험
- **Bubble 설문**: 22.7%가 전문 개발자, 14.3%가 완전 초보

#### 핵심 문제
1. **"AI가 생성한 코드를 제대로 리뷰하지 못하겠다"** — 능력 부족이 아니라 습관 부족
2. **"프롬프트를 어떻게 써야 더 나은 결과가 나오는지 모르겠다"** — Prompt Engineering Gap
3. **"생산성이 올랐다고 느끼는데 실제로는 아닌 것 같다"** — METR 연구의 역설 (주관 +20% vs 실제 -19%)
4. **"기술 부채가 쌓이는 게 보이지만 어떻게 관리할지 모르겠다"** — Day 2 Problem

#### 현재 행동
| 행동 | 비율 (추정) | 비용 | 만족도 |
|------|-----------|------|-------|
| **그냥 계속 사용** — 문제를 인식하면서도 대안 없이 계속 | ~40% | 시간 낭비 (주당 3~8시간 추정) | 중간 |
| **블로그/트위터에서 팁 수집** — 개인 프롬프트 노하우 축적 | ~25% | 시간 | 중간 |
| **도구 전환** — Cursor → Claude Code → Windsurf 등 계속 이동 | ~20% | 학습 비용 + 구독 중복 | 낮음 |
| **AI 코딩 교육 과정 수강** — Codecademy, Maven 등 | ~10% | $15~40/mo | 중간~높음 |
| **커뮤니티에서 질문** — Reddit r/vibecoding (89K), r/ClaudeAI (497K) | ~5% | 무료 | 낮음~중간 |

#### 지불의사
- **현재 지출**: AI 도구 구독 $20~200/mo 이미 지출 중
- **추정 WTP for 교육/진단**: 월 **$15~49** (기존 도구 구독의 부가 레이어로)
- **핵심 인사이트**: 이 세그먼트는 **"나는 잘하고 있다"고 믿기** 때문에 문제 인식 자체가 마케팅 과제

#### Pain Intensity Score: ★★★☆☆ (3/5)
고통은 있지만, 자기 과대평가(METR 역설)로 인해 적극적으로 솔루션을 찾지는 않습니다.

---

### ICP #3: "The Enterprise AI Champion" (기업 AI 도입 책임자)

#### 인구통계
- **규모**: Enterprise AI 도입 기업의 Engineering Manager / VP of Engineering / CTO — 글로벌 ~50K~200K명
- **프로필**: 팀(5~50명 개발자)에 AI 도구를 도입했거나 도입 중, ROI와 거버넌스 책임
- **Enterprise AI 지출**: 평균 $12.3M/년 (2026), +75.7% YoY

#### 핵심 문제
1. **"팀이 AI 도구를 쓰는데, 실제 생산성이 올랐는지 측정할 수 없다"** — ROI 측정 불가
2. **"누가 무슨 AI 코드를 프로덕션에 넣었는지 추적이 안 된다"** — Audit Trail 부재
3. **"AI 도구 교육을 하고 싶은데 체계적인 프로그램이 없다"** — Training Gap
4. **"규제 요구사항(SOC 2, HIPAA)을 AI 생성 코드에 어떻게 적용하나"** — Compliance Gap
5. **"AI 도구 비용이 예상보다 빠르게 증가하고 있다"** — Cost Visibility

#### 현재 행동
| 행동 | 비율 (추정) | 비용 | 만족도 |
|------|-----------|------|-------|
| **내부 가이드라인 문서 작성** — 자체 AI 사용 정책 | ~35% | 내부 인력 시간 | 낮음 (실효성 의문) |
| **기존 DevOps 도구에 의존** — Datadog, Snyk 등에서 부분적 커버 | ~25% | $5K~50K/년 | 중간 (AI 특화 아님) |
| **외부 컨설팅 의뢰** — McKinsey, Deloitte AI 컨설팅 | ~15% | $50K~500K/프로젝트 | 높음 (비싸지만 효과적) |
| **방치 / "일단 쓰고 보자"** — 거버넌스 없이 도입 | ~20% | 잠재적 보안/컴플라이언스 리스크 | N/A |
| **GitHub Copilot Metrics 등 벤더 내장 분석** | ~5% | 포함 | 낮음 (제한적) |

#### 지불의사
- **현재 지출**: AI 도구 라이선스 $500~50K/mo, DevOps $5K~50K/년, 컨설팅 $50K~500K/건
- **추정 WTP for AI 거버넌스/교육 플랫폼**: **$500~10,000/mo** (팀 규모별)
- **핵심 인사이트**: **예산이 가장 크고**, 장기 계약 선호, 하지만 **영업 사이클이 3~9개월**
- **Forrester**: Enterprise는 보안/컴플라이언스 충족 도구에 일반 대비 **3~5배** 지불 의향

#### Pain Intensity Score: ★★★★☆ (4/5)
문제를 명확히 인식하고, 예산도 있지만, 아직 시장에 적합한 솔루션이 없어서 자체 해결 중입니다.

---

### ICP #4: "The Domain Expert Creator" (도메인 전문가 크리에이터)

#### 인구통계
- **규모**: 정확한 수치 없음, 추정 1~5M명 (빠르게 성장 중)
- **프로필**: 의사, 교사, 변호사, 부동산 중개인, 소규모 사업자 등 — 자기 업무를 자동화하려는 도메인 전문가
- **특징**: "Software for one" (Kevin Roose, NYT) — 자신만을 위한 초개인화 도구를 만들려는 사람
- **동기**: "나만의 환자 관리 앱", "우리 학원 전용 학습 플랫폼", "내 부동산 매물 관리 시스템"

#### 핵심 문제
1. **"무엇을 만들 수 있는지 상상이 안 된다"** — a16z의 Imagination Problem
2. **"시작은 했는데 완성을 못 하겠다"** — 90%의 vibe-coded 앱이 미완성
3. **"내 업종에 특화된 기능이 필요한데 AI가 일반적인 것만 만든다"** — Domain Specificity Gap
4. **"데이터 보안이 중요한데 (환자 정보, 고객 데이터) AI가 안전하게 처리하는지 모르겠다"**

#### 현재 행동
| 행동 | 비율 (추정) | 비용 | 만족도 |
|------|-----------|------|-------|
| **기존 SaaS 사용 (대안)** — Notion, Airtable, Zapier 등으로 "대충" 해결 | ~40% | $10~100/mo | 중간 (커스터마이징 한계) |
| **Lovable/Bolt로 시도 후 포기** | ~25% | $20~200 낭비 | 매우 낮음 |
| **프리랜서에게 맞춤 개발 의뢰** | ~15% | $2,000~20,000 | 중간~높음 (비용만 감당 가능하면) |
| **Excel/Google Sheets로 수동 관리** | ~15% | 시간 (주당 5~15시간) | 낮음 |
| **특화 SaaS 사용** — 업종별 전문 소프트웨어 | ~5% | $50~500/mo | 높음 (있다면) |

#### 지불의사
- **현재 지출**: SaaS 구독 $10~500/mo, 프리랜서 $2K~20K/건
- **추정 WTP**: 완성된 솔루션에 **$49~199/mo**, 일회성 구축에 **$500~5,000**
- **핵심 인사이트**: **결과물의 가치**를 가장 명확하게 인식 — "이 앱이 내 시간을 주당 10시간 절약해주면 $200/mo는 싸다"

#### Pain Intensity Score: ★★★★☆ (4/5)
높은 고통 + 명확한 가치 인식, 하지만 기술 장벽이 가장 높은 세그먼트입니다.

---

## Part 2: ICP별 시장 규모 예측

### 전체 시장 컨텍스트

| Metric | 2025 | 2026 | 2027 | 2030 | Source |
|--------|------|------|------|------|--------|
| Vibe Coding 시장 | $3.9B | $4.7B | $12.3B | $50~150B | Congruence/SaaStr |
| AI Coding Tools 전체 | $6~12B | ~$15B | ~$24B | $65~100B | Grand View/Mordor |
| 비개발자 vibe coding 사용자 | ~20M | ~35M | ~60M | ~300M+ | Second Talent 추정 |
| AI Education 시장 | $7.6B | ~$12B | ~$18B | ~$55B | Market Research |

### ICP별 SAM/SOM 추정

```
ICP #1: Non-Technical Founder
├── SAM: 5M명 × $50/mo avg = $3B/년
├── 현실적 SOM (Year 1): 10K 유료 사용자 × $39/mo = $4.7M ARR
└── SOM (Year 3): 100K 유료 사용자 × $49/mo = $58.8M ARR

ICP #2: Vibe Coding Practitioner
├── SAM: 10M명 × $25/mo avg = $3B/년
├── 현실적 SOM (Year 1): 20K 유료 사용자 × $19/mo = $4.6M ARR
└── SOM (Year 3): 200K 유료 사용자 × $25/mo = $60M ARR

ICP #3: Enterprise AI Champion
├── SAM: 100K 기업 × $2,000/mo avg = $2.4B/년
├── 현실적 SOM (Year 1): 50 기업 × $2,000/mo = $1.2M ARR
└── SOM (Year 3): 500 기업 × $5,000/mo = $30M ARR

ICP #4: Domain Expert Creator
├── SAM: 3M명 × $100/mo avg = $3.6B/년
├── 현실적 SOM (Year 1): 5K 유료 사용자 × $79/mo = $4.7M ARR
└── SOM (Year 3): 50K 유료 사용자 × $99/mo = $59.4M ARR
```

**Combined SOM (Year 3): ~$208M ARR** — 이 시나리오에서 시리즈 B 수준의 스타트업이 됩니다.

---

## Part 3: 시장 성장 드라이버 & 시나리오 분석

### 성장 가속 요인 (Bull Case)

1. **Lovable/Replit의 초고속 성장이 "시장 교육"을 대신 해줌**
   - Lovable: $0 → $200M ARR in 12개월
   - Replit: $16M → $253M ARR in 12개월, 2026년 $1B 목표
   - 이들이 수백만 비개발자를 vibe coding으로 끌어들이고 → 좌절하는 순간 → NoMoreAISlop의 고객이 됨

2. **"Day 2 Problem"이 본격화되는 시점 = 지금**
   - Fast Company: $1.5T 기술 부채 예측 (2027)
   - 배포 후 결함 수정 비용이 개발 중 대비 30배
   - "빨리 만들기"에 집중한 1~2년 후, 유지보수 위기가 시작됨

3. **Enterprise AI 지출 폭증**
   - 2026년 평균 $12.3M/년 (+75.7% YoY)
   - Gartner: 2026년 신규 코드의 60%가 AI 생성 → 거버넌스 도구 필수

4. **인증/교육 시장의 구조적 수요**
   - 38%의 기업이 "AI 내부 전문성 부족"을 주요 장벽으로 인식
   - "AI prompting 능력"이 채용 기준이 되는 추세 (YC W25 배치의 25%가 95%+ AI 코드)

### 성장 억제 요인 (Bear Case)

1. **"Trough of Disillusionment" (2026~2027)**
   - Lovable/Replit의 트래픽이 여름 피크 후 하락 — 유지율 문제
   - 실제 비용이 드러나면서 사용자 이탈 가능

2. **플랫폼 자체 솔루션 출시**
   - Lovable/Replit이 자체 교육·보안·디버깅 기능 추가 가능 → 시장 잠식
   - GitHub Copilot Metrics가 확장되면 Enterprise 진단 시장 축소

3. **AI 모델 성능 급향상**
   - 모델이 더 좋아져서 "에러 루프" 문제 자체가 줄어들 가능성
   - 하지만 역설적으로: 모델이 좋아질수록 더 복잡한 것을 시도 → 새로운 문제 발생

4. **가격 민감성**
   - 비개발자는 이미 vibe coding 도구에 $20~100/mo 지출 → 추가 도구에 대한 지출 여력 제한
   - 37%만이 AI 도구에 유료 지불 의향 (Suzy 설문)

### 시나리오별 시장 전망

| 시나리오 | 2027 TAM | 확률 | NoMoreAISlop 전략 |
|---------|---------|------|-----------------|
| **Bull**: AI 코딩이 mainstream, 비개발자 3억명+ | $150~400B | 30% | 교육 + 인증이 핵심 moat |
| **Base**: 꾸준한 성장, 비개발자 6천만명 | $24~65B | 50% | Day 2 솔루션 + Enterprise |
| **Bear**: Trough of Disillusionment, 비개발자 이탈 | $12~24B | 20% | 남은 serious user 대상 premium |

---

## Part 4: 벤치마크 비즈니스 모델 분석

### Duolingo — "교육의 게이미피케이션" 벤치마크

| Metric | Duolingo | NoMoreAISlop 적용 |
|--------|----------|-----------------|
| Revenue (2024) | $748M | — |
| DAU | 40.5M | — |
| 무료→유료 전환 | ~8% (Max tier 9%) | 목표: 5~10% |
| ARPU | ~$18/년 (전체), ~$150/년 (유료) | 목표: $240~600/년 |
| Moat | 데이터 플라이휠, 습관 형성, 브랜드 | AI Score → 인증 → 채용 연계 |
| 핵심 교훈 | 초보자 과정이 가장 확장 가능, AI로 172개 과정을 빠르게 출시 | 초보자 vibe coding 교육이 가장 큰 시장 |

### Codecademy — "실습 기반 코딩 교육" 벤치마크

| Metric | Codecademy | NoMoreAISlop 적용 |
|--------|-----------|-----------------|
| 가격 | $15~40/mo | 참고 가격대 |
| 방식 | 인터랙티브 실습 | AI 세션 분석 기반 맞춤 피드백 |
| 한계 | AI 시대에 "코딩을 가르치는 것" 자체의 가치 하락 | "AI와 협업하는 법"을 가르치는 것은 가치 상승 |
| 핵심 교훈 | 2025 인기 과정 1위가 "Cursor로 앱 배포" | AI 도구 활용 교육이 새 mainstream |

### Chegg — "AI에 의해 파괴된 교육 기업" 반면교사

| Metric | Chegg | NoMoreAISlop 교훈 |
|--------|-------|-----------------|
| 사태 | ChatGPT가 숙제 답변을 대체 → 매출 급락 | **AI가 대체할 수 없는 가치**를 만들어야 함 |
| 실패 이유 | "정답 제공"이 핵심 가치 → AI가 더 잘함 | "AI 활용 능력 진단/인증"은 AI가 대체할 수 없음 |
| 핵심 교훈 | 기능 중심 서비스는 AI에 취약 | **인증(Certification)과 커뮤니티**가 moat |

### Coursera — "인증의 가치" 벤치마크

| Metric | Coursera | NoMoreAISlop 적용 |
|--------|---------|-----------------|
| Moat | 대학 파트너십 + 학위 인증 | 기업 인증("AI-Ready Developer") |
| 전략 전환 | B2C → B2B/기관 | NoMoreAISlop과 동일한 전략 |
| 핵심 교훈 | "AI가 설명은 할 수 있지만 인증은 줄 수 없다" | 인증이 AI 시대의 궁극적 moat |

---

## Part 5: 최종 전략 권고

### 추천 ICP 우선순위

```
1순위: ICP #1 (Non-Technical Founder) — B2C 바이럴 진입점
  ↓ 데이터 축적 & 브랜드 구축
2순위: ICP #2 (Vibe Coding Practitioner) — 볼륨 확장
  ↓ 인증 프로그램 출시
3순위: ICP #4 (Domain Expert Creator) — 수직 확장
  ↓ Enterprise 파일럿
4순위: ICP #3 (Enterprise) — 고ACV B2B
```

### 추천 비즈니스 아이템: "PromptCraft" + "Vibe Coach" 통합 플랫폼

#### Phase 1 (0~6개월): B2C 바이럴 진입 — "AI Collaboration Score"

**타겟**: ICP #1 + #2
**Product**: NoMoreAISlop의 기존 분석 엔진을 활용한 무료 "AI 활용 능력 진단"
- Claude Code / Cursor 세션 업로드 → AI Collaboration Score (0~100) 생성
- 소셜 공유 가능한 결과 카드 (바이럴 루프)
- "당신은 상위 15%의 AI 활용자입니다" or "에러 루프에 평균 3.2배 더 자주 빠집니다"

**Revenue**: Freemium → Pro $19/mo (상세 분석 + 개선 가이드)
**목표**: 100K 무료 사용자, 10K 유료 전환 = $2.3M ARR

#### Phase 2 (6~12개월): 실시간 코칭 + 교육 — "Vibe Coach"

**타겟**: ICP #1 + #2 + #4
**Product**: 브라우저 확장/CLI 플러그인
- 실시간 에러 루프 감지 → 전략 변경 제안
- 토큰/크레딧 비용 추적 → 예산 알림
- 프롬프트 최적화 제안
- 주간 학습 리포트 + 맞춤 교육 콘텐츠

**Revenue**: $29~49/mo (개인) → $99/mo (팀)
**목표**: 50K 유료 사용자 = $18~30M ARR

#### Phase 3 (12~18개월): Enterprise + 인증 — "AgentOps"

**타겟**: ICP #3
**Product**:
- 팀 단위 AI 활용 역량 대시보드
- AI 코드 거버넌스 정책 엔진
- "AI-Ready Developer" 인증 프로그램
- SOC 2 / HIPAA 컴플라이언스 리포트

**Revenue**: $500~10,000/mo (기업 규모별)
**목표**: 200 기업 = $24~48M ARR

#### Combined Year 3 Target: **$50~80M ARR**

### 경쟁 우위 (Moat) 구축 경로

```
Short-term (6개월):  데이터 — 세션 분석 데이터가 쌓일수록 더 정확한 진단
Mid-term (12개월):   네트워크 — "AI Collaboration Score"가 업계 표준 지표로 자리잡음
Long-term (18개월+): 인증 — "AI-Ready Developer" 인증이 채용 시장에서 인정받음
                      → Chegg와 달리 AI가 대체할 수 없는 moat
```

### 핵심 리스크 & 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Lovable/Replit이 자체 교육 기능 출시 | 높음 | 중간 | 멀티 플랫폼 지원으로 차별화 (단일 도구 ≠ 우리) |
| AI 모델 향상으로 에러 감소 | 중간 | 높음 | "코칭"에서 "인증/역량 평가"로 피벗 |
| Enterprise 영업 사이클이 길어짐 | 높음 | 중간 | B2C 매출로 런웨이 확보, Enterprise는 보너스 |
| 가격 저항 (비개발자 추가 지출 꺼림) | 중간 | 높음 | "토큰 절감 → ROI 입증" 메시지로 가치 정당화 |

---

## Sources

### 시장 규모 & 예측
- [Vibe Coding TAM: How Big Can This Market Really Get? — SaaStr](https://www.saastr.com/the-vibe-coding-tam-how-big-can-this-market-really-get/)
- [Vibe Coding Market Report 2025–2035 — Roots Analysis](https://www.rootsanalysis.com/vibe-coding-market)
- [Vibe Coding Market Intelligence 2025–2032 — Congruence Market Insights](https://www.congruencemarketinsights.com/report/vibe-coding-market)
- [Top Vibe Coding Statistics & Trends 2026 — Second Talent](https://www.secondtalent.com/resources/vibe-coding-statistics/)
- [The Vibe Coding Market in 2025 — Market Clarity](https://mktclarity.com/blogs/news/vibe-coding-market)

### 사용자 데이터 & 설문
- [2025 State of Visual Development and Vibe Coding — Bubble](https://bubble.io/blog/2025-state-of-visual-development-ai-app-building/)
- [Stack Overflow 2025 Developer Survey — AI](https://survey.stackoverflow.co/2025/ai/)
- [2025 State of Consumer AI — Menlo Ventures](https://menlovc.com/perspective/2025-the-state-of-consumer-ai/)
- [Will Consumers Pay for Generative AI Tools? — Suzy](https://www.suzy.com/blog/will-consumers-pay-for-generative-ai-tools-suzy-survey-indicates-37-of-users-would)

### 기업 데이터
- [Lovable Revenue: $200M ARR in 12 Months — AI Funding Tracker](https://aifundingtracker.com/lovable-vibe-coding-revenue/)
- [Lovable revenue, funding & growth rate — Sacra](https://sacra.com/c/lovable/)
- [Replit at $253M ARR growing 2,352% YoY — Sacra](https://sacra.com/research/replit-at-253m-arr-growing-2352-yoy/)
- [Replit Usage Statistics 2026 — Index.dev](https://www.index.dev/blog/replit-usage-statistics)
- [Vibe coding startups: valuations grew by 350% — Trending Topics EU](https://www.trendingtopics.eu/vibe-coding-startups-valuations-grew-by-350-in-one-year-huge-revenue-multiples/)

### 벤치마크
- [Duolingo in 2026: Usage, Revenue, Valuation — Fueler](https://fueler.io/blog/duolingo-usage-revenue-valuation-growth-statistics)
- [AI Education Revolution: Duolingo's Scalable Model — AInvest](https://www.ainvest.com/news/ai-education-revolution-duolingo-scalable-model-buy-2505/)
- [Top Global EdTech Startups 2025 — KisStartup](https://www.kisstartup.com/en/tin-tuc/top-global-edtech-startups-2025-when-business-models-enter-post-ai-era)

### 프리랜서/대안 행동
- [AI-Generated Code Specialists — Upwork](https://www.upwork.com/hire/ai-generated-code-specialists/)
- [Hire Dedicated Developers: Non-Tech Founders' Guide — DevTechnosys](https://devtechnosys.com/insights/how-non-tech-founders-successfully-hire-dedicated-developers/)
- [AI Application Spending Report — a16z](https://a16z.com/the-ai-application-spending-report-where-startup-dollars-really-go/)
