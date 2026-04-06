# BetterPrompt Research Insights & Scoring Reference

Shared knowledge file for all dimension analysis skills. Reference this for research-backed benchmarks, scoring rubrics, and behavioral signal detection.

## PTCF Prompt Framework

All analysis skills follow the PTCF structure:
- **Persona**: Define the analyst's expertise and role
- **Task**: Specify what to extract or generate
- **Context**: Provide relevant data sources and constraints
- **Format**: Define the output structure and persistence target

## Scoring Rubrics by Dimension

### aiCollaboration (AI Collaboration Mastery)
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| Structured Planning | 33% | TodoWrite usage, step-by-step plans, spec file references, plan mode usage |
| AI Orchestration | 33% | Task tool delegation, subagent usage, parallel agent workflows |
| Critical Verification | 33% | Code review requests, test requests, output modifications, rejection of AI suggestions |

### contextEngineering (Context Engineering)
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| WRITE (Preserve) | 30% | File references, code element mentions, constraint keywords, pattern usage |
| SELECT (Retrieve) | 25% | Specific file:line references, codebase navigation, pattern-based lookups |
| COMPRESS (Reduce) | 25% | /compact usage, efficient iterations (3-5 turns ideal), session separation |
| ISOLATE (Partition) | 20% | Task tool delegation, focused single-concern prompts, multi-agent workflows |

### toolMastery (Tool Mastery)
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| Diversity | 40% | Number of distinct tools used (Read, Edit, Grep, Glob, Bash, Task, TodoWrite, WebSearch) |
| Advanced Usage | 30% | Task tool for subagents, TodoWrite for tracking, WebSearch for research |
| Workflow Composition | 30% | Multi-tool chains, tool selection appropriateness, custom workflows |

### burnoutRisk (Burnout Risk Assessment)
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| Session Patterns | 40% | Average duration, longest session, trend (increasing/decreasing frequency) |
| Time Distribution | 30% | After-hours work (>9 PM), weekend sessions, late night (after midnight) |
| Frustration Signals | 30% | Repeated retries, escalating tone, "this doesn't work" patterns, session abandonment |

### aiControl (AI Control Index)
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| Verification Rate | 35% | Output modification requests, review requests, questions about AI output. Target: 40-60% of turns |
| Constraint Specification | 25% | "must", "should not", "required" keywords. Target: ~1-2 constraints per message |
| Output Critique | 25% | Corrections, rejections, alternative requests. Target: 10-30% critique rate |
| Context Control | 15% | /compact usage, fresh session starts, Task delegation for isolation |

### skillResilience (Skill Resilience) - Based on VCP Paper
| Sub-dimension | Weight | What to Measure |
|---------------|--------|-----------------|
| Cold Start Resilience (M_CSR) | 40% | Detailed first prompts with context vs vague "help me" starts |
| Hallucination Detection (M_HT) | 35% | Error corrections, challenges to AI, "that's wrong" moments |
| Explainability Gap (E_gap) | 25% | Inverse: "Explain this code" / "What does this do?" requests indicate gap |

## VCP Paper Metrics (arXiv:2601.02410)

The Vibe Coding Paper (VCP) established three key metrics for measuring developer skill resilience when using AI coding tools:

- **M_CSR (Cold Start Resilience)**: Measures ability to write detailed, structured first prompts that provide sufficient context for AI. High M_CSR = developer understands the problem well enough to describe it clearly. Low M_CSR = vague "help me with X" starts suggesting dependency.

- **M_HT (Hallucination Tolerance)**: Measures frequency of catching and correcting AI errors. High M_HT = developer actively validates output and catches mistakes. Low M_HT = blind acceptance of AI output, increasing risk of bugs.

- **E_gap (Explainability Gap)**: Measures how often developers ask AI to explain code it generated. High E_gap = developer doesn't understand AI-generated code (skill atrophy indicator). Low E_gap = developer understands the code and can work independently.

