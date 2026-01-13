# NoMoreAISlop - LLM Prompts Reference

> Version: 1.2.0
> Last Updated: 2026-01-13
> Status: Reference Documentation

---

## Overview

This document provides a quick reference to the prompts used for evaluating developer-AI collaboration quality. Full prompt implementations are in `src/analyzer/prompts.ts`.

**Evaluation Philosophy**: Evidence-based, growth-focused, balanced, and specific feedback that encourages improvement.

---

## Style Analyzer Prompts

Prompts used to evaluate developer-Claude Code collaboration sessions.

| Prompt | Purpose | Key Criteria | Source |
|--------|---------|--------------|--------|
| **System Prompt** | Establishes evaluator role as supportive coach | Fair, constructive, evidence-based feedback | `systemPrompt` in prompts.ts |
| **Evaluation Template** | Sends conversation for analysis | Returns JSON with ratings + evidence | `userPromptTemplate` in prompts.ts |

### Evaluation Dimensions

**Planning** - Clarifying requirements and providing structured instructions
- Strong: Task decomposition, clear input/output, edge cases, context provided, acceptance criteria
- Developing: Some structure, missed opportunities
- Needs Work: Vague prompts, minimal planning evidence

**Critical Thinking** - Recognizing and correcting suboptimal AI suggestions
- Strong: Questions approaches, identifies bugs, requests improvements, validates output
- Developing: Sometimes questions, misses some issues
- Needs Work: Rarely questions, accepts suggestions uncritically

**Code Understanding** - Leveraging existing functions, patterns, and conventions
- Strong: References existing code, follows patterns, provides context, maintains consistency
- Developing: Sometimes provides context, occasional misses
- Needs Work: Rarely references code, allows inconsistencies

---

## Verbose Analysis Prompts

Prompts optimized for hyper-personalized multi-session analysis. Used by `--verbose` mode.

**Source**: `src/analyzer/verbose-prompts.ts`

| Prompt | Purpose | Key Criteria | Source |
|--------|---------|--------------|--------|
| **Verbose System Prompt** | Establishes behavioral analyst role | Personalization, quote extraction, personality insights | `VERBOSE_SYSTEM_PROMPT` |
| **Verbose User Prompt** | Sends multi-session data for analysis | Session formatting, metrics aggregation, tier-based output | `buildVerboseUserPrompt()` |

### Analysis Approach

The verbose prompt uses four key strategies:

| Strategy | Description |
|----------|-------------|
| **Quote Extraction** | Find quotes revealing personality, not just competence. Look for unique thinking patterns, characteristic phrases, expressions of frustration/satisfaction/curiosity. |
| **Behavioral Signatures** | What makes THIS developer different? Verbal tics, characteristic phrases, request structure (long/short, detailed/vague). |
| **Pattern Analysis** | Don't just say "they ask questions" - show exactly HOW. Every pattern must have 2+ concrete examples with quotes. |
| **Personalization** | Use actual words when describing strengths. Reference specific sessions/timestamps. Make comparisons to archetypal behaviors. |

### Output Quality Standards

- **NEVER** use generic phrases without specific quotes
- **ALWAYS** include actual user quote, not paraphrases
- **MINIMUM** 5 different quotes across free tier content
- **EACH** strength must have 2+ evidence quotes
- **EACH** growth area must have 1+ evidence quote

### The 5 AI Coding Styles (Verbose Context)

| Type | Emoji | Description |
|------|-------|-------------|
| architect | 🏗️ | Strategic planner who designs before coding |
| scientist | 🔬 | Truth-seeker who verifies AI output |
| collaborator | 🤝 | Partnership master who iterates through dialogue |
| speedrunner | ⚡ | Agile executor who moves fast |
| craftsman | 🔧 | Quality artisan who prioritizes code quality |

### Control Levels (Verbose Context)

| Level | Description |
|-------|-------------|
| vibe-coder | High AI dependency - accepts output without much modification |
| developing | Learning balance - building control habits |
| ai-master | Strategic control - directs AI as a precision tool |

### Verbose Output Schema

```json
{
  "primaryType": "architect|scientist|collaborator|speedrunner|craftsman",
  "controlLevel": "vibe-coder|developing|ai-master",
  "distribution": { "architect": 25, "scientist": 30, ... },
  "personalitySummary": "200-800 char personalized paragraph...",
  "strengths": [
    {
      "title": "Short title",
      "description": "100-500 char description",
      "evidence": [{ "quote": "...", "sessionDate": "...", "significance": "..." }],
      "percentile": 85
    }
  ],
  "growthAreas": [{ "title": "...", "evidence": [...], "recommendation": "..." }],
  "promptPatterns": [{ "patternName": "...", "frequency": "frequent", "effectiveness": "highly_effective" }],
  "toolUsageDeepDive": [...],
  "tokenEfficiency": {...},
  "growthRoadmap": {...},
  "comparativeInsights": [...],
  "sessionTrends": [...]
}
```

