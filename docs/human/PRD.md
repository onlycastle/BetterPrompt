# PRD: NoMoreAISlop - AI Coding Capability Assessment Platform

> **Version:** 2.0.0 | **Status:** Active Development | **Last Updated:** 2026-02-02

---

## 1. Executive Summary

**"AI is a multiplier. But only if you're still thinking."**

NoMoreAISlop is the world's first data-driven AI coding capability assessment platform. By analyzing real developer-AI collaboration sessions from tools like Claude Code and Cursor, we provide personalized insights into how developers work with AI.

| For Developers | For Organizations |
|----------------|-------------------|
| Understand your unique AI collaboration style | Assess team AI readiness at scale |
| Get personalized growth recommendations | Identify training needs objectively |
| Track skill development over time | Benchmark against industry standards |

**Key Differentiators:**
1. **Data-Driven**: Analyzes actual session logs, not self-reported surveys
2. **15-Type Personality System**: 5 coding styles x 3 AI control levels
3. **6-Dimension Deep Analysis**: Comprehensive evaluation beyond surface metrics
4. **Privacy-First**: Session data processed in real-time, not stored

---

## 2. Problem Statement

**The AI Coding Crisis:**
- **70% of developers** now use AI assistants daily (GitHub, 2025)
- **But only 15%** can articulate their AI collaboration strategy
- **43%** report decreased confidence in their independent coding abilities

**The "Vibe Coding" Problem:**
1. **Over-Reliance**: Accepting AI output without verification
2. **Under-Utilization**: Treating AI as a search engine, missing productivity multipliers

**The Assessment Gap:**

| Approach | Problem |
|----------|---------|
| Self-assessment surveys | Subjective, inaccurate |
| Code review metrics | Doesn't capture AI interaction |
| Manager observation | Not scalable, biased |

**NoMoreAISlop fills this gap** by analyzing the actual conversation between developer and AI.

---

## 3. Target Customers

> **Core Message**: "당신은 AI를 사용하고 있나요, 아니면 AI에 사용당하고 있나요?"

**Phase 1** (0-6mo): Senior Developers (5yr+) → **Phase 2** (6-12mo): Tech Leads / Engineering Managers

### Primary Persona: "민수 (Min-su), The Reflective Senior"
- Backend/Fullstack developer (5-10 years), uses Claude Code or Cursor daily

**Pain Points:**

| Pain Point | Description |
|------------|-------------|
| "빨라졌는데 성장했나?" | AI productivity vs skill growth dilemma |
| "후배들에게 뭘 알려줘야 하지?" | Mentoring direction in AI era |
| "나만 이런 생각하나?" | Isolation of skill decay anxiety |
| "검증할 방법이 없음" | No objective AI utilization measurement |

> Evidence: See [PRD References](/docs/PRD_REFERENCES.md)

**Why Senior Developers First:** Highest pain intensity, buying power, influence (top-down viral), B2B bridge (seniors → managers)

---

## 4. Product Goals & Success Metrics

**North Star**: Monthly Active Analyses (MAA)

| Stage | Timeline | Key Targets |
|-------|----------|-------------|
| Launch | Month 1 | 1K analyses, 20% share rate, <1% error rate |
| Traction | Month 3 | 10K MAA, 30% share rate, 3% paid conversion |
| Scale | Month 12 | 100K MAA, $50K MRR, 20 enterprise customers |

**Quality Targets:** >85% type accuracy, >4.5/5 report rating, >99% reliability, <60s response

---

## 5. Core Features

### 5.1 Multi-Source Session Analysis
**Sources:** Claude Code, Cursor
**Pipeline:** Session Discovery → Parsing → Data Extraction → Insight Generation → Type Classification → Content Writing → Translation

### 5.2 15-Type Personality Classification
**5 Styles:** Architect, Analyst, Conductor, Speedrunner, Trendsetter
**3 Control Levels:** Explorer (0-34), Navigator (35-64), Cartographer (65-100)

### 5.3 6-Dimension Deep Analysis

| Dimension | What It Measures |
|-----------|------------------|
| AI Collaboration Mastery | Context provision quality |
| Context Engineering | WRITE-SELECT-COMPRESS-ISOLATE strategies |
| Burnout Risk | Work pattern indicators |
| Tool Mastery | Tool usage effectiveness |
| AI Control Index | Strategic control vs vibing |
| Skill Resilience | Independent coding ability |

### 5.4 Tier System

| Tier | Price | Features |
|------|-------|----------|
| FREE | $0 | 3/month, basic report (2 dimensions) |
| ONE_TIME | $9.99 | Unlimited, full report (6 dimensions) |
| PRO | $19/mo | + Progress tracking, comparison, API |
| ENTERPRISE | Custom | + Team management, custom KB, SSO |

---

## 6. User Journey

**Key Moments:**
1. **Discovery**: "What's my AI coding personality?" (viral hook)
2. **Aha Moment**: Seeing actual patterns with evidence
3. **Share Trigger**: Personality result + OG image
4. **Upgrade Trigger**: Wanting locked dimensions

**B2C → B2B Path:** Individual Discovery → Viral Sharing → Team Adoption → Enterprise Contract

---

## 7. Technical Architecture

```
Presentation: Next.js (Vercel) │ Claude Code Plugin
                    ↓
Processing: AWS Lambda (SST v3) - Seoul Region (15min, 1024MB, 50MB)
                    ↓
Pipeline: Phase 1 (Extract) → Phase 2 (5 Workers) → Phase 2.5 (Type) → Phase 3 (Content) → Phase 4 (Translate)
                    ↓
Data: Supabase (PostgreSQL)
```

| Phase | LLM Calls | Purpose |
|-------|-----------|---------|
| 1 | 0 | Deterministic data extraction |
| 2 | 5 | Parallel insight workers |
| 2.5 | 1 | Type classification |
| 3 | 1 | Personalized narrative |
| 4 | 0-1 | Translation (non-English) |

**Model:** Gemini 3 Flash | **Cost:** ~$0.02-0.08/analysis

**Key Decisions:** No Fallback Policy (errors surface), SSE Streaming, Lambda + Vercel separation

---

## 8. Appendix

**Glossary:** MAA (Monthly Active Analyses), Session (conversation log), Type (15 personalities), Dimension (6 evaluation areas), Worker (LLM analysis agent)

**Related Documents:**
- [Architecture](/docs/ARCHITECTURE.md) | [Data Flow](/docs/DATA_FLOW.md) | [LLM Flow](/docs/LLM_FLOW.md)
- [PRD References (Market Validation)](/docs/PRD_REFERENCES.md)

---

*This PRD is a living document. For market validation sources, see [PRD References](/docs/PRD_REFERENCES.md).*
