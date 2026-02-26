# Landing Page Messaging Framework

> **Purpose**: Gap analysis + new messaging direction for BetterPrompt landing page
> **Context**: Pivot from developer-centric "NoMoreAISlop" → non-developer vibe coder "BetterPrompt"
> **Strategy**: B2C (individual vibe coders) → B2B (team/org AI readiness)
> **Date**: 2026-02-12

---

## Part 1: Gap Analysis — Current vs. New Direction

### Current State Summary

| Section | Current Copy | Problem |
|---------|-------------|---------|
| **Hero** | "See how you/your team make AI slop" | Negative framing ("slop"), developer jargon, shaming tone |
| **Philosophy** | "AI is a multiplier. But only if you're still thinking." | Too philosophical, doesn't speak to action |
| **ValueStory** | "4-Phase Pipeline, 5 Parallel Workers, 15 personality types" | Technical architecture as selling point — irrelevant to non-devs |
| **AnalysisShowcase** | "Here's what we actually analyze. Real insights. Not a personality quiz." | Good differentiation, but examples are developer-centric (anti-patterns, tokens) |
| **EnterprisePreview** | "See how your team uses AI" + Manager Dashboard with engineering roles | All mock data is developer-focused (Senior Engineer, tokens, OAuth) |
| **DownloadSection** | "npx no-ai-slop" CLI command, Node.js requirement | CLI-first entry is a non-starter for non-developers |
| **Pricing** | Free/One-Time($4.99)/Pro($6.99/mo)/Enterprise | Tier names and features use dev terminology ("worker insights", "Knowledge Base") |

### 7 Critical Gaps

**Gap 1: Audience Mismatch**
- Current: Speaks to developers who understand "anti-patterns", "context fill", "tokens"
- Needed: Speaks to PMs, designers, founders who use "my app broke", "it keeps changing things", "I don't know if this is secure"

**Gap 2: Tone Mismatch**
- Current: Shaming ("AI slop"), philosophical, intellectual
- Needed: Empathetic, validating, empowering. The user already feels anxious — don't add shame

**Gap 3: Entry Point Mismatch**
- Current: `npx no-ai-slop` (requires terminal knowledge, Node.js)
- Needed: One-click web experience or at minimum extremely clear guided CLI

**Gap 4: Value Proposition Mismatch**
- Current: "See your AI coding personality" (curiosity-driven)
- Needed: "Find out what's actually wrong with your AI-built code" (pain-driven)

**Gap 5: Social Proof Mismatch**
- Current: No real user stories, no community evidence
- Needed: Real quotes from PMs/designers who hit the exact walls we describe

**Gap 6: B2B Signal Missing**
- Current: "Enterprise" section feels separate, corporate, cold
- Needed: Natural progression — "See your results → See your team's results" (Linear/Figma model)

**Gap 7: Showcase Data Mismatch**
- Current: "Passive Verification Loop", "751.3M tokens", "Professional Design Reasoning"
- Needed: "Error Loop Detection", "Security Risk Score", "AI Dependency Level"

---

## Part 2: Research-Backed User Stories

### The 5 Problems (Ordered by Entry Point → Core Value)

#### Problem 1: "It works... until it doesn't" (THE HOOK)
> **Severity**: Acute | **Awareness**: High | **Payment Willingness**: Medium

Real stories:
- **Leonel Acevedo** (non-technical SaaS founder): Built entire product with Cursor, zero hand-written code. Within days: API keys exposed, no auth, database corrupted, subscription bypassed. His words: *"guys, i'm under attack… random things are happening"* → Permanently shut down the project.
- **Cursor user** (developer): *"Cursor keeps breaking other parts of the code"* — spent 2 hours reverting changes, lost 4 months of development.
- **Replit incident**: AI deleted entire production database during code freeze, then generated 4,000 fake accounts to cover its tracks. CEO issued public apology.

**Why this hooks**: Every vibe coder has experienced the moment when "it was working fine" suddenly turns into cascading failures. This is universal, visceral, and immediate.

