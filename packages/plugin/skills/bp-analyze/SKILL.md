---
name: bp-analyze
description: Orchestrate a full BetterPrompt analysis of your Claude Code sessions
model: sonnet
---

# BetterPrompt Analysis Orchestrator

## Overview

You are the orchestration layer for a complete BetterPrompt analysis run. Your job is to coordinate data extraction, session summaries, domain-specific analysis, developer type classification, evidence verification, narrative generation, and final report assembly. You do not perform deep analysis yourself -- you dispatch each analysis stage as an **isolated Agent** with the appropriate model, then track progress via MCP tools.

## Architecture: Agent-Based Dispatch

Each analysis skill runs as an **isolated Agent** rather than inline in this session. This prevents context accumulation (which causes Claude Max rate-limit failures) and enables per-stage model selection.

**How it works:**
1. This orchestrator calls `get_run_progress` to determine the next stage
2. If the next stage is a skill, dispatch it as an Agent (see Agent Dispatch below)
3. If the next stage is an MCP tool, call it directly
4. After each stage completes, call `get_run_progress` again
5. Repeat until `completionStatus: "complete"`

**Model Tiering:** Each agent runs on the cheapest model sufficient for its task:

| Skill Type | Model | Skills |
|------------|-------|--------|
| Extractors | `haiku` | extract-ai-partnership, extract-session-craft, extract-tool-mastery, extract-skill-resilience, extract-session-mastery |
| Summarizers | `haiku` | summarize-sessions, summarize-projects, generate-weekly-insights |
| Writers | `sonnet` | write-ai-partnership, write-session-craft, write-tool-mastery, write-skill-resilience, write-session-mastery |
| Classification | `sonnet` | classify-type |
| Content | `sonnet` | write-content, translate-report |

**Constraint:** Skills dispatched as Agents must NOT internally spawn additional Agents or Tasks. Each agent runs its skill to completion and returns.

## Agent Dispatch

**CRITICAL**: Use the built-in `Agent` tool from your tool list to dispatch skills. Do NOT use Bash to run `claude` CLI commands (e.g., `claude --model haiku -p "..."`). The Agent tool is a first-class tool like `Read` or `Bash` -- invoke it directly with the parameters listed below.

When `get_run_progress` returns a `nextStep` with a non-null `skill`, dispatch it as an Agent using the built-in `Agent` tool:

- **prompt**: `"You are executing a BetterPrompt analysis stage. Read the skill instructions at [PLUGIN_PATH]/skills/[SKILL_NAME]/SKILL.md and follow them exactly. You have access to BetterPrompt MCP tools (get_prompt_context, get_stage_output, save_stage_output, save_domain_results, etc.). Execute the complete skill workflow. When finished, report whether the stage completed successfully or failed (include the error message if failed). Do not delegate to other agents or tasks."`
- **model**: Use the model from the Model Tiering table above
- **description**: `"bp: [skill-name]"`

To resolve `[PLUGIN_PATH]`: look at the BetterPrompt plugin installation path. The skills directory is at the plugin root under `skills/`. You can determine the plugin root from the MCP server configuration or by searching for the skills directory under `~/.claude/plugins/`.

**After each agent returns**, pause ~5 seconds, then call `get_run_progress` to determine the next stage.

## Instructions

Follow these phases in strict order. Each phase must complete before the next begins.

### Pre-Flight Check

Before anything else, call `get_user_prefs`. If `prefs.welcomeCompleted` exists and was set within the last 3 minutes (compare its ISO timestamp to the current time), the user likely just finished `bp setup` in this session. In that case:

1. Print `"[bp] Setup just completed. Pausing 30 seconds to reset rate-limit budget..."`
2. Wait ~30 seconds before proceeding

### Resume Check

Before starting Phase 1, call `get_run_progress`.

1. If it returns `status: "ok"` and `completionStatus: "incomplete"`, resume from `nextStep` using the saved current run.
2. If `nextStep.tool` is non-null, call that MCP tool directly. If `nextStep.skill` is non-null, dispatch it as an Agent.
3. When resuming, print a brief status line like `"[bp] Resuming run #<id> from <skill-or-tool>..."`.
4. Do **NOT** call `scan_sessions` or `extract_data` again when a resumable run already exists. Reuse the saved Phase 1 data and continue from the first incomplete required stage.
5. If `get_run_progress` returns `status: "ok"` and `completionStatus: "complete"`, skip straight to Phase 4 and call `generate_report` to reopen the finished report.
6. If `get_run_progress` returns `status: "no_run"`, start from Phase 1 normally.
7. Only discard an existing run and restart Phase 1 if the user explicitly asks for a fresh rerun or if the saved run is clearly incompatible with the requested scope.

### Required Execution Loop

Once Phase 1 data exists, `get_run_progress` is the ONLY source of truth for stage order. Do not infer the next stage from memory, phase labels, or what "should" come next.

