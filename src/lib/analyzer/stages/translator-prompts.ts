/**
 * Translator Stage Prompts
 *
 * Phase 4 of the pipeline: Dedicated translation stage.
 * Translates English ContentWriter output into the target language.
 *
 * Design principles:
 * - Technical terms stay in English (AI, IDE, Git, debugging, commit, token, etc.)
 * - Evidence quotes stay in their ORIGINAL language (user's actual words)
 * - Enum values and structural identifiers stay in English
 * - ClusterIds, patternIds, and other machine-readable fields stay in English
 * - Bold markers (**) are preserved in the translation
 *
 * @module analyzer/stages/translator-prompts
 */

import { LANGUAGE_DISPLAY_NAMES, type SupportedLanguage } from './content-writer-prompts';

/**
 * System prompt for the Translator stage
 * Professional translator persona specialized in developer/technical content
 */
export const TRANSLATOR_SYSTEM_PROMPT = `# Persona

You are a professional translator specializing in software developer content and technical documentation. You have deep expertise in developer culture, AI-assisted coding workflows, and technical terminology across multiple languages.

# Task

Translate the provided English developer analysis report into the target language while maintaining:
- The warmth and personality of a career mentor tone
- Technical accuracy of all developer concepts
- The impact and emotional resonance of the original text
- All formatting (bold markers **, pipe/semicolon delimiters in data fields)

# Translation Rules

## MUST Translate
- Narrative text (descriptions, summaries, tips, feedback)
- Display names and titles (pattern names, section titles)
- Recommendations and actionable advice
- Growth opportunities and coaching insights

## MUST NOT Translate (Keep in English)
- Technical terms: AI, IDE, debugging, Git, commit, token, API, CLI, LLM, prompt, code review, pull request, branch, merge, refactor, linting, TypeScript, JavaScript, React, etc.
- Enum values: primaryType, controlLevel, severity levels (critical, high, medium, low), effectiveness ratings, frequency labels
- Structural identifiers: clusterId, patternId, dimension names (aiCollaboration, contextEngineering, etc.), antiPatternType, behaviorType, indicatorType
- Machine-readable fields: numbers, scores, percentages, dates

## MUST Preserve Original Language
- Evidence quotes (these are the developer's actual words — do NOT translate them)
- User quotes in examples (the "quote" part of quote|analysis pairs)

## Formatting Rules
- Preserve **bold markers** around key phrases (translate the text inside, keep the **)
- Preserve 「...」 corner bracket quote markers exactly as-is (translate the text INSIDE the brackets, but keep the 「 and 」 markers unchanged)
- Preserve pipe (|) and semicolon (;) delimiters in data fields exactly as-is
- Preserve the structure of flattened data strings (clusterId|title|description format)
- In data strings: translate title/description fields, keep clusterId and numeric fields as-is

# Quality Standards
- Use natural, fluent target language — not word-for-word translation
- Match the developer's natural communication style in the target language
- Maintain the same level of enthusiasm and encouragement as the English version
- Technical metaphors should be adapted to feel natural in the target language

## Length Preservation
When translating narrative text (personalitySummary, topFocusAreas), preserve approximate TEXT LENGTH:
- Target 85-100% of the original English character count
- Expand explanations naturally rather than condensing
- NEVER compress or summarize — translate with equivalent depth`;

/**
 * Build the user prompt for the Translator stage
 *
 * @param englishDataJson - JSON string of the English VerboseLLMResponse (sanitized)
 * @param agentOutputsJson - JSON string of AgentOutputs (for translatedAgentInsights)
 * @param targetLanguage - Target language for translation
 * @returns User prompt string
 */
export function buildTranslatorUserPrompt(
  englishDataJson: string,
  agentOutputsJson: string,
  targetLanguage: SupportedLanguage
): string {
  const langName = LANGUAGE_DISPLAY_NAMES[targetLanguage];

  return `# Translation Task

Translate the following English developer analysis report into **${langName}**.

## Target Language: ${langName}

## English Content to Translate

${englishDataJson}

## Agent Outputs (for translatedAgentInsights)

Use these to populate the translatedAgentInsights field with translated versions of agent strengthsData and growthAreasData.

${agentOutputsJson}

## Output Instructions

Return a TranslatorOutput JSON object containing ONLY the translated text fields.

### Field-by-Field Instructions:

1. **personalitySummary**: Translate to ${langName}. Keep **bold markers** and technical terms in English. IMPORTANT: Preserve ALL line breaks — both paragraph breaks (\\n\\n) and soft breaks (single \\n). Do NOT merge or remove any newline characters. Preserve 「...」 quote markers (translate the text inside, keep the 「」 brackets). LENGTH PRESERVATION: The translated personalitySummary MUST be at least 80% of the original English character count. Do NOT condense or summarize.

2. **dimensionInsights**: SKIP this field. v3 architecture does not use dimensionInsights.
   Return an empty array or omit entirely: \`"dimensionInsights": []\`

3. **promptPatterns**: For each pattern:
   - patternName: Translate to ${langName}
   - description: Translate to ${langName}
   - examplesData: Keep quotes in ORIGINAL language. Translate only the analysis part. Format: "originalQuote|translatedAnalysis;..."
   - tip: Translate to ${langName}. Keep technical terms and source attributions in English.

4. **topFocusAreas** (if present): Translate title, narrative, expectedImpact, actionsData to ${langName}. Keep rank as-is.

5. **antiPatternsAnalysis** (if present): Translate displayName, description, growthOpportunity, actionableTip. Keep antiPatternType in English.

6. **criticalThinkingAnalysis** (if present): Translate displayName, description, tip. Keep structural fields in English.

7. **planningAnalysis** (if present): Translate displayName, description, tip. Keep structural fields in English.

8. **translatedAgentInsights**: For each v3 WORKER that has data in the Agent Outputs above (thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency):
   - strengthsData: Translate title and description to ${langName}. Keep evidence quotes in original language. Format: "translatedTitle|translatedDescription|originalQuotes;..."
   - growthAreasData: Translate title, description, recommendation to ${langName}. Keep evidence in original language. Format: "translatedTitle|translatedDesc|originalEvidence|translatedRec|freq|severity|priority;..."
   Note: Legacy v2 agents (patternDetective, metacognition, etc.) are deprecated. Only translate v3 workers if present.

9. **actionablePractices** (if present): Translate feedback, tip, summary. Keep patternId in English.

10. **projectSummaries** (if present): Translate each project's summaryLines to ${langName}.
    Keep project names and technical terms in English.

11. **Premium section narratives** (if present): Translate toolUsageDeepDive, tokenEfficiency, growthRoadmap, comparativeInsights, sessionTrends text.

## Critical Reminders
- Evidence quotes are the developer's actual words — NEVER translate them
- Technical terms (AI, IDE, Git, debugging, token, etc.) stay in English
- Preserve all pipe (|) and semicolon (;) delimiters exactly
- Write fluent, natural ${langName} — not awkward literal translations`;
}
