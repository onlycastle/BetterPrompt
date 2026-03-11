# Deployment (Agent Reference)

The supported open-source deployment target is:

- one self-hosted Next.js server
- one CLI pointed at that server
- local SQLite plus filesystem storage

## Runtime Model

- `npm run dev` / `npm run build && npm run start` runs the full web + API surface.
- `GOOGLE_GEMINI_API_KEY` is required for analysis workers.
- `NOSLOP_BASE_URL` and `NOSLOP_WEB_APP_URL` should point at the same self-hosted server.
- The CLI posts directly to `POST /api/analysis/run`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_GEMINI_API_KEY` | Gemini API key for worker execution |
| `NOSLOP_BASE_URL` | Canonical base URL for report links and metadata |
| `NOSLOP_WEB_APP_URL` | CLI target base URL (defaults to `http://localhost:3000`) |
| `NOSLOP_DB_PATH` | Optional SQLite database path override |

## Deployment Notes

- Use a persistent volume for the SQLite database.
- Keep `~/.nomoreaislop/knowledge` on persistent storage if you rely on local knowledge ingestion.
- No Lambda, Supabase, Polar, or desktop build pipeline is part of the supported OSS runtime.
- `publish-cli.yml` remains the only shipping workflow because the CLI is still a first-class product surface.
