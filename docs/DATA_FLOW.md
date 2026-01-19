# NoMoreAISlop - Data Flow

> Version: 2.0.0 | Last Updated: 2026-01-20

## Overview

NoMoreAISlop은 Vercel의 4.5MB 페이로드 제한과 5분 타임아웃을 우회하기 위해 **직접 Lambda 호출 아키텍처**를 사용합니다:
- **Desktop App**: Electron 앱 (세션 스캔, 분석, 리포트 표시)
- **AWS Lambda (SST)**: 분석 API (Desktop App이 직접 호출)
- **Web App (Vercel)**: Next.js 웹앱 (공유 가능한 리포트 표시 전용)

---

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         1. Desktop App (Electron)                           │
│                                                                             │
│   ~/.claude/projects/                                                       │
│   └── -Users-name-project/                                                  │
│       └── sessions/                                                         │
│           ├── abc123.jsonl     ←── Claude Code 세션 로그                     │
│           ├── def456.jsonl                                                  │
│           └── ...                                                           │
│                                                                             │
│   [스캔] → [세션 선택] → [JSONL 파싱] → [gzip 압축] → [HTTP POST]            │
│                                                                             │
│   Headers:                                                                  │
│   ├── Content-Type: application/octet-stream                                │
│   ├── X-Content-Encoding: gzip                                              │
│   └── X-Gemini-API-Key: <user_key>  (사용자 Gemini API 키)                   │
│                                                                             │
│   Payload: gzip(JSON { sessions[], totalMessages, totalDurationMinutes })   │
│   Limit: 25MB (압축 후) - Lambda 직접 호출로 Vercel 제한 우회                 │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ POST https://xxx.lambda-url.ap-northeast-2.on.aws
                                │ (Lambda Function URL 직접 호출)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       2. AWS Lambda (SST v3)                                │
│                                                                             │
│   Specifications:                                                           │
│   ├── Runtime: Node.js 20.x                                                 │
│   ├── Timeout: 15 minutes (vs Vercel 5분)                                   │
│   ├── Memory: 1024 MB                                                       │
│   ├── Payload: 50MB+ (vs Vercel 4.5MB)                                      │
│   ├── Streaming: Lambda Response Streaming (SSE)                            │
│   └── Region: ap-northeast-2 (Seoul)                                        │
│                                                                             │
│   Handler: lambda/analysis.ts                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Request Decode                                                   │   │
│   │    ├── Base64 decode (isBase64Encoded)                              │   │
│   │    ├── Gzip detect (magic bytes: 0x1f 0x8b)                         │   │
│   │    └── gunzipSync() → JSON parse                                    │   │
│   │                                                                     │   │
│   │ 2. Session Parsing                                                  │   │
│   │    ├── JSONL 라인별 파싱                                             │   │
│   │    ├── user/assistant 메시지 추출                                    │   │
│   │    └── tool_use/tool_result 매핑                                    │   │
│   │                                                                     │   │
│   │ 3. LLM Analysis (Gemini 3 Flash)                                    │   │
│   │    ├── Stage 1: Data Analyst (행동 패턴 추출)                        │   │
│   │    └── Stage 2: Content Writer (개인화 내러티브 생성)                 │   │
│   │                                                                     │   │
│   │ 4. Result Storage                                                   │   │
│   │    └── Supabase: analysis_results 테이블                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   SSE Response Stream:                                                      │
│   ├── data: {"type":"progress","stage":"parsing","progress":10,...}         │
│   ├── data: {"type":"progress","stage":"analyzing","progress":40,...}       │
│   ├── data: {"type":"progress","stage":"storing","progress":90,...}         │
│   └── data: {"type":"result","data":{resultId,primaryType,...}}             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ SSE Stream (text/event-stream)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     3. Desktop App Response Handling                        │
│                                                                             │
│   src/lib/api.ts:                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ SSE 스트림 처리:                                                     │   │
│   │ ├── progress 이벤트 → UI 진행률 표시                                 │   │
│   │ ├── result 이벤트 → 최종 결과 반환                                    │   │
│   │ └── error 이벤트 → 에러 throw                                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Desktop App UI:                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ ✓ Parsing 5 session(s)...                                           │   │
│   │ ✓ Analyzing behavioral patterns...                                  │   │
│   │ ✓ Generating personalized insights...                               │   │
│   │ ✓ Analysis complete!                                                │   │
│   │                                                                     │   │
│   │ 🎯 Your AI Coding Style: Architect (78%)                            │   │
│   │                                                                     │   │
│   │ [View Full Report] [Share Online]                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ Display Report in Desktop App
                                │ (or share via Web URL)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       4. Report Display                                     │