**Key finding**: Heavy AI reliance correlates with measurable skill decay. Professional developers modify approximately 50% of AI-generated code.

## Professional Benchmarks

### The 50% Modification Test
Professional developers modify approximately 50% of AI-generated code. Accepting output uncritically signals either exceptional prompt engineering or dangerous over-reliance. Source: elvis (Twitter), validated by industry surveys.

### The 80% Planning Rule
Top developers spend 80% of their time planning and 20% executing with AI. This dramatically improves outcomes compared to diving straight into coding. Source: Peter Yang.

### The 50% Context Rule
Approximately 50% context window utilization is optimal. Above 70% fill, model performance degrades noticeably. Use /compact proactively. Source: Anthropic Context Engineering Guide.

### Sunk Cost Fallacy in AI Prompting
When AI fails to produce correct output after 3+ attempts, starting a fresh session with clearer context outperforms continued iteration in a degraded context window. Source: MIT Technology Review.

### Fresh Sessions Outperform Continued Context
New sessions with well-structured first prompts consistently outperform continued sessions with accumulated context pollution. Session separation is a feature, not a limitation.

### Task Decomposition Pattern
Break complex work into A -> A1 -> A2 -> A3 -> B structure. Each subtask gets focused AI attention. Source: Claude Code best practices.

### Keep MCP Servers Under 10
Each MCP server consumes context tokens. Beyond 10 servers, context overhead reduces available working memory for actual analysis.

### Inverted TDD
Write tests first, then have AI implement code to pass them. This ensures verification happens before implementation and prevents blind acceptance. Source: Community best practices.

### Cascade Pattern
Run parallel Claude instances for independent tasks. Each instance gets clean context. Combine results after completion. Source: Advanced Claude Code usage patterns.

## Behavioral Signal Reference

### Strength Signal Keywords by Dimension
| Dimension | Keywords |
|-----------|----------|
| aiCollaboration | advanced prompting, expert collaboration, AI pair programming mastery, optimal AI interaction |
| contextEngineering | advanced context management, token optimization, multi-context strategies, context compaction |
| toolMastery | advanced tool orchestration, multi-tool workflows, tool chain optimization, subagent mastery |
| burnoutRisk | sustainable AI workflow, productivity balance, efficient sessions, healthy AI usage |
| aiControl | AI guidance mastery, direction control, output steering, expert verification |
| skillResilience | skill maintenance, independent coding, cold start mastery, continuous learning |

### Growth Signal Keywords by Dimension
| Dimension | Keywords |
|-----------|----------|
| aiCollaboration | AI collaboration basics, effective prompts, clear instructions, AI communication |
| contextEngineering | context basics, WRITE strategy, file references, context window, providing context |
| toolMastery | tool basics, when to use tools, tool selection, basic automation |
| burnoutRisk | session management, break strategies, overreliance prevention, healthy boundaries |
| aiControl | taking control, guiding AI, verification basics, code review, modification practice |
| skillResilience | skill atrophy, VCP practice, cold start exercises, dependency reduction, manual coding |

## Type Classification Reference

### 5 AI Coding Styles
- **Architect**: Strategic planner who designs before coding. Plans thoroughly, uses structured prompts.
- **Scientist**: Truth-seeker who verifies AI output. Questions, tests, validates everything.
- **Collaborator**: Partnership master who iterates through dialogue. Refines through conversation.
- **Speedrunner**: Agile executor who moves fast. Quick iterations, rapid prototyping.
- **Craftsman**: Quality artisan who prioritizes code quality. Focus on maintainability, style.

### 3 Control Levels
- **vibe-coder**: High AI dependency, accepts output without much modification
- **developing**: Learning balance, building control habits
- **ai-master**: Strategic control, directs AI as a precision tool

## Analysis Quality Standards

