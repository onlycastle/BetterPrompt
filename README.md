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
- **Desktop App** - Native macOS/Windows/Linux application with beautiful UI

---

## Quick Start

### Run Locally

```bash
# Clone and install
git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server (web app)
npm run dev
```

### Environment Variables

```env
# Required - Two-stage pipeline (Gemini 3 Flash)
GOOGLE_GEMINI_API_KEY=your-gemini-api-key-here

# Optional - Legacy single-stage mode / fallback
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Optional - Configuration
NOSLOP_MODEL=claude-sonnet-4-20250514  # Legacy mode only
NOSLOP_TELEMETRY=false

# Supabase (for knowledge platform)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Development Commands

### Web App

```bash
npm run dev            # Start Next.js development server (port 3000)
npm run build          # Build production bundle
npm run start          # Start production server
npm run typecheck      # Type check
npm run test           # Run tests
npm run lint           # ESLint
```

### Desktop App

```bash
cd packages/desktop
npm run dev            # Start Electron app in development mode
npm run build          # Build desktop app for current platform
npm run package        # Package app for distribution
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
├── app/                   # Next.js 15 App Router
│   ├── api/               # API routes (knowledge, learn, reports, etc.)
│   ├── browse/            # Knowledge discovery page
│   ├── dashboard/         # Analytics dashboard
│   ├── personal/          # Personal analytics
│   ├── enterprise/        # Team dashboard (B2B)
│   └── report/[reportId]/ # Dynamic report pages
├── src/
│   ├── lib/               # Core library
│   │   ├── analyzer/      # LLM analysis (two-stage pipeline)
│   │   ├── parser/        # JSONL session parsing
│   │   ├── models/        # Zod schemas
│   │   └── search-agent/  # Knowledge curation
│   ├── components/        # React UI components
│   ├── hooks/             # React hooks
│   └── views/             # Page view components
├── packages/
│   └── desktop/           # Electron desktop application
├── scripts/               # Utility scripts
└── docs/                  # Documentation
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

- **Local-First**: Session content only sent to LLM providers with your API keys
- **Optional Telemetry**: Disable with `NOSLOP_TELEMETRY=false`

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

**Built with TypeScript, Next.js 15, and React 19.**
