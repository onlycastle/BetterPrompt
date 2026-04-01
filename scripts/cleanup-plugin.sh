#!/usr/bin/env bash
# cleanup-plugin.sh — Remove all BetterPrompt plugin artifacts for clean install testing
set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[SKIP]${NC}  $*"; }
removed() { echo -e "${RED}[DEL]${NC}   $*"; }

CLEANED=()

# Choose a JSON validator: prefer jq, then python3, then node
validate_json() {
  local file="$1"
  if command -v jq &>/dev/null; then
    jq empty "$file" 2>/dev/null && return 0
  elif command -v python3 &>/dev/null; then
    python3 -m json.tool "$file" >/dev/null 2>&1 && return 0
  elif command -v node &>/dev/null; then
    node -e "JSON.parse(require('fs').readFileSync('$file','utf8'))" 2>/dev/null && return 0
  fi
  return 1
}

safe_edit_json() {
  local file="$1"
  local description="$2"
  local transform_fn="$3"  # name of a function that edits the file in-place

  if [[ ! -f "$file" ]]; then
    warn "$file does not exist — nothing to edit"
    return
  fi

  info "Editing $file ($description)"
  "$transform_fn" "$file"

  if validate_json "$file"; then
    success "Validated $file"
  else
    echo -e "${RED}[WARN]${NC} $file may have invalid JSON after edit — please check manually"
  fi

  CLEANED+=("$description")
}

safe_remove() {
  local target="$1"
  local description="$2"

  if [[ -e "$target" ]]; then
    rm -rf "$target"
    removed "$description: $target"
    CLEANED+=("$description")
  else
    warn "$target not found — skipping"
  fi
}

# ---------------------------------------------------------------------------
# JSON transform functions (using jq when available, sed fallback)
# ---------------------------------------------------------------------------

transform_settings_json() {
  local file="$1"

  if command -v jq &>/dev/null; then
    local tmp
    tmp=$(mktemp)
    jq '
      if .enabledPlugins then
        .enabledPlugins["betterprompt@betterprompt"] = false
      else . end
      |
      if .extraKnownMarketplaces then
        .extraKnownMarketplaces = []
      else . end
    ' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    # sed fallback: disable the plugin flag
    if grep -q '"betterprompt@betterprompt"' "$file"; then
      sed -i.bak 's/"betterprompt@betterprompt"[[:space:]]*:[[:space:]]*true/"betterprompt@betterprompt": false/g' "$file"
      rm -f "${file}.bak"
    fi
    # sed fallback: clear extraKnownMarketplaces array
    if grep -q '"extraKnownMarketplaces"' "$file"; then
      sed -i.bak 's/"extraKnownMarketplaces"[[:space:]]*:[[:space:]]*\[[^]]*\]/"extraKnownMarketplaces": []/g' "$file"
      rm -f "${file}.bak"
    fi
  fi
}

transform_installed_plugins() {
  local file="$1"

  if command -v jq &>/dev/null; then
    local tmp
    tmp=$(mktemp)
    jq 'if type == "array" then [.[] | select(.name != "betterprompt@betterprompt" and .id != "betterprompt@betterprompt")]
        elif type == "object" then del(.["betterprompt@betterprompt"])
        else . end' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    # sed fallback: remove lines referencing betterprompt (best-effort)
    sed -i.bak '/betterprompt@betterprompt/d' "$file"
    rm -f "${file}.bak"
  fi
}

transform_known_marketplaces() {
  local file="$1"

  if command -v jq &>/dev/null; then
    local tmp
    tmp=$(mktemp)
    jq 'if type == "array" then [.[] | select(. != "betterprompt" and .name != "betterprompt" and .id != "betterprompt")]
        elif type == "object" then del(.betterprompt)
        else . end' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    sed -i.bak '/betterprompt/d' "$file"
    rm -f "${file}.bak"
  fi
}

transform_project_settings_local() {
  local file="$1"

  if command -v jq &>/dev/null; then
    local tmp
    tmp=$(mktemp)
    jq 'walk(if type == "object" then with_entries(select(.key | test("betterprompt"; "i") | not)) else . end)' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    sed -i.bak '/betterprompt/Id' "$file"
    rm -f "${file}.bak"
  fi
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--project-dir /path/to/project]"
      echo ""
      echo "Remove all BetterPrompt plugin artifacts for a clean install test."
      echo ""
      echo "Options:"
      echo "  --project-dir PATH   Also clean settings.local.json in the given project"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      echo "Usage: $0 [--project-dir /path/to/project]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
CLAUDE_DIR="$HOME/.claude"
PLUGINS_DIR="$CLAUDE_DIR/plugins"

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD} BetterPrompt Plugin Cleanup${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# 1. Edit ~/.claude/settings.json
safe_edit_json "$CLAUDE_DIR/settings.json" \
  "Disable plugin & clear marketplaces in settings.json" \
  transform_settings_json

# 2. Remove from installed_plugins.json
safe_edit_json "$PLUGINS_DIR/installed_plugins.json" \
  "Remove betterprompt from installed_plugins.json" \
  transform_installed_plugins

# 3. Remove from known_marketplaces.json
safe_edit_json "$PLUGINS_DIR/known_marketplaces.json" \
  "Remove betterprompt from known_marketplaces.json" \
  transform_known_marketplaces

# 4. Delete cache dirs
safe_remove "$PLUGINS_DIR/cache/betterprompt" "Plugin cache (betterprompt)"

# Also clean temp_local_* dirs under cache
if [[ -d "$PLUGINS_DIR/cache" ]]; then
  while IFS= read -r -d '' dir; do
    safe_remove "$dir" "Temp local cache dir"
  done < <(find "$PLUGINS_DIR/cache" -maxdepth 1 -type d -name 'temp_local_*' -print0 2>/dev/null)
fi

# 5. Delete marketplace dir
safe_remove "$PLUGINS_DIR/marketplaces/betterprompt" "Plugin marketplace (betterprompt)"

# 6. Clean project-level settings.local.json if --project-dir provided
if [[ -n "$PROJECT_DIR" ]]; then
  LOCAL_SETTINGS="$PROJECT_DIR/.claude/settings.local.json"
  safe_edit_json "$LOCAL_SETTINGS" \
    "Remove betterprompt entries from project settings.local.json" \
    transform_project_settings_local
fi

# 7. Delete ~/.betterprompt/ entirely
safe_remove "$HOME/.betterprompt" "BetterPrompt user data (~/.betterprompt/)"

# 8. Clean plugin state databases in home dir
while IFS= read -r -d '' dbfile; do
  safe_remove "$dbfile" "Plugin state database"
done < <(find "$HOME" -maxdepth 1 -name 'bp-results*' -o -name 'bp-stage*' -print0 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD} Cleanup Summary${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

if [[ ${#CLEANED[@]} -eq 0 ]]; then
  echo -e "${GREEN}Nothing to clean — environment was already clean.${NC}"
else
  echo -e "${GREEN}Cleaned ${#CLEANED[@]} item(s):${NC}"
  for item in "${CLEANED[@]}"; do
    echo -e "  ${GREEN}*${NC} $item"
  done
fi

echo ""
echo -e "${CYAN}Ready for a fresh plugin install test.${NC}"
echo ""