#### Problem 2: "I can't tell if this is actually good" (THE CORE)
> **Severity**: Chronic | **Awareness**: Low | **Payment Willingness**: High (once aware)

Real pattern:
- Non-developers have no mental model for code quality. They can see if the UI works, but can't evaluate: Is this secure? Is this maintainable? Will this scale? Is this using best practices?
- **A16Z Research**: *"The core issue is that there's a minimum viable knowledge required to responsibly deploy software... AI hasn't eliminated that requirement — it's just obscured it."*
- **The Paradox**: *"Vibe coding works best for those who don't need it"* — experienced developers can verify AI output, non-developers cannot.

**Why this is the core**: This is the root cause of all other problems. Without feedback, there's no improvement.

#### Problem 3: "I'm stuck in an error loop" (HIGH PAIN)
> **Severity**: Acute | **Awareness**: Very High | **Payment Willingness**: Medium

Real stories:
- PMs/designers report getting into *"prompt loops"* — asking AI to fix one thing creates new bugs, fixing those creates more, and they spiral
- Claude behavior described as *"whack-a-mole"* — strong at implementing features, weak at maintaining consistency across changes
- **Bolt users**: *"When trying to set up databases or adding complex functionality... run into learning curve issues pretty quickly"*

**Why this matters**: Error loops are the #1 visible symptom. Users know they're stuck. They just don't know why.

#### Problem 4: "I have no idea about security" (HIDDEN DANGER)
> **Severity**: Critical | **Awareness**: Very Low | **Payment Willingness**: Very High (B2B)

Research:
- **Escape.tech study**: Analyzed 5,600 vibe-coded apps → found 2,000+ security vulnerabilities, 400+ exposed secrets, 175 instances of PII exposure
- Common mistakes: hardcoded API keys in frontend, no authentication, no rate limiting, no input validation, test/production databases not separated
- **Kaspersky**: Flagged vibe coding as emerging security threat category

**Why this matters for B2B**: This is the enterprise selling point. "Your team is building with AI. Do you know what vulnerabilities they're introducing?"

#### Problem 5: "I don't know what I don't know" (THE IDENTITY)
> **Severity**: Existential | **Awareness**: Growing | **Payment Willingness**: High

Real stories:
- **Sam Altman** himself described feeling *"happy, but disoriented... sad and confused"* when using AI tools — even the creator feels this
- PM who built product with Claude: *"I felt like a 10x engineer — until things broke. I'm still a PM, just wielding new tools."*
- The **hidden fatigue**: accelerated AI feedback creates *"brains overwhelmed with dopamine and stress hormones simultaneously, resulting in fatigue instead of happiness"*

**Why this matters**: This is the emotional resonance layer. It validates what users feel but can't articulate.

---

## Part 3: New Messaging Framework

### Design Principles (from B2C→B2B Research)

1. **Hero speaks to individual pain** — enterprise signals come later (Linear/Notion model)
2. **Free tier is genuinely valuable** — strategic limits drive upgrade, not feature gates (Figma model)
3. **"Team" not "Enterprise"** — use progressive language: You → Your Team → Your Organization
4. **Show, don't tell** — real examples > technical specs (AnalysisShowcase stays, data changes)
5. **One CTA dominates** — "Get Started Free" everywhere, team CTA appears mid-page only

---

### Section-by-Section Messaging

#### SECTION 1: Hero

**Current:**
```
"See how you/your team make AI slop."
"Analyze your coding sessions. Spot anti-patterns. Build better AI habits."
CTA: npx no-ai-slop
```

**Confirmed Direction (A+C Hybrid — Pain + Identity):**

```
Headline: "You're building with AI. But can you see what's going wrong?"

Subheadline: "BetterPrompt analyzes your AI coding sessions and shows you
             what's actually going on — security gaps, bad patterns,
             and the habits holding you back."

CTA: "Get Your Free Report" (→ web flow, not CLI)
```

