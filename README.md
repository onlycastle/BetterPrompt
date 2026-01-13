# NoMoreAISlop

> Analyze your AI collaboration skills and build a knowledge platform for AI engineering best practices.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## Overview

NoMoreAISlop is a dual-purpose platform:

1. **Session Analyzer** - Parses Claude Code JSONL logs and analyzes your developer-AI collaboration patterns
2. **Knowledge Platform** - Gathers, evaluates, and organizes AI engineering knowledge through a multi-skill search agent

### Key Features

- **AI Coding Style Detection** - Identifies your collaboration style: Architect, Scientist, Collaborator, Speedrunner, or Craftsman
- **Dimension Analysis** - Deep insights into AI collaboration mastery, prompt engineering, burnout risk, and tool mastery
- **Knowledge Base** - Aggregates and evaluates AI engineering best practices from multiple sources
- **Web Dashboard** - Terminal-aesthetic React UI for exploring analyses and knowledge
- **REST API** - Express.js server for programmatic access (port 3001)
- **Local-First** - All analysis runs locally; no data sent to external servers (except Anthropic API for legacy analysis)

---

## Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Anthropic API Key** (for legacy LLM analysis mode)
- **Optional**: Supabase account (for knowledge platform features)

### Installation

```bash
# Clone the repository
git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=your-api-key-here

# Optional Analysis Overrides
NOSLOP_MODEL=claude-sonnet-4-20250514
NOSLOP_TELEMETRY=true

# Optional Knowledge Platform
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

See [`.env.example`](./.env.example) for complete configuration options.

---

## Usage

### Session Analysis

Analyze your Claude Code sessions to determine your AI collaboration style:

```bash
# Analyze recent sessions and display results in CLI
npm run dev -- scripts/analyze-style.ts

# Start the web dashboard (API + React UI)
npm run ui

# Or run API and web separately
npm run api           # Starts on http://localhost:3001
npm run ui:web        # Starts React dev server on http://localhost:5173
```

**Available npm scripts:**

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode compilation
npm run typecheck      # Type checking without emitting
npm run test           # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # ESLint validation
npm run api            # Start REST API server
npm run api:dev        # API in watch mode with hot reload
npm run ui             # Start complete UI (API + React together)
npm run ui:web         # React development server only
```

### Output

The system generates multiple output formats:

1. **CLI** - Terminal output with type results, metrics, and limited evidence
2. **Web Report** - Terminal-aesthetic HTML report with:
   - Free tier: Type result, 2 evidence samples, basic metrics
   - Locked sections: Full evidence, dimension analysis, growth roadmap
3. **Storage** - JSON analysis files saved to `~/.nomoreaislop/analyses/`

---

## System Architecture

### Core Pipeline

```
JSONL Session Logs
        ↓
    [SessionParser]
        ↓
    [StyleAnalyzer]
        ↓
    [Dimensions Module]
        ↓
    [Output Layer]
   ↙        ↘
 CLI         Web
```

### Main Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **SessionParser** | Parses Claude Code JSONL files | `src/parser/` |
| **StyleAnalyzer** | Detects AI coding style (5 types) | `src/analyzer/style-analyzer.ts` |
| **Dimensions** | Multi-metric analysis (AI collaboration, prompt score, burnout, tools) | `src/analyzer/dimensions/` |
| **SearchAgent** | Multi-skill knowledge gathering system | `src/search-agent/` |
| **API Server** | Express.js REST API | `src/api/` |
| **Web UI** | React-based dashboard | `web-ui/` |
| **Storage** | Local analysis persistence | `src/utils/storage.ts` |

---

## AI Coding Style Types

The analyzer identifies your collaboration style across 5 positive personality types:

| Type | Emoji | Tagline | Key Trait |
|------|-------|---------|-----------|
| **Architect** | 🏗️ | "I design before I build" | Upfront strategic planning |
| **Scientist** | 🔬 | "I experiment to understand" | Verification-driven approach |
| **Collaborator** | 🤝 | "I iterate with feedback" | Iterative dialogue patterns |
| **Speedrunner** | ⚡ | "I move fast and fix later" | Rapid execution and iteration |
| **Craftsman** | 🔧 | "I refine until perfect" | Quality-focused refinement |

Each type receives personalized strength assessments and growth recommendations.

### Example Output

```
╔══════════════════════════════════════════════════════════════════╗
║                   🏗️  YOUR AI CODING STYLE: ARCHITECT            ║
╚══════════════════════════════════════════════════════════════════╝

"Strategic thinker who plans before diving into code"

You approach AI collaboration with careful planning and systematic
thinking. You break down complex problems, anticipate edge cases,
and use AI as a design partner to validate architectural decisions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 STYLE TYPE DISTRIBUTION

Architect      ████████████████████████████████ 85%
Scientist      █████████ 25%
Collaborator   ███████████ 30%
Speedrunner    ████ 12%
Craftsman      ████████████████ 45%
```

