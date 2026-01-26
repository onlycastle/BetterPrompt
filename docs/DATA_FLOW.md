# NoMoreAISlop - Data Flow

> Version: 3.0.0 | Last Updated: 2026-01-26

## Overview

NoMoreAISlop uses a **web-first architecture with Lambda analysis backend**:
- **Next.js Web App (Vercel)**: Primary user interface (session upload, report display)
- **AWS Lambda (SST)**: Heavy analysis processing (4-phase pipeline)
- **Claude Code Plugin**: Alternative session data source (direct file access)
- **Supabase**: Database for analysis results and reports

---

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   1. Client (Web App / Claude Code Plugin)                  │
│                                                                             │
│   ~/.claude/projects/                                                       │
│   └── -Users-name-project/                                                  │
│       └── sessions/                                                         │
│           ├── abc123.jsonl     ←── Claude Code session logs                 │
│           ├── def456.jsonl                                                  │
│           └── ...                                                           │
│                                                                             │
│   [Session Upload] → [JSONL Parsing] → [gzip compress] → [HTTP POST]       │
│                                                                             │
│   Headers:                                                                  │
│   ├── Content-Type: application/octet-stream                                │
│   ├── X-Content-Encoding: gzip                                              │
│   └── X-Gemini-API-Key: <user_key>  (user's Gemini API key)                │
│                                                                             │
│   Payload: gzip(JSON { sessions[], totalMessages, totalDurationMinutes })   │
│   Limit: 25MB (after compression) - bypasses Vercel limit via direct Lambda call │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ POST https://xxx.lambda-url.ap-northeast-2.on.aws
                                │ (Direct Lambda Function URL invocation)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       2. AWS Lambda (SST v3)                                │
│                                                                             │
│   Specifications:                                                           │
│   ├── Runtime: Node.js 20.x                                                 │
│   ├── Timeout: 15 minutes (vs Vercel 5min)                                  │
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
│   │    ├── Line-by-line JSONL parsing                                   │   │
│   │    ├── user/assistant message extraction                            │   │
│   │    └── tool_use/tool_result mapping                                 │   │
│   │                                                                     │   │
│   │ 3. 4-Phase Analysis Pipeline (Gemini 3 Flash)                       │   │
│   │    ├── Phase 1: DataExtractor (deterministic extraction, no LLM)    │   │
│   │    ├── Phase 2: 5 insight workers (parallel LLM analysis)           │   │
│   │    │   ├── ContextEfficiencyWorker                                  │   │
│   │    │   ├── KnowledgeGapWorker                                       │   │
│   │    │   ├── TrustVerificationWorker                                  │   │
│   │    │   ├── WorkflowHabitWorker                                      │   │
│   │    │   └── WowAgentWorker                                           │   │
│   │    ├── Phase 2.5: TypeClassifier (LLM synthesis)                    │   │
│   │    └── Phase 3: ContentWriter (personalized narrative generation)   │   │
│   │                                                                     │   │
│   │ 4. Result Storage                                                   │   │
│   │    └── Supabase: analysis_results table                             │   │
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
│                        3. Client Response Handling                          │
│                                                                             │
│   src/lib/api.ts:                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ SSE Stream Processing:                                               │   │
│   │ ├── progress event → UI progress display                            │   │
│   │ ├── result event → return final result                              │   │
│   │ └── error event → throw error                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Web App UI:                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ ✓ Parsing 5 session(s)...                                           │   │
│   │ ✓ Phase 1: Extracting data...                                       │   │
│   │ ✓ Phase 2: Analyzing insights (5 workers)...                        │   │
│   │ ✓ Phase 2.5: Classifying coding type...                             │   │
│   │ ✓ Phase 3: Generating personalized narrative...                     │   │
│   │ ✓ Analysis complete!                                                │   │
│   │                                                                     │   │
│   │ 🎯 Your AI Coding Style: Architect (78%)                            │   │
│   │                                                                     │   │
│   │ [View Full Report] [Share Online]                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ Display Report in Web App
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       4. Report Display                                     │
│                                                                             │
│   Web App (Primary):                                                        │
│   ├── Route: /r/[resultId]                                                  │
│   ├── Supabase: query evaluation from analysis_results table               │
│   ├── Server Component: data fetch and rendering                           │
│   ├── Public sharing via URL                                                │
│   └── Responsive UI: terminal-style interactive report                     │
│                                                                             │
│   Features:                                                                 │
│   ├── Snap scroll navigation (j/k keys)                                     │
│   ├── 6 dimension detailed analysis                                         │
│   ├── Personalized insights and recommendations                            │
│   └── Social sharing (auto-generated OG images)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Flow

### Lambda Deployment (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions: deploy-lambda.yml                        │
│                                                                             │
│   Trigger:                                                                  │
│   ├── push to main                                                          │
│   │   └── paths: lambda/**, infra/**, sst.config.ts, src/lib/**            │
│   └── workflow_dispatch (manual)                                            │
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
│   │    └── Remove system Pulumi to use SST's built-in version           │   │
│   │                                                                     │   │
│   │ 4. Deploy with SST                                                  │   │
│   │    ├── npx sst deploy --stage production                            │   │
│   │    └── Output: extract apiUrl                                       │   │
│   │                                                                     │   │
│   │ 5. Add Public Invoke Permission                                     │   │
│   │    └── aws lambda add-permission                                    │   │
│   │        ├── --action lambda:InvokeFunction                           │   │
│   │        └── --principal "*"                                          │   │
│   │        (AWS 2025 policy: InvokeFunctionUrl + InvokeFunction required) │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Required Secrets:                                                         │
│   ├── AWS_ACCESS_KEY_ID                                                     │
│   ├── AWS_SECRET_ACCESS_KEY                                                 │
│   ├── NEXT_PUBLIC_SUPABASE_URL                                              │
│   └── SUPABASE_SERVICE_ROLE_KEY                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vercel Deployment (Auto)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Vercel Auto-Deploy                                  │
│                                                                             │
│   Trigger: push to main (all changes)                                       │
│                                                                             │
│   Process:                                                                  │
│   ├── next build                                                            │
│   └── Edge Network deployment                                               │
│                                                                             │
│   Key Config (next.config.ts):                                              │
│   ├── serverExternalPackages: ['@anthropic-ai/sdk', '@google/genai']        │
│   └── experimental.serverActions.bodySizeLimit: '50mb'                      │
│                                                                             │
│   Note: Client calls Lambda directly, so Vercel rewrite not needed          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Payload Truncation Strategy

When client exceeds 25MB limit, payload is automatically reduced:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Payload Truncation (src/lib/api.ts)                     │
│                                                                             │
│   Step 1: Try full payload                                                  │
│   ├── Include all sessions                                                  │
│   ├── gzip compress                                                         │
│   └── If under 25MB → success → send                                        │
│                                                                             │
│   Step 2: Session content truncation                                        │
│   ├── Limit each session content to 150,000 characters                      │
│   ├── Preserve most recent messages (from end)                              │
│   └── If under 25MB → success → send (truncated: true)                      │
│                                                                             │
│   Step 3: Session removal                                                   │
│   ├── Remove oldest sessions first                                          │
│   ├── Keep minimum 1 session                                                │
│   └── Repeat until under 25MB                                               │
│                                                                             │
│   Progress notification:                                                    │
│   └── onProgress('preparing', 0, 'Large payload detected. Truncated...')    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SSE (Server-Sent Events) Protocol

Real-time communication between Lambda and client:

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
| **API Client** | `src/lib/api.ts` | Lambda communication, SSE handling |
| **Lambda Handler** | `lambda/analysis.ts` | Lambda handler (streaming) |
| **Analysis Orchestrator** | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | 4-phase pipeline coordinator |
| **Phase 1 Worker** | `src/lib/analyzer/workers/data-extractor-worker.ts` | Deterministic data extraction |
| **Phase 2 Workers** | `src/lib/analyzer/workers/*.ts` | 5 insight workers (parallel) |
| **Phase 2.5 Worker** | `src/lib/analyzer/workers/type-classifier-worker.ts` | Coding type classification |
| **Phase 3 Stage** | `src/lib/analyzer/stages/content-writer.ts` | Narrative generation |
| **SST Config** | `sst.config.ts` | SST app configuration |
| **Lambda Infra** | `infra/api.ts` | Lambda function definition |
| **Next Config** | `next.config.ts` | Next.js configuration |
| **Deploy Workflow** | `.github/workflows/deploy-lambda.yml` | Lambda CI/CD |

---

## Environment Variables

### Lambda (SST)
| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub Secret | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secret | Supabase server key |

### Vercel (Next.js Web App)
| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Dashboard | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel Dashboard | Supabase client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Dashboard | Supabase server key |
| `GOOGLE_GEMINI_API_KEY` | Vercel Dashboard | Gemini API (optional) |

### Client (User-Provided)
| Variable | Source | Purpose |
|----------|--------|---------|
| `X-Gemini-API-Key` | HTTP Header | User's Gemini API key (sent with analysis request) |

---

## Troubleshooting

### Lambda 403 Forbidden
```bash
# AWS 2025 policy: lambda:InvokeFunction permission required
aws lambda add-permission \
  --function-name nomoreaislop-production-AnalysisFunction-xxx \
  --statement-id AllowPublicInvoke \
  --action lambda:InvokeFunction \
  --principal "*"
```

### E2E Testing
```bash
# 1. Direct Lambda invocation
curl -I https://xxx.lambda-url.ap-northeast-2.on.aws/

# 2. Web app full flow
npm run dev  # Starts Next.js dev server (port 3000)

# 3. Run test suite
npm test
```