**Why this works**: Combines Option A's anxiety validation ("what's going wrong")
with Option C's personal address ("You're building"). The first sentence
validates identity ("yes, I build with AI"), the second creates productive
doubt ("but can I see the problems?"). This avoids shaming (unlike "AI slop")
while being specific enough to drive clicks.

**B2C→B2B consideration**: Hero does NOT mention "team" — intentional.
Individual pain first, team messaging below fold.
(Follows Linear/Figma pattern, not W&B pattern.)

---

#### SECTION 2: Social Proof Bar (NEW — doesn't exist currently)

**Why add this**: Every successful B2C→B2B landing page has a trust strip
immediately below the hero. It signals scale without saying "enterprise."

```
"Trusted by 2,000+ builders using Cursor, Claude Code, and Replit"
[Cursor logo] [Claude Code logo] [Replit logo] [Bolt logo]
```

Or, if we have user count data:
```
"2,847 AI coding sessions analyzed this month"
```

This is the implicit B2B signal. A manager visiting the page sees scale
and thinks "we could use this for our team."

---

#### SECTION 3: Problem Validation (replaces PhilosophySection)

**Current**: "AI is a multiplier. But only if you're still thinking." (philosophical)

**New Direction**: Show the user you understand their exact pain.

```
Section Title: "Sound familiar?"

Card 1: "It was working fine... then everything broke"
  → "AI tools are great at building features. But every fix
     introduces new bugs. You're stuck in an endless loop."

Card 2: "I shipped it. But is it actually secure?"
  → "2,000+ vulnerabilities found in vibe-coded apps.
     API keys exposed. No authentication. No rate limiting.
     If you're not checking, nobody is."

Card 3: "I don't know what I don't know"
  → "Your app looks fine on the surface. But you can't review
     what you can't understand. That's not a skill gap —
     it's a feedback gap."
```

**Design note**: Each card should feel like reading the user's internal
monologue. Use first person ("I shipped it") in the trigger, then shift
to empathetic second person ("you can't review") in the explanation.

---

#### SECTION 4: Solution (replaces ValueStory)

**Current**: "4-Phase Pipeline, 5 Parallel Workers" (technical architecture)

**New Direction**: Show what the product actually does, in user language.

```
Section Title: "We review what you can't"

Feature 1: "Behavior Analysis"
  Icon: [brain/pattern icon]
  "See how you actually use AI — where you accept blindly,
   where you verify, and where you get stuck."

Feature 2: "Risk Detection"
  Icon: [shield icon]
  "Security vulnerabilities. Exposed API keys. Missing authentication.
   We catch what AI won't tell you about."

Feature 3: "Growth Roadmap"
  Icon: [chart icon]
  "Personalized recommendations based on your actual sessions.
   Not generic tips — specific actions for your workflow."
```

**What stays**: The 15-type personality system still appears here, but
repositioned. Instead of "5 styles × 3 control levels = 15 types" (math),
show: "Discover your AI Builder Profile — are you an Architect, Speedrunner,
or somewhere in between?"

**The personality type is the viral share hook.** Keep it, but make it
secondary to the practical value.

---

#### SECTION 5: Showcase (updated AnalysisShowcase)

**Current**: Anti-pattern detection, weekly dashboard with tokens, strength analysis

**New Direction**: Same structure (3 showcase cards), different data.

```
Card 1: "AI Dependency Score"
  → Shows a gauge: "You accepted AI output without review in 73% of changes"
  → "Most vibe coders don't realize how much they're trusting blindly"

Card 2: "Security Risk Report"
  → Shows flagged items: "3 exposed API keys", "No input validation on 2 forms",
     "Authentication bypassed on admin route"
  → "This is what a security audit would catch. We run one every session."

Card 3: "Your Growth Path"
  → Shows a progression: Week 1 → Week 4
  → "From accepting everything → asking better questions → reviewing critically"
  → "Your AI builder personality: Navigator Architect"
```

**CTA below showcase**: "See your real results" → Get Started Free

---

#### SECTION 6: Team Section (replaces EnterprisePreview)

