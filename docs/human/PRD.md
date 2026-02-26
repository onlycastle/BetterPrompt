# PRD: BetterPrompt — AI Session Intelligence for Vibe Coders

> **Version:** 3.1.0 | **Status:** Strategic Pivot | **Updated:** February 2026 | **Target Market:** United States

---

## 1. Executive Summary

> *Your AI builds it. We tell you if you're building it right.*

**BetterPrompt** is the first AI session intelligence platform for vibe coders. We analyze real human-AI collaboration sessions from tools like Claude Code, Cursor, and Lovable to show users what they can't see: how they're actually working with AI, and how to do it better.

We are not a code linter. We are not a security scanner. We review **behavior, not code.** This makes us uniquely valuable to non-developers who can't interpret ESLint errors, but can understand "you're accepting AI output without verification 83% of the time."

| For Individuals | For Organizations |
|-----------------|-------------------|
| See how you actually work with AI | Measure team AI readiness at scale |
| Get actionable behavior feedback | Identify training gaps objectively |
| Track improvement over time | Benchmark against industry data |

**Key Differentiators:**

| Differentiator | Description |
|----------------|-------------|
| **Data-Driven** | Analyzes actual session logs, not self-reported surveys |
| **Behavior-First** | Reviews how you work with AI, not the code AI produces |
| **Non-Dev Friendly** | Feedback in plain language, not compiler errors |
| **Privacy-First** | Local scanning. Summaries sent, not raw sessions. Originals deleted. |

---

## 2. Market Opportunity

### 2.1 Why Now

In February 2025, Andrej Karpathy coined "vibe coding." One year later, the landscape has fundamentally shifted:

| Metric | Data | Source |
|--------|------|--------|
| Market Size | $2.96B (2025) → $325B (2040) | Roots Analysis, 2025 |
| US Adoption | 92% of US developers use AI tools daily | Second Talent, 2026 |
| Non-Dev Users | 63% of vibe coding users are non-developers | Second Talent, 2026 |
| Enterprise | 87% of Fortune 500 have adopted vibe coding | Market Clarity, 2025 |
| Code Quality | 45% of AI-generated code has security vulnerabilities | Veracode, 2025 |
| Debug Tax | 63% spent more time debugging AI code than writing it | Second Talent, 2026 |

### 2.2 The Gap

"Building" tools are saturated: Cursor, Copilot, Replit, Lovable, Bolt, v0. A new one launches every month. But "Am I building it right?" has zero solutions.

| Category | Examples | What They Do | What They Miss |
|----------|----------|-------------|----------------|
| Code Linters | ESLint, SonarQube | Flag code issues | Non-devs can't interpret output |
| Security Scanners | VibeGuard, Snyk | Find vulnerabilities | Code-level, not behavior-level |
| AI Readiness | Microsoft, Cisco | Org-level assessment | C-suite consulting, not individual |
| **BetterPrompt** | — | Review AI work behavior | **Only player in this space** |

**"Individual AI capability assessment"** is an empty category. The first mover defines it.

---

## 3. Ideal Customer Profile

### 3.1 Primary Persona

**Sarah** — PM, First-Time Builder — San Francisco, CA

3-year Product Manager. Started vibe coding with Cursor 6 months ago. Built her first working prototype and demo'd it to her team instead of a Figma mockup. Got standing ovation.

| | |
|---|---|
| **Tools** | Cursor, Claude Code, Lovable |
| **Experience** | 6 months of vibe coding. Non-CS background. |
| **Motivation** | *"I want to build things myself, but I need someone to tell me if I'm doing it right."* |

### 3.2 The Core Problem

> *"It works... but is it actually good?"*

When non-developers build with AI, they have zero feedback on their process. Developers have code review, pair programming, PR feedback. Vibe coders have nothing.

**The Problem Stack:**

| # | Problem | Severity | Role in Product |
|---|---------|----------|-----------------|
| 1 | Error Loop: stuck in debug cycles that never resolve | **ENTRY POINT** | The pain that drives users to find us |
| 2 | No Feedback Loop: no one reviews how they work with AI | **CORE VALUE** | The root cause that makes them stay |
| 3 | Quality Blindness: can't judge if AI output is good | High / Low awareness | Revealed through analysis |
| 4 | Security Ignorance: don't know what they don't know | Critical / Zero awareness | Revealed through analysis |
| 5 | Prototype Delusion: think "it works" = "it's done" | Medium | Long-term education |
| 6 | AI Pleaser Trap: AI always says code is fine | High | Differentiator vs asking AI |
| 7 | Learning Stagnation: getting faster but not better | High / Low awareness | Retention and repeat use |

**Strategy: "Hook with pain, hold with value"**