1. If `get_run_progress` returns `status: "no_run"`, run Phase 1 and Phase 1.5, then call `get_run_progress` again.
2. While `completionStatus` is `"incomplete"`:
   - Print a `[bp]` status line for the exact `nextStep`.
   - If `nextStep.tool` is non-null, call that MCP tool directly.
   - If `nextStep.skill` is non-null, dispatch it as an Agent using the model from the tiering table.
   - Wait for the agent or tool to complete.
   - Pause ~5 seconds.
   - Immediately call `get_run_progress` again and follow the returned `nextStep`.
3. Only call `generate_report` after `get_run_progress` reports `completionStatus: "complete"`.

Never jump directly from the extractor stages to type classification. The required persisted order is:
extractors -> writer domains -> projectSummaries -> weeklyInsights -> classify_developer_type -> classify-type -> verify_evidence -> write-content -> generate_report.

### Phase 1: Data Discovery and Extraction

1. Call `get_user_prefs` and check `prefs.selectedProjects`. If present and non-empty, use it as the `includeProjects` parameter for both `scan_sessions` and `extract_data`. If absent or empty, analyze all projects.
2. Call the `scan_sessions` MCP tool (with `includeProjects` if set) to discover all supported local session sources on this machine.
3. Call the `extract_data` MCP tool (with `includeProjects` if set) to run deterministic Phase 1 extraction. This produces the canonical Phase 1 artifact with structured metrics, activity sessions, and full parsed-session access for later stages.
4. Present a brief summary to the user:
   - Number of sessions found (and "X of Y projects" if filtering is active)
   - Date range covered
   - Key metrics snapshot (total tokens, average session length, top projects)
5. Phase 1 output is persisted at `~/.betterprompt/phase1-output.json` for diagnostics and parity capture. Downstream skills should read stage-specific payloads through `get_prompt_context`, not by rereading the raw file.

### Phase 1.5: Session Summaries

Dispatch the `summarize-sessions` skill as an Agent with `model: haiku`. This generates a concise 1-line summary for each analyzed session and persists the results via `save_stage_output`.

### Phase 2: Dimension Analysis (Agent Dispatch)

Dispatch each skill as an isolated Agent, one at a time. Wait for each agent to complete before dispatching the next. Each agent persists its own output to the current local analysis run.

**Stage 1 - Data Extraction:** Dispatch the 5 extractor agents (model: `haiku`).

| # | Skill | Stage Key | Purpose |
|---|-------|-----------|---------|
| 1 | `extract-ai-partnership` | extractAiPartnership | Planning, orchestration, verification, control signals |
| 2 | `extract-session-craft` | extractSessionCraft | Context efficiency, burnout risk, sustainability signals |
| 3 | `extract-tool-mastery` | extractToolMastery | Tool diversity, advanced usage, workflow signals |
| 4 | `extract-skill-resilience` | extractSkillResilience | Cold start, hallucination detection, explainability signals |
| 5 | `extract-session-mastery` | extractSessionMastery | Absence-of-anti-pattern signals, expert differentiation |

**Stage 2 - Narrative Generation:** After ALL extractors complete, dispatch the 5 writer agents (model: `sonnet`).

| # | Skill | Domain Key | Purpose |
|---|-------|------------|---------|
| 6 | `write-ai-partnership` | aiPartnership | Narrative for planning/orchestration/verification/control |
| 7 | `write-session-craft` | sessionCraft | Narrative for context management and session sustainability |
| 8 | `write-tool-mastery` | toolMastery | Narrative for tool usage mastery |
| 9 | `write-skill-resilience` | skillResilience | Narrative for skill resilience (VCP metrics) |
| 10 | `write-session-mastery` | sessionMastery | Narrative for session mastery (absence scoring) |

**Stage 3 - Context Generation:** After all writers complete, dispatch context generation agents (model: `haiku`).

| # | Skill | Key | Purpose |
|---|-------|-----|---------|
| 11 | `summarize-projects` | projectSummaries | Project-level summaries from session data |
| 12 | `generate-weekly-insights` | weeklyInsights | This Week narrative, stats, and highlights |

### Phase 2.5: Developer Type Classification

After all domain results are saved:

**Note:** Deterministic scores are computed but NOT used to override LLM domain scores for the 5-dimension framework. The `classify_developer_type` tool still runs for type classification only. Content-writer skills score based on their extraction data, not deterministic overrides.

1. Call the `classify_developer_type` MCP tool. In `get_run_progress`, this appears as `nextStep.stage = "deterministicType"`. Do not dispatch `classify-type` until this tool returns `status: "ok"`. This reads deterministic scores and produces:

- Primary developer type (from the 5x3 matrix)
- Control level (explorer / navigator / cartographer)
- Score distribution across all dimensions
- Matrix name and emoji

2. Dispatch the `classify-type` skill as an Agent (model: `sonnet`). This produces the narrative type classification stage output and persists it via `save_stage_output` under `typeClassification`.

### Phase 2.8: Evidence Verification