**Current**: "Manager Dashboard" with Enterprise badge, engineering roles, token counts

**New Direction**: Soften the enterprise feel. Use "Team" language.

```
Section Title: "See how your whole team builds with AI"
Subheadline: "Same analysis, team-wide visibility.
              Know who's building securely and who needs support."

Dashboard Preview (updated mock data):
  - "Sarah Park" — Product Manager — AI Control: 72 — "Built checkout flow, user dashboard"
  - "James Lee" — Designer — AI Control: 58 — "Created component library, landing pages"
  - "Maria Chen" — Marketing Lead — AI Control: 81 — "Built analytics dashboard, A/B test framework"
  - "Tom Wilson" — Operations — AI Control: 45 — "Built internal tools, automated reports"

Key change: Roles are NON-DEVELOPER roles.
Key change: "Score" → "AI Control" (more specific, less judgmental)
Key change: "Tokens" column removed (meaningless to non-devs)
Key change: "Enterprise" badge → "Team Plan" badge
```

**CTA**: "Start a team trial" or "Add your team" (not "Learn more about Enterprise")

**B2C→B2B bridge**: A PM who just got their individual report thinks
"I wonder how my team compares" → this section answers that exact thought.

---

#### SECTION 7: How It Works + Pricing (updated DownloadSection)

**Current**: `npx no-ai-slop`, Node.js requirement, CLI-focused

**New Direction**: Web-first experience (even if CLI is the actual mechanism).

```
Section Title: "Get started in 2 minutes"

Step 1: "Connect your AI tool"
  → "Works with Claude Code, Cursor, and more.
     We read your session logs — not your source code."

Step 2: "Get your assessment"
  → "Our AI analyzes how you work with AI.
     Patterns, risks, and opportunities — all in one report."

Step 3: "Start improving"
  → "Actionable recommendations specific to your workflow.
     Track your progress over time."
```

**Pricing update**:
```
Free ($0)
  - 3 assessments/month
  - Core AI Builder Profile
  - Basic behavior analysis

Starter ($4.99 one-time) ← renamed from "One-Time"
  - Unlimited assessments
  - Full 6-dimension analysis
  - Security risk report
  - Growth recommendations

Pro ($6.99/mo)
  - Everything in Starter
  - Progress tracking over time
  - Learning resources
  - Team comparison (up to 5)

Team (Custom) ← renamed from "Enterprise"
  - Everything in Pro
  - Team dashboard
  - Manager insights
  - SSO + admin controls
```

**Key changes**:
- "Worker insights" → "6-dimension analysis"
- "Knowledge Base" → "Learning resources"
- "Enterprise" → "Team"
- Added "Security risk report" as Starter feature (high perceived value)
- Added "Team comparison (up to 5)" to Pro (B2C→B2B bridge)

---

#### SECTION 8: Trust + Privacy (updated from features strip)

```
"Your code stays yours"
  - "Session summaries are analyzed — never your source code"
  - "Data encrypted in transit, deleted after analysis"
  - "No agents, no background processes, no tracking"
```

This section matters MORE for non-developers, who are MORE privacy-anxious
about tools they don't fully understand.

---

#### SECTION 9: Final CTA (updated LandingFooter)

**Current**: "Ready to find out?" + npx no-ai-slop

**New Direction**:
```
"You're already building with AI.
 Now find out if you're building it right."

CTA: "Get Your Free Assessment"

Small text: "No credit card. No installation. Takes 2 minutes."
```

---

## Part 4: B2C → B2B Messaging Strategy

### The Progression Model

Based on analysis of Linear, Figma, Notion, and W&B:

```
STAGE 1 (Landing Page): Individual Pain
  → "You're building with AI. But can you see what's going wrong?"
  → Get individual report → share result

STAGE 2 (In-Product): Team Curiosity
  → After viewing report: "See how your team compares"
  → Nudge to invite team members

STAGE 3 (Team Page): Manager Value
  → /for-teams landing page (separate from main)
  → "Know what your team is actually building with AI"
  → Dashboard preview with team analytics

STAGE 4 (Sales): Enterprise Compliance
  → Custom security assessments
  → AI readiness certification
  → Integration with existing tools
```

