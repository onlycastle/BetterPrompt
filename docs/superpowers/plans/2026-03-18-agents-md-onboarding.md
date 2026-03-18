# AGENTS.md Installation Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite AGENTS.md with persona-based installation onboarding, deduplicate installation content in CLAUDE.md, and remove the unused `@google/genai` dependency.

**Architecture:** Documentation-only change plus one dependency removal. AGENTS.md becomes the single source of truth for agent-facing installation. CLAUDE.md points to it. No application code changes.

**Tech Stack:** Markdown, npm (dependency management)

**Spec:** `docs/superpowers/specs/2026-03-18-agents-md-onboarding-design.md`

---

### Task 1: Rewrite AGENTS.md

**Files:**
- Modify: `AGENTS.md` (replace entire content)

- [ ] **Step 1: Replace AGENTS.md content**

```markdown
# AGENTS.md

> Machine-readable setup and usage guide for AI coding agents.

## Installation

When a user asks to install BetterPrompt, first ask:

> "Are you setting this up for yourself as an individual developer, or are you a team manager setting it up for your team?"

Then follow the matching path below.

### Individual Developer

Install the Claude Code plugin. No server, no API keys, no cloning needed.

```
/plugin marketplace add onlycastle/BetterPrompt
/plugin install betterprompt@betterprompt
```

**What to do next:** Say "Analyze my coding sessions and generate a report" in any Claude Code session. The plugin queues analysis automatically when enough new sessions accumulate. Reports are served at `http://localhost:3456`.

### Team Manager

Team managers are also individual developers. Start with the plugin, then add the shared dashboard.

**1. Install the plugin**

```
/plugin marketplace add onlycastle/BetterPrompt
/plugin install betterprompt@betterprompt
```

**2. Start the dashboard server**

```bash
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install
npm run dev
```

Wait for `Ready on http://localhost:3000`.

**What to do next:** Visit `/dashboard/enterprise/setup` to create your organization and invite team members. Share the server URL with your team — each member needs to configure `BETTERPROMPT_SERVER_URL` in their plugin settings and use `sync_to_team` to upload their analysis results.

## Verification

In Claude Code, run `/help` and confirm BetterPrompt appears as an installed plugin with skills (e.g., `analyze-sessions`) and MCP tools (e.g., `scan_sessions`, `save_stage_output`).
```

- [ ] **Step 2: Verify no Gemini references remain**

Run: `grep -i gemini AGENTS.md`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: rewrite AGENTS.md with persona-based installation onboarding"
```

---

### Task 2: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md:17` (Language Policy — remove Gemini reference)
- Modify: `CLAUDE.md:24-35` (Installation section — replace with pointer to AGENTS.md)
- Modify: `docs/agent/ARCHITECTURE.md:57` (update AGENTS.md description)

- [ ] **Step 1: Update Language Policy line 17**

Change:
```
- **LLM Prompts**: All prompts for LLM analysis (Gemini, Anthropic, etc.) must be in English
```
To:
```
- **LLM Prompts**: All prompts for LLM analysis (Anthropic, etc.) must be in English
```

- [ ] **Step 2: Replace Installation section (lines 24-35)**

Change the "Installation (for end-users)" section to:
```markdown
## Installation (for end-users)

> ⚠️ **When a user asks to "install" BetterPrompt**, this means installing the Claude Code plugin — NOT cloning the repo or running `npm install`. Follow the guided installation flow in [AGENTS.md](./AGENTS.md).
```

- [ ] **Step 3: Update docs/agent/ARCHITECTURE.md line 57**

Change:
```
- [AGENTS.md](../../AGENTS.md) — Machine-readable setup guide for AI coding agents (plugin quick start, enterprise setup)
```
To:
```
- [AGENTS.md](../../AGENTS.md) — Machine-readable setup guide for AI coding agents (persona-based installation onboarding)
```

- [ ] **Step 4: Verify no Gemini references remain in CLAUDE.md**

Run: `grep -i gemini CLAUDE.md`
Expected: No matches

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/agent/ARCHITECTURE.md
git commit -m "docs: point CLAUDE.md installation to AGENTS.md, remove Gemini reference"
```

---

### Task 3: Remove `@google/genai` dependency

**Files:**
- Modify: `package.json:40` (remove `@google/genai` line)
- Modify: `next.config.ts:5` (remove `@google/genai` from serverExternalPackages)

- [ ] **Step 1: Remove from package.json line 40**

Remove this line:
```json
    "@google/genai": "^1.45.0",
```

- [ ] **Step 2: Update next.config.ts line 5**

Change:
```typescript
  serverExternalPackages: ['@anthropic-ai/sdk', '@google/genai'],
```
To:
```typescript
  serverExternalPackages: ['@anthropic-ai/sdk'],
```

- [ ] **Step 3: Regenerate lockfile**

Run: `npm install`
Expected: Completes without errors, `package-lock.json` updated

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: remove unused @google/genai dependency"
```

---

### Task 4: Acceptance verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds (confirms no runtime dependency on `@google/genai`)

- [ ] **Step 3: Tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Final Gemini check on AGENTS.md**

Run: `grep -ri "gemini" AGENTS.md`
Expected: Zero results

- [ ] **Step 5: Verify CLAUDE.md points to AGENTS.md and has no Gemini references**

Run: `grep -i gemini CLAUDE.md`
Expected: Zero results

Run: `grep "AGENTS.md" CLAUDE.md`
Expected: At least one match (confirming the pointer exists)
