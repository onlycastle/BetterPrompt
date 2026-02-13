# Open-Core Strategy + PII Redaction Layer Design

> **Date**: 2026-02-11
> **Status**: Draft — Strategic design, not yet in implementation
> **Decision**: Open-core (AGPL-3.0) with PII redaction layer to address privacy concerns while enabling community growth

## Context

NoMoreAISlop's #1 adoption barrier is **privacy fear**: users worry their personal and company information could leak when their Claude Code sessions are analyzed. The current architecture sends sampled developer utterances (up to 150) and session metrics to Google's Gemini API for analysis, and stores results in Supabase.

**User's initial idea**: Open-source the entire project to build trust.
**Tension**: Open-sourcing exposes all prompts/analysis logic, making it easy to copy.
**Resolution**: The service's moat is in **data/network effects** (benchmarks, comparisons, trends), not in prompts. Therefore, open-sourcing code while keeping aggregated data proprietary is the optimal strategy.

**Target customers**: Startups/SMBs (10-100 developer teams)
**Open-source goals**: Both privacy trust acquisition AND community/viral growth

---

## Strategy: Open-Core + PII Redaction Layer

### Model (Supabase/GitLab pattern)
- Core product fully open-source (AGPL-3.0)
- Managed hosting as primary revenue source
- Network effects create value that cannot be replicated by self-hosting

### Open/Proprietary Boundary

| Open Source (Public) | Proprietary (SaaS Only) |
|---|---|
| CLI (scanner, uploader, tag stripping) | **Benchmark DB** — "How do you compare to top 10% developers?" |
| Analysis pipeline (prompts, workers, orchestrator) | **Team/Enterprise comparison** — cross-developer analytics |
| Frontend report components | **Time-series trends** — growth tracking over months |
| Data models/schemas | **Enterprise dashboard** — B2B premium features |
| PII redaction layer | **Curated resource matching** (KnowledgeResourceMatcher DB) |

### Why This Works
1. Self-hosted users can only analyze **their own data** — no benchmarks, no comparisons
2. "Where do I stand compared to other developers?" → only available on hosted service
3. More users → more accurate benchmarks → more value → flywheel
4. Prompt copiers without data cannot offer comparison features

---

## PII Redaction Layer Design

### Pipeline Position

```
Current:  JSONL → CLI Scanner → Upload → Gemini Analysis
Proposed: JSONL → CLI Scanner → [PII Redaction] → [Data Preview] → Upload → Gemini Analysis
```

Lives in CLI, before upload. Open-source = auditable by anyone.

### Three-Tier Redaction

**Tier 1: Automatic (always on)**
- API keys/tokens: `sk-xxx`, `ghp_xxx`, `AKIA...`, Bearer tokens → `[API_KEY]`
- Email addresses → `[EMAIL]`
- Password patterns: `password=xxx`, `secret=xxx` → `[CREDENTIAL]`
- DB connection strings → `[DB_CONNECTION]`

**Tier 2: Path Anonymization (on by default, toggleable)**
- `/Users/jane/work/acme-corp/backend` → `[USER]/[PROJECT-1]/backend`
- Consistent per-project mapping (same project → same token)
- Directory structure preserved, identifiable parts replaced

**Tier 3: User-defined (optional)**
- Company names, internal service names via config
- Custom regex patterns in configuration file

### Data Preview (CLI)

```
$ nomoreaislop analyze --preview

📊 Sessions to analyze: 47 (23 projects)
📝 Utterances to send: 150 (sampled)

🔒 Auto-redaction results:
  - 3 API keys masked
  - 1 email masked
  - 12 paths anonymized

[Enter to continue, 'v' for detail, 'q' to cancel]
```

### Analysis Quality Impact

