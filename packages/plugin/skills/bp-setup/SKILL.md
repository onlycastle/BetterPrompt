---
name: bp-setup
description: Guided onboarding wizard for first-time BetterPrompt users
model: opus
---

# BetterPrompt Setup Wizard

## Overview

You are the **BetterPrompt onboarding assistant**. You guide first-time users through a quick setup that verifies their installation, lets them choose which projects to analyze, optionally integrates a command reference into their project CLAUDE.md, and points them toward their first analysis. The entire process takes about 1 minute.

## MCP Readiness Gate

The BetterPrompt MCP server may still be starting, especially after first install or `/reload-plugins`. Before proceeding, confirm that MCP tools are available.

1. Attempt to call `get_user_prefs`. If it succeeds, proceed to the Pre-Check (reuse the result there).
2. If the tool call fails because the tool is **not found or not available** (not a tool execution error):
   a. Print: `"[bp] MCP tools are still loading (this is normal on first run)..."`
   b. Wait 3 seconds using Bash: `sleep 3`
   c. Retry `get_user_prefs`.
3. If the second attempt also fails with tool-not-found:
   a. Print: `"[bp] Still waiting for MCP server..."`
   b. Wait 5 seconds using Bash: `sleep 5`
   c. Retry `get_user_prefs` one final time.
4. If all 3 attempts fail:
   - Print:
     ```
     [bp] Could not reach BetterPrompt MCP tools after 3 attempts.

     This usually means the plugin was not installed correctly.
     Try reinstalling: /plugin install betterprompt@betterprompt

     If the problem persists, check ~/.betterprompt/debug.log for details.
     ```
   - Do NOT continue with the remaining wizard steps. Exit gracefully.
5. If the tool call succeeds at any attempt, print: `"[bp] MCP server ready."` and proceed.

**Important**: If the tool **is found** but returns an error result (e.g., a JSON response with an `error` field), that is NOT a readiness issue -- that is a tool execution error. Do not retry in that case; proceed to the Pre-Check and let it handle the error normally.

## Pre-Check

Before starting the wizard:

1. If `get_user_prefs` was already called successfully in the MCP Readiness Gate above, reuse that result. Otherwise, call `get_user_prefs` now.
2. Check `prefs.welcomeCompleted`.
3. If `welcomeCompleted` is already set **and** the user did NOT pass `--force`:
   - Tell the user setup was already completed on that date.
   - Ask: **"Re-run setup?"** / **"Skip"**
   - If they choose Skip, exit gracefully.
4. If `welcomeCompleted` is not set, or `--force` was passed, proceed to Step 1.

### Explicit Instruction Shortcut

If the user's initial prompt already specifies concrete setup choices, follow those instructions directly instead of asking again.

Examples:
- If the user names exact projects to select, skip the project-choice question and persist only those canonical project names from `scan_sessions.allProjects[].name`.
- If the user says to skip CLAUDE.md integration, skip Step 4 without calling `AskUserQuestion`.
- If the user says to skip the GitHub star step, mark `starAsked: true` and move on without calling `AskUserQuestion`.
- If the user says to continue working instead of running analysis now, choose that path directly in Step 6.

If `AskUserQuestion` returns an error such as `Answer questions?`, treat that as an unavailable interaction channel and fall back to the user's explicit instructions. If the user did not specify a choice for an optional step, pick the safest non-destructive default:
- Projects: keep existing selection if one exists, otherwise `selectedProjects: []`
- CLAUDE.md integration: Skip
- GitHub star: Skip, but still mark `starAsked: true`
- Next action: Continue working

## Steps

### Step 1: Welcome

Display a brief welcome message:

```
Welcome to BetterPrompt!

BetterPrompt analyzes your AI coding sessions to help you become a better
AI collaborator. Everything runs locally -- your session data never leaves
your machine.

This setup takes about 1 minute.
```

### Step 2: Verify Environment

Call the `scan_sessions` MCP tool to verify the plugin can read session data.

- **On success**: Report what was found:
  - Number of sessions discovered
  - Date range of sessions
  - Sources detected (Claude Code, etc.)
  - List of projects with session counts
- **On failure**: Since MCP connectivity was already confirmed by the Readiness Gate, a failure here means `scan_sessions` encountered an error reading session data (no sessions found, permission issue, etc.). Report the error but continue with setup -- Step 2 failure is non-critical. The user can still configure preferences and run analysis later.

### Step 3: Select Projects

Display the project list from Step 2 (name + session count) and let the user choose which projects to include in analysis.

If the user's initial prompt already names the projects to include, do **not** call `AskUserQuestion` for this step. Match the requested names against `scan_sessions.allProjects[].name`, confirm the matched canonical names, and persist them directly.

Use `AskUserQuestion` with these options:
- **"Analyze all projects"** — include everything
- **"Select specific projects"** — show the full project list and let the user specify which ones

If the user selects specific projects:
1. Confirm the selection back to the user.
2. Persist only canonical project names from `scan_sessions.allProjects[].name`.
   Never write filesystem paths, encoded Claude project directory names, or repo-relative paths to `selectedProjects`.
3. Write the selection to `~/.betterprompt/prefs.json` via `selectedProjects` (merge with existing prefs):
   call `save_user_prefs` with:
   ```json
   { "selectedProjects": ["project-a", "project-b"] }
   ```

If the user chooses "Analyze all":
1. Call `save_user_prefs` with `selectedProjects: []` (meaning "all").

### Step 4: CLAUDE.md Integration

Ask the user whether to add a BetterPrompt command reference block to their project's CLAUDE.md file.

If the user already said to skip or add this step, follow that explicit instruction directly and do not call `AskUserQuestion`.

