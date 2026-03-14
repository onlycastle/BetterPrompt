#!/bin/bash
#
# Setup Test Sessions for E2E Testing
# Copies test session files to ~/.claude/projects/ for CLI testing
#
# Usage: ./scripts/setup-test-sessions.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../test-data/claude-sessions"
DEST_BASE=~/.claude/projects

echo "Setting up test sessions for E2E testing..."
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory not found: $SOURCE_DIR"
  echo "Make sure you're running this from the project root."
  exit 1
fi

# Create destination base if it doesn't exist
if [ ! -d "$DEST_BASE" ]; then
  echo "Creating Claude projects directory: $DEST_BASE"
  mkdir -p "$DEST_BASE"
fi

# Copy each project directory
for dir in "$SOURCE_DIR"/*; do
  if [ -d "$dir" ]; then
    dirname=$(basename "$dir")
    dest="$DEST_BASE/$dirname"

    # Create destination directory
    mkdir -p "$dest"

    # Copy JSONL files
    count=$(ls -1 "$dir"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      cp "$dir"/*.jsonl "$dest/"
      echo "  Copied $count session(s) to $dest"
    else
      echo "  No JSONL files found in $dir"
    fi
  fi
done

echo ""
echo "Test sessions ready!"
echo ""
echo "Next steps:"
echo "  1. Start the dev server: npm run dev"
echo "  2. Run the CLI: npx betterprompt-cli"
echo "  3. Complete device authorization in browser"
echo "  4. View your test report at /dashboard/personal"
echo ""
