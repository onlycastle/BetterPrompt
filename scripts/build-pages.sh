#!/usr/bin/env bash
set -euo pipefail

# Build static export for GitHub Pages.
# Temporarily hides server-only files, runs next build with output: 'export',
# then restores everything. Safe even on build failure (trap cleanup).

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BACKUP_DIR=$(mktemp -d)

# Paths to temporarily exclude (server-only, incompatible with static export)
EXCLUDE_PATHS=(
  "app/api"
  "app/dashboard"
  "app/personal"
  "app/benchmarks"
  "app/r"
  "app/opengraph-image.tsx"
  "middleware.ts"
)

cleanup() {
  echo "Restoring server-only files..."
  for path in "${EXCLUDE_PATHS[@]}"; do
    local name
    name=$(basename "$path")
    local dest
    dest=$(dirname "$path")
    if [ -e "$BACKUP_DIR/$name" ]; then
      mv "$BACKUP_DIR/$name" "$dest/$name"
    fi
  done
  rm -rf "$BACKUP_DIR"
  echo "Restore complete."
}

trap cleanup EXIT

echo "Moving server-only files to temp backup..."
for path in "${EXCLUDE_PATHS[@]}"; do
  if [ -e "$path" ]; then
    mv "$path" "$BACKUP_DIR/"
  fi
done

echo "Building static export..."
STATIC_EXPORT=1 npx next build

echo ""
echo "Static export complete: out/"
echo "Test locally: npx serve out"
