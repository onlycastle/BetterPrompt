# Contributing

Thanks for your interest in BetterPrompt! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install
cp .env.example .env
# Add your GOOGLE_GEMINI_API_KEY to .env (only needed for web server features)
npm run dev
```

The plugin (`packages/plugin`) works standalone without any API keys.

## Project Structure

| Directory | What it does |
|-----------|-------------|
| `packages/plugin/` | Claude Code plugin (MCP tools + analysis skills) |
| `packages/cli/` | CLI for session upload to web server |
| `app/` | Next.js app router (team dashboard) |
| `src/lib/analyzer/` | Gemini-powered analysis pipeline |
| `src/components/` | React components |
| `tests/` | Unit, integration, and E2E tests |

## Making Changes

1. Create a branch from `main`.
2. Make your changes.
3. Run the checks below.
4. Open a pull request.

## Verification

Run before opening a PR:

```bash
npm run typecheck   # TypeScript compilation check
npm run lint        # ESLint
npm test            # Unit tests
npm run build       # Production build
```

## Guardrails

- Do not commit `.env` files, generated caches, or session transcripts.
- Do not add hardcoded production URLs, webhook endpoints, or API keys.
- Prefer local-first behavior and make hosted integrations opt-in.

## Code Style

- TypeScript strict mode is enabled.
- ESLint enforces style rules -- run `npm run lint` to check.
- Keep LLM prompts and all code in English (see `CLAUDE.md` language policy).

## Reporting Issues

- **Bugs**: Use the [bug report template](https://github.com/onlycastle/BetterPrompt/issues/new?template=bug_report.md).
- **Features**: Use the [feature request template](https://github.com/onlycastle/BetterPrompt/issues/new?template=feature_request.md).
- **Security**: See [SECURITY.md](./SECURITY.md) for private vulnerability reporting.