---

## Analysis Dimensions

### 1. AI Collaboration Mastery Score (0-100)

Measures your effectiveness in AI-assisted development across four dimensions:

- **Context Engineering** (25%): File references, code element mentions, constraint clarity
- **Structured Planning** (25%): Planning tool usage, step-by-step approaches
- **AI Orchestration** (25%): Advanced tool coordination, multi-agent patterns
- **Critical Verification** (25%): Code reviews, testing, output validation

**Levels**: Novice (0-25) → Developing (26-50) → Proficient (51-75) → Expert (76-100)

### 2. Prompt Engineering Score (0-100)

Evaluates effectiveness of your prompts:

- **Context Provision**: Relevant background and code examples
- **Specificity**: Clear, detailed requirements
- **Iteration Efficiency**: Fewer turns to achieve results
- **First Try Success**: Minimal corrections needed
- **Constraint Clarity**: Explicit requirements and format specs

### 3. Burnout Risk Indicators (0-100, lower is healthier)

Analyzes work patterns for sustainability:

- **After Hours Rate**: Sessions after 9 PM
- **Weekend Rate**: Weekend work frequency
- **Late Night Sessions**: Work after midnight
- **Long Sessions**: Duration patterns and trends
- **Session Frequency**: Volume and consistency

### 4. Tool Mastery Profile (0-100)

Tracks effective use of Claude Code tools:

- **Read/Write Balance**: Verification before changes
- **Grep Effectiveness**: Pattern search usage
- **Multi-Tool Chains**: Complex workflows
- **Bash Usage**: Advanced operations
- **Tool Diversity**: Range of tools employed

---

## Search Agent & Knowledge Platform

The knowledge platform aggregates AI engineering best practices:

### Skills

The multi-skill system includes:

- **Gatherer** - Collects knowledge from multiple sources (YouTube, documentation, forums)
- **Judge** - Evaluates quality and relevance of gathered information
- **Organizer** - Structures and categorizes knowledge for easy discovery

### Storage

Knowledge is stored in Supabase with:

- **Influencers** - Domain experts and curators
- **Knowledge Entries** - Structured data with sources and evaluation scores
- **Platform Utils** - Cross-platform detection and normalization

### Setup Knowledge Platform

```bash
# Initialize Supabase database schema
npm run db:init

# Start populating knowledge base
npm run script scripts/populate-knowledge.ts

# Browse collected knowledge
npm run script scripts/browse-knowledge.ts
```

---

## Project Structure

```
nomoreaislop/
├── commands/                   # Claude Code plugin commands
│   ├── noslop.md
│   ├── analyze.md
│   ├── sessions.md
│   ├── history.md
│   └── config.md
│
├── src/
│   ├── analyzer/              # Session analysis
│   │   ├── index.ts           # LLMAnalyzer (legacy)
│   │   ├── style-analyzer.ts  # NEW: Style type detection
│   │   ├── prompts.ts         # Analysis prompts
│   │   ├── schema-converter.ts
│   │   └── dimensions/        # NEW: Multi-metric analysis
│   │       ├── ai-collaboration.ts
│   │       ├── prompt-score.ts
│   │       ├── burnout-risk.ts
│   │       └── tool-mastery.ts
│   │
│   ├── parser/                # JSONL session parsing
│   │   ├── index.ts
│   │   ├── jsonl-reader.ts
│   │   └── types.ts
│   │
│   ├── search-agent/          # Knowledge platform
│   │   ├── index.ts
│   │   ├── models/
│   │   ├── skills/
│   │   │   ├── gatherer/
│   │   │   ├── judge/
│   │   │   └── organizer/
│   │   └── storage/
│   │
│   ├── api/                   # REST API
│   │   └── index.ts
│   │
│   ├── cli/output/            # CLI rendering
│   │   ├── components/
│   │   └── theme.ts
│   │
│   ├── web/                   # Web server
│   │   ├── server.ts
│   │   └── template.ts
│   │
│   ├── models/                # Zod schemas
│   │   ├── evaluation.ts
│   │   ├── session.ts
│   │   ├── coding-style.ts
│   │   ├── config.ts
│   │   └── storage.ts
│   │
│   ├── utils/                 # Utilities
│   │   ├── reporter.ts
│   │   ├── storage.ts
│   │   ├── telemetry.ts
│   │   └── errors.ts
│   │
│   └── config/                # Configuration
│       └── manager.ts
│
├── scripts/                   # CLI utilities
│   ├── analyze-style.ts
│   ├── populate-knowledge.ts
│   ├── browse-knowledge.ts
│   └── ...
│
├── web-ui/                    # React dashboard
│   ├── src/
│   ├── public/
│   └── package.json
│
├── supabase/                  # Database schema
│   └── migrations/
│
├── tests/                     # Test suite
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   └── ...
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System design details
│   ├── DATA_MODELS.md         # Schema specifications
│   └── progress_plan.md       # Development roadmap
│
├── .env.example               # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

### Core Runtime

- **@anthropic-ai/sdk** - Anthropic API client
- **@supabase/supabase-js** - Supabase database client
- **express** - Web framework for API
- **zod** - TypeScript-first schema validation
- **picocolors** - Terminal colors
- **ora** - CLI spinners
- **boxen** - CLI boxes

### Development

- **typescript** - Type safety
- **vitest** - Testing framework
- **tsx** - TypeScript execution
- **eslint** - Code linting

See [`package.json`](./package.json) for complete dependency list.

---

## API Documentation

### REST API (Port 3001)

Start the API server:

```bash
npm run api
```

#### Endpoints

**Analyze Session**
```
POST /api/analyze
Content-Type: application/json

