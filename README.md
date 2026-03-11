# NoMoreAISlop

> Self-hosted AI session analysis with a local-first CLI and Next.js server.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## Overview

NoMoreAISlop analyzes your Claude Code and Cursor sessions, runs the Gemini-powered report pipeline on your own server, and stores auth, reports, and knowledge data locally.

The open-source product surface is now:

- `Next.js server` for auth, report pages, knowledge APIs, and local analysis execution
- `CLI` for local session discovery, device login, and analysis uploads to your self-hosted server
- `SQLite + local files` for persistence

The desktop app is not part of the open-source path.
Hosted billing, waitlist collection, and survey ingestion are not part of the supported runtime.

## Quick Start

```bash
git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop
npm install
cp .env.example .env
```

Required environment:

```env
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
NOSLOP_BASE_URL=http://localhost:3000
NOSLOP_WEB_APP_URL=http://localhost:3000
```

Start the server:

```bash
npm run dev
```

In another terminal, authenticate the CLI and run an analysis:

```bash
npx no-ai-slop
```

The CLI will open the device auth flow at your self-hosted server, then upload pre-parsed session data to `POST /api/analysis/run`.

## What Is Local

- Web auth uses local email/password accounts stored in SQLite.
- CLI auth uses device flow plus long-lived local CLI tokens.
- Analysis runs inside the Next.js server with your Gemini API key.
- Reports are stored in SQLite.
- Knowledge items are stored under `~/.nomoreaislop/knowledge`.

## Current Scope

- Supported product path: `self-hosted server + CLI`
- Public report pages: `GET /r/:resultId`
- Knowledge dashboard: local file-backed APIs

## Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm test
```

## Project Structure

```text
app/              Next.js app router, web UI, local API routes
packages/cli/     CLI for scan + login + upload
src/lib/analyzer/ Gemini analysis pipeline
src/lib/local/    SQLite auth and report persistence
src/lib/search-agent/storage/knowledge-store.ts
scripts/          local utilities and test fixtures
```

## Open Source Publication

Before making the repository public, complete the history purge and key rotation steps in [docs/human/OPEN_SOURCE_PUBLICATION.md](./docs/human/OPEN_SOURCE_PUBLICATION.md).

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [docs/human/OPEN_SOURCE_PUBLICATION.md](./docs/human/OPEN_SOURCE_PUBLICATION.md)

## License

MIT. See [LICENSE](./LICENSE).
