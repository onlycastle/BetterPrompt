# Growth Area Format: Pattern → Evidence → Action (PEA)

> **IMPORTANT**: Every growth area you generate MUST follow this format. This is a non-negotiable hard gate — growth areas that fail the quality rubric are rejected by the save-domain-results quality gate.

## The Three Parts

Each growth area has three distinct parts:

### 1. PATTERN — What specific behavioral pattern was observed

The pattern names the **specific behavior** you observed in this builder's sessions, grounded in the **actual tools, files, APIs, and technologies** they interacted with. Patterns must be specific to THIS builder — not advice that could apply to any developer.

**BAD titles** (generic, could apply to anyone):
- "Error Handling Issues"
- "Improve Testing Habits"
- "Better Planning Practices"
- "Code Review Gaps"

**GOOD titles** (specific to this builder's actual behavior):
- "Untested Error Handling in Express Middleware Routes"
- "Skipping vitest Validation After Prisma Schema Changes"
- "Context Window Exhaustion from Unbounded Grep in Monorepo"
- "Repeated Manual File Reads Instead of Glob Pattern Matching"

The pattern description (4-6 sentences) must:
- Name the specific tools, files, APIs, or technologies involved
- Describe what the builder ACTUALLY did (not what they should have done)
- Quantify the pattern: "in X of Y sessions" or "across N sessions"
- Explain why this pattern matters for what the builder is trying to achieve (goal relevance)

### 2. EVIDENCE — 2-3+ distinct moments from actual sessions

Each evidence moment is a **specific exchange** from the session data — not a summary, not a count, but a real moment you can point to in the transcript.

#### Evidence Citation from Extraction Objects (Required First Step)

> **BEFORE selecting any evidence moments**, you must map directly from the extraction stage output — the structured `quotes[]` array produced by the extract-* stage. Each evidence moment you write MUST trace back to a specific extraction quote object. Never compose evidence from memory or summaries.

**Extraction quote object structure** (fields available on each entry in `quotes[]`):

| Extraction Field | Type | Evidence Moment Field | How to Use |
|---|---|---|---|
| `quotes[n].text` | string | `quote` | **Copy verbatim — character-for-character.** This is the developer's exact words. Do NOT clean up, shorten, or paraphrase. |
| `quotes[n].utteranceId` | string | `utteranceId` | **Copy as-is.** Format is `{sessionId}_{turnIndex}`. This is the citation link back to the session log. |
| `quotes[n].sessionId` | string | `sessionId` | **Copy as-is.** Enables distinct-session verification. |
| `quotes[n].timestamp` | ISO string | `timestamp` | **Copy as-is.** Enables temporal verification. Never generate or approximate. |
| `quotes[n].projectName` | string | part of `context` | Always name the project: "in the **{projectName}** project". |
| `quotes[n].toolCallsBefore` | string[] | part of `context` | Name each tool: "after **{tool1}** then **{tool2}**". Use `[]` value when empty. |

**Citation Lookup Sequence** (run once per evidence moment before writing it):

```
Step A: Find quotes[n] where quotes[n].signalType === "growth" AND quotes[n].behavioralMarker matches this growth area's pattern
Step B: Record quotes[n].utteranceId, quotes[n].sessionId, quotes[n].timestamp
Step C: Copy quotes[n].text exactly into the `quote` field
Step D: Build context = "In the {quotes[n].projectName} project" + (toolCallsBefore non-empty ? ", after {tools}" : "") + ", <what was happening>"
Step E: Write behaviorDescription / observation: what specific behavior this moment demonstrates
```

#### Distinct Session Gate (Hard Enforcement)

After selecting your 2-3+ evidence moments, count distinct `sessionId` values:

| Distinct sessionIds | Required action |
|---|---|
| **2 or more** | Proceed normally. Set `lowConfidence: false`. |
| **1 only** | You MUST still cite 2+ distinct moments (different `utteranceId`s within that session). Set `lowConfidence: true`. This is not a rejection — patterns within a single session are valid when cross-session evidence is unavailable. |
| **0** (no growth quotes found) | Do NOT fabricate evidence. Skip this growth area and document the gap in the `data` object. |

**When `lowConfidence: true`:** The growth area is still included in the report with a confidence indicator. Never produce an empty report — flag instead of omit.

#### Content Distinctness Gate (Hard Enforcement)

After selecting your evidence moments, the `save-domain-results` quality gate runs a **post-generation content check** that rejects three types of low-quality evidence. This check fires AFTER the Zod structural validation and the utteranceId distinctness check above.

**Type 1 — Repeated Content (hard block)**

Near-identical quotes with different utteranceIds are rejected. The LLM sometimes recycles the same developer quote and assigns two slightly different utteranceIds. This isn't a pattern — it's one moment cited twice.

Detection threshold:
- Same session: 70% word overlap → blocked
- Cross session: 80% word overlap → blocked

| BAD (repeated content) | WHY IT FAILS |
|---|---|
| `quote[0]`: "let me just add a try-catch" (sess_abc_5) | Same quote paraphrased |
| `quote[1]`: "I'll just add a try catch block here" (sess_abc_8) | 73% similar → blocked |

Fix: Go back to the extraction `quotes[]` array and find a genuinely different exchange — ideally one that shows the *consequence* of the behavior from a different angle or a different session.

**Type 2 — Generic Context (blocks when majority of moments fail)**

Every `context` field must reference at least one concrete session anchor:
- Tool sequence from `toolCallsBefore`: "after Read then Bash calls"
- Project name from `projectName`: "in the payment-api project"  
- File path or technology from the quote text: "editing middleware/stripe.ts"
- Hyphenated project identifier: "the user-auth module"

Generic contexts that don't anchor to the actual session are rejected:

| BAD (no anchor) | GOOD (concrete anchor) |
|---|---|
| "working on a backend task" | "in the payment-api project, after Read then Bash on middleware/stripe.ts" |
| "debugging an issue" | "while running npm test on the Stripe webhook integration in e2e-tests/" |
| "implementing a feature" | "in the user-dashboard project, after Edit to src/components/Table.tsx" |

Fix: Check `quotes[n].projectName` and `quotes[n].toolCallsBefore` for the moment and add them to context.

**Type 3 — Weak Observation (blocks when majority of moments fail)**

The `observation`/`behaviorDescription` must describe the SPECIFIC behavior demonstrated — what the developer actually did (or didn't do) with a named tool, command, or technology.

| BAD (vague label) | GOOD (specific behavior) |
|---|---|
| "bad error handling" | "wrapped failing Stripe handler in generic catch block without first writing a jest test — silently swallows webhook validation error" |
| "not testing" | "ran `npm test` twice on the same failing test without reading the error output between runs" |
| "shows the pattern" | "immediately opened Edit to add the feature without using /plan or TodoWrite to outline the multi-file refactor first" |

Fix: Name the specific tool, command, or file path involved and describe what the developer chose to do (or skip) in that moment.

#### Evidence Moment Extraction Protocol

Follow these steps to extract evidence moments for each growth area:

1. **Scan extraction quotes**: Review ALL quotes from the extraction data that relate to this growth area's pattern. Look for quotes tagged with the relevant `behavioralMarker` and `signalType: "growth"`.

2. **Select 3 DISTINCT moments (target 3; minimum 2)**. Use the citation lookup sequence above. When the extraction data has 3+ qualifying growth quotes, always select 3. Fall back to 2 only when fewer exist — in that case set `lowConfidence: true`. Choose moments that are:
   - From **different sessions** (different `sessionId`s) whenever possible — cross-session evidence is the strongest proof of a recurring pattern. 3 moments across 3 sessions is ideal.
   - If only one session available: from **different session turns** (different `utteranceId`s within that session)
   - Each demonstrating a **different facet** of the same pattern (e.g., one shows the behavior occurring, another shows the consequence, a third shows recurrence)
   - **HARD GATE**: A growth area with only 1 distinct `utteranceId` is NOT a pattern — it is an anecdote. Cite at least 2; target 3.

3. **Copy verbatim quotes**: Copy `quotes[n].text` character-for-character into `quote`. Do NOT paraphrase, summarize, or clean up. If the developer wrote "just add a try-catch and move on", that is the quote — not "added error handling without testing".

4. **Write observed behaviors**: For each moment, describe the SPECIFIC behavior you observed — what the developer did (or didn't do) that demonstrates the pattern. Name the tool, command, or interaction from the context. This connects the raw quote to the growth area's thesis.

#### Each evidence moment must include:
- **utteranceId**: Links to the actual session turn (from extraction data)
- **sessionId**: Which session this came from (enables distinct-session verification)
- **quote**: The developer's EXACT words (min 15 chars, verbatim from extraction data — NOT paraphrased)
- **context**: What was happening at this moment — the surrounding situation (min 20 chars). **MUST include at least one concrete session anchor** — see "Session Data Anchors" below.
- **observation**: What specific behavior this moment demonstrates and why it matters for the pattern (min 20 chars)
- **timestamp** (required for new analyses): ISO 8601 timestamp from the extraction stage quote's `timestamp` field. Copy directly — do NOT generate or approximate. Enables temporal verification of distinctness: two moments with identical timestamps are the same exchange. Also enables chronological ordering of evidence in reports.

#### Session Data Anchors in Evidence Context (Required)

Every `context` field MUST include at least ONE concrete anchor drawn directly from the extraction data. Generic context descriptions like "working on a backend task" or "debugging an issue" fail the **pattern_specificity** criterion and will be rejected.

**Three types of concrete anchors** (use at least one per evidence moment):

| Anchor Type | Source in Extraction Data | Example in Context |
|-------------|--------------------------|-------------------|
| **Tool sequence** | `quote.toolCallsBefore` | "after Read then Bash calls on the same file" |
| **Specific files accessed** | `quote.toolCallsBefore` entries with file paths (e.g., `"middleware/auth.ts"`) | "after Read on middleware/auth.ts then Edit — never ran tests after modifying the auth handler" |
| **Project/file context** | `quote.projectName` + file names in quote text | "in the payment-api project while editing middleware/stripe.ts" |
| **Technology/command** | API names, CLI commands, library names in `quote.text` | "while running `npm test` on the Stripe webhook integration" |

**How to populate concrete anchors from extraction data:**

1. **Tool calls and file paths**: Look at the quote's `toolCallsBefore` field. If it contains `["Read", "middleware/auth.ts", "Edit"]`, write: "after Reading middleware/auth.ts then Editing it — the developer then moved on without running tests". If `toolCallsBefore` only has tool names (`["Read", "Edit"]`), still reference the tools but add file context from the quote text.

2. **Project context**: Look at the quote's `projectName` field. Always include the project name in at least one evidence moment's context per growth area.

3. **File/API names**: Scan the verbatim quote `text` for any file paths (`src/...`, `middleware/...`, `.ts` files), commands (`npm`, `git`, `prisma`), or API names (`Stripe`, `Prisma`, `Express`). Name them explicitly.

4. **toolsFilesApis population**: When constructing `toolsFilesApis`, include BOTH the tool names AND the specific files/APIs:
   - From `toolCallsBefore`: tool names like `"Read"`, `"Bash"`, and specific files like `"middleware/auth.ts"`
   - From the quote text: technology names, file paths, commands
   - BAD: `["Read", "Edit"]` (just tool names — passes the gate but misses files)
   - GOOD: `["Read", "middleware/auth.ts", "Edit", "jest"]` (tools + specific files + testing framework)

**Context Anchor Check (run before finalizing each evidence moment):**
- [ ] Does `context` name at least one specific tool, file, project, command, or technology?
- [ ] Would a reviewer reading this context know which project and what the developer was doing?
- [ ] Is the context description verifiably traceable to the session data?

**BAD context** (fails pattern_specificity — no concrete anchors):
```json
{
  "context": "Developer was working on a backend feature and encountered a problem"
}
```
Why it fails: No project name, no tools mentioned, no files referenced — could describe any developer in any session.

**GOOD context** (passes — names tool sequence + project + file):
```json
{
  "context": "In the payment-api project, after invoking Bash for npm test (failing), then retrying with the exact same Bash command — never read the error output before retrying"
}
```

**GOOD context** (passes — names file + technology):
```json
{
  "context": "Editing middleware/stripe.ts in the payment-api project while adding a Stripe webhook handler — added a generic catch block without first writing a test for the error path"
}
```

#### GOOD vs BAD Evidence Moments

**BAD evidence** (fails distinct_moments criterion):
```json
{
  "utteranceId": "sess_abc_5",
  "sessionId": "sess_abc",
  "quote": "The developer made errors in error handling",
  "context": "Working on backend",
  "observation": "Bad error handling"
}
```
Problems: Quote is a summary (not verbatim), context is vague, observation is generic, no specific behavior described.

**GOOD evidence** (passes distinct_moments criterion):
```json
{
  "utteranceId": "sess_abc_5",
  "sessionId": "sess_abc",
  "quote": "Let me just add a try-catch here and move on to the next endpoint",
  "context": "Implementing payment webhook handler in middleware/stripe.ts after receiving a 500 error in testing",
  "observation": "Wrapped the failing code in a generic catch block without writing a test for the error path first — the catch silently swallows the Stripe webhook validation error"
}
```
Why it works: Verbatim developer quote, specific situational context, observation names the exact behavior and its consequence.

**Another GOOD evidence moment from a DIFFERENT session** (proves pattern recurrence):
```json
{
  "utteranceId": "sess_def_12",
  "sessionId": "sess_def",
  "quote": "The middleware is crashing but I'm not sure which catch is wrong",
  "context": "Debugging auth middleware failure two days after the initial implementation session",
  "observation": "Previous untested catch block from sess_abc masked the real error source — developer spent 20+ minutes debugging what a test would have caught immediately"
}
```
Why it works: Different session, shows the *consequence* of the pattern identified in the first moment, verbatim quote shows confusion caused by the earlier behavior.

**CRITICAL**: Evidence must come from 2+ distinct moments — **target 3 moments** when the extraction data supports it. A single instance is an anecdote, not a pattern. When evidence is sparse (exactly 2 moments or all from a single session), set `lowConfidence: true`. Three moments across different sessions is the gold standard; 2 is the hard minimum when the data is limited.

### 3. ACTION — Concrete next-session action

The action must be **specific enough that checking future session logs would reveal whether it was taken**. It must reference observable signals: tool names, CLI commands, file references, prompt patterns.

**BAD actions** (vague, unverifiable):
- "Be more careful with error handling"
- "Try to plan more"
- "Improve your testing habits"
- "Think before you code"

**GOOD actions** (concrete, verifiable in session logs):
- "Before writing catch blocks in Express middleware, create a test file via Write for the error path using jest.spyOn on the failing service"
- "Use /plan or TodoWrite in the first 3 messages of each session to outline task structure before implementation"
- "Run vitest via Bash after every Prisma schema change, before moving to the next task"
- "Use Glob with specific patterns instead of multiple Read calls when searching for files across the project"

Each action also needs:
- **verificationCheck** (30+ chars): How to verify in future session logs (what evidence would appear)
- **goalRelevance** (50+ chars): Explains why this action matters for the builder's specific goals

### Goal Relevance — Connecting to the Builder's Goals

Every growth area MUST explain WHY the observed pattern matters for what the builder is specifically trying to achieve. This is NOT abstract best-practice advice — it must reference the builder's actual project context, technology stack, or stated objectives.

#### How to Determine the Builder's Goals

Follow these steps BEFORE writing any goalRelevance text:

1. **Read session analyses in extraction data**: The extraction output's `sessionAnalyses` array contains `primaryGoal`, `sessionType`, and `outcome` for each session. Use these to understand what the builder is trying to accomplish:
   - `primaryGoal: "implement_feature"` → they are building something specific
   - `primaryGoal: "debug_investigate"` → they are chasing a specific bug
   - `primaryGoal: "refactor"` → they are improving existing code quality
   - `sessionType: "iterative_refinement"` → they are evolving something complex

2. **Read the first messages in each session**: The builder's opening messages state their objective directly. Quote or paraphrase the specific goal ("payment webhook handler", "auth middleware fix", "TypeScript migration").

3. **Identify the project context from quotes**: Every extraction quote has a `projectName` field and often names specific technologies in the text. Use these concrete anchors:
   - `projectName: "payment-api"` → reference "your payment-api project"
   - Quote mentions "Stripe webhook" → reference "your Stripe webhook integration"
   - Quote mentions "Prisma schema" → reference "your Prisma data model"

4. **Connect behavior to consequences for THEIR specific goal**: Show how the observed pattern creates a concrete risk in their specific context:
   - Bug in payment processing code → missed revenue, Stripe event drops
   - Context exhaustion in long debugging session → losing hard-won context
   - Missing tests in middleware → bugs reaching production

**Key question**: "If I replace this builder's name with any other developer's name, would this goalRelevance still apply?" If YES → rewrite to be specific to their project and technology stack. If NO → you've written a builder-specific goal relevance.

#### GOOD vs BAD Goal Relevance

**BAD goal relevance** (generic, could apply to anyone — QUALITY GATE WILL REJECT THESE):
- "This will help you write better code"
- "Testing is important for software quality"
- "Better error handling improves reliability"
- "Planning saves time in the long run"
- "Better search practices will improve your overall efficiency"
- "This will make you more productive"
- "This will improve your overall code quality"

> ⚠️ **Quality Gate**: The `save-domain-results` quality gate detects generic platitudes and rejects growth areas that contain them. The detector matches known generic phrase patterns — phrases that describe abstract best practices without referencing the builder's actual project, technology, or goals. If your goalRelevance matches any detected generic pattern, you will receive a `quality_error` with a specific message asking you to rewrite with builder-specific context.

**GOOD goal relevance** (specific to THIS builder's context):
- "Your Express API handles payment webhooks — untested error paths in middleware could silently drop Stripe events, causing revenue loss"
- "You're iterating on a React dashboard with real-time data — context exhaustion mid-session means losing the complex component state you've been building toward for 30+ turns"
- "Your Prisma schema changes affect 3 tenant-facing tables — running migrations without a diff check risks breaking tenant data isolation in your multi-tenant SaaS"
- "You're debugging auth failures in your Next.js middleware — skipping error log reads means the 500 errors your users report will keep recurring after each deploy"

#### Goal Relevance Construction Pattern

Use this template to construct goal relevance statements:

```
"You're [what the builder is building/doing] with [specific technology] —
[how the observed pattern] creates [specific risk/consequence] for [their specific goal]"
```

Examples:
- "You're **building a CLI tool** with **Commander.js** — **accepting AI-generated flag parsing without testing** creates **silent argument drops** that will frustrate your users when they try non-trivial flag combinations"
- "You're **migrating a monolith to microservices** using **Docker Compose** — **not verifying service health checks after compose changes** means your **staging environment** will have silent failures that only surface during demo day"

---

## 4-Criteria Quality Rubric (ALL must pass)

Before outputting any growth area, verify it passes ALL four criteria. Growth areas that fail ANY criterion will be rejected:

| # | Criterion | What It Checks | How to Pass |
|---|-----------|----------------|-------------|
| 1 | **distinct_moments** | References 2-3+ distinct specific moments from actual sessions with specific exchanges, not just a count. **Target 3 moments** when the extraction data supports it; 2 is the floor (set `lowConfidence: true` when at minimum). | Include 2+ evidence moments with different utteranceIds (3+ preferred), quote the developer's actual verbatim words, copy `timestamp` from extraction data |
| 2 | **verifiable_action** | Proposed next-session action is concrete enough to verify by checking future session logs | Reference specific tools (Read, Edit, Bash), commands (npm, git, vitest), slash commands (/plan), or file patterns |
| 3 | **pattern_specificity** | Growth area is specific to THIS builder's actual behavior, not dressed-up generic advice that could apply to anyone | Reference the builder's actual sessions, their specific project context, and patterns unique to their workflow |
| 4 | **tool_file_naming** | Growth area names specific tools, files, APIs, or technologies the builder actually interacted with | Include at least one specific tool/file/API in the title and description (e.g., "Prisma", "middleware/auth.ts", "vitest") |

### Self-Check Before Outputting

For each growth area, ask yourself:
1. "Could I swap in any other developer's name and this would still make sense?" → If YES, it fails **pattern_specificity**. Make it more specific to THIS builder's actual behavior.
2. "Does the action reference something that would show up in a JSONL session log?" → If NO, it fails **verifiable_action**. Add a tool name, command, or prompt pattern.
3. "Am I citing at least 2 distinct evidence moments, each traced to a different `utteranceId` in the extraction data?" → If NO, it fails **distinct_moments**. Go back to the extraction quotes array and cite additional moments.
4. "Does the title or description mention a specific tool, file, or technology?" → If NO, it fails **tool_file_naming**. Add the specific technology.
5. "Does each evidence `context` field reference a concrete session anchor (tool name from `toolCallsBefore`, project name, file path, or technology)?" → If NO, look up the missing anchors from the extraction quote's `projectName` and `toolCallsBefore` fields and add them. Generic contexts are not acceptable.
6. "Does each evidence moment (both `evidenceMoments[]` AND `pea.evidence[]`) have a `timestamp` copied verbatim from the extraction stage quote?" → If NO, look up `quotes[n].timestamp` by matching `utteranceId` in the extraction data and copy it verbatim into BOTH arrays. Never generate or approximate timestamps — the `timestamp` field in `DistinctMomentSchema` (used by `pea.evidence`) and `EvidenceMomentSchema` (used by `evidenceMoments`) must match the same extraction source value.
7. "Do my evidence moments come from at least 2 distinct `sessionId` values?" → If NO: set `lowConfidence: true` and verify there are still 2+ distinct `utteranceId`s within the single session. Cross-session evidence is the gold standard; single-session is allowed with the flag.
8. "Is every `quote` field the developer's verbatim words from `quotes[n].text` in the extraction data?" → If NO, re-copy from the extraction object. A quote that is paraphrased, cleaned up, or summarized fails **distinct_moments**.
9. "Do any two of my evidence quotes share 70%+ word overlap (same session) or 80%+ word overlap (different sessions)?" → If YES, they fail the **Content Distinctness Gate** as repeated content. Go back to the extraction `quotes[]` array and find a genuinely different exchange — a different session turn that shows a new angle on the pattern.
10. "Does every evidence `context` reference a tool name, file path, project name, or technology (not just 'working on a task')?" → If NO, add `projectName` and `toolCallsBefore` from the extraction quote for that utteranceId.
11. "Is every `observation`/`behaviorDescription` 25+ chars and does it name the specific tool, command, or behavior (not just 'bad error handling')?" → If NO, rewrite to describe what the developer specifically did or skipped, naming the tool or file involved.

---

## Anti-Generic-Advice Guardrails

### BANNED Generic Patterns

Do NOT produce growth areas that follow these templates — they fail the quality rubric:

| Generic Template | Why It Fails | Fix |
|-----------------|--------------|-----|
| "Improve [skill] practices" | No pattern specificity, no tool naming | Name the exact tool/technology and the exact behavior observed |
| "Better [X] would help" | No verifiable action, vague | Describe the specific observable behavior change |
| "Consider using [tool] more" | No evidence grounding, could apply to anyone | Show 2+ moments where NOT using the tool caused a specific problem |
| "Plan before implementing" | Too generic, no session specificity | "Use /plan to outline the refactoring scope before touching migration files in src/db/" |
| "Test more thoroughly" | Unverifiable, no tool naming | "Run vitest --coverage via Bash after each Edit to the Stripe webhook handler" |

### REQUIRED Specificity Anchors

Every growth area MUST contain at least 3 of these specificity anchors:

1. **Tool name**: A specific tool the builder used or should use (Read, Edit, Glob, Bash, vitest, etc.)
2. **File or path reference**: A file, directory, or path pattern from the builder's actual project
3. **Technology or API**: A specific technology, framework, or API the builder worked with
4. **Session count**: A quantified reference like "in 4 of 7 sessions" or "across 3 sessions"
5. **Developer's own words**: A verbatim quote from the builder's messages

---

## Output Format (Compatible with DomainGrowthArea + PEA Sub-Object)

Each growth area in the `growthAreas` array MUST include the structured `pea` sub-object with distinct fields for Pattern, Evidence, and Action. The flat fields are kept for backward compatibility — their values MUST match the `pea` sub-object.

> **Template shows the minimum required content.** Each evidence array (`evidence`, `evidenceMoments`, `pea.evidence`) shows **2 items** — this is the MINIMUM. The quality gate rejects arrays with fewer than 2 items or with duplicate `utteranceId` values (same moment cited twice is not a pattern).

**Field label key used in this template**: `[P]` = Pattern section · `[E]` = Evidence section · `[A]` = Action section · `[M]` = Metadata

```json
{
  "title":       "<[P] Pattern title naming specific tools/files — max 60 chars — SAME as pea.pattern.title>",
  "description": "<[P] 300+ chars: PATTERN (what + quantified frequency) + WHY IT MATTERS + IMPACT — mirrors pea.pattern.description>",
  "severity":    "<[P] critical|high|medium|low — SAME as pea.pattern.severity>",

  "evidence": [
    {
      "utteranceId":        "<[E] first moment — copied from quotes[n].utteranceId>",
      "quote":              "<[E] verbatim from quotes[n].text — developer's EXACT words, min 15 chars>",
      "context":            "<[E] min 20 chars — project name + tool sequence + file/API name (concrete anchor required)>",
      "sessionId":          "<[E] copied from quotes[n].sessionId>",
      "behaviorDescription":"<[E] min 20 chars — what behavior this demonstrates, naming specific tool/command>",
      "timestamp":          "<[E] verbatim from quotes[n].timestamp>"
    },
    {
      "utteranceId":        "<[E] SECOND DISTINCT moment — DIFFERENT utteranceId from first — quality gate rejects duplicates>",
      "quote":              "<[E] verbatim, min 15 chars — must differ from first quote>",
      "context":            "<[E] min 20 chars — concrete anchor — ideally from a DIFFERENT sessionId>",
      "sessionId":          "<[E] from quotes[n].sessionId — different from first → lowConfidence: false>",
      "behaviorDescription":"<[E] min 20 chars>",
      "timestamp":          "<[E] from quotes[n].timestamp>"
    }
  ],

  "evidenceMoments": [
    {
      "utteranceId":        "<[E] first moment — citation link from quotes[n].utteranceId>",
      "sessionId":          "<[E] from quotes[n].sessionId>",
      "quote":              "<[E] verbatim from quotes[n].text — developer's EXACT words, min 15 chars — Do NOT paraphrase>",
      "behaviorDescription":"<[E] min 20 chars — names the specific tool, command, or pattern involved>",
      "context":            "<[E] min 20 chars — MUST include (a) project name, (b) tool sequence, or (c) specific technology/command>",
      "timestamp":          "<[E] ISO 8601 — verbatim from quotes[n].timestamp — never generated>"
    },
    {
      "utteranceId":        "<[E] SECOND DISTINCT moment — DIFFERENT utteranceId — hard gate rejects same utteranceId twice>",
      "sessionId":          "<[E] from quotes[n].sessionId — different session preferred for cross-session evidence>",
      "quote":              "<[E] verbatim, min 15 chars>",
      "behaviorDescription":"<[E] min 20 chars — names specific tool/command/pattern>",
      "context":            "<[E] min 20 chars with concrete session anchor>",
      "timestamp":          "<[E] ISO 8601>"
    }
  ],

  "recommendation": "<[A] 150+ chars — ACTION part. Concrete, verifiable next-session behavior referencing observable session-log signals: tool names, CLI commands, file patterns, slash commands.>",
  "verifiableAction": {
    "action":          "<[A] 50+ chars — specific behavior to adopt next session — SAME as pea.action.instruction>",
    "checkDescription":"<[A] 30+ chars — what evidence appears in session logs when action is taken — SAME as pea.action.verificationCheck>",
    "toolOrPattern":   "<[A] the specific tool, command, or pattern this targets>"
  },
  "goalRelevance":  "<[A] 50+ chars — WHY this pattern matters for the builder's specific goals — SAME as pea.action.goalRelevance>",
  "categoryTags":   ["<[M] descriptive-behavioral-tag-1>", "<[M] descriptive-behavioral-tag-2>"],
  "toolsFilesApis": ["<[P] specific-tool-or-file-1>", "<[P] specific-file-or-api-2>"],
  "lowConfidence":  false,

  "pea": {

    "pattern": {
      "title":        "<[P] same as top-level title — specific to this builder, names tools/files/APIs>",
      "description":  "<[P] 100+ chars — specific behavioral pattern, names tools, quantified frequency, context>",
      "severity":     "<[P] critical|high|medium|low>",
      "toolsFilesApis": ["<[P] specific tool or file the builder interacted with>", "<[P] another tool or API>"]
    },

    "evidence": [
      {
        "utteranceId":  "<[E] first distinct moment — from extraction data — links to source session turn>",
        "sessionId":    "<[E] which session — copied from quotes[n].sessionId>",
        "quote":        "<[E] developer's EXACT words, verbatim — min 15 chars — character-for-character from quotes[n].text>",
        "context":      "<[E] min 20 chars — MUST name a specific tool, project, file, or technology>",
        "observation":  "<[E] min 20 chars — what specific behavior this moment demonstrates and why it matters>",
        "timestamp":    "<[E] ISO 8601 — verbatim from quotes[n].timestamp — never generate or approximate>"
      },
      {
        "utteranceId":  "<[E] SECOND DISTINCT moment — different utteranceId — hard gate rejects fewer than 2>",
        "sessionId":    "<[E] ideally different from first — cross-session = strongest pattern proof>",
        "quote":        "<[E] EXACT words, min 15 chars — different exchange from first moment>",
        "context":      "<[E] min 20 chars with concrete session anchor (tool, file, project, or technology)>",
        "observation":  "<[E] min 20 chars — what this moment demonstrates>",
        "timestamp":    "<[E] ISO 8601>"
      }
    ],

    "action": {
      "instruction":       "<[A] 50+ chars — specific behavior to adopt next session. MUST reference observable session-log signals: tool names, CLI commands (/plan, npm, git), or file patterns.>",
      "verificationCheck": "<[A] 30+ chars — what evidence would appear in future session logs to prove the action was taken>",
      "goalRelevance":     "<[A] 50+ chars — WHY this matters for the builder's specific goals. Reference their actual project, technology stack, or objective. NOT generic advice.>"
    }
  }
}
```

### PEA Sub-Object Field Notes

**`toolsFilesApis`** (flat top-level field) — REQUIRED for new analyses, matches `pea.pattern.toolsFilesApis`. This flat field is consumed by the report UI to render tool tag pills above the evidence section. MUST contain the same entries as `pea.pattern.toolsFilesApis`. The quality gate checks this field AND the `pea.pattern.toolsFilesApis` entries to satisfy the `tool_file_naming` rubric criterion.

**`pea.pattern.toolsFilesApis`** — REQUIRED, min 1 item. List the specific tools, files, APIs, and technologies the builder actually interacted with. These MUST be recognizable names:
- ✓ Good: `["Express.js", "middleware/auth.ts", "vitest", "Bash"]`
- ✗ Bad: `["tool", "API", "framework", "library"]` — too generic, rejected by quality gate

**`pea.evidence[].observation`** vs `evidenceMoments[].behaviorDescription`:
- `evidenceMoments` (flat backward-compat array) uses `behaviorDescription`
- `pea.evidence` (PEA structured array) uses `observation`
- Both describe the same behavioral observation — use the same text in both fields

**`pea.evidence[].timestamp`** — Copy verbatim from `quotes[n].timestamp` for the matching `utteranceId`. This is the same value as `evidenceMoments[].timestamp`. The `DistinctMomentSchema` (used by `pea.evidence`) supports `timestamp` for temporal verification: two moments with identical timestamps are the same exchange. Identical timestamps across both `pea.evidence` and `evidenceMoments` confirm they reference the same source moment. Never generate or approximate — look up by `utteranceId` in the extraction data.

**`pea.evidence[].context`** — Must name at least ONE concrete session anchor (tool from `toolCallsBefore`, project name, file path, or technology). Generic context fails `pattern_specificity` criterion.

**`pea.action.instruction`** — Must reference an observable session-log signal (tool name, CLI command, slash command, or file pattern) to pass the `verifiable_action` rubric criterion.

**Key flat-field ↔ PEA mappings (MUST be kept in sync):**
- `title` ↔ `pea.pattern.title`
- `description` ↔ `pea.pattern.description` (description is richer narrative; pea version is focused pattern desc)
- `severity` ↔ `pea.pattern.severity`
- `toolsFilesApis` ↔ `pea.pattern.toolsFilesApis` (MUST contain same entries — flat array for UI rendering, pea array for quality gate)
- `evidenceMoments[].behaviorDescription` ↔ `pea.evidence[].observation` (same behavior text)
- `evidenceMoments[].timestamp` ↔ `pea.evidence[].timestamp` (MUST be the same ISO value from extraction — same source moment)
- `verifiableAction.action` ↔ `pea.action.instruction`
- `verifiableAction.checkDescription` ↔ `pea.action.verificationCheck`
- `goalRelevance` ↔ `pea.action.goalRelevance`

---

## Category Tags (for Team Aggregation)

Each growth area MUST include `categoryTags` at the top level (1-5 tags required). These are NOT constrained to a fixed taxonomy — generate descriptive tags based on the actual pattern.

Examples of good category tags:
- `"error-handling"`, `"test-coverage"`, `"express-middleware"`
- `"context-management"`, `"session-planning"`, `"tool-composition"`
- `"api-design"`, `"debugging-strategy"`, `"dependency-management"`

Include 2-3 descriptive tags per growth area. Tags are used for cross-developer pattern detection in team views — choose tags that could meaningfully identify shared behavioral clusters.

---

## PEA Field Specification (Explicit Labels and Format Constraints)

The tables below map every field in the PEA sub-object to its labeled section, format constraint, and quality criterion. Use this as a pre-output verification reference — **the quality gate applies these constraints mechanically and rejects non-compliant output with specific error messages**.

### `[P]` Pattern Section Fields

| Field | Type | Hard Constraint | Quality Criterion | Notes |
|-------|------|----------------|-------------------|-------|
| `pea.pattern.title` | `string` | max 60 chars | `pattern_specificity` + `tool_file_naming` | Same as flat `title`; must name specific tools/files/APIs |
| `pea.pattern.description` | `string` | **min 100 chars** | `pattern_specificity` | Names the behavioral pattern, tools, and quantified frequency ("in X of Y sessions") |
| `pea.pattern.severity` | `enum` | `critical\|high\|medium\|low` | — | Same as flat `severity` |
| `pea.pattern.toolsFilesApis` | `string[]` | **min 1 valid entry** | `tool_file_naming` + `pattern_specificity` | No generic placeholders — must be recognizable names (e.g., `"Express.js"`, not `"tool"`) |

### `[E]` Evidence Section Fields

| Field | Type | Hard Constraint | Quality Criterion | Notes |
|-------|------|----------------|-------------------|-------|
| `pea.evidence[]` (array) | `array` | **min 2 items** | `distinct_moments` | Fewer than 2 → hard rejection. Target 3 when data supports it. |
| `pea.evidence[].utteranceId` | `string` | required, **unique per item** | `distinct_moments` | Each item MUST have a DIFFERENT `utteranceId` — same ID twice = same moment, not a pattern |
| `pea.evidence[].sessionId` | `string` | required | `distinct_moments` | 2+ distinct sessions → `lowConfidence: false`; 1 session → `lowConfidence: true` |
| `pea.evidence[].quote` | `string` | **min 15 chars**, verbatim | `distinct_moments` | Developer's EXACT words from `quotes[n].text` — never paraphrased or summarized |
| `pea.evidence[].context` | `string` | **min 20 chars**, concrete anchor | `distinct_moments` | MUST include: project name OR tool sequence from `toolCallsBefore` OR specific technology |
| `pea.evidence[].observation` | `string` | **min 20 chars** | `distinct_moments` | Names the specific tool/command/behavior demonstrated — no vague labels like "bad error handling" |
| `pea.evidence[].timestamp` | `string` | ISO 8601, verbatim | — | Copy from `quotes[n].timestamp` — never generate or approximate |

### `[A]` Action Section Fields

| Field | Type | Hard Constraint | Quality Criterion | Notes |
|-------|------|----------------|-------------------|-------|
| `pea.action.instruction` | `string` | **min 50 chars** + observable signal | `verifiable_action` | MUST reference a tool name, CLI command, slash command, or session-log pattern |
| `pea.action.verificationCheck` | `string` | **min 30 chars** | `verifiable_action` | Describes what appears in future session logs when action is taken |
| `pea.action.goalRelevance` | `string` | **min 50 chars**, builder-specific | `goal_relevance` | WHY this matters for THIS builder's specific project/technology — NOT generic advice |

### `[M]` Metadata Fields

| Field | Type | Hard Constraint | Purpose | Notes |
|-------|------|----------------|---------|-------|
| `categoryTags` | `string[]` | 1–5 items, descriptive | team aggregation | No generic placeholders — e.g., `"error-handling"` not `"tag-1"` or `"general"` |
| `lowConfidence` | `boolean` | default `false` | confidence signal | Set `true` when all evidence is from 1 session OR only 2 moments total |
| `toolsFilesApis` (flat) | `string[]` | **min 1 valid entry** | UI rendering + `tool_file_naming` | Same entries as `pea.pattern.toolsFilesApis` — rendered as tag pills in the report |

### 4-Criteria → Field Mapping (Quick Reference)

> Run this check mentally before generating each growth area. ALL FOUR must pass or the growth area is rejected.

| Criterion | Checked Fields | Hard Gate Condition |
|-----------|---------------|---------------------|
| `distinct_moments` | `pea.evidence[]` length + distinct `utteranceId`s | ≥ 2 items AND all `utteranceId` values are unique |
| `verifiable_action` | `pea.action.instruction` + `verificationCheck` | instruction ≥ 50 chars + verificationCheck ≥ 30 chars + at least one observable signal (tool name, command, etc.) |
| `pattern_specificity` | `pea.pattern.description` length + `toolsFilesApis` count | description ≥ 100 chars AND toolsFilesApis has ≥ 1 entry |
| `tool_file_naming` | `pea.pattern.toolsFilesApis` entries + `title`/`description` text | ≥ 1 valid entry (not a vague placeholder) AND recognizable tech name visible in title or description |
