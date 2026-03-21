#!/usr/bin/env bash
#
# BetterPrompt Plugin Verification Script
#
# Run this to verify that the BetterPrompt plugin is correctly installed
# and all dependencies (MCP server, SQLite, hooks) are working.
#
# Usage: bash scripts/verify-plugin.sh [plugin-root]
#   plugin-root: Optional path to plugin installation directory.
#                Defaults to auto-detection from Claude Code plugin cache.

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

ERRORS=0

echo ""
echo "BetterPrompt Plugin Verification"
echo "================================"
echo ""

# --- Step 1: Locate plugin root ---
PLUGIN_ROOT="${1:-}"
if [ -z "$PLUGIN_ROOT" ]; then
  # Auto-detect from Claude Code plugin cache
  CACHE_DIR="$HOME/.claude/plugins/cache/betterprompt/betterprompt"
  if [ -d "$CACHE_DIR" ]; then
    # Find the latest version directory
    PLUGIN_ROOT=$(ls -dt "$CACHE_DIR"/*/ 2>/dev/null | head -1)
  fi
fi

if [ -z "$PLUGIN_ROOT" ] || [ ! -d "$PLUGIN_ROOT" ]; then
  # Fallback: try the local development path
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PLUGIN_ROOT="$SCRIPT_DIR/../packages/plugin"
fi

echo "1. Plugin Location"
if [ -d "$PLUGIN_ROOT" ]; then
  pass "Plugin root: $PLUGIN_ROOT"
else
  fail "Plugin root not found at: $PLUGIN_ROOT"
  echo ""
  echo "Install the plugin first:"
  echo "  /plugin marketplace add onlycastle/BetterPrompt"
  echo "  /plugin install betterprompt@betterprompt"
  exit 1
fi

# --- Step 2: Check dist files ---
echo ""
echo "2. Build Artifacts"
if [ -f "$PLUGIN_ROOT/dist/mcp/server-entry.js" ]; then
  pass "MCP server entry: dist/mcp/server-entry.js"
else
  fail "MCP server entry missing: dist/mcp/server-entry.js"
fi

if [ -f "$PLUGIN_ROOT/dist/mcp/server.js" ]; then
  pass "MCP server: dist/mcp/server.js"
else
  fail "MCP server missing: dist/mcp/server.js"
fi

if [ -f "$PLUGIN_ROOT/dist/hooks/session-start-handler.js" ]; then
  pass "Session start hook: dist/hooks/session-start-handler.js"
else
  fail "Session start hook missing: dist/hooks/session-start-handler.js"
fi

if [ -f "$PLUGIN_ROOT/dist/hooks/post-session-handler.js" ]; then
  pass "Post session hook: dist/hooks/post-session-handler.js"
else
  fail "Post session hook missing: dist/hooks/post-session-handler.js"
fi

# --- Step 3: Check native dependencies ---
echo ""
echo "3. Native Dependencies (better-sqlite3)"
MARKER="$PLUGIN_ROOT/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
FALLBACK_MARKER="$HOME/.betterprompt/node_modules/better-sqlite3/build/Release/better_sqlite3.node"

if [ -f "$MARKER" ]; then
  pass "better-sqlite3 compiled at plugin root"
elif [ -f "$FALLBACK_MARKER" ]; then
  pass "better-sqlite3 compiled at ~/.betterprompt (fallback)"
else
  fail "better-sqlite3 native module not found"
  echo ""
  echo "  To fix, run:"
  echo "    npm install --prefix $PLUGIN_ROOT better-sqlite3@12.8.0"
  echo ""
  echo "  If compilation fails, ensure build tools are installed:"
  echo "    macOS:  xcode-select --install"
  echo "    Linux:  sudo apt install build-essential python3"
fi

# --- Step 4: Check MCP configuration ---
echo ""
echo "4. MCP Configuration"
if [ -f "$PLUGIN_ROOT/.mcp.json" ]; then
  pass "MCP config: .mcp.json"
else
  fail "MCP config missing: .mcp.json"
fi

# --- Step 5: Check plugin registration ---
echo ""
echo "5. Plugin Registration"
INSTALLED_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
if [ -f "$INSTALLED_PLUGINS" ]; then
  if grep -q "betterprompt@betterprompt" "$INSTALLED_PLUGINS" 2>/dev/null; then
    pass "Plugin registered in installed_plugins.json"
  else
    fail "Plugin not registered. Run: /plugin install betterprompt@betterprompt"
  fi
else
  warn "installed_plugins.json not found (Claude Code may not be initialized)"
fi

KNOWN_MARKETPLACES="$HOME/.claude/plugins/known_marketplaces.json"
if [ -f "$KNOWN_MARKETPLACES" ]; then
  if grep -q "betterprompt" "$KNOWN_MARKETPLACES" 2>/dev/null; then
    pass "Marketplace registered in known_marketplaces.json"
  else
    fail "Marketplace not registered. Run: /plugin marketplace add onlycastle/BetterPrompt"
  fi
else
  warn "known_marketplaces.json not found"
fi

# --- Step 6: Check data directory ---
echo ""
echo "6. Data Directory"
DATA_DIR="$HOME/.betterprompt"
if [ -d "$DATA_DIR" ]; then
  pass "Data directory: $DATA_DIR"
else
  warn "Data directory not created yet (will be created on first run)"
fi

# --- Step 7: Test MCP server startup ---
echo ""
echo "7. MCP Server Startup Test"
if [ -f "$PLUGIN_ROOT/dist/mcp/server-entry.js" ]; then
  # Start server with a 5-second timeout, capture stderr
  STDERR_OUTPUT=$(cd "$PLUGIN_ROOT" && node dist/mcp/server-entry.js 2>&1 &
    SERVER_PID=$!
    sleep 3
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
  )

  if echo "$STDERR_OUTPUT" | grep -q "native deps ready"; then
    pass "Native deps loaded"
  else
    fail "Native deps failed to load"
  fi

  if echo "$STDERR_OUTPUT" | grep -q "connected"; then
    pass "MCP server connected"
  else
    warn "MCP server did not fully connect (may need stdio transport)"
  fi
else
  fail "Cannot test: server-entry.js missing"
fi

# --- Step 8: Check Claude Code sessions ---
echo ""
echo "8. Claude Code Sessions"
SESSION_DIR="$HOME/.claude/projects"
if [ -d "$SESSION_DIR" ]; then
  SESSION_COUNT=$(find "$SESSION_DIR" -name "*.jsonl" -maxdepth 2 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SESSION_COUNT" -gt 0 ]; then
    pass "Found $SESSION_COUNT session files"
  else
    warn "No session files found (need Claude Code usage data to analyze)"
  fi
else
  warn "Claude Code projects directory not found"
fi

# --- Summary ---
echo ""
echo "================================"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC} BetterPrompt is ready to use."
  echo ""
  echo "Next steps:"
  echo "  1. Start a Claude Code session"
  echo "  2. Run: bp setup    (first-time setup)"
  echo "  3. Run: bp analyze  (full analysis)"
else
  echo -e "${RED}$ERRORS check(s) failed.${NC} See above for fixes."
fi
echo ""
