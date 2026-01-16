# Next.js Migration Plan: NoMoreAISlop

## Overview

**Goal**: Migrate the current Express API + Vite React SPA to a unified Next.js 15 App Router application for Vercel deployment.

**Strategy**: Full rewrite with aggressive RSC adoption and streaming for LLM responses.

---

## Requirements Summary

| Decision | Choice |
|----------|--------|
| Migration Strategy | Full rewrite |
| RSC Utilization | Active (maximize server components) |
| Priority | Fast deployment |
| Scope | Complete (8 pages + 30+ API endpoints) |
| LLM Handling | Streaming responses |
| Directory Structure | Root transformation |
| Shared Code | Reorganize to src/lib/ |

---

## Acceptance Criteria

- [ ] All 8 pages functional in Next.js App Router
- [ ] All 30+ API endpoints converted to Next.js API Routes
- [ ] LLM analysis endpoint uses streaming (no timeout issues)
- [ ] Vercel deployment successful with all features working
- [ ] CLI package (`packages/cli/`) remains independent and functional
- [ ] Supabase authentication working
- [ ] All CSS Module styles preserved
- [ ] SEO-critical pages render as RSC (PublicResultPage, ReportPage)

---

## Phase 1: Project Setup & Structure (Foundation)

### 1.1 Initialize Next.js in Project Root

**Files to create:**
- `next.config.ts` - Next.js configuration
- `app/layout.tsx` - Root layout with providers
- `app/page.tsx` - Home page (redirect to /personal)
- `middleware.ts` - Edge middleware (if needed)

**Commands:**
```bash
# Install Next.js dependencies
npm install next@15 react@19 react-dom@19

# Install Next.js specific packages
npm install @next/env

# Remove Vite-specific deps (after migration complete)
```

**Configuration (`next.config.ts`):**
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', '@google/genai'],
  },
  serverExternalPackages: ['@anthropic-ai/sdk', '@google/genai'],
  images: {
    domains: [],
  },
};