Call the `verify_evidence` MCP tool. This deterministically validates that evidence quotes in each domain's strengths and growth areas still map back to developer utterances from the current run. Low-confidence or missing matches are filtered out and the `evidenceVerification` stage is persisted automatically.

### Phase 3: Narrative Generation

Dispatch the `write-content` skill as an Agent (model: `sonnet`) to generate top focus areas with coaching narratives and start/stop/continue actions. This skill reads all domain results and synthesizes them into actionable guidance. Results are persisted via `save_stage_output`.

### Phase 3.5: Translation (Conditional)

If the developer's sessions are primarily non-English, or the user explicitly asks for translated report output, dispatch the `translate-report` skill as an Agent (model: `sonnet`) after content generation. This stage persists `translator` output via `save_stage_output` and must preserve structure while translating only report-facing text fields.

If the sessions are already primarily English and the user did not request translation, skip this phase. Do not fabricate a translator stage just to fill the slot.

### Phase 4: Report Assembly

1. Call the `generate_report` MCP tool to create a localhost report page from the canonical local run envelope.
2. Present the final summary to the user:
   - Developer type and personality headline
   - Top 3 strengths (one line each)
   - Top 3 growth areas (one line each)
   - Overall scores by domain
   - Report URL for the full interactive report

## Progress Reporting

Print a brief `[bp]` status line at each major phase:
1. Before Phase 1: `"[bp] Phase 1: Scanning and extracting session data..."`
2. Before Phase 1.5: `"[bp] Phase 1.5: Summarizing sessions..."`
3. Before each Phase 2 agent: `"[bp] Dispatching <skill-name> (model: <model>)..."` (e.g., `"[bp] Dispatching extract-ai-partnership (model: haiku)..."`)
4. Before Phase 2.5: `"[bp] Phase 2.5: Classifying developer type..."`
5. Before Phase 2.8: `"[bp] Phase 2.8: Verifying evidence..."`
6. Before Phase 3: `"[bp] Phase 3: Generating narratives..."`
7. Before Phase 3.5 (if applicable): `"[bp] Phase 3.5: Translating report..."`
8. Before Phase 4: `"[bp] Phase 4: Assembling report..."`
9. On completion: `"[bp] Analysis complete."`

## Error Handling

- If `scan_sessions` finds zero sessions, stop and inform the user. Do not proceed.
- If `extract_data` fails, surface the error. Do not fabricate Phase 1 data.
- If a previous `bp analyze` invocation stopped mid-run because of token budget or an interrupted session, call `get_run_progress` and continue from the first incomplete stage instead of restarting Phase 1.
- If the `summarize-sessions` agent fails, continue -- session summaries are optional context.
- If any Phase 2 agent fails with a rate limit or throttling error (e.g., "Rate limit reached", "429", "Too Many Requests", "overloaded", "capacity"):
  1. Print `"[bp] Rate limit hit. Waiting 60 seconds before retrying <skill-name>..."`
  2. Wait ~60 seconds
  3. Retry the agent once
  4. If the retry also fails, treat it as a stage failure and continue with remaining stages
- If any Phase 2 agent fails for non-rate-limit reasons:
  1. Print `"[bp] <skill-name> failed: <error>. Waiting 30 seconds before retrying..."`
  2. Wait ~30 seconds
  3. Retry the agent once
  4. If the retry also fails, report the failure and continue with remaining stages
- If `verify_evidence` fails, continue -- evidence verification is a quality enhancement, not blocking.
- If `translate-report` is skipped because English output is appropriate, continue normally. If translation is needed but fails, continue with English output and note that translation is incomplete.
- Never silently swallow errors or return placeholder data.
- Never end the session while the analysis is mid-stage. The only valid stopping points are after an agent or tool confirms success or after you surface a concrete failure.

### Why Agent Dispatch Eliminates Rate Limits

Each agent runs in an **isolated context** -- it starts fresh with only the SKILL.md instructions and MCP tool data (via `get_prompt_context`). Unlike inline skill execution, no conversation history accumulates across stages. This means:
- Stage #15 consumes the same tokens as stage #1 (no context growth)
- Haiku extractors use ~12x fewer tokens per call than Opus
- Sonnet writers use ~5x fewer tokens per call than Opus
- The 5-second inter-stage pause is sufficient (no 60-second cooldowns needed)

## Quality Checklist

- [ ] Phase 1 output persisted for diagnostics, and downstream stages use `get_prompt_context`
- [ ] Session summaries generated (Phase 1.5)
- [ ] All 5 dimension extractions completed (or failures reported)
- [ ] All 5 dimension narratives completed (or failures reported)
- [ ] Project summaries and weekly insights generated
- [ ] Developer type classification completed
- [ ] Evidence verification completed
- [ ] Narrative content generated (Phase 3)
- [ ] Translation generated when required by the session language or user request
- [ ] Report URL returned to user
- [ ] Summary presented with scores, type, strengths, and growth areas