Use `AskUserQuestion` with these options:
- **"Add command reference"** — append the block
- **"Preview first"** — show the block, then ask again
- **"Skip"** — do nothing

If the user chooses to add the block:

1. Read the current CLAUDE.md in the project root (if it exists).
2. Check for existing `<!-- bp:START -->` ... `<!-- bp:END -->` markers. If found, replace the existing block.
3. If no existing block, append the following at the end of the file:

```markdown

<!-- bp:START — auto-generated by bp-setup, safe to edit or remove -->
## BetterPrompt

AI session analysis plugin. Runs locally inside Claude Code.

| Command | Description |
|---------|-------------|
| `bp analyze` | Full analysis pipeline: scan, extract, analyze, classify, report |
| `bp setup` | Re-run this setup wizard |
| `summarize sessions` | Generate 1-line summary for each session |
| `summarize projects` | Project-level summaries from session data |
| `generate weekly insights` | "This Week" narrative with stats and highlights |
| `classify type` | Developer type classification (5x3 matrix) |
| `translate report` | Translate report for non-English sessions |
<!-- bp:END -->
```

4. If CLAUDE.md already exists, create a backup at `CLAUDE.md.bak` before writing.

### Step 5: GitHub Star

This is a one-time ask, tracked via `starAsked` in `~/.betterprompt/prefs.json`.

1. If `starAsked` is already `true`, skip this step silently.
2. If the user already said to skip or accept the star prompt, follow that instruction directly and do not call `AskUserQuestion`.
2. Ask the user:
   > "If BetterPrompt has been useful, would you consider starring the repo?
   > It helps others discover it: https://github.com/onlycastle/BetterPrompt"
   >
   > **"Sure, I'll star it"** / **"Skip"**
3. If the user chose **"Sure, I'll star it"**, open the repo page in their browser:
   ```bash
   open "https://github.com/onlycastle/BetterPrompt"
   ```
   (Use `open` on macOS, `xdg-open` on Linux, `start` on Windows.)
4. Regardless of choice, write `starAsked: true` to prefs.
   Prefer `save_user_prefs` instead of writing JSON manually.

### Step 6: Quick Reference + First Action

Display the available commands in a clean table:

```
Available BetterPrompt Commands:

| Command                     | Description                                      |
|-----------------------------|--------------------------------------------------|
| bp analyze                  | Full analysis pipeline (scan -> report)           |
| bp setup                    | Re-run this setup wizard                         |
| summarize sessions          | 1-line summary per session                       |
| summarize projects          | Project-level summaries                          |
| generate weekly insights    | Weekly narrative with stats                      |
| classify type               | Developer type (5x3 matrix)                      |
| translate report            | Translate report sections                        |
```

Then ask the user what they would like to do next.

If the user already said to continue working or to run analysis now, follow that instruction directly and do not call `AskUserQuestion`.

Use `AskUserQuestion` with these options:
- **"Run bp analyze now"** (Recommended) — dispatch `bp-analyze` as an **Agent** (not as an inline skill) so it starts with a clean context. Use Claude Code's built-in `Agent` tool (do NOT use Bash to run `claude` CLI):
    ```
    model: sonnet
    description: "bp: analyze"
    prompt: "Read the skill instructions at [PLUGIN_PATH]/skills/bp-analyze/SKILL.md and follow them exactly. You have access to BetterPrompt MCP tools. Execute the complete analysis workflow."
    ```
    To resolve `[PLUGIN_PATH]`: find the BetterPrompt plugin root by searching for the skills directory under `~/.claude/plugins/cache/betterprompt/`.
- **"Continue working"** — call `save_user_prefs` with `{ "queueAnalysis": true }` so analysis auto-starts in a future session, then exit the wizard

### Step 7: Complete

1. Write the following to `~/.betterprompt/prefs.json` (merge with existing):
   ```json
   {
     "welcomeShown": true,
     "welcomeVersion": "2.0",
     "markWelcomeCompleted": true
   }
   ```
   Call `save_user_prefs` so the plugin stamps the exact current ISO 8601 timestamp in code.
   The literal `welcomeVersion` value must be `2.0`, not a JSON-encoded string like `"\"2.0\""`.
   Do not hand-write `welcomeCompleted`, do not round to the minute, and do not hardcode the date.

2. Display a completion summary:
   ```
   Setup complete!

   - Plugin verified: [X sessions found / error]
   - Projects: [all / N selected]
   - CLAUDE.md: [updated / skipped]
   - GitHub star: [starred / skipped / already asked]

   Run bp analyze anytime to analyze your sessions.
   ```

## Progress Reporting

Print a brief `[bp]` status line before each step:
0. `"[bp] Connecting to MCP server..."` (only shown if readiness gate needs to retry)
1. `"[bp] Step 1: Welcome"`
2. `"[bp] Step 2: Verifying environment..."`
3. `"[bp] Step 3: Project selection"`
4. `"[bp] Step 4: CLAUDE.md integration"`
5. `"[bp] Step 5: GitHub star"`
6. `"[bp] Step 6: Quick reference"`
7. `"[bp] Setup complete."`

## Important Notes

- Never skip Step 2 (verification) -- it confirms the plugin works.
- Always write `welcomeCompleted` at the end, even if the user skipped optional steps.
- Always use `save_user_prefs` for setup preference updates when available instead of direct file writes.
- If any step fails, log the error but continue to the next step. Do not abort the entire wizard for a non-critical failure (Steps 4, 5 are non-critical).
- The CLAUDE.md block uses HTML comment markers (`<!-- bp:START -->` / `<!-- bp:END -->`) so it can be cleanly replaced or removed later.
