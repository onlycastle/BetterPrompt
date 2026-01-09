# NoMoreAISlop - Product Requirements Document

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

---

## 1. Overview

### 1.1 Product Vision

**"No More AI Slop"** - A tool that analyzes and improves developer-AI collaboration skills to prevent low-quality AI-generated code (AI Slop).

### 1.2 Problem Statement

- Developers use AI tools (Claude Code, GitHub Copilot, etc.) but have **no way to measure** if they're collaborating effectively
- Low-quality AI-generated code ("AI Slop") accumulates in codebases
- No method exists to differentiate **"developers who use AI well"** from **"developers who depend on AI"**

### 1.3 Solution

Analyze Claude Code's `~/.claude` session logs to evaluate developer AI collaboration skills across three categories:

1. **Planning**: Ability to provide clear, structured requirements
2. **Critical Thinking**: Ability to recognize and correct AI errors
3. **Code Understanding**: Ability to leverage existing code patterns

### 1.4 Target Users

| Tier | User Type | Use Case |
|------|-----------|----------|
| Primary | Individual developers using Claude Code | Self-improvement |
| Secondary | Team leads / Engineering managers | Team skill tracking |
| Tertiary | Technical education institutions | AI collaboration training |

### 1.5 Success Metrics

| Metric | Week 1 Target | Month 1 Target |
|--------|---------------|----------------|
| GitHub Stars | 100+ | 500+ |
| Plugin Installs | 50+ | 200+ |
| Analysis Runs | 100+ | 500+ |

---

## 2. User Stories

### US-001: First-Time User Runs Analysis

**As a** Claude Code user,
**I want to** analyze my current session's AI collaboration quality,
**So that** I can understand how effectively I'm working with AI.

**Acceptance Criteria:**
- [ ] User can run `/noslop` command without any setup (besides API key)
- [ ] Analysis completes in under 30 seconds
- [ ] Report displays clearly in CLI with ratings for all 3 categories
- [ ] Report includes specific evidence (quotes) from the conversation
- [ ] Analysis is automatically saved to local storage

### US-002: User Views Past Analyses

**As a** returning user,
**I want to** view my previous analysis results,
**So that** I can track my progress over time.

**Acceptance Criteria:**
- [ ] User can run `/noslop:history` to see past analyses
- [ ] List shows: date, project, session ID, ratings summary
- [ ] User can view full details of any past analysis
- [ ] Analyses are sorted by date (newest first)

### US-003: User Lists Available Sessions

**As a** developer,
**I want to** see all available Claude Code sessions,
**So that** I can choose which one to analyze.

**Acceptance Criteria:**
- [ ] User can run `/noslop:sessions` to list sessions
- [ ] List shows: session ID, project path, date, message count
- [ ] Sessions are grouped by project
- [ ] User can copy session ID to use with `/noslop:analyze`

### US-004: User Analyzes Specific Session

**As a** developer,
**I want to** analyze a specific past session,
**So that** I can review my collaboration on a particular task.

**Acceptance Criteria:**
- [ ] User can run `/noslop:analyze <session-id>`
- [ ] System validates session ID exists
- [ ] Analysis works the same as current session analysis
- [ ] Clear error message if session not found

### US-005: User Configures Settings

**As a** user,
**I want to** configure plugin settings,
**So that** I can customize my experience.

**Acceptance Criteria:**
- [ ] User can run `/noslop:config` to view/edit settings
- [ ] Can enable/disable telemetry
- [ ] Can change storage location
- [ ] Settings persist across sessions

---

## 3. Functional Requirements

### FR-001: Session Analysis

**Description:** Analyze a Claude Code session and generate an evaluation report.

| Attribute | Value |
|-----------|-------|
| Input | Session ID (optional, defaults to current session) |
| Output | Markdown report displayed in CLI |
| Side Effect | Analysis saved to local JSON file |

**Behavior:**
1. Parse session JSONL file from `~/.claude/projects/{path}/{session}.jsonl`
2. Extract user messages, assistant messages, and tool calls
3. Send to Claude API for evaluation
4. Parse structured response into evaluation object
5. Generate markdown report
6. Save to `~/.nomoreaislop/analyses/{session_id}.json`
7. Display report in CLI

**Error Handling:**
- Missing API key: Show setup instructions
- Session not found: Show available sessions
- API error: Show error message with retry suggestion
- Parse error: Show partial results with warning

### FR-002: Session Listing

**Description:** List all available Claude Code sessions for analysis.

| Attribute | Value |
|-----------|-------|
| Input | None |
| Output | Table of sessions with metadata |

**Columns:**
- Session ID (truncated)
- Project Path
- Date/Time
- Message Count
- Duration

### FR-003: Analysis History

**Description:** Show previously completed analyses.

