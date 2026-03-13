#!/bin/bash
# NPM Publish Script for betterprompt CLI
# Usage: ./scripts/publish.sh [patch|minor|major]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"

cd "$CLI_DIR"

# Default to patch version bump
VERSION_TYPE=${1:-patch}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "❌ Invalid version type: $VERSION_TYPE"
  echo "Usage: ./scripts/publish.sh [patch|minor|major]"
  exit 1
fi

echo "📦 betterprompt CLI Publisher"
echo "─────────────────────────────"

# Show current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"
echo "Version bump: $VERSION_TYPE"
echo ""

# Confirm
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Build first to catch errors early
echo ""
echo "🔨 Building..."
npm run build

# Bump version (creates git tag)
echo ""
echo "📝 Bumping version..."
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# Publish to npm
echo ""
echo "🚀 Publishing to npm..."
npm publish --access public

echo ""
echo "✅ Successfully published betterprompt@$NEW_VERSION"
echo ""
echo "Users can now run:"
echo "  npx betterprompt@$NEW_VERSION"
echo ""
echo "Don't forget to commit the version bump:"
echo "  git add packages/cli/package.json"
echo "  git commit -m \"chore(cli): release v$NEW_VERSION\""
echo "  git tag cli-v$NEW_VERSION"