Users discover us when stuck in error loops (Problem #1). They stay because we're the only feedback loop for their AI collaboration habits (Problem #2). Over time, analysis reveals deeper issues (#3-#7) they didn't know they had.

### 3.3 What They Do Today

| Current Solution | Why It Fails | Our Advantage |
|------------------|-------------|---------------|
| Ask AI "is this code OK?" | AI is a pleaser, always says yes | Objective, evidence-based analysis |
| Ask a developer friend | Doesn't scale. Embarrassing. "Just rewrite it." | Non-judgmental, available 24/7 |
| Ship and pray | Works until it breaks. Then unrecoverable. | Proactive pattern detection |
| Take vibe coding courses | Generic advice, not personalized | Based on YOUR actual sessions |
| Use code linters | Non-devs can't read ESLint errors | Plain language behavior feedback |
| **Do nothing** | *Biggest competitor. Don't know they have a problem.* | Curiosity hook: "What's my BetterPrompt score?" |

---

## 4. Solution

### 4.1 Core Value Proposition

> *The missing code review for vibe coders.*

BetterPrompt analyzes your AI coding sessions and reviews how you work with AI. Not the code. Your behavior. We tell you things like:

- *"You accept AI output without verification 83% of the time. Try asking 'Is there a better approach?' before accepting."*
- *"When errors occur, you paste the error message 4x in a row. Instead, describe what you were trying to do and where it broke."*
- *"You never asked about security. 70% of similar builders request a security check before deploying."*

**This is feedback a non-developer can understand and act on.** "Line 42 has a SQL injection" means nothing to them. "You never asked about security" changes behavior.

### 4.2 Analysis Dimensions

5 parallel AI workers analyze different aspects of how users collaborate with AI:

| Dimension | What It Measures | Non-Dev Example |
|-----------|-----------------|-----------------|
| **Thinking Quality** | Do you think before asking? Verify after receiving? | *"You accepted 9/10 AI suggestions without follow-up questions"* |
| **Communication** | How clear and effective are your prompts? | *"Your prompts average 12 words. Top performers use 45+ with context."* |
| **Learning Behavior** | Are you growing, or repeating the same mistakes? | *"You've hit the same auth error pattern 3 times this month."* |
| **Context Efficiency** | Are you giving AI enough context to help you? | *"Adding project context could reduce your error rate by ~40%."* |
| **Session Outcomes** | Are your sessions productive? Do you achieve goals? | *"62% of your sessions end without completing the stated goal."* |

### 4.3 Personality System

5 AI collaboration styles x 3 control levels = 15 unique types. Each user gets a type that describes how they work with AI.

**Styles:**

| Architect | Analyst | Conductor | Speedrunner | Trendsetter |
|-----------|---------|-----------|-------------|-------------|
| Plans before prompting | Verifies everything | Orchestrates AI flow | Ships fast, iterates | Explores new patterns |

**Control Levels:**

| Explorer (0-34) | Navigator (35-64) | Cartographer (65-100) |
|------------------|--------------------|------------------------|
| Learning the ropes. High AI reliance. | Finding balance. Growing control. | Maps the territory. Strategic AI use. |

---

## 5. Business Model

### 5.1 Philosophy: "Diagnosis Free, Prescription Paid"

Free users see the problems. Paid users get the solutions. This maximizes viral sharing (everyone sees their issues) while creating a clear upgrade trigger (wanting the fix).

| | **Free** | **Starter $4.99** | **Pro $6.99/mo** | **Team** |
|---|---|---|---|---|
| **Analyses** | 3/month | Unlimited | 4 full/month | Unlimited |
| **Dimensions** | 1 of 5 | All 5 | All 5 | All 5 + custom |
| **Diagnosis** | ✓ | ✓ | ✓ | ✓ |
| **Prescription** | — | ✓ | ✓ | ✓ |
| **Security Risk Report** | — | ✓ | ✓ | ✓ |
| **Progress Tracking** | — | — | ✓ | ✓ |
| **Learning Resources** | — | — | ✓ | ✓ |
| **Team Comparison** | — | — | Up to 5 | Unlimited |
| **Team Dashboard** | — | — | — | ✓ |
| **SSO + Admin** | — | — | — | ✓ |

### 5.2 B2C → B2B Transition (W&B Model)

Like Weights & Biases, we start with individual value and grow into team/org adoption organically:

| Stage | User | Need | Product |
|-------|------|------|---------|
| **1. Individual** | Sarah (PM) | "Am I doing this right?" | Personal report |
| **2. Team** | Sarah + 3 teammates | "How does our team compare?" | Team comparison dashboard |
| **3. Org** | Head of Product | "Is our AI adoption effective?" | Organization capability report |
| **4. Enterprise** | CTO / VP Eng | "AI readiness across 500 people?" | Custom assessment + SSO + API |

**Key insight:** Same data, different views. No new product needed at each stage. Individual session analysis rolls up into team analytics, which rolls up into org metrics.

---

## 6. User Journey

| Phase | Moment | User Action | Emotional State |
|-------|--------|-------------|-----------------|
| **Discovery** | Sees shared report on Twitter/LinkedIn | "What's my score?" → runs CLI | Curiosity |
| **First Run** | npx betterprompt | CLI scans local sessions, uploads summary | Anticipation |
| **Aha Moment** | Sees their type + behavior patterns | "I really do paste errors without context..." | Self-recognition |
| **Share** | OG image with type + score | Shares to Twitter/LinkedIn/Slack | Pride / humor |
| **Upgrade** | Wants locked prescriptions | Pays $4.99 one-time | Investment in growth |
| **Return** | "Did I improve this month?" | Runs again, compares scores | Progress motivation |
| **Spread** | "Let's do this as a team" | Shares with teammates → B2B lead | Advocacy |

### Distribution Strategy

**Primary:** `npx betterprompt` — zero-friction CLI entry. No install, no signup to start.

- **Dev Twitter/X** — "What's your BetterPrompt type?" as viral hook. Seed with AI coding influencers.
- **LinkedIn** — B2B bridge. Engineering leaders sharing team insights.
- **Hacker News / Reddit** — Data storytelling: "We analyzed 10,000 vibe coding sessions. Here's what we found."
- **Internal sharing** — "Share with your team" CTA to drive organic B2B leads.

---

## 7. Landing Page Messaging

> See [LANDING_PAGE_MESSAGING.md](./LANDING_PAGE_MESSAGING.md) for the full messaging framework.

**Confirmed Hero Copy:**

> "You're building with AI. But can you see what's going wrong?"
>
> Subheadline: "BetterPrompt analyzes your AI coding sessions and shows you what's actually going on — security gaps, bad patterns, and the habits holding you back."
>
> CTA: "Get Your Free Report"

**Messaging Principles:**
- Empathetic, not shaming ("problems you can't see" not "you're making AI slop")
- Specific, not philosophical ("73% blind acceptance rate" not "unconscious dependency")
- Actionable, not judgmental ("here's how to improve" not "you need to think more")
- Inclusive, not gatekeeping ("no coding knowledge required" not "for developers who...")

**Page Structure (90% B2C / 10% B2B signal):**
1. Hero → Individual pain
2. Social Proof Bar → Trust building
3. Problem Validation → "Sound familiar?" pain cards
4. Solution → Behavior Analysis, Risk Detection, Growth Roadmap
5. Showcase → AI Dependency Score, Security Risk Report, Growth Path
6. Team Section → "See how your whole team builds with AI"
7. How It Works + Pricing → Free / Starter / Pro / Team
8. Trust + Privacy → "Your code stays yours"
9. Final CTA → "Get Your Free Assessment"

---

## 8. Success Metrics

**North Star Metric:** Monthly Active Analyses (MAA)

| Stage | Timeline | MAA | Revenue | Key Signal |
|-------|----------|-----|---------|------------|
| Launch | Month 1 | 1K | — | 20% share rate |
| Traction | Month 3 | 10K | $5K MRR | 3% paid conversion |
| Growth | Month 6 | 50K | $25K MRR | First 5 team accounts |
| Scale | Month 12 | 100K | $50K MRR | 20 enterprise leads |

**Quality Targets:**

| Metric | Target |
|--------|--------|
| Type classification accuracy | > 85% |
| User report rating | > 4.5/5 |
| Analysis pipeline reliability | > 99% |
| End-to-end latency | < 60 seconds |
| Analysis cost per run | < $0.08 |

---

## 9. Technical Architecture

Multi-phase LLM pipeline with 11 API calls per analysis, costing ~$0.04-0.05:

| Phase | Component | LLM | Purpose |
|-------|-----------|-----|---------|
| 0 | Multi-Source Scanner | 0 | Discover sessions from Claude Code / Cursor / Composer |
| 1 | Data Extractor + Scorer + Type Mapper | 0 | Deterministic extraction and scoring |
| 1.5 | Session Summarizer | 1 | One-line session summaries (batch) |
| 2 | 5 Insight Workers (parallel) | 5 | Thinking, Communication, Learning, Context, Session |
| 2 | Project + Weekly Summarizer | 2 | Project-level and weekly narratives |
| 2.5 | Type Classifier | 1 | 15-type personality + narrative |
| 2.8 | Evidence Verifier | 1 | LLM-based evidence quality check |
| 3 | Content Writer | 1 | Focus areas narrative |
| 4 | Translator (conditional) | 0-1 | Non-English support (CJK) |

**Stack:** Next.js (Vercel) + AWS Lambda (SST v3) + Supabase + Gemini 3 Flash

**Privacy:** CLI scans locally. Only summaries (not source code) are transmitted. Raw data deleted after analysis.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Privacy resistance** | US users sensitive about AI log sharing | Local scanning + summaries only + delete originals. Lead messaging with privacy. |
| **Awareness gap** | Users don't know they have a problem | Curiosity hook ("What's your score?") not problem hook ("You're doing it wrong") |
| **CLI barrier** | Non-devs may not have Node.js / terminal comfort | Phase 1: CLI for Claude Code users. Phase 2: Web upload, IDE plugins. |
| **"Do nothing" inertia** | Biggest competitor is apathy | Social proof via shared reports. "Everyone on my feed is sharing theirs." |
| **Category creation** | No existing category = education burden | Data storytelling + thought leadership content to create the narrative. |

---

**BetterPrompt**: The missing code review for vibe coders.

*This is a living document. Target market: United States.*

**Related Documents:**
- [Landing Page Messaging](./LANDING_PAGE_MESSAGING.md)
- [Architecture](/docs/agent/ARCHITECTURE.md)
- [PRD References](/docs/human/PRD_REFERENCES.md)
