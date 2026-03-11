# Open Source Publication Checklist

Use this checklist before making the repository public.

## 1. Rotate Secrets

Rotate any credential that may have been exposed in tracked files or prior commits, especially:

- `GOOGLE_GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `SLACK_WEBHOOK_URL`

Do the rotation first. History rewrites do not make already-leaked secrets safe again.

## 2. Purge Sensitive Files From Git History

The current tree no longer tracks the known cache artifacts, but old commits can still contain them.

Recommended tool: `git filter-repo`

```bash
brew install git-filter-repo
git checkout main
git branch backup/pre-open-source
git filter-repo \
  --invert-paths \
  --path scripts/fixtures/phase2-cache/phase2-cache.json \
  --path scripts/fixtures/phase3-cache/phase3-cache.json
```

If more sensitive files are discovered, add more `--path` entries and rerun from a fresh clone or backup branch.

## 3. Verify The Rewrite

Run these checks after the rewrite:

```bash
git log --stat -- scripts/fixtures/phase2-cache/phase2-cache.json
git log --stat -- scripts/fixtures/phase3-cache/phase3-cache.json
git grep -n "AIza\\|SUPABASE_SERVICE_ROLE_KEY\\|POLAR_ACCESS_TOKEN" $(git rev-list --all)
```

Expected result:

- the deleted cache JSON files no longer appear in `git log`
- secret-shaped values are not found in reachable commits

## 4. Force Push Carefully

History rewriting changes commit IDs. Everyone with an old clone must re-clone or hard-reset to the new history.

```bash
git push --force-with-lease origin main
```

## 5. Final Pre-Public Checks

Run a final local verification pass:

```bash
npm run typecheck
npm test
```

Then manually confirm:

- `.env.example` files contain placeholders only
- `.gitignore` excludes local caches and generated artifacts
- public docs do not mention private infrastructure URLs or workstation paths
- hosted-only APIs return `501` unless self-hosted env vars are configured
