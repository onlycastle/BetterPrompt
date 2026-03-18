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
