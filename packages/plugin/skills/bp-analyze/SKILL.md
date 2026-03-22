---
name: bp-analyze
description: Orchestrate a full BetterPrompt analysis of your Claude Code sessions
model: sonnet
---

# BetterPrompt Analysis Orchestrator

## Overview

You are the orchestration layer for a complete BetterPrompt analysis run. Your job is to coordinate data extraction, session summaries, domain-specific analysis, developer type classification, evidence verification, narrative generation, and final report assembly. You do not perform deep analysis yourself -- you coordinate the MCP tools and specialized BetterPrompt skills so the full pipeline completes in order.

## Instructions

Follow these phases in strict order. Each phase must complete before the next begins unless explicitly noted as parallelizable.

### Phase 1: Data Discovery and Extraction

1. Read `~/.betterprompt/prefs.json` and check for `selectedProjects`. If present and non-empty, use it as the `includeProjects` parameter for both `scan_sessions` and `extract_data`. If absent or empty, analyze all projects.
2. Call the `scan_sessions` MCP tool (with `includeProjects` if set) to discover all supported local session sources on this machine.
3. Call the `extract_data` MCP tool (with `includeProjects` if set) to run deterministic Phase 1 extraction. This produces the canonical Phase 1 artifact with structured metrics, activity sessions, and full parsed-session access for later stages.
4. Present a brief summary to the user:
   - Number of sessions found (and "X of Y projects" if filtering is active)
   - Date range covered
   - Key metrics snapshot (total tokens, average session length, top projects)
5. Phase 1 output is persisted at `~/.betterprompt/phase1-output.json` for diagnostics and parity capture. Downstream skills should read stage-specific payloads through `get_prompt_context`, not by rereading the raw file.

### Phase 1.5: Session Summaries

Run the `summarize-sessions` skill. This generates a concise 1-line summary for each analyzed session and persists the results via `save_stage_output`.

### Phase 2: Dimension Extraction (Sequential with Cooldown)

Run each skill **one at a time, sequentially** to avoid rate limit failures on Claude Max. Wait for each skill to fully complete before starting the next. Each unit persists its own output to the current local analysis run.

**Rate Limit Prevention:** After each skill completes, pause briefly before starting the next. This spreading prevents token-per-minute rate limit spikes on Claude Max plans. Print the cooldown status so the user knows you are pacing intentionally, not stalling.

**Stage 1 - Data Extraction:** Run the 6 data-analyst skills first. These extract structured signals, quotes, and patterns from Phase 1 data and save via `save_stage_output`.

| # | Subagent Skill | Type | Stage Key | Purpose |
|---|----------------|------|-----------|---------|
| 1 | `extract-ai-collaboration` | Extractor (`save_stage_output`) | extractAiCollaboration | Planning, orchestration, verification signals |
| 2 | `extract-context-engineering` | Extractor (`save_stage_output`) | extractContextEngineering | WRITE/SELECT/COMPRESS/ISOLATE signals |
| 3 | `extract-tool-mastery` | Extractor (`save_stage_output`) | extractToolMastery | Tool diversity, advanced usage, workflow signals |
| 4 | `extract-burnout-risk` | Extractor (`save_stage_output`) | extractBurnoutRisk | Session patterns, time distribution, frustration signals |
| 5 | `extract-ai-control` | Extractor (`save_stage_output`) | extractAiControl | Verification, constraints, critique signals |
| 6 | `extract-skill-resilience` | Extractor (`save_stage_output`) | extractSkillResilience | Cold start, hallucination detection, explainability signals |

**Stage 2 - Narrative Generation:** After ALL extractors complete, run the 6 content-writer skills. These read extraction data via `get_stage_output` and generate narrative strengths/growth areas via `save_domain_results`.

| # | Subagent Skill | Type | Domain Key | Purpose |
|---|----------------|------|------------|---------|
| 7 | `write-ai-collaboration` | Writer (`save_domain_results`) | thinkingQuality | Narrative for planning/orchestration/verification |
| 8 | `write-context-engineering` | Writer (`save_domain_results`) | contextEfficiency | Narrative for context engineering mastery |
| 9 | `write-tool-mastery` | Writer (`save_domain_results`) | communicationPatterns | Narrative for tool usage mastery |
| 10 | `write-burnout-risk` | Writer (`save_domain_results`) | learningBehavior | Narrative for burnout risk and sustainability |
| 11 | `write-ai-control` | Writer (`save_domain_results`) | sessionOutcome | Narrative for AI control and verification mastery |
| 12 | `write-skill-resilience` | Writer (`save_domain_results`) | content | Narrative for skill resilience (VCP metrics) |

**Stage 3 - Context Generation:** After all writers complete, run context generation skills.

