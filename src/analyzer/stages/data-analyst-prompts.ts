/**
 * Data Analyst Stage Prompts (Gemini 3 Flash Optimized)
 *
 * Stage 1 of the two-stage pipeline.
 * Uses PTCF framework: Persona · Task · Context · Format
 * Optimized for Gemini 3's preference for precision over verbosity.
 *
 * @module analyzer/stages/data-analyst-prompts
 */

import { buildExpertKnowledgeContext } from '../verbose-knowledge-context.js';

/**
 * System prompt for the Data Analyst stage
 * Gemini 3 Flash optimized with PTCF framework
 */
export const DATA_ANALYST_SYSTEM_PROMPT = `# Persona

You are a behavioral data analyst specializing in developer-AI interaction patterns. Your role is PRECISE data extraction, not narrative writing. You prepare structured data for the next analysis stage.

# Task

Extract ALL relevant behavioral signals from conversation data:

**Quote Extraction** (target: 20-50+ quotes)
- Extract exact text, no paraphrasing
- Tag each with: dimension, signal type (strength/growth), behavioral marker
- Assign confidence score (0-1) based on signal clarity
- Prefer personality-revealing quotes over competence demonstrations

**Pattern Detection** (target: 5-10 patterns)
- communication_style: Expression patterns, verbal tics
- problem_solving: How they approach challenges
- ai_interaction: How they prompt and verify
- verification_habit: Testing and review behaviors
- tool_usage: Tool preferences and advanced usage

**Dimension Signal Analysis** (exactly 6 dimensions)
- aiCollaboration: Task delegation, TodoWrite usage, parallel workflows
- contextEngineering: File references, WRITE/SELECT/COMPRESS patterns
- toolMastery: Tool diversity, advanced tool usage
- burnoutRisk: Work hours, session duration patterns
- aiControl: Verification requests, corrections, modifications
- skillResilience: Cold start behavior, hallucination detection

**Type Classification**
- primaryType: architect | scientist | collaborator | speedrunner | craftsman
- controlLevel: vibe-coder | developing | ai-master
- distribution: Percentages across all 5 types (must sum to 100)

# Context

${buildExpertKnowledgeContext()}

# Format

Return StructuredAnalysisData with:
- typeAnalysis: Classification with reasoning
- extractedQuotes: Array of quotes (MINIMUM 15, target 20-50)
- detectedPatterns: Array of patterns (MINIMUM 3, target 5-10)
- dimensionSignals: EXACTLY 6 objects, one per dimension
- analysisMetadata: Summary statistics and confidence

**Critical Rules:**
- Do NOT write engaging prose or narrative
- Do NOT summarize quotes - use exact text
- DO be exhaustive - more data is better
- DO assign confidence scores honestly
- ALWAYS include at least 15 extractedQuotes
- ALWAYS include at least 3 detectedPatterns
- ALWAYS include exactly 6 dimensionSignals`;

/**
 * Build the user prompt for Stage 1 data extraction
 * Places data context before instructions (Gemini best practice)
 */
export function buildDataAnalystUserPrompt(
  sessionsFormatted: string,
  metricsFormatted: string
): string {
  const sessionCount = sessionsFormatted.split('<session').length - 1;

  return `# Context Data

## Aggregated Metrics
${metricsFormatted}

## Developer-AI Conversation Sessions (${sessionCount} sessions)
${sessionsFormatted}

# Extraction Instructions

Analyze the sessions above and extract:

1. **Quotes** (20-50+ total)
   - Every personality-revealing statement
   - Tag with dimension, signal type, confidence

2. **Patterns** (5-10 patterns)
   - Recurring behaviors across sessions
   - Count frequency and provide examples

3. **Dimension Signals** (6 dimensions)
   - All strength and growth signals per dimension
   - Reference quotes by content

4. **Type Classification**
   - Primary type with evidence
   - Control level assessment
   - Distribution percentages

Return StructuredAnalysisData. Be EXHAUSTIVE.`;
}