- **NEVER** use generic phrases without specific evidence quotes
- **ALWAYS** include verbatim user quotes, not paraphrases
- **MINIMUM** 15-20 quotes per dimension across strengths and growth areas
- **EACH** strength cluster: 3-5 evidence quotes showing the pattern repeatedly
- **EACH** growth area: 2-3 evidence quotes with specific examples
- **NO HEDGING**: Use "is", "does", "demonstrates" -- never "may", "might", "tends to"
- **QUANTIFY**: "in X of Y sessions", not "often" or "sometimes"

## Verifiable Next-Session Action Requirement (MANDATORY)

Every growth area **MUST** include a `verifiableAction` object with a concrete next-session action that can be checked against future session logs. This is a non-negotiable quality gate — growth areas without verifiable actions will be rejected by the save-domain-results CLI.

### What Makes an Action Verifiable

A verifiable action describes a specific behavior change the developer can take in their **next session** that produces an **observable signal** in session logs. The signal must be one of:

| Signal Type | Examples | What Appears in Logs |
|------------|---------|---------------------|
| Tool usage | "Use Grep to search before asking AI" | `tool_use` block with `name: "Grep"` |
| Slash commands | "Start with /plan before implementation" | User message containing `/plan` |
| CLI commands | "Run vitest before making changes" | Bash `tool_use` with `vitest` in command |
| File operations | "Create a CLAUDE.md constraint list" | Write/Edit `tool_use` targeting `CLAUDE.md` |
| Prompt patterns | "State goal and constraints in first message" | First user message contains constraint keywords |
| Behavioral sequence | "Read test file before editing source" | Read `tool_use` for `.test.ts` before Edit `tool_use` for `.ts` |

### verifiableAction Object Format

```json
{
  "verifiableAction": {
    "action": "In your next session involving API changes, run the existing test suite via Bash ('npm test') before making any code modifications to establish a passing baseline.",
    "checkDescription": "Session contains Bash tool_use with 'npm test' or 'vitest' command appearing before any Edit tool_use targeting source files.",
    "toolOrPattern": "Bash test execution"
  }
}
```

**Fields:**
- `action` (required, min 50 chars): The specific behavior to adopt. Must name tools, commands, files, or patterns.
- `checkDescription` (required, min 30 chars): How a reviewer would verify this in session logs. Describes the observable signal.
- `toolOrPattern` (optional): The primary tool, command, or pattern targeted.

### Actions That PASS the Rubric

| Growth Area | Verifiable Action | Why It Passes |
|------------|------------------|---------------|
| "Unverified AI Output" | "In your next session, add at least one Read tool call to verify file state after every AI-generated Edit" | Tool_use sequence is checkable in logs |
| "Missing Test Execution" | "Run the test suite via Bash before AND after each code change" | Bash tool_use with test command is observable |
| "Context Window Bloat" | "Use /compact when context exceeds 60% capacity" | /compact command in user messages is searchable |
| "No Planning Phase" | "Start your next session with TodoWrite to decompose the task into 3+ subtasks" | TodoWrite tool_use in first 3 turns is verifiable |

### Actions That FAIL the Rubric

| Generic Action | Why It Fails | How to Fix |
|---------------|-------------|-----------|
| "Try to plan more" | No observable signal in logs | "Use /plan or TodoWrite in your first 3 messages" |
| "Be more careful with AI output" | Not checkable — "careful" isn't observable | "Add a Read tool call after each Edit to verify changes" |
| "Improve your testing habits" | Vague aspiration, not a session action | "Run 'npm test' via Bash before committing" |
| "Consider using more tools" | No specific tool named, no timing | "Use Grep instead of Bash for file searches" |

### Quality Gate Enforcement

The `save-domain-results` CLI validates:
1. `verifiableAction` object is present on every growth area
2. `action` field is >= 50 characters
3. `checkDescription` field is >= 30 characters
4. Combined text references at least one observable session-log signal (tool name, command, file reference, or prompt pattern)

Growth areas failing any of these checks will be rejected with a `quality_error` status.
