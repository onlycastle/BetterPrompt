/**
 * Content Writer Stage Prompts (Gemini 3 Flash Optimized)
 *
 * Stage 2 of the two-stage pipeline.
 * Uses PTCF framework: Persona · Task · Context · Format
 * Transforms structured data into engaging, personalized narrative.
 *
 * @module analyzer/stages/content-writer-prompts
 */

import { NO_HEDGING_DIRECTIVE } from '../shared/constants';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';

/**
 * Supported output languages for content generation
 */
export type SupportedLanguage = 'en' | 'ko' | 'ja' | 'zh';

/**
 * Result of language detection analysis
 */
export interface LanguageDetectionResult {
  /** Primary detected language */
  primary: SupportedLanguage;
  /** Confidence score (0-1) based on character ratio */
  confidence: number;
  /** Whether non-English characters were found */
  hasNonEnglish: boolean;
  /** Character counts for debug logging */
  charCounts: {
    korean: number;
    japanese: number;
    chinese: number;
    total: number;
  };
}

/**
 * Detect the primary language from given texts
 *
 * Uses Unicode character ranges to detect CJK languages:
 * - Korean (Hangul): U+AC00-U+D7AF (syllables), U+1100-U+11FF, U+3130-U+318F (Jamo)
 * - Japanese: U+3040-U+309F (Hiragana), U+30A0-U+30FF (Katakana)
 * - Chinese: U+4E00-U+9FFF (CJK Unified Ideographs)
 *
 * Priority: Korean > Japanese > Chinese > English (default)
 * Threshold: 5% - if non-English characters make up >= 5% of meaningful content,
 * the text is considered to be in that language.
 * (Lowered from 20% because developer sessions mix Korean with heavy English
 * technical content — code, CLI commands, file paths — diluting the ratio.)
 *
 * @param texts - Array of text strings to analyze
 * @returns LanguageDetectionResult with primary language and confidence
 */
