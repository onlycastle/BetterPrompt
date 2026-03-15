# AGENTS.md

> Machine-readable setup and usage guide for AI coding agents (Claude Code, Cursor, Copilot, etc.)

## Quick Setup (Plugin -- Recommended)

The plugin runs entirely inside Claude Code. No API keys. No server.

```bash
# 1. Clone and build
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install
cd packages/plugin
npm run build
```

```bash
# 2. Launch Claude Code with the plugin
claude --plugin-dir /absolute/path/to/BetterPrompt/packages/plugin
```

```bash
# 3. Run analysis
# In the Claude Code session, say:
# "Analyze my coding sessions and generate a report"
```

Claude calls the MCP tools automatically -- scan sessions, extract data, analyze each domain, classify type, and serve a report at `http://localhost:3456`.

## Alternative: Server + CLI

For teams or if you prefer a web dashboard, use the server-based approach.

```bash
# 1. Clone and install
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install

# 2. Configure environment
cp .env.example .env
```

Then set the Gemini API key in `.env`:

```
GOOGLE_GEMINI_API_KEY=<ask the user for their key>
```

> **You must ask the user for their Gemini API key.** Free tier keys work. Get one at https://aistudio.google.com/apikey

```bash
# 3. Start the server (run in background)
npm run dev
```

Wait for the server to be ready (look for `Ready on http://localhost:3000`).

```bash
# 4. Run analysis in non-interactive mode
npx betterprompt-cli --auto
```

The `--auto` flag skips all interactive prompts (tool selection, project picker, privacy confirmation) and analyzes all available sessions from all supported tools.

When complete, the CLI prints a report URL like `http://localhost:3000/dashboard/r/{resultId}`. Share this URL with the user.

## CLI Flags

| Flag | Purpose |
|------|---------|
| `--auto` | Non-interactive mode: skip all prompts, analyze all tools and projects |
| `--no-translate` | Keep results in English (skip translation phase) |

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

This is a 3-step UI wizard (not automatable via CLI):
1. Enter organization name
2. Optionally create a first team
3. Get the server URL to share with team members

### 2. Invite members

Members are invited via the web UI at `/dashboard/enterprise/members`. Each member needs:
- An email address
- A role: `owner`, `admin`, `member`, or `viewer`

### 3. Team member analysis

Each team member runs the CLI pointed at the shared server:

```bash
BETTERPROMPT_WEB_APP_URL=http://<server-host>:3000 npx betterprompt-cli --auto
```

Their results automatically appear in the enterprise dashboard.

## Verification

**Plugin mode:** In the Claude Code session, run `/betterprompt:` and confirm the plugin's skills and MCP tools are listed.

**Server + CLI mode:**

```bash
# Server is running
curl -s http://localhost:3000/api/auth/me | head -c 100

# CLI is installed and shows usage
npx betterprompt-cli --help
```

## Supported Session Sources

The CLI auto-discovers sessions from:

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