{
  "sessionId": "uuid-here"
}
```

**List Sessions**
```
GET /api/sessions
```

**Get Analysis Results**
```
GET /api/analyses/:sessionId
```

**Knowledge Search**
```
GET /api/knowledge/search?q=query
```

See `src/api/index.ts` for complete endpoint documentation.

---

## Configuration

### Local Storage

Analysis results are stored at:
```
~/.nomoreaislop/
├── analyses/           # JSON analysis results
├── config.json         # User settings
└── license.json        # Unlock status (future)
```

### Plugin Commands

When used as a Claude Code plugin, available commands:

#### Session Analysis
| Command | Description |
|---------|-------------|
| `/noslop` | Analyze current session for AI collaboration quality |
| `/noslop:analyze <id>` | Analyze specific session by ID |
| `/noslop:sessions` | List available Claude Code sessions |
| `/noslop:history` | View past analysis results |
| `/noslop:config` | View NoMoreAISlop configuration |

#### Knowledge Platform
| Command | Description |
|---------|-------------|
| `/noslop:learn` | Gather and organize AI engineering knowledge from web sources |
| `/noslop:search-knowledge <query>` | Search the curated knowledge base |
| `/noslop:knowledge` | Browse and manage the knowledge base |

### CLI Scripts

Direct script execution for advanced usage:

```bash
# Style Analysis
npx tsx scripts/analyze-style.ts                    # Normal mode (pattern-based)
npx tsx scripts/analyze-style.ts --verbose          # Verbose mode (LLM-powered)
npx tsx scripts/analyze-style.ts --verbose --dry-run # Preview cost without running
npx tsx scripts/analyze-style.ts --verbose --yes    # Skip cost confirmation

# Session Management
npx tsx scripts/test-local.ts sessions              # List sessions
npx tsx scripts/test-local.ts analyze <id>          # Analyze specific session
npx tsx scripts/test-local.ts history               # View history

# Knowledge Platform
npx tsx scripts/learn.ts --mock                     # Test learning pipeline
npx tsx scripts/browse-knowledge.ts --stats         # Knowledge base statistics
npx tsx scripts/search-knowledge.ts "query"         # Search knowledge
npx tsx scripts/knowledge.ts list                   # List knowledge items
```

---

## Development & Testing

### Quick Test Sequence

Run this sequence to verify the full implementation is working:

```bash
# 1. Build & Type Check
npm run build                              # Compile TypeScript
npm run typecheck                          # Verify types

# 2. Automated Tests (414 tests across 17 files)
npm test                                   # Run all unit/integration tests

# 3. Database Connection (requires SUPABASE_* env vars)
npx tsx scripts/test-supabase.ts           # Verify Supabase connection

# 4. Session Analyzer
npx tsx scripts/test-local.ts sessions     # List Claude Code sessions

# 5. Search Agent (no external dependencies)
npx tsx scripts/learn.ts --mock            # Test learning pipeline

# 6. Knowledge Base
npx tsx scripts/browse-knowledge.ts --stats # Verify knowledge storage

