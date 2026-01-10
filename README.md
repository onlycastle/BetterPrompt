# NoMoreAISlop

> **What's Your AI Coding Style?** Discover your AI collaboration personality

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-orange)](https://github.com/anthropics/claude-code)
[![Version](https://img.shields.io/badge/version-2.1.0-green.svg)](https://github.com/nomoreaislop/nomoreaislop/releases)

NoMoreAISlop v2.1 reveals your unique AI collaboration style through deep analysis of your Claude Code sessions. Like a personality test for developer-AI interaction, it identifies which of 5 distinct coding styles you embody, provides dimensional analysis of your collaboration patterns, and generates a beautiful web report you can share.

## The 5 AI Coding Style Types

NoMoreAISlop categorizes your collaboration style into one of five distinct personalities:

### 🏗️ Architect
*"Strategic thinker who plans before diving into code"*

Plans meticulously, breaks down problems systematically, and thinks several steps ahead. Treats AI as a design partner.

### 🔬 Scientist
*"Truth-seeker who always verifies AI output"*

Questions assumptions, tests hypotheses, and validates every suggestion. Uses AI as a research assistant, not a source of truth.

### 🤝 Collaborator
*"Partnership master who finds answers through dialogue"*

Excels at back-and-forth iteration, refines through conversation, and builds context progressively. Views AI as a true pair-programming partner.

### ⚡ Speedrunner
*"Agile executor who delivers through fast iteration"*

Moves quickly, learns by doing, and optimizes for velocity over perfection. Leverages AI to accelerate development cycles.

### 🔧 Craftsman
*"Artisan who prioritizes code quality above all"*

Focuses on patterns, maintainability, and long-term design. Uses AI to elevate code quality rather than just complete tasks.

## Deep Analysis Dimensions

Beyond identifying your style type, v2.1 provides dimensional analysis:

### 🧠 AI Dependency Score (0-100)
Measures how much you rely on AI vs. independent problem-solving. Lower scores indicate healthier collaboration patterns where you maintain agency.

**Healthy Range:** 20-50

### 🎯 Prompt Engineering Score (0-100)
Evaluates the clarity, specificity, and effectiveness of your prompts. Higher scores mean you get better results with fewer iterations.

**Target:** 70+

### 🔥 Burnout Risk Analysis
Analyzes session time patterns, task complexity, and frustration signals to identify potential burnout indicators.

**Levels:** Low / Moderate / High / Critical

### 🛠️ Tool Mastery Profile
Measures your effectiveness with Claude Code's tools (Read, Write, Edit, Bash, etc.) and identifies opportunities for improvement.

**Categories:** Novice / Competent / Proficient / Expert

## Installation

```bash
# Clone the repository
git clone https://github.com/nomoreaislop/nomoreaislop.git

# Install dependencies
cd nomoreaislop
npm install

# Build the project
npm run build
```

Then add to your Claude Code plugins directory or install via the Claude Code plugin marketplace.

## Requirements

- Claude Code CLI
- Node.js 18+
- Anthropic API key (`ANTHROPIC_API_KEY` environment variable)

## Quick Start

### Run Style Analysis

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-api-key

# Run the style analyzer
npx tsx scripts/analyze-style.ts
```

This will:
1. Analyze your recent Claude Code sessions
2. Calculate your coding style type and dimensional scores
3. Launch a local web server at `http://localhost:3000`
4. Open your browser to view your personalized report

### Use Plugin Commands

```bash
# Analyze your current session
/noslop

# View your coding style history
/noslop:history
```

## Commands

| Command | Description |
|---------|-------------|
| `/noslop` | Analyze the current session |
| `/noslop:analyze <id>` | Analyze a specific session |
| `/noslop:sessions` | List available sessions |
| `/noslop:history` | View past analysis results |
| `/noslop:config` | View/modify settings |

## Example Output

### Style Type Result

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 DIMENSIONAL ANALYSIS

🧠 AI Dependency Score:        ████████░░ 32/100  (Healthy)
🎯 Prompt Engineering Score:   ███████████ 78/100 (Strong)
🔥 Burnout Risk:              ██░░░░░░░░ Low
🛠️  Tool Mastery:              ████████░░ Proficient

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 GROWTH RECOMMENDATIONS

1. Consider pairing your planning strength with faster iteration cycles
2. Your low dependency score is excellent - maintain this independence
3. Try experimenting with the Edit tool more (currently 23% usage)

📈 View full report at: http://localhost:3000/report/abc123
```

### Classic Session Analysis

The original v1.x functionality remains available, providing detailed evaluation:

```
# 📊 AI Collaboration Report

**Analysis Date:** January 10, 2026, 3:15 PM
**Session Duration:** 45 minutes
**Messages:** 12 user, 15 assistant
**Coding Style:** 🏗️ Architect

---

## Summary

| Category | Rating | Score |
|----------|--------|-------|
| Planning | 🟢 **Strong** | ████████████████████ |
| Critical Thinking | 🟡 **Developing** | ████████████░░░░░░░░ |
| Code Understanding | 🟢 **Strong** | ████████████████████ |

## Detailed Analysis

### Planning

🟢 **Strong**

The developer consistently broke down complex tasks into clear steps...

**Evidence:**
1. ✓ "First, let me understand the current auth flow. Then we'll modify the middleware..."
   → *Demonstrates systematic task breakdown with clear sequence*

...

## 💡 Recommendations

1. Before accepting code, ask "What could go wrong here?" to prompt consideration of edge cases
2. When AI generates database queries, always verify that appropriate indexes exist
```

## Rating System

NoMoreAISlop uses a growth-focused rating system:

| Rating | Meaning |
|--------|---------|
| 🟢 **Strong** | Excellent performance, demonstrates best practices |
| 🟡 **Developing** | Good foundation with clear opportunities for growth |
| 🔴 **Needs Work** | Significant room for improvement |

## How It Works

### v2.1 Style Analysis Pipeline

1. **Aggregate Sessions** - Analyzes multiple recent sessions for pattern detection
2. **Dimension Calculation** - Runs specialized analyzers for each dimension:
   - Dependency analyzer tracks independent vs. AI-driven problem-solving
   - Prompt analyzer evaluates communication clarity and specificity
   - Burnout analyzer examines session patterns and stress signals
   - Tool analyzer measures Claude Code tool effectiveness
3. **Style Detection** - Classifies your collaboration personality based on dimensional scores
4. **Report Generation** - Creates terminal-aesthetic HTML with charts and insights
5. **Local Web Server** - Serves report at localhost with shareable link

### Classic Session Analysis

1. **Parse** - Reads your Claude Code session logs from `~/.claude/projects/`
2. **Analyze** - Sends the conversation to Claude using [Structured Outputs](https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs) for guaranteed JSON
3. **Evaluate** - Assesses your collaboration across three categories with specific evidence
4. **Report** - Generates a detailed markdown report with actionable recommendations
5. **Save** - Stores the analysis in `~/.nomoreaislop/analyses/` for tracking progress

## Configuration

Settings are stored in `~/.nomoreaislop/config.json`:

```json
{
  "version": "2.1.0",
  "telemetry": true,
  "model": "claude-sonnet-4-20250514",
  "storagePath": "~/.nomoreaislop",
  "styleAnalysis": {
    "enabled": true,
    "sessionsToAnalyze": 10,
    "webServerPort": 3000
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `NOSLOP_TELEMETRY` | Enable/disable anonymous analytics |
| `NOSLOP_MODEL` | Model to use for analysis (default: claude-sonnet-4-20250514) |
| `NOSLOP_STORAGE_PATH` | Custom storage directory |
| `NOSLOP_WEB_PORT` | Port for style analysis web server (default: 3000) |

## Privacy

- **Local-first**: All data stays on your machine
- **Your API key**: Uses your own Anthropic API key
- **Opt-out telemetry**: Anonymous usage analytics can be disabled
- **Local web server**: Reports are served only on localhost

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint
```

## Project Structure

```
nomoreaislop/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── commands/
│   ├── noslop.md            # Main command
│   ├── analyze.md           # Analyze specific session
│   ├── sessions.md          # List sessions
│   ├── history.md           # View history
│   └── config.md            # Configuration
├── scripts/
│   └── analyze-style.ts     # Main entry point for style analysis
├── src/
│   ├── index.ts             # Main entry point
│   ├── models/              # Zod schemas & types
│   ├── parser/              # JSONL session parser
│   ├── analyzer/
│   │   ├── dimensions/      # Analysis dimension modules
│   │   │   ├── dependency-analyzer.ts
│   │   │   ├── prompt-analyzer.ts
│   │   │   ├── burnout-analyzer.ts
│   │   │   └── tool-analyzer.ts
│   │   ├── style-analyzer.ts # Style type detection
│   │   └── llm-analyzer.ts  # LLM analysis with structured outputs
│   ├── web/                 # Local web server & HTML templates
│   │   ├── server.ts        # Express server
│   │   └── templates/       # Terminal-aesthetic HTML
│   ├── utils/               # Reporter & storage
│   └── config/              # Configuration management
├── docs/                    # Design documents
└── tests/                   # Test files
```

## What's New in v2.1

### Major Features

- **5 AI Coding Style Types**: Architect, Scientist, Collaborator, Speedrunner, Craftsman
- **Dimensional Analysis**: AI Dependency, Prompt Engineering, Burnout Risk, Tool Mastery
- **Web Report Generator**: Beautiful terminal-aesthetic HTML reports
- **Local Web Server**: Share your style with team members
- **Multi-session Analysis**: Pattern detection across recent sessions

### Technical Improvements

- New dimension analyzer modules for specialized metrics
- Style classification algorithm with confidence scoring
- Chart generation for distribution visualization
- Enhanced storage format for longitudinal tracking

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for [Claude Code](https://github.com/anthropics/claude-code)
- Powered by [Anthropic's Claude API](https://www.anthropic.com/api)
- Uses [Zod](https://zod.dev/) for schema validation
- Terminal aesthetics inspired by the beauty of the command line

---

*Stop producing AI slop. Start collaborating effectively. Discover your style.*