export default nextConfig;
```

### 1.2 Reorganize Source Directory Structure

**Current → New mapping:**

```
CURRENT                          NEW (Next.js)
-------                          -------------
src/api/                    →    app/api/
src/api/routes/*.ts         →    app/api/[route]/route.ts
src/api/services/           →    src/lib/services/
src/analyzer/               →    src/lib/analyzer/
src/models/                 →    src/lib/models/
src/parser/                 →    src/lib/parser/
src/search-agent/           →    src/lib/search-agent/
src/infrastructure/         →    src/lib/infrastructure/
src/lib/                    →    src/lib/shared/
web-ui/src/components/      →    src/components/
web-ui/src/hooks/           →    src/hooks/
web-ui/src/styles/          →    src/styles/
web-ui/src/contexts/        →    src/contexts/
web-ui/src/api/client.ts    →    src/lib/api-client.ts
```

### 1.3 Update Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

### 1.4 Environment Variables

**Rename for Next.js:**
```
VITE_SUPABASE_URL          →    NEXT_PUBLIC_SUPABASE_URL
VITE_SUPABASE_ANON_KEY     →    NEXT_PUBLIC_SUPABASE_ANON_KEY
GOOGLE_GEMINI_API_KEY      →    (unchanged, server-only)
ANTHROPIC_API_KEY          →    (unchanged, server-only)
```

---

## Phase 2: API Routes Migration

### 2.1 API Route Structure

**Target structure:**
```
app/api/
├── health/route.ts
├── analysis/
│   ├── remote/route.ts          # POST with streaming (CRITICAL)
│   └── results/[resultId]/route.ts
├── reports/
│   ├── route.ts                 # POST /api/reports/share
│   ├── [reportId]/
│   │   ├── route.ts             # GET, DELETE
│   │   ├── share/route.ts       # POST share action
│   │   └── og-image/route.ts    # GET OG image
│   └── comparison/
│       ├── features/route.ts
│       └── [reportId]/route.ts
├── knowledge/
│   ├── route.ts                 # GET list
│   ├── stats/route.ts
│   ├── metrics/route.ts
│   └── [id]/route.ts            # GET, DELETE
├── learn/
│   ├── youtube/route.ts
│   ├── url/route.ts
│   └── status/[id]/route.ts
├── influencers/
│   ├── route.ts                 # GET, POST
│   ├── active/route.ts
│   ├── tier/[tier]/route.ts
│   └── [id]/
│       ├── route.ts             # GET, PATCH, DELETE
│       └── deactivate/route.ts
└── enterprise/
    ├── team/demo/
    │   ├── route.ts             # GET analytics
    │   ├── members/route.ts
    │   └── trends/route.ts
    └── personal/
        ├── tracking/route.ts
        └── history/route.ts
```

### 2.2 Body Size Configuration (CRITICAL)

**Current Express config:** `express.json({ limit: '50mb' })`
**Next.js default:** 4MB

**Add to `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  // ... other config
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};
```

**For API routes, add to each route needing large payloads:**
```typescript
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
```

### 2.3 Express → Next.js Route Handler Pattern

**Before (Express):**
```typescript
router.get('/', async (req, res) => {
  try {
    const result = await service.list();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**After (Next.js):**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const result = await service.list();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### 2.4 Streaming LLM Response (Critical)

**File: `app/api/analysis/remote/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { streamingAnalysis } from '@/lib/services/streaming-analysis';

export const maxDuration = 60; // Vercel Pro allows up to 60s

export async function POST(request: NextRequest) {
  const body = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send progress updates
      const sendProgress = (stage: string, progress: number) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'progress', stage, progress })}\n\n`
        ));
      };

      try {
        sendProgress('parsing', 10);
        // Parse sessions...

        sendProgress('analyzing', 30);
        // Run Stage 1: Data Analyst

        sendProgress('writing', 60);
        // Run Stage 2: Content Writer

        sendProgress('complete', 100);
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'result', data: result })}\n\n`
        ));
      } catch (error) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## Phase 3: Page Components Migration

### 3.1 App Router Structure

```
app/
├── layout.tsx              # Root layout (RSC)
├── page.tsx                # Home → redirect to /personal
├── personal/
│   └── page.tsx            # PersonalDashboardPage (Client)
├── report/
│   └── [reportId]/
│       └── page.tsx        # ReportPage (RSC + Client hybrid)
├── r/
│   └── [resultId]/
│       └── page.tsx        # PublicResultPage (RSC for SEO)
├── comparison/
│   ├── page.tsx            # ComparisonPage
│   └── [reportId]/
│       └── page.tsx
├── enterprise/
│   └── page.tsx            # EnterpriseDashboardPage (Client)
├── browse/
│   └── page.tsx            # BrowsePage
├── learn/
│   └── page.tsx            # LearnPage
└── dashboard/
    └── page.tsx            # DashboardPage
```

### 3.2 RSC vs Client Component Strategy

| Page | Type | Reason |
|------|------|--------|
| `PublicResultPage` | **RSC** | SEO critical, shareable |
| `ReportPage` | **Hybrid** | SSR head, client interactive |
| `PersonalDashboardPage` | **Client** | Auth-gated, heavy interactivity |
| `EnterpriseDashboardPage` | **Client** | Auth-gated, charts |
| `ComparisonPage` | **Client** | Dynamic data |
| `BrowsePage` | **Hybrid** | List can be SSR |
| `LearnPage` | **Client** | Form submission |
| `DashboardPage` | **Client** | Analytics |

### 3.3 Root Layout Structure

**File: `app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import '@/styles/global.css';
import '@/styles/variables.css';

export const metadata: Metadata = {
  title: 'NoMoreAISlop - AI Coding Style Analysis',
  description: 'Analyze your AI-assisted coding style',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

**File: `src/components/providers.tsx`**

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### 3.4 Page Migration Pattern

**RSC Page (PublicResultPage):**
```typescript
// app/r/[resultId]/page.tsx
import { loadRemoteResult } from '@/lib/services/remote-analysis';
import { PublicResultView } from './PublicResultView';

export async function generateMetadata({ params }) {
  const result = await loadRemoteResult(params.resultId);
  return {
    title: `${result?.evaluation.codingStyle.primaryType} - NoMoreAISlop`,
    openGraph: { /* ... */ },
  };
}

