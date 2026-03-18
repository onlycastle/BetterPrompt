# AGENTS.md

> Machine-readable setup and usage guide for AI coding agents (Claude Code, Cursor, Copilot, etc.)

## Quick Setup (Plugin)

The plugin runs entirely inside Claude Code. No API keys. No server.

```
/plugin marketplace add onlycastle/BetterPrompt
/plugin install betterprompt@betterprompt
```

Then say: "Analyze my coding sessions and generate a report"

Claude calls the MCP tools automatically -- scan sessions, extract data, analyze each domain, classify type, and serve a report at `http://localhost:3456`.

## Optional: Dashboard Server

For teams or if you prefer a web dashboard, run the Next.js server alongside the plugin. Analysis still runs inside Claude Code; the server provides auth, storage, and dashboards.

```bash
# 1. Clone and install
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install

# 2. Configure environment
export GOOGLE_GEMINI_API_KEY=<your-key>
```

> **You must ask the user for their Gemini API key.** Free tier keys work. Get one at https://aistudio.google.com/apikey

```bash
# 3. Start the server (run in background)
npm run dev
```

Wait for the server to be ready (look for `Ready on http://localhost:3000`).

After running a local analysis via the plugin, use the `sync_to_team` MCP tool to upload results to the shared dashboard.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Yes | Gemini API key for the analysis pipeline |
| `BETTERPROMPT_WEB_APP_URL` | No | Server URL (default: `http://localhost:3000`) |
| `BETTERPROMPT_DEBUG` | No | Set to `1` for verbose logging |

## Enterprise / Team Setup

For team managers who want to set up an organization and monitor team members:

### 1. Create the organization

After the server is running, the admin needs to use the browser-based setup wizard:

```
Open http://localhost:3000/dashboard/enterprise/setup
```

This is a 3-step UI wizard:
1. Enter organization name
2. Optionally create a first team
3. Get the server URL to share with team members

### 2. Invite members

Members are invited via the web UI at `/dashboard/enterprise/members`. Each member needs:
- An email address
- A role: `owner`, `admin`, `member`, or `viewer`

### 3. Team member analysis

Each team member needs the BetterPrompt Claude Code plugin installed and the shared server URL for `sync_to_team`.

## Verification

In the Claude Code session, run `/help` and confirm BetterPrompt's skills and MCP tools appear under the plugin namespace.

## Supported Session Sources

The plugin auto-discovers sessions from:

| Tool | Path | Format |
|------|------|--------|
| Claude Code | `~/.claude/projects/` | JSONL |
| Cursor | `~/.cursor/chats/` | SQLite |

At least one tool must have existing session logs for analysis to work.

## Common Issues

| Problem | Solution |
|---------|----------|
| `No sessions found` | The user needs to have AI coding sessions first. BetterPrompt analyzes existing logs. |
| `GOOGLE_GEMINI_API_KEY not set` | Ask the user for their Gemini API key |
| `ECONNREFUSED localhost:3000` | Server isn't running. Start it with `npm run dev` |
| Port 3000 in use | Stop the other process or set a different port in Next.js config |