---

## Search Agent Prompts

Multi-skill architecture for discovering and organizing AI engineering knowledge.

| Skill | Purpose | Tools Used | Source |
|-------|---------|-----------|--------|
| **Gatherer** | Extract metadata from web content (topics, insights, code, tools) | `extract_metadata` | `gatherer/index.ts` |
| **Judge** | Score relevance across 5 dimensions; recommend accept/review/reject | `evaluate_relevance` | `judge/index.ts` |
| **Organizer** | Transform evaluated content into structured knowledge items | `organize_knowledge` | `organizer/index.ts` |
| **Transcript** | Analyze YouTube transcripts for AI engineering insights | `analyze_transcript` | `skills/transcript/` |

### Judge Evaluation Dimensions

Weighted scoring (0.0-1.0) with recommendations:

| Dimension | Weight | Positive Signals | Negative Signals |
|-----------|--------|-----------------|-----------------|
| **Topic Relevance** | 0.25 | Context engineering, Claude Code, AI workflows | Off-topic, generic advice, outdated |
| **Project Fit** | 0.25 | Planning/critical thinking, evaluation frameworks | Focuses on AI capabilities only, too theoretical |
| **Actionability** | 0.20 | Concrete examples, step-by-step, clear do/don'ts | Purely theoretical, vague, speculative |
| **Novelty** | 0.15 | New techniques, unique perspective, original research | Repeats known info, rehashes docs |
| **Credibility** | 0.15 | Official docs, known experts, evidence-backed | Anonymous, factual errors, low engagement |

**Recommendation Logic**: Accept (≥0.7), Review (0.4-0.7), Reject (<0.4)

---

## Output Schemas

### Style Analyzer Output

JSON structure returned by evaluation:

```json
{
  "planning": { "rating": "Strong|Developing|Needs Work", "summary": "...", "clues": [] },
  "criticalThinking": { "rating": "...", "summary": "...", "clues": [] },
  "codeUnderstanding": { "rating": "...", "summary": "...", "clues": [] },
  "overallSummary": "...",
  "recommendations": ["action 1", "action 2", ...]
}
```

Each category clue includes:
- `type`: "positive" or "negative"
- `quote`: Exact text from conversation
- `explanation`: Why this is evidence

### Search Agent Outputs

**Metadata** (Gatherer): mainTopic, keyInsights (1-5), codeSnippets (max 3), referencedTools

**Evaluation** (Judge): Scores for each dimension, overall weighted score, confidence, recommendation, reasoning

**Knowledge Item** (Organizer): title, summary, content, category, contentType, tags

---

## Model Configuration

```
Model: claude-3-5-sonnet-20241022 (recommended for balance)
Max Tokens: 2,000
Temperature: 0.3 (lower for consistency)
```

**Token Budget**:
- System Prompt: ~500 tokens
- Evaluation Criteria: ~800 tokens
- User Prompt: ~400 tokens
- Conversation: ~3,000 tokens (truncated if needed)
- Total Input: ~4,700 tokens

---

## Edge Cases

For short sessions (<5 messages): Focus on available evidence, avoid penalizing for lack of opportunities.

For tool-heavy sessions: Base evaluation on prompts initiating operations and feedback provided.

For error recovery sessions: Recognize that error correction demonstrates critical thinking.

---

## Categories & Tags

**Knowledge Categories**:
context-engineering, claude-code-skills, subagents, memory-management, prompt-engineering, tool-use, workflow-automation, best-practices, other

**Content Types**:
technique, pattern, tool, configuration, insight, example, reference

---

## Implementation Notes

- Full prompt text and conversation formatting logic: See `src/analyzer/prompts.ts`
- Conversation truncation for large sessions: Uses 4 char ≈ 1 token estimation
- Structured Outputs: Uses Anthropic's `anthropic-beta: structured-outputs-2025-11-13`
- Schema conversion: Zod schemas → JSON Schema via `src/analyzer/schema-converter.ts`
- Response parsing: JSON extraction, validation, error recovery with 1 retry attempt

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-09 | Initial release with style analyzer prompts |
| 1.1.0 | 2026-01-12 | Added search agent prompts; converted to reference format |
| 1.2.0 | 2026-01-13 | Added verbose analysis prompts for hyper-personalized mode |