# 7. Style Analysis
npx tsx scripts/analyze-style.ts           # Full style analysis + web report
```

---

### Automated Tests (Vitest)

The test suite covers 17 files with 414 tests:

```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode (re-runs on changes)
npm run test:coverage    # Generate coverage report
```

**Test Coverage:**

| Component | Test File | Tests |
|-----------|-----------|-------|
| Parser | `tests/unit/parser/jsonl-reader.test.ts` | 34 |
| Analyzer | `tests/unit/analyzer/type-detector.test.ts` | 28 |
| Pattern Utils | `tests/unit/analyzer/dimensions/pattern-utils.test.ts` | 40 |
| Models (Session) | `tests/unit/models/session.test.ts` | 35 |
| Models (Evaluation) | `tests/unit/models/evaluation.test.ts` | 22 |
| Models (Config) | `tests/unit/models/config.test.ts` | 18 |
| Config Manager | `tests/unit/config/manager.test.ts` | 26 |
| Result Type | `tests/unit/lib/result.test.ts` | 45 |
| Influencer Service | `tests/unit/application/services/influencer-service.test.ts` | 22 |
| Knowledge Service | `tests/unit/application/services/knowledge-service.test.ts` | 18 |
| API Routes | `tests/unit/api/routes/*.test.ts` | 33 |
| Search Agent Models | `tests/unit/search-agent/models/*.test.ts` | 53 |
| Judge Criteria | `tests/unit/search-agent/skills/judge/criteria.test.ts` | 22 |
| Integration | `tests/integration.test.ts` | 4 |

---

### Database Testing (Supabase)

```bash
# Test Supabase connection and table access
npx tsx scripts/test-supabase.ts

# Expected output:
# ✅ Connection successful!
# 📊 knowledge_items table accessible
# 📊 influencers table accessible
```

**Required environment variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# or
SUPABASE_ANON_KEY=your-anon-key
```

---

### Session Analyzer Testing

```bash
# List available Claude Code sessions
npx tsx scripts/test-local.ts sessions

# Analyze most recent session (requires ANTHROPIC_API_KEY)
npx tsx scripts/test-local.ts analyze

# Analyze specific session with options
npx tsx scripts/test-local.ts analyze <session-id>
npx tsx scripts/test-local.ts analyze --summary   # Condensed view
npx tsx scripts/test-local.ts analyze --verbose   # Full details
npx tsx scripts/test-local.ts analyze --json      # Raw JSON output

# View past analyses
npx tsx scripts/test-local.ts history

# Full style analysis with web report (port 3000)
npx tsx scripts/analyze-style.ts
```

---

### Search Agent Testing

```bash
# Test learning pipeline with mock data (no external dependencies)
npx tsx scripts/learn.ts --mock

# Test with real search results from JSON file
npx tsx scripts/learn.ts <path-to-results.json>

# Browse knowledge base
npx tsx scripts/browse-knowledge.ts                  # List all items
npx tsx scripts/browse-knowledge.ts --stats          # Statistics summary
npx tsx scripts/browse-knowledge.ts --metrics        # Quality metrics
npx tsx scripts/browse-knowledge.ts --json           # JSON output

# Filter knowledge
npx tsx scripts/browse-knowledge.ts --platform youtube
npx tsx scripts/browse-knowledge.ts --category prompt-engineering
npx tsx scripts/browse-knowledge.ts --author "Andrej Karpathy"
npx tsx scripts/browse-knowledge.ts --min-score 0.8
npx tsx scripts/browse-knowledge.ts --query "context engineering"
npx tsx scripts/browse-knowledge.ts --sort date --limit 10

# Search knowledge base
npx tsx scripts/search-knowledge.ts "context engineering"
npx tsx scripts/search-knowledge.ts --top --limit 10
```

---

### YouTube Learning Testing

```bash
# Process single video (requires ANTHROPIC_API_KEY)
npx tsx scripts/learn-youtube.ts https://youtube.com/watch?v=VIDEO_ID

# Process and save to knowledge base
npx tsx scripts/learn-youtube.ts https://youtube.com/watch?v=VIDEO_ID --save

# Process playlist
npx tsx scripts/learn-youtube.ts https://youtube.com/playlist?list=PLAYLIST_ID --playlist

# Process playlist with limit
npx tsx scripts/learn-youtube.ts <playlist-url> --playlist --max 5

# JSON output
npx tsx scripts/learn-youtube.ts <video-url> --json
```

---

### Influencer Registry Testing

```bash
# List all tracked influencers
npx tsx scripts/manage-influencers.ts list

# Show influencer statistics
npx tsx scripts/manage-influencers.ts stats

# Search influencers
npx tsx scripts/manage-influencers.ts search "prompt engineering"

# Add new influencer
npx tsx scripts/manage-influencers.ts add \
  --name "John Doe" \
  --twitter "johndoe" \
  --tier medium \
  --topics "AI,prompt-engineering,coding"

# Remove influencer
npx tsx scripts/manage-influencers.ts remove <influencer-id>

# Export registry as JSON
npx tsx scripts/manage-influencers.ts export

# Reset to defaults
npx tsx scripts/manage-influencers.ts reset
```

---

### API Server Testing

```bash
# Start API server (port 3001)
npm run api

# Start API in development mode (hot reload)
npm run api:dev

# Test endpoints with curl:
curl http://localhost:3001/api/health
curl http://localhost:3001/api/sessions
curl http://localhost:3001/api/knowledge
curl http://localhost:3001/api/knowledge/stats
curl http://localhost:3001/api/influencers
```

---

### Web UI Testing

```bash
# Start complete UI (API + React together)
npm run ui

# Or run separately:
npm run api           # Terminal 1: API on :3001
npm run ui:web        # Terminal 2: React on :5173

# Style analysis with web report
npx tsx scripts/analyze-style.ts   # Opens report on :3000
```

---

### Type Checking & Linting

```bash
npm run typecheck     # Type check without emitting
npm run build         # Full build with type checking
npm run lint          # ESLint validation
```

---

### Comprehensive Test Sequence (All Features)

```bash
# ====== PHASE 1: Build & Validate ======
npm run build && npm run typecheck && npm run lint

# ====== PHASE 2: Automated Tests ======
npm test

# ====== PHASE 3: Database ======
npx tsx scripts/test-supabase.ts

# ====== PHASE 4: Session Analyzer ======
npx tsx scripts/test-local.ts sessions
npx tsx scripts/test-local.ts history

# ====== PHASE 5: Search Agent ======
npx tsx scripts/learn.ts --mock
npx tsx scripts/browse-knowledge.ts --stats
npx tsx scripts/manage-influencers.ts list

# ====== PHASE 6: API ======
npm run api &
sleep 2
curl -s http://localhost:3001/api/health | head -1
pkill -f "tsx src/api"

# ====== PHASE 7: Style Analysis ======
npx tsx scripts/analyze-style.ts
```

---

## Data Privacy & Security

- **Local-First**: All analysis runs locally; session content only sent to Anthropic with your API key
- **No Cloud Storage**: Analysis results stored in `~/.nomoreaislop/` (user's machine only)
- **Web Server Local-Only**: Dashboard runs on localhost, no external connections
- **Optional Telemetry**: Anonymous usage events (can be disabled via `.env`)
- **Data Control**: Delete all data by removing `~/.nomoreaislop/` directory

---

## Telemetry

Collects anonymous events (opt-out via `NOSLOP_TELEMETRY=false`):

- Installation events
- Analysis completion (counts, not content)
- Feature usage
- Plugin version

**Never collects**: Session content, API keys, file paths, or prompts.

---

## Roadmap

### Phase 1: Analysis Platform (Current)
- [x] Session JSONL parsing
- [x] AI Coding Style detection
- [x] Multi-dimension analysis
- [x] Web dashboard with terminal aesthetic
- [x] REST API server

### Phase 2: Knowledge Platform (In Progress)
- [ ] Knowledge gathering agents
- [ ] Quality evaluation framework
- [ ] Organized knowledge browser
- [ ] Search and filtering

### Phase 3: Monetization & Sharing
- [ ] Stripe payment integration
- [ ] Premium features unlock
- [ ] Shareable analysis badges
- [ ] Leaderboards

### Phase 4: Enterprise
- [ ] Multi-user teams
- [ ] Admin dashboards
- [ ] API key management
- [ ] Bulk analysis

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

Please include tests and documentation for new features.

---

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design, component responsibilities, data flows
- **[DATA_MODELS.md](./docs/DATA_MODELS.md)** - Complete schema specifications and examples
- **[progress_plan.md](./docs/progress_plan.md)** - Development roadmap and milestones

---

## License

MIT License. See [LICENSE](./LICENSE) file for details.

---

## Support

- **GitHub Issues** - [Report bugs or request features](https://github.com/nomoreaislop/nomoreaislop/issues)
- **Documentation** - See `docs/` directory
- **Email** - [support@nomoreaislop.com](mailto:support@nomoreaislop.com) (future)

---

## Acknowledgments

This project analyzes patterns in developer-AI collaboration, drawing on research from:

- Anthropic's work on collaborative intelligence
- JetBrains State of Developer Ecosystem reports
- GitHub Copilot Metrics and best practices

Special thanks to the Claude Code community for inspiration and feedback.

---

**Built with TypeScript, Express, React, and Anthropic's Claude API.**

Made with care for developers who want to master AI collaboration.