│                                                                             │
│   Desktop App (Primary):                                                    │
│   ├── src/app/r/[resultId]/page.tsx (embedded in Electron)                 │
│   ├── Supabase: analysis_results 테이블에서 evaluation 조회                  │
│   ├── React Component: 데이터 fetch 및 렌더링                                │
│   └── Native UI: 터미널 스타일 인터랙티브 리포트                              │
│                                                                             │
│   Web App (Sharing):                                                        │
│   ├── Route: /r/[resultId]                                                  │
│   ├── Supabase: analysis_results 테이블에서 evaluation 조회                  │
│   ├── Server Component: 데이터 fetch 및 렌더링                               │
│   └── Public sharing via URL                                                │
│                                                                             │
│   Features:                                                                 │
│   ├── 스냅 스크롤 네비게이션 (j/k 키)                                        │
│   ├── 6개 차원 상세 분석                                                    │
│   ├── 개인화된 인사이트 및 추천                                              │
│   └── SNS 공유 (OG 이미지 자동 생성)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Flow

### Lambda 배포 (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions: deploy-lambda.yml                        │
│                                                                             │
│   Trigger:                                                                  │
│   ├── push to main                                                          │
│   │   └── paths: lambda/**, infra/**, sst.config.ts, src/lib/**            │
│   └── workflow_dispatch (수동)                                              │
│                                                                             │
│   Steps:                                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Checkout & Setup                                                 │   │
│   │    ├── actions/checkout@v4                                          │   │
│   │    ├── actions/setup-node@v4 (Node 20)                              │   │
│   │    └── npm ci                                                       │   │
│   │                                                                     │   │
│   │ 2. AWS Credentials                                                  │   │
│   │    └── aws-actions/configure-aws-credentials@v4                     │   │
│   │        ├── AWS_ACCESS_KEY_ID                                        │   │
│   │        ├── AWS_SECRET_ACCESS_KEY                                    │   │
│   │        └── region: ap-northeast-2                                   │   │
│   │                                                                     │   │
│   │ 3. Clear System Pulumi                                              │   │
│   │    └── SST 내장 버전 사용을 위해 시스템 Pulumi 제거                   │   │
│   │                                                                     │   │
│   │ 4. Deploy with SST                                                  │   │
│   │    ├── npx sst deploy --stage production                            │   │
│   │    └── Output: apiUrl 추출                                          │   │
│   │                                                                     │   │
│   │ 5. Add Public Invoke Permission                                     │   │
│   │    └── aws lambda add-permission                                    │   │
│   │        ├── --action lambda:InvokeFunction                           │   │
│   │        └── --principal "*"                                          │   │
│   │        (AWS 2025 정책: InvokeFunctionUrl + InvokeFunction 필요)      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Required Secrets:                                                         │
│   ├── AWS_ACCESS_KEY_ID                                                     │
│   ├── AWS_SECRET_ACCESS_KEY                                                 │
│   ├── NEXT_PUBLIC_SUPABASE_URL                                              │
│   └── SUPABASE_SERVICE_ROLE_KEY                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vercel 배포 (자동)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Vercel Auto-Deploy                                  │
│                                                                             │
│   Trigger: push to main (모든 변경)                                         │
│                                                                             │
│   Process:                                                                  │
│   ├── next build                                                            │
│   └── Edge Network 배포                                                     │
│                                                                             │
│   Key Config (next.config.ts):                                              │
│   ├── serverExternalPackages: ['@anthropic-ai/sdk', '@google/genai']        │
│   └── experimental.serverActions.bodySizeLimit: '50mb'                      │
│                                                                             │
│   Note: Desktop App은 Lambda를 직접 호출하므로 Vercel rewrite 불필요            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Payload Truncation Strategy

Desktop App이 25MB 제한을 초과할 경우 자동으로 페이로드를 줄입니다:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Payload Truncation (src/lib/api.ts)                     │
│                                                                             │
│   Step 1: 전체 페이로드 시도                                                 │
│   ├── 모든 세션 포함                                                        │
│   ├── gzip 압축                                                             │
│   └── 25MB 이하면 성공 → 전송                                               │
│                                                                             │
│   Step 2: 세션 내용 Truncation                                              │
│   ├── 각 세션 content를 150,000자로 제한                                    │
│   ├── 최신 메시지 우선 보존 (끝에서부터)                                     │
│   └── 25MB 이하면 성공 → 전송 (truncated: true)                             │
│                                                                             │
│   Step 3: 세션 제거                                                         │
│   ├── 가장 오래된 세션부터 제거                                              │
│   ├── 최소 1개 세션 유지                                                    │
│   └── 25MB 이하가 될 때까지 반복                                            │
│                                                                             │
│   진행률 알림:                                                               │
│   └── onProgress('preparing', 0, 'Large payload detected. Truncated...')    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SSE (Server-Sent Events) Protocol

Lambda와 Desktop App 간의 실시간 통신:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SSE Event Types                                     │
│                                                                             │
│   Progress Event:                                                           │
│   {                                                                         │
│     "type": "progress",                                                     │
│     "stage": "parsing" | "analyzing" | "storing" | "complete",              │
│     "progress": 0-100,                                                      │
│     "message": "Parsing 5 session(s)..."                                    │
│   }                                                                         │
│                                                                             │
│   Result Event:                                                             │
│   {                                                                         │
│     "type": "result",                                                       │
│     "data": {                                                               │
│       "resultId": "abc123",                                                 │
│       "primaryType": "architect",                                           │
│       "controlLevel": "proficient",                                         │
│       "distribution": { "architect": 78, "scientist": 12, ... },            │
│       "personalitySummary": "..."                                           │
│     }                                                                       │
│   }                                                                         │
│                                                                             │
│   Error Event:                                                              │
│   {                                                                         │
│     "type": "error",                                                        │
│     "code": "NO_API_KEY" | "INVALID_JSON" | "ANALYSIS_FAILED",              │
│     "message": "Error description"                                          │
│   }                                                                         │
│                                                                             │
│   Wire Format (text/event-stream):                                          │
│   data: {"type":"progress","stage":"parsing","progress":10,...}             │
│   <blank line>                                                              │
│   data: {"type":"progress","stage":"analyzing","progress":40,...}           │
│   <blank line>                                                              │
│   ...                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| **Desktop Main** | `electron/main.ts` | Electron 메인 프로세스 |
| **Scanner** | `src/lib/parser/project-scanner.ts` | 세션 디렉토리 스캔 |
| **API Client** | `src/lib/api.ts` | Lambda 통신, SSE 처리 |
| **Lambda Handler** | `lambda/analysis.ts` | Lambda 핸들러 (스트리밍) |
| **SST Config** | `sst.config.ts` | SST 앱 설정 |
| **Lambda Infra** | `infra/api.ts` | Lambda 함수 정의 |
| **Next Config** | `next.config.ts` | Next.js 설정 |
| **Deploy Workflow** | `.github/workflows/deploy-lambda.yml` | Lambda CI/CD |

---

## Environment Variables

### Lambda (SST)
| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub Secret | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secret | Supabase 서버 키 |

### Vercel
| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Dashboard | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel Dashboard | Supabase 클라이언트 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Dashboard | Supabase 서버 키 |
| `GOOGLE_GEMINI_API_KEY` | Vercel Dashboard | Gemini API (폴백용) |

### Desktop App
| Variable | Source | Purpose |
|----------|--------|---------|
| `NOSLOP_API_URL` | App Settings (선택) | 커스텀 Lambda URL (기본: Lambda Function URL) |
| `GOOGLE_GEMINI_API_KEY` | App Settings | Gemini API 키 (UI에서 입력) |

---

## Troubleshooting

### Lambda 403 Forbidden
```bash
# AWS 2025 정책: lambda:InvokeFunction 권한 필요
aws lambda add-permission \
  --function-name nomoreaislop-production-AnalysisFunction-xxx \
  --statement-id AllowPublicInvoke \
  --action lambda:InvokeFunction \
  --principal "*"
```

### E2E 테스트
```bash
# 1. Lambda 직접 호출 (Desktop App이 사용하는 URL)
curl -I https://xxx.lambda-url.ap-northeast-2.on.aws/

# 2. Desktop App 전체 흐름
npm run dev  # Starts desktop app in development mode
```
