# NoMoreAISlop

> Analyze your AI collaboration skills and discover your coding style.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## Overview

NoMoreAISlop analyzes your Claude Code sessions to identify your AI collaboration style and provide personalized growth recommendations.

**Key Features:**
- **AI Coding Style Detection** - Architect, Scientist, Collaborator, Speedrunner, or Craftsman
- **6-Dimension Analysis** - AI collaboration, context engineering, burnout risk, tool mastery, control index, skill resilience
- **LLM-Powered Insights** - Hyper-personalized analysis with evidence quotes from your actual sessions
- **Terminal-Aesthetic Web UI** - React dashboard with macOS-style interface

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop
npm install

# Configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Run analysis
npx tsx scripts/analyze-style.ts
```

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=your-api-key-here

# Optional
NOSLOP_MODEL=claude-sonnet-4-20250514
NOSLOP_TELEMETRY=true

# Optional (Knowledge Platform)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Usage

### Analysis Commands

```bash
# Run analysis (opens web report)
npx tsx scripts/analyze-style.ts

# Preview cost without running
npx tsx scripts/analyze-style.ts --dry-run

# Skip cost confirmation
npx tsx scripts/analyze-style.ts --yes
```

### Development Commands

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type check
npm run test           # Run tests
npm run lint           # ESLint

npm run ui             # Start API + React UI
npm run api            # API only (port 3001)
npm run ui:web         # React only (port 5173)
```

---

## The 5 AI Coding Styles

| Type | Emoji | Tagline |
|------|-------|---------|
| **Architect** | 🏗️ | Strategic planner who designs before coding |
| **Scientist** | 🔬 | Truth-seeker who verifies AI output |
| **Collaborator** | 🤝 | Pair programmer who iterates through dialogue |
| **Speedrunner** | ⚡ | Agile executor who moves fast |
| **Craftsman** | 🔧 | Quality artisan who refines code |

---

## Project Structure

```
nomoreaislop/
├── src/
│   ├── analyzer/      # LLM analysis (VerboseAnalyzer, UnifiedAnalyzer)
│   ├── parser/        # JSONL session parsing
│   ├── models/        # Zod schemas (verbose-evaluation, unified-report)
│   ├── api/           # REST API (Express, port 3001)
│   └── domain/        # Domain models and errors
├── web-ui/            # React SPA (Vite, port 5173)
├── scripts/           # CLI utilities
├── commands/          # Claude Code plugin commands
└── docs/
    └── ARCHITECTURE.md  # System design details
```

For detailed architecture, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Data Privacy

- **Local-First**: Session content only sent to Anthropic with your API key
- **Local Storage**: Results saved in `~/.nomoreaislop/`
- **No Cloud Storage**: Dashboard runs on localhost only
- **Optional Telemetry**: Disable with `NOSLOP_TELEMETRY=false`

---

## Plugin Commands

When used as a Claude Code plugin:

| Command | Description |
|---------|-------------|
| `/noslop` | Analyze current session |
| `/noslop:analyze <id>` | Analyze specific session |
| `/noslop:sessions` | List available sessions |
| `/noslop:history` | View past analyses |
| `/noslop:config` | View configuration |

---

## Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design, pipelines, components

---

## License

MIT License. See [LICENSE](./LICENSE) file.

---

## Support

- **GitHub Issues** - [Report bugs or request features](https://github.com/nomoreaislop/nomoreaislop/issues)

---

**Built with TypeScript, React, and Anthropic's Claude API.**