export default async function PublicResultPage({ params }) {
  const result = await loadRemoteResult(params.resultId);

  if (!result) {
    notFound();
  }

  return <PublicResultView result={result} />;
}
```

**Client Page:**
```typescript
// app/personal/page.tsx
'use client';

import { PersonalDashboardPage } from '@/components/pages/PersonalDashboardPage';

export default function Personal() {
  return <PersonalDashboardPage />;
}
```

---

## Phase 4: Components & Styling

### 4.1 Component Migration

**Move and update imports:**
```
web-ui/src/components/ → src/components/
```

**Add 'use client' directive to interactive components:**
- All components using `useState`, `useEffect`
- Components with event handlers
- Components using browser APIs

### 4.2 CSS Modules (No Changes Needed)

CSS Modules work natively in Next.js. Just move files:
```
web-ui/src/components/Button.module.css → src/components/ui/Button.module.css
```

### 4.3 Font Configuration

**Replace @fontsource with next/font:**

```typescript
// src/lib/fonts.ts
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  weight: ['400', '500', '600', '700'],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});
```

**Update layout:**
```typescript
<body className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
```

---

## Phase 5: Authentication & Supabase

### 5.1 Supabase SSR Setup

**Install:**
```bash
npm install @supabase/ssr
```

**Server Client (`src/lib/supabase/server.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

**Browser Client (`src/lib/supabase/client.ts`):**
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## Phase 6: CLI Package Updates

### 6.1 Update API Base URL

**File: `packages/cli/src/uploader.ts`**

Update to use production Vercel URL or configurable base:

```typescript
const API_BASE = process.env.NOSLOP_API_URL || 'https://nomoreaislop.vercel.app';
```

### 6.2 Handle Streaming Response

Update CLI to handle SSE streaming:

```typescript
async function analyzeWithStreaming(data: SessionData): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/analysis/remote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'progress') {
          updateSpinner(event.stage, event.progress);
        } else if (event.type === 'result') {
          return event.data;
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
    }
  }
}
```

---

## Phase 7: Cleanup & Deployment

### 7.1 Files to Delete

After successful migration:
```
web-ui/                     # Entire directory
src/api/                    # Moved to app/api/
vite.config.ts              # Vite config (in web-ui)
```

### 7.2 Files to Update

- `package.json` - Remove Vite deps, update scripts
- `tsconfig.json` - Update for Next.js paths
- `.gitignore` - Add `.next/`
- `vercel.json` - Configure if needed

### 7.3 Vercel Configuration

**`vercel.json` (if needed):**
```json
{
  "functions": {
    "app/api/analysis/remote/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### 7.4 Environment Variables in Vercel

Set in Vercel Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `GOOGLE_GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

---

## Implementation Order

### Day 1: Foundation
1. [ ] Initialize Next.js configuration
2. [ ] Create app/layout.tsx with providers
3. [ ] Move shared code to src/lib/
4. [ ] Update environment variables

### Day 2: API Routes
5. [ ] Migrate health endpoint
6. [ ] Migrate knowledge routes
7. [ ] Migrate learn routes
8. [ ] Migrate influencer routes
9. [ ] Migrate reports routes
10. [ ] Migrate enterprise routes
11. [ ] Migrate analysis routes (with streaming)

### Day 3: Pages & Components
12. [ ] Move components to src/components/
13. [ ] Add 'use client' directives
14. [ ] Create page routes in app/
15. [ ] Configure fonts with next/font
16. [ ] Update Supabase for SSR

### Day 4: Testing & Deployment
17. [ ] Test all API endpoints
18. [ ] Test all pages
19. [ ] Update CLI for streaming
20. [ ] Deploy to Vercel
21. [ ] Verify production
22. [ ] Clean up old files

---

## Risk Assessment (Updated with Metis Analysis)

### Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Vercel function timeout** | HIGH | BLOCKING | Streaming required OR Pro plan (60s limit) |
| **50MB body size limit** | CERTAIN | HIGH | Next.js default is 4MB. Must configure `bodyParser` |
| **CLI response contract** | HIGH | HIGH | CLI expects specific JSON shape. Streaming must preserve `AnalysisResult` interface |
| **Import path breakage** | CERTAIN | MEDIUM | ALL relative imports will break. Use `@/` path aliases |
| **Supabase singleton in serverless** | HIGH | MEDIUM | Singleton pattern fails in cold starts. Use `@supabase/ssr` |
| **window.location in RSC** | HIGH | MEDIUM | AuthContext uses `window.location.origin`. Breaks in RSC |

### Moderate Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking CLI | Medium | Test thoroughly before cleanup |
| Auth issues | Medium | Test Supabase SSR carefully |
| CSS issues | Low | CSS Modules work natively |
| Build errors | Medium | Incremental testing |
| Local analysis feature | Medium | `/api/analysis/local` reads from filesystem - won't work on Vercel |

### Hidden Requirements Discovered

1. **Three Supabase client patterns**: Server singleton, web client, and new SSR pattern all need consolidation
2. **Test suite migration**: 35+ test files exist - need migration strategy
3. **OG image generation**: Must use Next.js `ImageResponse` API
4. **QueryClient hydration**: Needs adjustment for RSC patterns

---

## Pre-Migration Checklist (Phase 0)

**Must complete before any code changes:**

- [x] ~~Confirm Vercel plan tier~~ → **Free tier (10s timeout) - STREAMING IS MANDATORY**
- [ ] Set up tsconfig path aliases (`@/lib/*`, `@/components/*`)
- [ ] Create `nextjs-migration` git branch (not in main)
- [ ] Audit all `window.` / `document.` usage in codebase
- [ ] Document current CLI API response contract
- [ ] Create Supabase snapshot/backup
- [ ] Deploy empty Next.js app to Vercel staging
- [x] ~~Decide on `/api/analysis/local` feature~~ → **REMOVE COMPLETELY**

### Files to Remove (Local Analysis Feature)

```
DELETE: src/utils/local-analysis.ts
DELETE: /api/analysis/local routes in analysis.ts
UPDATE: web-ui/src/hooks/useAnalysisReport.ts (remove local mode)
UPDATE: web-ui/src/hooks/useLatestAnalysis.ts (remove local fetch)
DELETE: tests/unit/api/routes/analysis.test.ts (local tests)
```

---

## Verification Checklist

- [ ] `npm run build` succeeds
- [ ] All 8 pages load correctly
- [ ] API endpoints return expected data
- [ ] Authentication works (login/logout)
- [ ] LLM analysis completes without timeout
- [ ] CLI can submit and receive results
- [ ] OG images generate correctly
- [ ] Vercel deployment successful
- [ ] No TypeScript errors
- [ ] No console errors in browser

---

## Post-Migration Improvements (Future)

1. **ISR for public results** - Revalidate popular shared results
2. **Edge Runtime** - Move simple routes to edge for faster response
3. **Parallel Routes** - For dashboard layouts
4. **Server Actions** - Replace some API routes
5. **Streaming UI** - Progressive loading with Suspense

---

## Recommended Approach (Updated)

**Vercel Free tier confirmed → Streaming is MANDATORY (10s timeout)**

### Implementation Strategy (5-7 days)

Since streaming cannot be deferred, the implementation order is:

1. **Day 1-2**: Foundation + Streaming API
   - Initialize Next.js
   - Implement streaming `/api/analysis/remote` FIRST (critical path)
   - Update CLI to handle SSE responses

2. **Day 3-4**: Remaining API Routes + Pages
   - All other API routes (non-streaming)
   - Page components migration
   - Remove local analysis feature

3. **Day 5-6**: Testing + Auth
   - Supabase SSR setup
   - End-to-end testing
   - CLI integration testing

4. **Day 7**: Deployment + Cleanup
   - Deploy to Vercel
   - Production verification
   - Remove old files

---

*Plan created: 2026-01-16*
*Estimated effort: 5-7 days (full) or 3-4 days (MVP)*
*Primary risks: Vercel timeout limits, CLI contract preservation, 50MB body limit*
*Plan reviewed by: Metis (Pre-planning consultant)*