### What This Means for the Landing Page

The main landing page (`/`) should be 90% B2C, 10% B2B signal.

**B2C elements** (90%):
- Hero, Problem Validation, Solution, Showcase, How It Works, Pricing (Free/Starter/Pro), Final CTA

**B2B signals** (10%):
- Social proof bar (logos, numbers)
- Team section (Section 6) — shows team capability WITHOUT making it the focus
- "Team" tier in pricing — exists, visible, but not highlighted
- Trust/privacy section — enterprises care about data handling

**The key insight**: Don't try to sell to both audiences simultaneously.
Sell to individuals. Let them discover the team value themselves.
The team section is a seed — not a sales pitch.

### Separate /for-teams Page (Future)

When B2B demand grows, create a dedicated page:
```
URL: /for-teams
Hero: "Know how your team really uses AI"
Subheadline: "BetterPrompt gives engineering managers visibility into
              AI adoption patterns, security risks, and skill gaps
              across their entire team."
CTA: "Start Team Trial" / "Book a Demo"
```

This page would have different social proof (company logos, not user count),
different showcase (team dashboard, not individual report), and different
pricing (Team/Enterprise tiers only).

---

## Part 5: Copy Tone Guide

### Voice Principles

1. **Empathetic, not shaming**: "Problems you can't see" not "You're making AI slop"
2. **Specific, not philosophical**: "73% blind acceptance rate" not "Unconscious dependency"
3. **Actionable, not judgmental**: "Here's how to improve" not "You need to think more"
4. **Inclusive, not gatekeeping**: "No coding knowledge required" not "For developers who..."

### Word Replacements

| Current (Dev-speak) | New (Accessible) |
|---------------------|-------------------|
| Anti-patterns | Bad habits / Risky patterns |
| Tokens | (remove entirely) |
| Context fill | Session efficiency |
| Worker insights | Analysis dimensions |
| LLM calls | AI analysis steps |
| Pipeline | Analysis process |
| CLI | Tool / App |
| npx command | "Get started" button |
| Knowledge Base | Learning resources |
| Deterministic scoring | Objective assessment |

### Emotional Arc of the Page

```
SECTION 1 (Hero):     Anxiety validation    → "Yes, this is a real problem"
SECTION 2 (Proof):    Trust building         → "You're not alone"
SECTION 3 (Problems): Pain amplification     → "It's worse than you think"
SECTION 4 (Solution): Relief + empowerment   → "But there's a way forward"
SECTION 5 (Showcase): Concrete visualization → "This is exactly what you get"
SECTION 6 (Team):     Expansion seed         → "Imagine this for your whole team"
SECTION 7 (Pricing):  Low-friction entry     → "Free to start, fair to grow"
SECTION 8 (Trust):    Objection handling     → "Your data is safe"
SECTION 9 (CTA):      Confident action       → "Let's go"
```

---

## Part 6: Implementation Priority

### Phase 1 — Must Change (Breaking Issues)
1. **Hero copy** — current "AI slop" framing actively repels non-dev target
2. **CTA mechanism** — `npx` CLI must become web-first (or at minimum guided)
3. **Showcase data** — developer-centric examples confuse non-dev visitors

### Phase 2 — Should Change (Strategic Alignment)
4. **ValueStory** — replace technical architecture with user-facing value
5. **EnterprisePreview** — rebrand to "Team" with non-dev roles
6. **Pricing tier names** — rename and reframe features in accessible language

### Phase 3 — Nice to Have (Growth Optimization)
7. **Social proof bar** — add once we have real usage data
8. **Problem validation section** — replace PhilosophySection with pain cards
9. **Separate /for-teams page** — create when B2B demand emerges

---

*This framework should be reviewed alongside PRD v3 and updated as landing page implementation progresses.*
