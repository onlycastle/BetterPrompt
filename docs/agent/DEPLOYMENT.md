# Deployment (Agent Reference)

The supported open-source deployment target is:

- one self-hosted Next.js server
- Claude Code plugin clients that run analysis locally
- local SQLite plus filesystem storage

## Runtime Model

- `npm run dev` / `npm run build && npm run start` runs the web, auth, sync, and dashboard surface.
- Plugin-produced canonical runs sync through `POST /api/analysis/sync`.
- Public report/dashboard URLs are derived from the incoming request origin.
- The local SQLite database lives at `~/.betterprompt/betterprompt.db`.

## GitHub Pages (Landing Page)

The landing page and docs page are deployed as static HTML to GitHub Pages at `betterprompt.sh`.

| Command | Purpose |
|---------|---------|
| `npm run build:pages` | Static export to `out/` directory |
| `npx serve out` | Test static output locally |

**How it works**: `scripts/build-pages.sh` temporarily moves server-only files (`app/api/`, `app/dashboard/`, `middleware.ts`, etc.) out of the build path, runs `next build` with `STATIC_EXPORT=1` (which sets `output: 'export'`), then restores everything via `trap` cleanup.

**Trigger**: Push to `main` triggers `.github/workflows/deploy-pages.yml`, which builds and deploys to GitHub Pages.

**DNS**: `betterprompt.sh` must point to GitHub Pages IPs (`185.199.108-111.153`) or CNAME to `onlycastle.github.io`.

## Deployment Notes

- Use a persistent volume for the SQLite database.
- Keep `~/.betterprompt/knowledge` on persistent storage if you rely on local knowledge ingestion.
- No Lambda, Supabase, Polar, or desktop build pipeline is part of the supported OSS runtime.
- The plugin is the first-class analysis entrypoint; the CLI has been removed.
