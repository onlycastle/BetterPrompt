# Expert Knowledge Base: Claude Code Internals

Extracted from Claude Code source analysis. This file provides expert-level behavioral benchmarks for each analysis dimension. Reference this alongside `research-insights.md` for scoring rubrics.

## Source

Patterns extracted from Claude Code's own architecture: instruction loading, prompt assembly, hooks, permissions, subagent orchestration, and authoring flows. These represent how the tool's creators designed optimal usage patterns.

## Expert Patterns by Analysis Domain

### aiPartnership Expert Signals

#### Planning Sophistication

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Layered instruction usage | References to CLAUDE.md, .claude/rules/*.md, CLAUDE.local.md | +12 |
| Spec-before-code | Creates spec/plan files before implementation | +15 |
| Coordinator-style decomposition | Breaks work into research -> synthesis -> implementation -> verification | +12 |
| Path-scoped rules awareness | Uses .claude/rules/ for subsystem-specific guidance | +10 |
| Skill-based workflow | Invokes skills for capability (not just ambient prompts) | +8 |

**Expert baseline**: Claude Code's coordinator prompt encodes a reusable parallel-work pattern: research, synthesis, implementation, verification. Users who follow this decomposition pattern demonstrate expert-level planning.

**Anti-pattern**: Dumping all instructions into one giant prompt. The Claude Code team explicitly separates always-on context (CLAUDE.md), scoped rules (.claude/rules/), and temporary behavior (skills/hooks).

#### Verification and Control

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Stop-hook-style review | Reviews AI output before accepting (like stop hooks check truthfulness) | +12 |
| Explicit constraint specification | Sets "must", "should not", "required" in prompts (like policy objects) | +10 |
| Trust-but-verify workflow | Verifies AI claims instead of blind acceptance | +15 |
| Error chain breaking | Starts fresh after 3+ failures instead of bare retries | +10 |

**Expert baseline**: Claude Code uses Stop hooks as the "truthfulness/correctness boundary" -- the best place to catch "fixed without verification" and false completion claims. Users who review AI output before accepting demonstrate this same pattern.

### sessionCraft Expert Signals

#### Context Engineering

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Proactive context management | /compact usage before context overflow | +15 |
| Fresh session strategy | Starting new sessions for new tasks instead of continuing polluted context | +12 |
| Context-aware token budgeting | Keeping prompts concise when context is high | +10 |
| Volatile context isolation | Using Task/Agent tool for work that would pollute main context | +12 |
| Cache-stable prompt patterns | Consistent prompt structure that enables prompt caching | +8 |

**Expert baseline**: Claude Code treats prompt mass like a performance bug. They separate cached vs uncached prompt material intentionally. The "50% context rule" isn't arbitrary -- above 70% fill, model performance degrades. Expert users proactively manage their context window.

**Key metric**: Context fill percentage. Expert users maintain avg < 50%, never exceed 70% without compaction. Claude Code marks uncached sections as "DANGEROUS" -- that's how seriously they treat context economics.

#### Session Lifecycle

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Session separation discipline | Distinct sessions for distinct tasks | +10 |
| Sunk cost avoidance | Abandoning failing approach after 3+ retries, starting fresh | +12 |
| Medium-length session preference | 4-10 turn sessions (focused, not runaway) | +8 |
| Minimal mode awareness | Using --bare or simplified context when debugging | +6 |

**Expert baseline**: The Claude Code team builds "minimal mode" as a first-class debugging primitive. Session hooks are ephemeral and in-memory. Expert users treat each session as a fresh workspace, not an infinite conversation.

### toolMastery Expert Signals

#### Tool Selection Mastery

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Read over cat | Using Read tool instead of `bash cat` for file inspection | +10 |
| Grep over bash grep | Using dedicated Grep tool instead of `bash grep/rg` | +10 |
| Glob over find | Using Glob tool instead of `bash find` or `bash ls` for file search | +10 |
| Edit over sed | Using Edit tool for targeted modifications instead of `bash sed` | +8 |
| Write for new files only | Using Write only for creation, Edit for modifications | +8 |
| Task for delegation | Using Task/Agent tool for parallel work instead of sequential prompting | +15 |
| TodoWrite for tracking | Using TodoWrite for multi-step work tracking | +12 |

**Expert baseline**: Claude Code's own system prompt explicitly tells users "Do NOT use the Bash tool to run commands when a relevant dedicated tool is provided." The tool descriptions themselves encode the correct selection heuristic. Users who follow this show tool mastery.

**Anti-patterns scored negatively**:
- Using `bash cat/head/tail` when Read is available: -8
- Using `bash grep/rg` when Grep is available: -8
- Using `bash find/ls` when Glob is available: -8
- Using `bash sed/awk` when Edit is available: -8
- Using Write for small changes when Edit suffices: -5

#### Advanced Orchestration

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Multi-agent workflows | Spawning Task agents for independent work | +15 |
| Parallel execution | Multiple concurrent Task invocations | +12 |
| Subagent context slimming | Scoping agent tasks to specific files/concerns | +10 |
| Background task management | Using background execution for long operations | +8 |
| Worktree isolation | Using git worktrees for isolated feature work | +10 |

**Expert baseline**: Claude Code's subagent system gives child agents the "smallest context that still preserves correctness." Expert users delegate with crisp scope boundaries, not vague instructions.

### skillResilience Expert Signals

#### Cold Start Excellence

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| CLAUDE.md-informed starts | First prompt references project context, architecture, or conventions | +15 |
| Structured first prompt | Session opener includes task description, constraints, and expected output | +12 |
| Context loading pattern | Reading relevant files before starting work | +10 |
| Git status awareness | Checking current state before making changes | +8 |

**Expert baseline**: Claude Code's instruction loading follows managed -> user -> project -> local precedence. Expert users mirror this by providing layered context: what the project is, what the task is, what constraints apply, and what they've already tried.

**Key insight**: "Cold Start Resilience" (M_CSR from VCP paper) maps directly to how well users leverage the instruction architecture. Users who write CLAUDE.md, use .claude/rules/, and structure their first prompts well demonstrate high M_CSR.

#### Error Recovery Patterns

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Fresh approach after failure | Starting new session or new approach after 3+ failures | +12 |
| Error analysis before retry | Asking "why did this fail?" before retrying | +10 |
| Constraint refinement | Adding constraints after failure to prevent recurrence | +8 |
| Hook-style verification | Checking output systematically after each step | +10 |

**Expert baseline**: Claude Code's hook system has explicit exit-code semantics. Exit code 2 means "block" for PreToolUse but "feedback" for PostToolUse. Expert users similarly distinguish between "stop and rethink" vs "adjust and continue."

### sessionMastery Expert Signals

#### Anti-Pattern Absence (Scored Inversely)

| Anti-Pattern | Detection Signal | Score Penalty |
|-------------|-----------------|---------------|
| Context overflow without compaction | >90% context fill with no /compact | -15 |
| Bare retry spirals | 3+ short retry messages after errors | -12 |
| Session sprawl | Single session exceeding 30 turns without clear progress | -10 |
| Tool failure chains | 3+ consecutive tool errors without strategy change | -10 |
| Frustration expressions | "ugh", "still not working", "same error" | -8 |
| Blind acceptance | No output modification across entire session | -10 |

**Expert baseline**: Claude Code's Session Mastery scoring is "absence-of-anti-pattern" -- higher scores indicate clean sessions free of common pitfalls. Expert developers produce clean sessions with no retries, no context overflows, and focused single-topic work.

#### Session Hygiene Excellence

| Expert Pattern | Detection Signal | Score Impact |
|---------------|-----------------|--------------|
| Clear session boundaries | Each session has a single clear goal | +10 |
| Appropriate session length | 4-10 turns for focused work | +8 |
| Clean session endings | Task completion confirmed before ending | +8 |
| Git commit discipline | Regular commits during long sessions | +6 |

## Harness Engineering Maturity Indicators

These cross-cutting signals indicate a user operating at harness-engineering level (beyond just "using Claude Code"):

| Maturity Indicator | Detection Method | Domain Boost |
|-------------------|-----------------|--------------|
| CLAUDE.md authoring | References to writing/updating CLAUDE.md | aiPartnership +5, skillResilience +5 |
| Hook configuration | References to hooks, PreToolUse, PostToolUse, settings.json | sessionMastery +5, toolMastery +5 |
| Skill usage | /skill invocations or skill file references | toolMastery +5, aiPartnership +5 |
| MCP server awareness | References to MCP servers, tools, connections | toolMastery +8 |
| Permission mode awareness | References to permissions, auto mode, plan mode | sessionMastery +5 |
| Context compaction discipline | Regular /compact usage (>2 per 10 sessions) | sessionCraft +10 |
| Task delegation proficiency | Task tool for parallel work (>1 per 5 sessions) | aiPartnership +8, toolMastery +8 |

## What NOT to Score

- Do not penalize absence of advanced features if user's session count < 10 (insufficient data)
- Do not treat MCP/plugin configuration as required -- it's bonus knowledge
- Do not score hook authoring unless user explicitly references it
- These expert patterns are aspirational benchmarks, not minimum requirements
