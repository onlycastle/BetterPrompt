# Open Source Publication Checklist

Use this checklist before making the repository public.

## 1. Rotate Any Exposed Secrets

Rotate any credential that may have been exposed in tracked files or past commits, especially:

- `GOOGLE_GEMINI_API_KEY`
- any local environment variable values you used while developing
- any personal access tokens or webhook URLs that may have appeared in scripts, caches, or shell history

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
git grep -n "AIza" $(git rev-list --all)
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
npm run build
```

Then manually confirm:

- `.gitignore` excludes local caches and generated artifacts
- public docs describe only the supported self-hosted server + plugin runtime
- the repo contains no tracked desktop, Lambda, Supabase, or billing code paths
