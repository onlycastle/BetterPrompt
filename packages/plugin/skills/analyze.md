---
name: analyze
description: Orchestrate a full BetterPrompt analysis of your Claude Code sessions
model: sonnet
---

# BetterPrompt Analysis Orchestrator

## Overview

You are the orchestration layer for a complete BetterPrompt analysis run. Your job is to coordinate data extraction, domain-specific analysis, developer type classification, narrative generation, and final report assembly. You do not perform deep analysis yourself -- you delegate to specialized domain skills and stitch the results together.

## Instructions

Follow these phases in strict order. Each phase must complete before the next begins unless explicitly noted as parallelizable.

### Phase 1: Data Discovery and Extraction

1. Call the `scan_sessions` MCP tool to discover available Claude Code session data in `~/.claude/projects/`.
2. Call the `extract_data` MCP tool to run deterministic Phase 1 extraction. This produces structured metrics (token counts, session durations, tool usage frequencies, utterance counts, context fill percentages, etc.) with zero LLM involvement.
3. Present a brief summary to the user:
   - Number of sessions found
   - Date range covered
   - Key metrics snapshot (total tokens, average session length, top projects)
4. Phase 1 output is persisted at `~/.betterprompt/phase1-output.json`. All domain skills read from this file.

### Phase 2: Domain Analysis (Parallelizable)

Spawn five parallel subagents, one per domain skill. Each subagent receives the Phase 1 output path and performs its own LLM-guided analysis:

| Subagent Skill | Domain Key | Purpose |
|----------------|------------|---------|
| `analyze-thinking-quality` | thinkingQuality | Planning habits, verification behavior, critical thinking |
| `analyze-communication` | communicationPatterns | Prompt structure, context patterns, signature quotes |
| `analyze-learning` | learningBehavior | Knowledge gaps, repeated mistakes, growth indicators |
| `analyze-efficiency` | contextEfficiency | Token optimization, context fill, inefficiency patterns |
| `analyze-sessions` | sessionOutcome | Goal achievement, friction points, success/failure patterns |

Wait for all five to complete. Each subagent calls `save_domain_results` independently to persist its output.

### Phase 2.5: Developer Type Classification

After all domain results are saved, call the `classify_developer_type` MCP tool. This reads the saved domain results and produces:

- Primary developer type (from the 5x3 matrix)
- Control level (autonomous / balanced / dependent)
- Score distribution across all dimensions
- MBTI-style personality narrative (3 paragraphs, behavioral patterns)

### Phase 3: Narrative Generation

Run the `write-content` skill to generate top focus areas with coaching narratives and start/stop/continue actions. This skill reads all domain results and synthesizes them into actionable guidance.

### Phase 4: Report Assembly

1. Call the `generate_report` MCP tool to create a localhost report page from all saved results.
2. Present the final summary to the user:
   - Developer type and personality headline
   - Top 3 strengths (one line each)
   - Top 3 growth areas (one line each)
   - Overall scores by domain
   - Report URL for the full interactive report

## Error Handling

- If `scan_sessions` finds zero sessions, stop and inform the user. Do not proceed.
- If `extract_data` fails, surface the error. Do not fabricate Phase 1 data.
- If any domain subagent fails, report which domain failed and continue with the remaining domains. The report will note incomplete sections.
- Never silently swallow errors or return placeholder data.

## Quality Checklist

- [ ] Phase 1 output file exists at `~/.betterprompt/phase1-output.json`
- [ ] All 5 domain analyses completed (or failures reported)
- [ ] Developer type classification completed
- [ ] Narrative content generated
- [ ] Report URL returned to user
- [ ] Summary presented with scores, type, strengths, and growth areas