| Attribute | Value |
|-----------|-------|
| Input | None |
| Output | List of past analysis summaries |

**Columns:**
- Date
- Project
- Session ID
- Planning Rating
- Critical Thinking Rating
- Code Understanding Rating

### FR-004: Configuration Management

**Description:** Manage user settings for the plugin.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| telemetry | boolean | true | Send anonymous usage data |
| storagePath | string | ~/.nomoreaislop | Where to save analyses |
| model | string | claude-3-5-sonnet-20241022 | LLM model for analysis |

---

## 4. Non-Functional Requirements

### NFR-001: Performance

| Metric | Target |
|--------|--------|
| Session parsing (100 messages) | < 500ms |
| LLM analysis | < 30 seconds |
| Report generation | < 100ms |
| Total analysis time | < 45 seconds |

### NFR-002: Reliability

- Graceful handling of all error conditions
- No data loss on failures
- Partial results when possible
- Clear error messages with recovery steps

### NFR-003: Privacy

- **Local-first**: All data processing happens locally
- **Your API key**: Users use their own Anthropic API key
- **Opt-out telemetry**: Anonymous usage tracking is opt-out
- **No conversation upload**: Session content never leaves the user's machine (except to Anthropic API)

### NFR-004: Usability

- **< 60 seconds** from install to first analysis
- **3-second scan**: Key information visible immediately in report
- **Non-judgmental**: Growth-focused language ("Developing" not "Weak")
- **Actionable**: Every rating includes specific improvement tips

### NFR-005: Compatibility

- Node.js 18+
- Claude Code v2.0.12+
- macOS, Linux, Windows (via WSL)

---

## 5. Out of Scope (MVP)

The following features are explicitly **NOT** included in MVP:

| Feature | Reason | Future Phase |
|---------|--------|--------------|
| Cloud dashboard | Requires auth/backend | Phase 2 |
| Team features | Requires multi-user | Phase 3 |
| Cursor/Copilot support | Different log formats | Future |
| Historical trends | Requires dashboard | Phase 2 |
| PDF export | Requires dashboard | Phase 2 |
| Share links | Requires cloud | Phase 2 |

---

## 6. Technical Constraints

### TC-001: Claude Code Plugin Format

Must follow Claude Code plugin specification:
- `.claude-plugin/plugin.json` manifest
- Commands in `commands/` directory
- TypeScript/JavaScript source

### TC-002: JSONL Schema Dependency

Depends on Claude Code's internal JSONL format:
- Format may change between versions
- Must handle schema variations gracefully
- Version detection recommended

### TC-003: API Key Requirement

Users must have their own Anthropic API key:
- Set via `ANTHROPIC_API_KEY` environment variable
- Or configured in plugin settings
- No free tier API access provided

---

## 7. Glossary

| Term | Definition |
|------|------------|
| AI Slop | Low-quality, generic, or incorrect code generated by AI |
| Session | A single Claude Code conversation with a unique session ID |
| Evaluation | The analysis result containing ratings and evidence |
| Clue | A specific quote from conversation used as evidence |
| Rating | Strong, Developing, or Needs Work |

---

## Appendix A: Report Example

```markdown
# AI Collaboration Analysis

**Session**: e0c35da6 | 45 min | 23 messages | 47 tool calls

## Overview

| Category | Rating |
|----------|--------|
| Planning | Strong |
| Critical Thinking | Developing |
| Code Understanding | Strong |

---

## Planning — Strong

You effectively broke down complex tasks into manageable steps
and provided clear context to the AI.

**Evidence:**
> "First, let me understand the current auth flow. Then we'll
> modify the middleware, and finally update the tests."

---

## Critical Thinking — Developing

There were opportunities to question AI suggestions more actively.

**Growth Opportunity:**
> The AI suggested using `any` type - consider asking about
> type-safe alternatives in similar situations.

**Tip:** Before accepting code, ask "What could go wrong here?"

---

## Code Understanding — Strong

You consistently referenced existing patterns and guided the AI
to follow established conventions.

**Evidence:**
> "Use the same pattern as `src/auth/middleware.ts`"

---

## Recommendations

1. Question AI suggestions before accepting
2. Ask "what are the alternatives?" more often
3. Continue referencing existing code patterns

---

Saved: ~/.nomoreaislop/analyses/e0c35da6.json
Track your progress: nomoreaislop.xyz
```

---

## Appendix B: Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/noslop` | Analyze current session | `/noslop` |
| `/noslop:analyze <id>` | Analyze specific session | `/noslop:analyze e0c35da6` |
| `/noslop:sessions` | List available sessions | `/noslop:sessions` |
| `/noslop:history` | View past analyses | `/noslop:history` |
| `/noslop:config` | Manage settings | `/noslop:config` |
