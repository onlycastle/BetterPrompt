# Deployment (Agent Reference)

The supported open-source deployment target is:

- one self-hosted Next.js server
- Claude Code plugin clients that run analysis locally
- local SQLite plus filesystem storage

## Runtime Model

- `npm run dev` / `npm run build && npm run start` runs the web, auth, sync, and dashboard surface.
- `BETTERPROMPT_BASE_URL` and `BETTERPROMPT_WEB_APP_URL` should point at the same self-hosted server.
- Plugin-produced canonical runs sync through `POST /api/analysis/sync`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BETTERPROMPT_BASE_URL` | Canonical base URL for report links and metadata |
| `BETTERPROMPT_WEB_APP_URL` | Dashboard base URL (defaults to `http://localhost:3000`) |
| `BETTERPROMPT_DB_PATH` | Optional SQLite database path override |
## Deployment Notes

- Use a persistent volume for the SQLite database.
- Keep `~/.betterprompt/knowledge` on persistent storage if you rely on local knowledge ingestion.
- No Lambda, Supabase, Polar, or desktop build pipeline is part of the supported OSS runtime.
- The plugin is the first-class analysis entrypoint; the CLI has been removed.