| Phase | Analyzes | PII Impact |
|---|---|---|
| Phase 1 (DataExtractor) | Token counts, session length, tool usage | **None** — numeric metrics |
| Phase 1.1-1.2 (Deterministic) | Score/type mapping | **None** — number-based |
| Phase 2: ThinkingQuality | Thinking **patterns** | **Minimal** — "how" not "what" |
| Phase 2: Communication | Communication **style** | **Minimal** — sentence structure, question patterns |
| Phase 2: LearningBehavior | Learning **patterns** | **Minimal** — iteration frequency |
| Phase 2: ContextEfficiency | Context **utilization** | **None** — token/message ratios |
| Phase 2: SessionOutcome | Session **results** | **Slight** — project descriptions become generic |
| Phase 2.5 (TypeClassifier) | Developer **behavioral type** | **Minimal** — behavior-based classification |
| Phase 3 (ContentWriter) | **Narrative** writing | **Slight** — project-specific recommendations generalize |

**Conclusion**: Core analysis value is in **behavioral patterns**, which are minimally affected by PII redaction. The analysis focuses on *how* developers work, not *what* they build.

---

## Open-Source Transition Roadmap

### License: AGPL-3.0

- Competitors who copy code must open-source their changes
- But without data moat, they cannot offer benchmarks/comparisons
- Community-friendly → drives adoption and viral growth
- "Real open source" trust signal

### Phase 0: Preparation (2-3 weeks)
- Audit codebase for hardcoded secrets/environment variables
- Create `.env.example` files
- Write README, CONTRIBUTING.md, LICENSE
- Set up public CI/CD pipeline
- Security review of all external API integrations

### Phase 1: CLI Open Source + PII Layer (3-4 weeks)
- `packages/cli/` already isolated — immediate action possible
- Implement PII redaction layer before public release
- Publish as independent npm package
- **Immediate trust signal**: "See exactly what our CLI collects"

Key files:
- `packages/cli/src/scanner.ts` — session scanning
- `packages/cli/src/uploader.ts` — data upload
- `packages/cli/src/lib/strip-system-tags.ts` — metadata filtering
- NEW: `packages/cli/src/lib/pii-redactor.ts` — PII detection/redaction
- NEW: `packages/cli/src/lib/data-preview.ts` — pre-upload preview

### Phase 2: Analysis Pipeline Open Source (4-6 weeks)
- `src/lib/analyzer/` — pipeline, workers, prompts
- `src/lib/models/` — data schemas
- `src/lib/parser/` — JSONL parsing
- Abstract Supabase dependency behind interfaces
- **Community explosion point**: prompt improvements, new worker proposals

### Phase 3: Self-Hosting Guide (2-3 weeks)
- Docker Compose setup
- "Analyze locally with your own Gemini API key" guide
- **Enterprise adoption unblock**

### Phase 4: Frontend Open Source (2-3 weeks)
- Report components public
- Landing page stays proprietary (branding)
- **Full self-hosting possible**

### Timeline

```
Prep(2-3w) → CLI+PII(3-4w) → Pipeline(4-6w) → Self-hosting(2-3w) → Frontend(2-3w)
           ↑                ↑                   ↑
    Quick trust win   Community growth    B2B sales unblock
```

---

## Current Data Flow Reference

Sensitive data points in the current architecture:

| Data | Sensitivity | Where It Goes |
|---|---|---|
| Project paths (`/Users/jane/work/acme-corp`) | 🔴 High — exposes company/project names | CLI → S3 → Gemini → Supabase |
| Developer utterances | 🔴 High — may contain code, business logic | CLI → Gemini (sampled, max 150) |
| Code snippets in AI responses | 🔴 High — proprietary code patterns | CLI → Gemini (sampled, max 350) |
| Tool call inputs | 🟡 Medium — file paths, search queries | CLI → Gemini |
| Token counts, session metrics | 🟢 Low — aggregate numbers | CLI → Gemini → Supabase |

Existing mitigations:
- System tag stripping (`stripSystemTags()`)
- LLM-based metadata filtering
- Strategic sampling (5000 utterances → 150)
- Text truncation (max 2000 chars per message)
- Content tier filtering (ContentGateway)

---

## Verification

This is a strategic design document, not a code implementation plan. Verification approach:

1. **PII Redaction effectiveness**: Build prototype, run against real JSONL sessions, verify sensitive patterns are caught
2. **Analysis quality**: Run analysis with and without PII redaction on same dataset, compare scores
3. **Open-source readiness**: Run `grep -r` for hardcoded secrets, API keys, internal URLs before any code goes public
4. **Community reception**: Soft-launch with existing users, gather feedback before full public release
