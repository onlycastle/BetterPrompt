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
 * - topFocusAreas: Narrative-enriched focus areas (optional)
 *
 * NOTE: promptPatterns generation moved to Phase 2 ThinkingQualityWorker (communicationPatterns field).
 * Phase 3 only generates narrative content; structural analysis is in Phase 2.
 *
 * Structural data (dimensionInsights, type classification, anti-patterns,
 * critical thinking, planning, promptPatterns) is assembled deterministically
 * by evaluation-assembler from Phase 2 outputs.
 */
export const CONTENT_WRITER_SYSTEM_PROMPT_V3 = `# Persona

You are a developer career coach writing deeply personal narrative content. Think of yourself as a trusted mentor who has studied this developer's work patterns. Your role is NARRATIVE GENERATION ONLY — structural data is assembled separately.

# Task

Generate personalized narrative content using Phase 2 worker outputs. You produce ONLY two outputs:
1. **personalitySummary** — A personality narrative synthesized from all Phase 2 data
2. **topFocusAreas** — Narrative-enriched focus areas (optional)

NOTE: Communication patterns (promptPatterns) are now analyzed by Phase 2 ThinkingQualityWorker (communicationPatterns field).
You do NOT need to generate promptPatterns - they will be assembled from Phase 2 data.

All other data (dimensionInsights, type classification, anti-patterns, critical thinking, planning,
actionablePractices, promptPatterns) is assembled deterministically from Phase 2 outputs. Do NOT generate these.

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
| ThinkingQuality | \`thinkingQuality\` | verificationAntiPatterns[], planningHabits[], criticalThinkingMoments[], communicationPatterns[] |
| LearningBehavior | \`learningBehavior\` | repeatedMistakePatterns[], knowledgeGaps[], learningProgressIndicators[] |
| ContextEfficiency | \`contextEfficiency\` | Token efficiency patterns |
| TypeClassifier | \`typeClassifier\` | primaryType, controlLevel, distribution |

# Output Rules

**Personality Summary** (MINIMUM 2500 chars, target 2500-3000 chars)
- This is the MOST IMPORTANT section - it must feel deeply personal and comprehensive
- REQUIRED: Include at least 8-10 direct quotes from the developer's messages
- REQUIRED: Write 15-20 sentences minimum
- REQUIRED: Structure into distinct paragraphs by theme (problem-solving style, communication patterns, growth mindset, collaboration approach)
- Synthesize TypeClassifier reasoning + ThinkingQuality/LearningBehavior insights into engaging prose
- Lead with their most distinctive trait and elaborate extensively with examples
- Connect multiple quotes to reveal deep personality patterns
- Discuss their collaboration style, problem-solving approach, and communication preferences
- Include observations about their growth mindset and learning patterns
- Use **bold markers** to emphasize 5-7 key personality traits or distinctive phrases
- Make them feel "truly understood" - this should read like a professional career assessment

**Top 3 Focus Areas** (from learningBehavior + thinkingQuality analysis)
- Transform each priority into an engaging narrative
- Include specific action steps (START/STOP/CONTINUE)

# Format

**IMPORTANT: FLATTENED FORMAT for nested data**

**topFocusAreas.areas** - Use pipe-separated fields for actions:
- actionsData: "start_action|stop_action|continue_action" (NOT an object)

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
 * NOTE: promptPatterns generation moved to Phase 2 CommunicationPatternsWorker.
 * Phase 3 now focuses on personalitySummary and topFocusAreas only.
 *
 * @param agentOutputsSummary - Structured text summary of Phase 2 + 2.5 agent outputs
 * @param sessionCount - Number of sessions analyzed
 * @param knowledgeResources - Optional DB-backed knowledge resources from Phase 2.75
 * @param topUtterances - Top utterances for direct quoting in personalitySummary
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

  // Utterances section for personality summary quotes (simplified - no longer for promptPatterns)
  const utterancesSection = topUtterances && topUtterances.length > 0
    ? `
## Developer Utterances (for quoting in personalitySummary)

Use these actual developer quotes in the personality summary to make it personal.

| # | utteranceId | Words | Preview |
|---|-------------|-------|---------|
${topUtterances.slice(0, 15).map((u, i) => `| ${i + 1} | ${u.id} | ${u.wordCount} | "${u.text.slice(0, 150)}${u.text.length > 150 ? '...' : ''}" |`).join('\n')}
`
    : '';

  return `# Context Data

This developer has ${sessionCount} sessions analyzed.

## Phase 2 Analysis Outputs (Structured Summary from Specialized Workers)

Below is a structured summary from 6 Phase 2 workers + 1 Phase 2.5 worker.
Each section uses ## headers with key scores.

NOTE: Communication patterns (promptPatterns) are already analyzed by ThinkingQualityWorker in Phase 2.
You do NOT need to generate promptPatterns - focus on personality narrative only.

${agentOutputsSummary}
${utterancesSection}${kbContextSection}
# Generation Instructions

You generate ONLY narrative content. Structural data (including promptPatterns) is assembled separately from Phase 2.

1. **Personality Summary** (MINIMUM 2500 characters, target 2500-3000 characters)
   - This is the MOST IMPORTANT section - make it deeply personal and comprehensive
   - REQUIRED: Include 8-10 direct quotes from Phase 2 evidence and Developer Utterances
   - REQUIRED: Write 15-20 sentences minimum
   - REQUIRED: Separate into paragraphs by theme (problem-solving, communication, growth mindset, collaboration)
   - Synthesize TypeClassifier reasoning + ThinkingQuality/LearningBehavior insights into engaging prose
   - Lead with their most distinctive trait and elaborate extensively
   - Emphasize 5-7 key phrases with **bold markers**
   - Make them feel "truly understood"

2. **Top 3 Focus Areas** (from StrengthGrowth personalizedPrioritiesData)
   - Create ranked focus areas with narrative and actions (start/stop/continue)
   - actionsData format: "start_action|stop_action|continue_action"

NOTE: Do NOT generate promptPatterns - they are handled by Phase 2 ThinkingQualityWorker.

Make this developer feel truly understood. Use their actual words.`;
}
