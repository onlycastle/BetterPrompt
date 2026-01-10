---
allowed-tools: Bash(cat:*), Bash(echo:*)
description: View NoMoreAISlop configuration
---

Show the current NoMoreAISlop configuration.

Configuration is managed through:
1. Environment variables (highest priority)
2. Config file: `~/.nomoreaislop/config.json`

Show the current config:

```bash
cat ~/.nomoreaislop/config.json 2>/dev/null || echo '{"message": "No config file found. Using defaults."}'
```

## Available Settings

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| API Key | `ANTHROPIC_API_KEY` | (required) |
| Model | `NOSLOP_MODEL` | `claude-sonnet-4-20250514` |
| Telemetry | `NOSLOP_TELEMETRY` | `true` |
| Storage Path | `NOSLOP_STORAGE_PATH` | `~/.nomoreaislop` |

To change settings, set the corresponding environment variable or edit the config file directly.
