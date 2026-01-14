# Configuration Guide

NoMoreAISlop uses a flexible configuration system that supports environment variables, configuration files, and sensible defaults. This guide covers all available configuration options and how to set them up for your environment.

## Quick Start

The simplest way to get started:

```bash
# 1. Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# 2. Run analysis
npx tsx scripts/analyze-style.ts
```

That's it! All other settings have defaults that work out of the box.

For a more complete setup with custom storage and telemetry control:

```bash
# Create config file
mkdir -p ~/.nomoreaislop

# Edit config (or let the app create it)
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-sonnet-4-20250514"
}
EOF
```

## Configuration Resolution Order

Settings are resolved in this priority order (highest to lowest):

1. **Environment Variables** - Immediate override (e.g., `ANTHROPIC_API_KEY=...`)
2. **Config File** - Settings in `~/.nomoreaislop/config.json`
3. **Defaults** - Built-in fallback values

Example: If you set `NOSLOP_MODEL=claude-opus-4-20250514` as an environment variable, it will override any `model` value in your config file or the default.

## Environment Variables

All environment variables are optional except `ANTHROPIC_API_KEY` (required for LLM analysis).

### Core Analysis Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key for Claude access. Get one at [console.anthropic.com](https://console.anthropic.com/) |
| `NOSLOP_MODEL` | `claude-sonnet-4-20250514` | Claude model to use for analysis. See [Model Selection Guide](#model-selection-guide) for options |
| `NOSLOP_TELEMETRY` | `true` | Enable anonymous usage telemetry (can be `true`, `false`, `0`, or `1`) |
| `NOSLOP_STORAGE_PATH` | `~/.nomoreaislop` | Directory for storing analyses and config. Supports `~` for home directory |

### Knowledge Platform Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | (optional) | Your Supabase project URL (e.g., `https://project-ref.supabase.co`) |
| `SUPABASE_ANON_KEY` | (optional) | Supabase anonymous key for public access |
| `SUPABASE_SERVICE_ROLE_KEY` | (optional) | Supabase service role key for admin operations (requires this OR SUPABASE_ANON_KEY) |

### Development Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `NOSLOP_TEST_TIER` | (optional) | Test tier for development: `free`, `pro`, `premium`, or `enterprise` |

## Configuration File

The configuration file is stored at `~/.nomoreaislop/config.json` and uses this schema:

```json
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-sonnet-4-20250514"
}
```

### Schema Details

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | string | `"1.0.0"` | Config format version (locked to ensure compatibility) |
| `apiKey` | string or null | `null` | Anthropic API key. Can be `null` for read-only operations |
| `telemetry` | boolean | `true` | Enable/disable anonymous usage tracking |
| `storagePath` | string | `~/.nomoreaislop` | Directory for storing analysis results. Supports `~` |
| `model` | string | `claude-sonnet-4-20250514` | Claude model for analysis |

### File Locations

```
~/.nomoreaislop/
├── config.json              # User configuration
├── analyses/                # Analysis results (JSON files)
│   ├── {session-id}.json   # Individual analysis
│   └── ...
└── telemetry/              # Anonymized event logs (if enabled)
    └── events.jsonl
```

## Model Selection Guide

Choose the right Claude model for your needs:

### Recommended Models

| Model | Cost | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `claude-haiku-4-5-20251001` | Lowest | Fastest | Good for patterns | Quick analysis, budget-conscious |
| `claude-sonnet-4-20250514` | Medium | Fast | Excellent | Default; general-purpose analysis |
| `claude-opus-4-20251101` | Highest | Slower | Best-in-class | Complex analysis, highest accuracy |

### Usage Examples

```bash
# Use Haiku for budget-friendly analysis
export NOSLOP_MODEL=claude-haiku-4-5-20251001

# Use Opus for maximum accuracy
export NOSLOP_MODEL=claude-opus-4-20251101

# Or set in config file
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "model": "claude-opus-4-20251101"
}
EOF
```

### Model Comparison

**Haiku (Fastest, Most Affordable)**
- Cost: ~$0.80 per million tokens
- Speed: 2-3x faster than Sonnet
- Use when: Quick pattern analysis, cost is primary concern
- Note: Good enough for style detection and basic analysis

**Sonnet (Balanced)**
- Cost: ~$3 per million tokens
- Speed: Baseline speed reference
- Use when: General purpose analysis (recommended default)
- Note: Best cost/quality tradeoff for most users

**Opus (Most Powerful)**
- Cost: ~$15 per million tokens
- Speed: 2-3x slower than Sonnet
- Use when: Complex analysis, accuracy is critical
- Note: Recommended for enterprise tier

## Telemetry Configuration

NoMoreAISlop collects anonymous usage data to improve the product. All telemetry is **opt-out** and **fully anonymous**.

### What's Collected

Telemetry events include:
- Plugin installation events
- Analysis completion (counts only, no content)
- Feature usage (which commands are used)
- Plugin version number

### What's NOT Collected

The following data is **never** sent:
- Session content or conversation history
- Your API keys or credentials
- File paths or project structure
- Specific prompts or code snippets
- Personal or identifying information

### Disabling Telemetry

To disable telemetry:

```bash
# Option 1: Environment variable
export NOSLOP_TELEMETRY=false

# Option 2: Config file
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "telemetry": false
}
EOF

# Option 3: Valid false values
export NOSLOP_TELEMETRY=0        # Also works
export NOSLOP_TELEMETRY=false    # Also works
```

### Viewing Telemetry Data

If enabled, telemetry events are stored locally at:
```
~/.nomoreaislop/telemetry/events.jsonl
```

Each line is a JSON event. You can inspect your own data anytime.

## Storage Configuration

### Default Storage

All analysis results are stored locally in your home directory:

```
~/.nomoreaislop/
├── config.json              # Configuration (max 10KB)
├── analyses/                # Analysis results
│   ├── {session-id}.json   # One file per analysis (~50-200KB)
│   └── ...
└── telemetry/              # Event logs (if enabled)
```

### Custom Storage Location

To use a different storage directory:

```bash
# Option 1: Environment variable
export NOSLOP_STORAGE_PATH=/path/to/storage

# Option 2: Config file
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "storagePath": "/custom/path/for/analyses"
}
EOF
```

Important: The storage path is created automatically if it doesn't exist.

### Clearing Storage

To clear all local data:

```bash
# Remove everything
rm -rf ~/.nomoreaislop

# Or keep config but clear analyses
rm -rf ~/.nomoreaislop/analyses
rm -rf ~/.nomoreaislop/telemetry
```

## Configuration Examples

### Example 1: Minimal Setup

Only set what's required:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

All other values use defaults. Configuration file not created until first modification.

### Example 2: Development Setup

Development environment with verbose logging and budget model:

```bash
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "model": "claude-haiku-4-5-20251001",
  "telemetry": false,
  "storagePath": "~/.nomoreaislop"
}
EOF
```

Run with:
```bash
export NODE_ENV=development
npm run dev -- scripts/analyze-style.ts
```

### Example 3: Production Setup

Production environment with best model and telemetry enabled:

```bash
cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "model": "claude-opus-4-20251101",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop"
}
EOF
```

### Example 4: Enterprise with Supabase

Full setup with knowledge platform:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export NOSLOP_MODEL=claude-sonnet-4-20250514
export NOSLOP_TELEMETRY=true
export NOSLOP_STORAGE_PATH=~/.nomoreaislop
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or in config file and `.env`:

**~/.nomoreaislop/config.json:**
```json
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-20250514",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop"
}
```

**.env:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Example 5: Team Shared Analysis

Custom storage for team results:

```bash
mkdir -p /var/nomoreaislop/shared

cat > ~/.nomoreaislop/config.json << 'EOF'
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "storagePath": "/var/nomoreaislop/shared",
  "telemetry": false
}
EOF
```

## API Reference: ConfigManager

The `ConfigManager` class handles all configuration operations programmatically.

### Usage in Code

```typescript
import { configManager } from '@/config/manager';

// Get full config
const config = await configManager.getConfig();

// Get specific values
const apiKey = await configManager.get('apiKey');
const model = await configManager.getModel();
const enabled = await configManager.isTelemetryEnabled();
const storagePath = await configManager.getStoragePath();

// Check if API key is configured
const hasKey = await configManager.hasApiKey();

// Set values and persist
await configManager.set('model', 'claude-opus-4-20251101');
await configManager.set('telemetry', false);

// Reset to defaults
await configManager.reset();

// Check if config file exists
const exists = await configManager.exists();

// Get config file path
const path = configManager.getConfigPath();
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getConfig()` | `Promise<Config>` | Get merged config (env > file > defaults) |
| `get(key)` | `Promise<Config[K]>` | Get specific config value |
| `set(key, value)` | `Promise<void>` | Set value and persist to file |
| `save(config)` | `Promise<void>` | Save full config to file |
| `reset()` | `Promise<void>` | Reset to default values |
| `getApiKey()` | `Promise<string or null>` | Convenience method for API key |
| `hasApiKey()` | `Promise<boolean>` | Check if API key is configured |
| `isTelemetryEnabled()` | `Promise<boolean>` | Check telemetry status |
| `getModel()` | `Promise<string>` | Get selected model |
| `getStoragePath()` | `Promise<string>` | Get storage directory (expanded `~`) |
| `exists()` | `Promise<boolean>` | Check if config file exists |
| `getConfigPath()` | `string` | Get config file path |

## Troubleshooting

### API Key Issues

**Error: "API key is required"**

Solution: Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or in config file:
```json
{
  "version": "1.0.0",
  "apiKey": "sk-ant-..."
}
EOF
```

Get an API key at: https://console.anthropic.com/

### Storage Path Issues

**Error: "Permission denied" when creating storage directory**

Solution: Use a directory you own:
```bash
export NOSLOP_STORAGE_PATH=~/my-analyses
```

Or fix permissions:
```bash
chmod 755 ~/.nomoreaislop
```

### Config File Issues

**Error: "Invalid configuration" or "Config validation failed"**

Solution: Validate your config file:
```bash
# Check syntax
cat ~/.nomoreaislop/config.json | jq .

# Reset to defaults
rm ~/.nomoreaislop/config.json
# App will create new valid config on next run
```

Valid config must have:
- `version`: `"1.0.0"` (required)
- `apiKey`: string or null (optional)
- `telemetry`: boolean (optional, default true)
- `storagePath`: string (optional, default `~/.nomoreaislop`)
- `model`: string (optional, default `claude-sonnet-4-20250514`)

### Model Not Found

**Error: "Model not available" or "Invalid model name"**

Solution: Check available models and use correct name:
```bash
# Valid models:
# - claude-haiku-4-5-20251001
# - claude-sonnet-4-20250514
# - claude-opus-4-20251101

export NOSLOP_MODEL=claude-sonnet-4-20250514
```

### Telemetry Parse Errors

**Issue: Telemetry events not being recorded**

Solution: Check NOSLOP_TELEMETRY is valid:
```bash
# Valid values:
export NOSLOP_TELEMETRY=true
export NOSLOP_TELEMETRY=false
export NOSLOP_TELEMETRY=1
export NOSLOP_TELEMETRY=0

# Invalid values (will use default):
# export NOSLOP_TELEMETRY=yes  # WRONG
```

## Environment-Specific Setups

### Docker

In your Dockerfile:
```dockerfile
FROM node:18-alpine
ENV NOSLOP_STORAGE_PATH=/data/analyses
ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ENV NOSLOP_MODEL=claude-sonnet-4-20250514
VOLUME ["/data"]
```

Run with:
```bash
docker run -e ANTHROPIC_API_KEY=sk-ant-... \
  -v /path/to/analyses:/data \
  nomoreaislop
```

### CI/CD Pipeline

In GitHub Actions:
```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  NOSLOP_MODEL: claude-sonnet-4-20250514
  NOSLOP_TELEMETRY: false
  NOSLOP_STORAGE_PATH: ./analyses

script:
  - npm run build
  - npx tsx scripts/analyze-style.ts
```

### SSH Remote Setup

Remote configuration over SSH:
```bash
ssh user@remote.server << 'EOF'
mkdir -p ~/.nomoreaislop
cat > ~/.nomoreaislop/config.json << 'CONFIG'
{
  "version": "1.0.0",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-20250514"
}
CONFIG
EOF
```

## Related Documentation

- [README.md](../README.md) - Project overview and quick start
- [SCRIPTS.md](./SCRIPTS.md) - Available CLI scripts and usage
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and component details
- [DATA_MODELS.md](./DATA_MODELS.md) - Complete schema specifications

## Support

For configuration issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review examples for your use case
3. Open an issue on [GitHub](https://github.com/nomoreaislop/nomoreaislop/issues)
4. Email [support@nomoreaislop.com](mailto:support@nomoreaislop.com)