| # | Subagent Skill | Type | Key | Purpose |
|---|----------------|------|-----|---------|
| 13 | `summarize-projects` | Context (`save_stage_output`) | projectSummaries | Project-level summaries from session data |
| 14 | `generate-weekly-insights` | Context (`save_stage_output`) | weeklyInsights | This Week narrative, stats, and highlights |

**Do NOT run any of these skills in parallel. Start each skill only after the previous one has completed.**

### Phase 2.5: Developer Type Classification

After all domain results are saved:

**Note:** Deterministic scores are computed but NOT used to override LLM domain scores for the 6-dimension framework. The `classify_developer_type` tool still runs for type classification only. Content-writer skills score based on their extraction data, not deterministic overrides.

1. Call the `classify_developer_type` MCP tool. This reads deterministic scores and produces:

- Primary developer type (from the 5x3 matrix)
- Control level (explorer / navigator / cartographer)
- Score distribution across all dimensions
- Matrix name and emoji

2. Run the `classify-type` skill. This produces the narrative type classification stage output and persists it via `save_stage_output` under `typeClassification`.

### Phase 2.8: Evidence Verification

Run the `verify-evidence` skill. This validates that evidence quotes in each domain's strengths and growth areas actually exist in the referenced utterances. Low-relevance evidence is filtered out. Results are persisted via `save_stage_output`.

### Phase 3: Narrative Generation

Run the `write-content` skill to generate top focus areas with coaching narratives and start/stop/continue actions. This skill reads all domain results and synthesizes them into actionable guidance. Results are persisted via `save_stage_output`.

### Phase 3.5: Translation (Conditional)

If the developer's sessions are primarily non-English, or the user explicitly asks for translated report output, run the `translate-report` skill after content generation. This stage persists `translator` output via `save_stage_output` and must preserve structure while translating only report-facing text fields.

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
3. Before each Phase 2 skill: `"[bp] Running <skill-name>..."` (e.g., `"[bp] Running extract-ai-collaboration..."`)
4. Before Phase 2.5: `"[bp] Phase 2.5: Classifying developer type..."`
5. Before Phase 2.8: `"[bp] Phase 2.8: Verifying evidence..."`
6. Before Phase 3: `"[bp] Phase 3: Generating narratives..."`
7. Before Phase 3.5 (if applicable): `"[bp] Phase 3.5: Translating report..."`
8. Before Phase 4: `"[bp] Phase 4: Assembling report..."`
9. On completion: `"[bp] Analysis complete."`

## Error Handling

- If `scan_sessions` finds zero sessions, stop and inform the user. Do not proceed.
- If `extract_data` fails, surface the error. Do not fabricate Phase 1 data.
- If the `summarize-sessions` skill fails, continue -- session summaries are optional context.
- If any Phase 2 skill fails with a rate limit or throttling error (e.g., "Rate limit reached", "429", "Too Many Requests", "overloaded", "capacity"):
  1. Print `"[bp] Rate limit hit. Waiting 60 seconds before retrying <skill-name>..."`
  2. Wait ~60 seconds (not 30 — longer pauses prevent cascading rate limits)
  3. Retry the skill once
  4. If the retry also fails with a rate limit, wait ~90 seconds and retry a final time (max 2 retries)
  5. If still failing after retries, treat it as a skill failure and continue with remaining skills
  6. After a rate-limit recovery, wait an additional ~30 seconds before starting the next skill to avoid immediately hitting the limit again
- If any Phase 2 skill fails for non-rate-limit reasons, report which skill failed and continue with the remaining skills. The report will note incomplete sections.
- If `verify-evidence` fails, continue -- evidence verification is a quality enhancement, not blocking.
- If `translate-report` is skipped because English output is appropriate, continue normally. If translation is needed but fails, continue with English output and note that translation is incomplete.
- Never silently swallow errors or return placeholder data.

### Rate Limit Context

Rate limits on Claude Max are token-per-minute based. Each analysis skill consumes a large prompt context (session data + analysis rubric) plus generates a detailed structured output. Running 7 skills back-to-back can exhaust the rate limit. The sequential execution with cooldowns and progressive backoff mitigates this. If rate limits persist, the user can reduce the analysis scope by selecting fewer projects in `~/.betterprompt/prefs.json` or reducing `maxSessions` in the `extract_data` call.

## Quality Checklist

- [ ] Phase 1 output persisted for diagnostics, and downstream stages use `get_prompt_context`
- [ ] Session summaries generated (Phase 1.5)
- [ ] All 6 dimension extractions completed (or failures reported)
- [ ] All 6 dimension narratives completed (or failures reported)
- [ ] Project summaries and weekly insights generated
- [ ] Developer type classification completed
- [ ] Evidence verification completed
- [ ] Narrative content generated (Phase 3)
- [ ] Translation generated when required by the session language or user request
- [ ] Report URL returned to user
- [ ] Summary presented with scores, type, strengths, and growth areas