export function detectPrimaryLanguage(texts: string[]): LanguageDetectionResult {
  if (texts.length === 0) {
    return { primary: 'en', confidence: 1.0, hasNonEnglish: false, charCounts: { korean: 0, japanese: 0, chinese: 0, total: 0 } };
  }

  const combinedText = texts.join(' ');

  // Count Korean characters (Hangul syllables + Jamo)
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
  const koreanMatches = combinedText.match(koreanRegex);
  const koreanCount = koreanMatches ? koreanMatches.length : 0;

  // Count Japanese characters (Hiragana + Katakana, excluding shared CJK)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/g;
  const japaneseMatches = combinedText.match(japaneseRegex);
  const japaneseCount = japaneseMatches ? japaneseMatches.length : 0;

  // Count Chinese characters (CJK Unified Ideographs)
  // Note: This range is shared with Japanese Kanji, but we prioritize Hiragana/Katakana detection
  const chineseRegex = /[\u4E00-\u9FFF]/g;
  const chineseMatches = combinedText.match(chineseRegex);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;

  // Count total meaningful characters (letters, numbers, CJK)
  const meaningfulRegex = /[a-zA-Z0-9\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g;
  const meaningfulMatches = combinedText.match(meaningfulRegex);
  const totalCount = meaningfulMatches ? meaningfulMatches.length : 0;

  if (totalCount === 0) {
    return { primary: 'en', confidence: 1.0, hasNonEnglish: false, charCounts: { korean: koreanCount, japanese: japaneseCount, chinese: chineseCount, total: totalCount } };
  }

  // Calculate ratios
  const koreanRatio = koreanCount / totalCount;
  const japaneseRatio = japaneseCount / totalCount;
  const chineseRatio = chineseCount / totalCount;

  // Threshold: 5% - lowered from 20% because developer sessions mix native
  // language with heavy English technical content (code, CLI, paths, variables),
  // diluting the CJK ratio. Hangul is exclusive to Korean with zero false-positive
  // risk, so even 5% is an unambiguous signal.
  const THRESHOLD = 0.05;

  const hasNonEnglish = koreanCount > 0 || japaneseCount > 0 || chineseCount > 0;

  // Priority: Korean > Japanese > Chinese > English
  // Korean takes priority as it has distinct character ranges
  const charCounts = { korean: koreanCount, japanese: japaneseCount, chinese: chineseCount, total: totalCount };

  if (koreanRatio >= THRESHOLD) {
    return { primary: 'ko', confidence: koreanRatio, hasNonEnglish, charCounts };
  }

  // Japanese (if significant Hiragana/Katakana present)
  if (japaneseRatio >= THRESHOLD) {
    return { primary: 'ja', confidence: japaneseRatio, hasNonEnglish, charCounts };
  }

  // Chinese (CJK without Japanese kana)
  // Only consider Chinese if there's CJK but minimal Japanese kana
  if (chineseRatio >= THRESHOLD && japaneseRatio < 0.05) {
    return { primary: 'zh', confidence: chineseRatio, hasNonEnglish, charCounts };
  }

  // Default to English
  const englishRatio = 1 - (koreanRatio + japaneseRatio + chineseRatio);
  return { primary: 'en', confidence: englishRatio, hasNonEnglish, charCounts };
}

/**
 * System prompt for Content Writer stage (Phase 3)
 *
 * Generates narrative-only content from Phase 2 worker outputs:
 * - personalitySummary: Personality narrative from all Phase 2 data
 * - promptPatterns: WHAT-WHY-HOW analysis of prompting habits
 * - topFocusAreas: Narrative-enriched focus areas (optional)
 *
 * Structural data (dimensionInsights, type classification, anti-patterns,
 * critical thinking, planning) is assembled deterministically by evaluation-assembler.
 */
export const CONTENT_WRITER_SYSTEM_PROMPT_V3 = `# Persona

You are a developer career coach writing deeply personal narrative content. Think of yourself as a trusted mentor who has studied this developer's work patterns. Your role is NARRATIVE GENERATION ONLY — structural data is assembled separately.

# Task

Generate personalized narrative content using Phase 2 worker outputs. You produce ONLY three outputs:
1. **personalitySummary** — A personality narrative synthesized from all Phase 2 data
2. **promptPatterns** — WHAT-WHY-HOW analysis of prompting habits
3. **topFocusAreas** — Narrative-enriched focus areas (optional)

All other data (dimensionInsights, type classification, anti-patterns, critical thinking, planning, actionablePractices) is assembled deterministically from Phase 2 outputs. Do NOT generate these.

**Writing Principles:**
- Use their actual words frequently (quotes from the Phase 2 evidence data)
- Reference specific moments: "When you said X..."
- Create "aha moments" through specificity
- Be warm but professional - like a trusted career mentor

**Tone Examples:**
- DO: "Your habit of saying 'let me think about this' before complex tasks shows..."
- DON'T: "You demonstrate good planning behaviors..."

# Input Data Sources

Your input comes from Phase 2 specialized workers in AgentOutputs:

| Worker | Field | What it provides |
|--------|-------|------------------|
| StrengthGrowth | \`strengthGrowth\` | strengths[], growthAreas[], personalizedPrioritiesData |
| TrustVerification | \`trustVerification\` | antiPatterns[], overallTrustHealthScore |
| WorkflowHabit | \`workflowHabit\` | criticalThinkingMoments[], planningHabits[] |
| KnowledgeGap | \`knowledgeGap\` | Knowledge gaps, learning progress |
| ContextEfficiency | \`contextEfficiency\` | Token efficiency patterns |
| TypeClassifier | \`typeClassifier\` | primaryType, controlLevel, distribution |

# Output Rules

**Personality Summary** (MINIMUM 2500 chars, target 2500-3000 chars)
- This is the MOST IMPORTANT section - it must feel deeply personal and comprehensive
- REQUIRED: Include at least 8-10 direct quotes from the developer's messages
- REQUIRED: Write 15-20 sentences minimum
- Synthesize TypeClassifier reasoning + StrengthGrowth insights into engaging prose
- Lead with their most distinctive trait and elaborate extensively with examples
- Connect multiple quotes to reveal deep personality patterns
- Discuss their collaboration style, problem-solving approach, and communication preferences
- Include observations about their growth mindset and learning patterns
- Use **bold markers** to emphasize 5-7 key personality traits or distinctive phrases
- Make them feel "truly understood" - this should read like a professional career assessment

**Prompt Patterns** (5-12 patterns for comprehensive analysis)
- Name each pattern distinctively based on its characteristics
- **Description (MINIMUM 1500 chars, target 2000-2500 chars):** Write an EXTREMELY DEEP analysis using WHAT-WHY-HOW framework:
  - **WHAT section (5-7 sentences)**: Describe the observable behavior pattern concretely with specific examples
  - **WHY section (4-5 sentences)**: Explain what this pattern reveals about their mindset, values, and work philosophy
  - **HOW section (4-5 sentences)**: Describe how this affects their AI collaboration and code quality
  - Include behavioral context and session-specific observations
  - Include the IMPACT: productivity, code quality, learning speed, or team dynamics
- Show examples by referencing Developer Utterances using their IDs
  - CRITICAL: Use utteranceId from the Developer Utterances section (e.g., "abc123_5")
  - DO NOT write quotes directly - only reference by ID
  - The actual quote text will be looked up from the original data
- Rate effectiveness
- **Tip (MINIMUM 1000 chars, target 1200-1500 chars):** Write expert-level coaching advice:
  - Reference knowledge base insights with natural attribution
  - Provide 3-4 concrete "try this" examples
  - Explain the reasoning behind each recommendation

**Top 3 Focus Areas** (from strengthGrowth.personalizedPrioritiesData)
- Transform each priority into an engaging narrative
- Include specific action steps (START/STOP/CONTINUE)

# Format

**IMPORTANT: FLATTENED FORMAT for nested data**

**promptPatterns** - Use pipe-separated fields, semicolon between items:
- examplesData: "utteranceId1|analysis1;utteranceId2|analysis2;..." (NOT an array)
- utteranceId format: "sessionId_turnIndex" (e.g., "abc123_5", "def456_12")
- ONLY use IDs from the Developer Utterances section above
- The actual quote text will be resolved from Phase 1 data

**topFocusAreas.areas** - Use pipe-separated fields for actions:
- actionsData: "start_action|stop_action|continue_action" (NOT an object)

**Critical Rules:**
- Reference Developer Utterances by ID only. Do not write quotes directly.
- ONLY use utteranceIds that appear in the Developer Utterances section.
- ESCAPE any pipe (|) or semicolon (;) characters within analysis text with backslash.

${NO_HEDGING_DIRECTIVE}`;

/**
 * Build KB context section from Phase 2.75 matched resources (DB-backed)
 *
 * Converts DimensionResourceMatch[] into a prompt section grouped by dimension.
 */
export function buildKnowledgeContextFromResources(
  resources: DimensionResourceMatch[]
): string {
  if (!resources || resources.length === 0) {
    return '';
  }

  const header = `## Knowledge Base Context (for tip generation)\n\nReference these expert insights when writing tips. Use natural attribution: "According to Anthropic's guide...", "As Simon Willison advises..."\n`;

  const sections: string[] = [header];

  for (const match of resources) {
    const hasInsights = match.professionalInsights.length > 0;
    const hasKnowledge = match.knowledgeItems.length > 0;
    if (!hasInsights && !hasKnowledge) continue;

    sections.push(`### ${match.dimensionDisplayName}\n`);

    for (const insight of match.professionalInsights) {
      sections.push(`- **"${insight.title}"** (${insight.sourceAuthor}): "${insight.keyTakeaway}"`);
      if (insight.actionableAdvice.length > 0) {
        sections.push(`  - Advice: ${insight.actionableAdvice.slice(0, 2).join('; ')}`);
      }
    }

    for (const item of match.knowledgeItems) {
      const author = item.sourceAuthor || 'Unknown';
      sections.push(`- **"${item.title}"** (${author}): "${item.summary}"`);
    }

    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Language display names for output instructions
 */
export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

/**
 * Build the user prompt for Content Writer stage (Phase 3)
 *
 * Constructs a prompt from Phase 2 worker outputs for narrative generation.
 *
 * @param agentOutputsSummary - Structured text summary of Phase 2 + 2.5 agent outputs
 * @param sessionCount - Number of sessions analyzed
 * @param knowledgeResources - Optional DB-backed knowledge resources from Phase 2.75
 * @param topUtterances - Top 20 longest utterances for direct quoting
 */
export function buildContentWriterUserPromptV3(
  agentOutputsSummary: string,
  sessionCount: number,
  knowledgeResources?: DimensionResourceMatch[],
  topUtterances?: Array<{ id: string; text: string; wordCount: number }>
): string {
  const kbContextSection = knowledgeResources
    ? buildKnowledgeContextFromResources(knowledgeResources)
    : '';

  const utterancesSection = topUtterances && topUtterances.length > 0
    ? `
## Developer Utterances (Reference by utteranceId in examplesData)

IMPORTANT: Use the utteranceId (first column) for examplesData, NOT the quote text.
The utteranceId format is "{sessionId}_{turnIndex}" (e.g., "7fdbb780_5", "abc123def_12").

| # | utteranceId | Words | Preview |
|---|-------------|-------|---------|
${topUtterances.map((u, i) => `| ${i + 1} | ${u.id} | ${u.wordCount} | "${u.text.slice(0, 150)}${u.text.length > 150 ? '...' : ''}" |`).join('\n')}

### examplesData Format Rules
- examplesData must contain ONLY utteranceIds from the table above
- Format: "utteranceId|analysis;utteranceId|analysis;..."
- VALID example: "7fdbb780_5|Shows systematic debugging;abc123_12|Demonstrates planning"
- INVALID: "분석 텍스트...|analysis" — Do NOT use quote text, Korean, or spaces in the ID part
- If no matching utteranceId found, leave examplesData empty
`
    : '';

  return `# Context Data

This developer has ${sessionCount} sessions analyzed.

## Phase 2 Analysis Outputs (Structured Summary from Specialized Workers)

Below is a structured summary from 5 Phase 2 workers + 1 Phase 2.5 worker.
Each section uses ## headers with key scores.

${agentOutputsSummary}
${utterancesSection}${kbContextSection}
# Generation Instructions

You generate ONLY narrative content. Structural data is assembled separately.

1. **Personality Summary** (MINIMUM 2500 characters, target 2500-3000 characters)
   - This is the MOST IMPORTANT section - make it deeply personal and comprehensive
   - REQUIRED: Include 8-10 direct quotes from Phase 2 evidence
   - REQUIRED: Write 15-20 sentences minimum
   - Synthesize TypeClassifier reasoning + StrengthGrowth insights into engaging prose
   - Lead with their most distinctive trait and elaborate extensively
   - Emphasize 5-7 key phrases with **bold markers**
   - Make them feel "truly understood"

2. **Prompt Patterns** (5-12 for comprehensive analysis)
   - Derive patterns from Phase 2 insights and the Developer Utterances section
   - Use the "Developer Utterances" section as your PRIMARY source for examples
   - CRITICAL: In examplesData, reference utterances ONLY by their exact ID (format: "sessionId_turnIndex", e.g., "7fdbb780_5")
   - examplesData format: "utteranceId|analysis;utteranceId|analysis;..."
   - DO NOT copy, paraphrase, or include any quote text in examplesData - use ONLY the utterance ID
   - The quote text will be retrieved separately from Phase 1 data
   - Valid example: "7fdbb780_5|Shows good error handling;abc123_12|Demonstrates planning"
   - INVALID: "Let me check this error...|analysis" (quote text instead of ID)
   - **Description (MINIMUM 1500 chars, target 2000-2500 chars):** EXTREMELY deep WHAT-WHY-HOW framework
     * WHAT (5-7 sentences): Concrete behavior with specific examples
     * WHY (4-5 sentences): Mindset, values, work philosophy revealed
     * HOW (4-5 sentences): Impact on AI collaboration and code quality
   - Include 2-5 example references by ID
   - **Tip (MINIMUM 1000 chars, target 1200-1500 chars):** Expert coaching using Knowledge Base context
     * 3-4 concrete "try this" examples
     * Explain reasoning behind recommendations

3. **Top 3 Focus Areas** (from StrengthGrowth personalizedPrioritiesData)
   - Create ranked focus areas with narrative and actions (start/stop/continue)

Make this developer feel truly understood. Use their actual words.`;
}
