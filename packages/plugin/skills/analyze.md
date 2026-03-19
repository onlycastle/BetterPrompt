---
name: analyze
description: Orchestrate a full BetterPrompt analysis of your Claude Code sessions
model: sonnet
---

# BetterPrompt Analysis Orchestrator

## Overview

You are the orchestration layer for a complete BetterPrompt analysis run. Your job is to coordinate data extraction, session summaries, domain-specific analysis, developer type classification, evidence verification, narrative generation, and final report assembly. You do not perform deep analysis yourself -- you coordinate the MCP tools and specialized BetterPrompt skills so the full pipeline completes in order.

## Instructions

Follow these phases in strict order. Each phase must complete before the next begins unless explicitly noted as parallelizable.

### Phase 1: Data Discovery and Extraction

1. Call the `scan_sessions` MCP tool to discover all supported local session sources on this machine, including Claude Code and Cursor.
2. Call the `extract_data` MCP tool to run deterministic Phase 1 extraction. This produces the canonical Phase 1 artifact with structured metrics, activity sessions, and full parsed-session access for later stages.
3. Present a brief summary to the user:
   - Number of sessions found
   - Date range covered
   - Key metrics snapshot (total tokens, average session length, top projects)
4. Phase 1 output is persisted at `~/.betterprompt/phase1-output.json` for diagnostics and parity capture. Downstream skills should read stage-specific payloads through `get_prompt_context`, not by rereading the raw file.

### Phase 1.5: Session Summaries

Run the `summarize-sessions` skill. This generates a concise 1-line summary for each analyzed session and persists the results via `save_stage_output`.

### Phase 2: Domain Analysis + Context Generation (Parallelizable)

Run the domain analyzers and context generators in parallel when Claude Code decides it is appropriate. Each unit persists its own output to the current local analysis run.

**Domain Analyzers** (each calls `save_domain_results`):

| Subagent Skill | Domain Key | Purpose |
|----------------|------------|---------|
| `analyze-thinking-quality` | thinkingQuality | Planning habits, verification behavior, critical thinking |
| `analyze-communication` | communicationPatterns | Prompt structure, context patterns, signature quotes |
| `analyze-learning` | learningBehavior | Knowledge gaps, repeated mistakes, growth indicators |
| `analyze-efficiency` | contextEfficiency | Token optimization, context fill, inefficiency patterns |
| `analyze-sessions` | sessionOutcome | Goal achievement, friction points, success/failure patterns |

**Context Generators** (each calls `save_stage_output`):

| Subagent Skill | Stage Key | Purpose |
|----------------|-----------|---------|
| `summarize-projects` | projectSummaries | Project-level summaries from session data |
| `generate-weekly-insights` | weeklyInsights | This Week narrative, stats, and highlights |

Wait for all analyses to complete. Each one persists its output independently.

### Phase 2.5: Developer Type Classification

After all domain results are saved:

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

## Error Handling

- If `scan_sessions` finds zero sessions, stop and inform the user. Do not proceed.
- If `extract_data` fails, surface the error. Do not fabricate Phase 1 data.
- If the `summarize-sessions` skill fails, continue -- session summaries are optional context.
- If any domain subagent fails, report which domain failed and continue with the remaining domains. The report will note incomplete sections.
- If `verify-evidence` fails, continue -- evidence verification is a quality enhancement, not blocking.
- If `translate-report` is skipped because English output is appropriate, continue normally. If translation is needed but fails, continue with English output and note that translation is incomplete.
- Never silently swallow errors or return placeholder data.

## Quality Checklist

- [ ] Phase 1 output persisted for diagnostics, and downstream stages use `get_prompt_context`
- [ ] Session summaries generated (Phase 1.5)
- [ ] All 5 domain analyses completed (or failures reported)
- [ ] Project summaries and weekly insights generated
- [ ] Developer type classification completed
- [ ] Evidence verification completed
- [ ] Narrative content generated (Phase 3)
- [ ] Translation generated when required by the session language or user request
- [ ] Report URL returned to user
- [ ] Summary presented with scores, type, strengths, and growth areas
