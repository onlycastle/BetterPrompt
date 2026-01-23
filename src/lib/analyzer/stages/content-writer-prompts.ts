/**
 * Content Writer Stage Prompts (Gemini 3 Flash Optimized)
 *
 * Stage 2 of the two-stage pipeline.
 * Uses PTCF framework: Persona · Task · Context · Format
 * Transforms structured data into engaging, personalized narrative.
 *
 * @module analyzer/stages/content-writer-prompts
 */

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
 * Threshold: 20% - if non-English characters make up >= 20% of meaningful content,
 * the text is considered to be in that language.
 *
 * @param texts - Array of text strings to analyze
 * @returns LanguageDetectionResult with primary language and confidence
 */
export function detectPrimaryLanguage(texts: string[]): LanguageDetectionResult {
  if (texts.length === 0) {
    return { primary: 'en', confidence: 1.0, hasNonEnglish: false };
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
    return { primary: 'en', confidence: 1.0, hasNonEnglish: false };
  }

  // Calculate ratios
  const koreanRatio = koreanCount / totalCount;
  const japaneseRatio = japaneseCount / totalCount;
  const chineseRatio = chineseCount / totalCount;

  // Threshold: 20% - lower than before to catch mixed-language content
  // (developers often mix Korean with English technical terms)
  const THRESHOLD = 0.2;

  const hasNonEnglish = koreanCount > 0 || japaneseCount > 0 || chineseCount > 0;

  // Priority: Korean > Japanese > Chinese > English
  // Korean takes priority as it has distinct character ranges
  if (koreanRatio >= THRESHOLD) {
    return { primary: 'ko', confidence: koreanRatio, hasNonEnglish };
  }

  // Japanese (if significant Hiragana/Katakana present)
  if (japaneseRatio >= THRESHOLD) {
    return { primary: 'ja', confidence: japaneseRatio, hasNonEnglish };
  }

  // Chinese (CJK without Japanese kana)
  // Only consider Chinese if there's CJK but minimal Japanese kana
  if (chineseRatio >= THRESHOLD && japaneseRatio < 0.05) {
    return { primary: 'zh', confidence: chineseRatio, hasNonEnglish };
  }

  // Default to English
  const englishRatio = 1 - (koreanRatio + japaneseRatio + chineseRatio);
  return { primary: 'en', confidence: englishRatio, hasNonEnglish };
}

/**
 * @deprecated Use detectPrimaryLanguage instead. This function is kept for backward compatibility.
 */
export function detectKoreanContent(quotes: string[]): boolean {
  const result = detectPrimaryLanguage(quotes);
  return result.primary === 'ko';
}

/**
 * System prompt for the Content Writer stage
 * Gemini 3 Flash optimized with PTCF framework
 */
export const CONTENT_WRITER_SYSTEM_PROMPT = `# Persona

You are a developer career coach writing a deeply personal analysis report. Think of yourself as a trusted mentor who has studied this developer's work patterns. Your role is PRESENTATION and PERSONALIZATION, not re-analysis.

# Task

Transform raw behavioral data into an ENGAGING, PERSONALIZED narrative that makes the developer feel truly understood.

**Writing Principles:**
- Use their actual words frequently (quotes from the data)
- Reference specific moments: "When you said X..."
- Create "aha moments" through specificity
- Be warm but professional - like a trusted career mentor
- Frame growth areas as extensions of existing strengths

**Tone Examples:**
- DO: "Your habit of saying 'let me think about this' before complex tasks shows..."
- DON'T: "You demonstrate good planning behaviors..."
- DO: "That moment where you said 'wait, that doesn't look right' caught a real bug"
- DON'T: "You have good verification habits..."

# Transformation Rules

**Personality Summary** (300-1500 chars for premium depth)
- Synthesize type analysis into memorable, detailed prose
- Lead with their most distinctive trait
- Reference 3-5 specific quotes that capture their essence
- Use **bold markers** to emphasize 3-5 key personality traits or distinctive phrases
- Example: "Your **systematic verification habit** sets you apart..."
- Include insights about their collaboration style, problem-solving approach, and growth mindset
- Make this feel like a professional career assessment worth paying for

**Dimension Insights** (exactly 6 - COMPREHENSIVE)
For each dimension, USE CLUSTERS from Stage 1 data (dimensionSignals.strengthClusterThemes / growthClusterThemes):

⚠️ CRITICAL: ClusterId output is required (used for evidence matching)

STRENGTH SECTIONS:
- Number of strength sections = number of strength clusters defined in Stage 1
- For each cluster: transform cluster.theme into an engaging section title
  - Make it specific and memorable (not generic)
- strengthsData format: "clusterId|title|description;clusterId|title|description;..."
  - clusterId must be copied exactly from Stage 1 strengthClusterThemes (the part before the colon)
  - Example: Stage 1 cluster "aiCollaboration_s_1:Expert Persona Usage"
    → Output: "aiCollaboration_s_1|Expert Persona Orchestration|Your strategic use of..."
- Write detailed descriptions (up to 500 chars) that feel personal
- Evidence quotes will be added automatically via clusterId matching

GROWTH AREAS:
- Number of growth sections = number of growth clusters defined in Stage 1
- Transform cluster.theme into actionable section title
- Frame as opportunities, not criticisms
- growthAreasData format: "clusterId|title|description|recommendation;..."
  - clusterId must be copied exactly from Stage 1 growthClusterThemes (the part before the colon)
- Include detailed, actionable recommendations (up to 400 chars)
- Evidence quotes will be added automatically via clusterId matching

ABSENCE-BASED GROWTH INTEGRATION (CRITICAL):
- Check absenceBasedGrowthSignals from Stage 1 data
- For each signal where wasAbsent=true, this is a SYSTEMATIC growth area
- These should be PRIORITIZED because absence detection is more reliable than positive detection
- Include in growthAreasData with:
  - clusterId: use the patternId prefixed with "absence_" (e.g., "absence_plan_usage")
  - title: use growthTitle from the signal
  - description: use growthDescription, but personalize it with session context (500+ chars for depth)
  - recommendation: use the signal's recommendation
- CITE SOURCES: When behavioral contrast shows unmet best practices, cite the source
  - Example: "According to Anthropic's best practices, using /plan before complex tasks..."

⚠️ VALIDATION: Each clusterId in output MUST exist in Stage 1 cluster themes. Missing or wrong clusterId = broken evidence matching.

**Prompt Patterns** (5-12 patterns for comprehensive analysis)
- Name each pattern distinctively based on its characteristics
- **Description (600-800 chars):** Write a DEEP analysis that makes the developer feel truly understood:
  - **WHAT**: Describe the observable behavior pattern concretely
  - **WHY**: Explain what this pattern reveals about their mindset, values, or work philosophy
  - **HOW**: Describe how this pattern affects their AI collaboration effectiveness and code quality
  - Connect to their personality: "This reflects your tendency to..." or "This pattern shows your..."
  - Include the IMPACT: productivity, code quality, learning speed, or team dynamics
- Show examples with actual quotes
- Rate effectiveness
- **Tip (600-1000 chars):** Write expert-level coaching advice:
  - Reference knowledge base insights with natural attribution: "According to Anthropic's guide...", "As Simon Willison advises..."
  - Include specific techniques or frameworks from expert sources
  - Provide concrete "try this" examples the developer can apply immediately
  - Connect to their actual behavior: "When you [quote], you could enhance this by..."
  - When writing in non-English: Translate KB advice naturally, keep technical terms in English

**Actionable Practices** (from actionablePatternMatches in Stage 1 data)
- Transform practiced patterns into "practiced" array:
  - Include patternId, advice, source, feedback, dimension
  - Write personalized feedback celebrating this practice
- Transform missed patterns (practiced=false) into "opportunities" array:
  - Include patternId, advice, source, tip, dimension, priority
  - Write encouraging tip explaining why to adopt this practice
- Write a summary (max 300 chars) assessing their overall expert practice adoption
- Prioritize high-priority patterns (priority >= 8) in the summary

**Advanced Sections**
- toolUsageDeepDive: Based on tool_usage patterns
- tokenEfficiency: Based on session efficiency signals
- growthRoadmap: 3-5 steps based on growth signals
- comparativeInsights: Contextualize their patterns
- sessionTrends: Based on temporal patterns in quotes

**Anti-Patterns Analysis** (Premium/Enterprise - from detectedAntiPatterns)
- Transform each anti-pattern into an insight with a MEMORABLE NAME:
  - sunk_cost_loop → "The Retry Loop Trap", "The Persistence Paradox"
  - emotional_escalation → "The Frustration Spiral"
  - blind_retry → "The Quick Fix Reflex"
  - passive_acceptance → "The Trust Fall"
- Write description that feels SUPPORTIVE, not judgmental
- Provide specific growthOpportunity: "Instead of X, try Y..."
- Include actionableTip: concrete next step
- Calculate overallHealthScore (0-100): fewer/milder anti-patterns = higher score
- Write a summary that normalizes growth: "These are common learning patterns..."

**Critical Thinking Highlights** (Premium/Enterprise - from criticalThinkingMoments)
- Celebrate these as STRENGTHS - they show professional maturity
- Transform each moment into a highlight with DISTINCTIVE TITLE:
  - verification_request → "The Guardrail", "The Safety Check"
  - output_validation → "The Proof Seeker", "The Test-First Mind"
  - assumption_questioning → "The Thoughtful Challenger"
  - alternative_exploration → "The Option Weigher"
  - security_check → "The Security Sentinel"
- Split into strengths (high confidence) and opportunities (lower confidence)
- Calculate overallScore (0-100): more/better critical thinking = higher score
- Write summary emphasizing their professional questioning habits

**Planning Assessment** (Premium/Enterprise - from planningBehaviors)
- This is a KEY INDICATOR of developer seniority
- Assess planningMaturityLevel based on evidence:
  - 'expert': /plan usage with 3+ step decomposition
  - 'structured': /plan usage with simple plans OR consistent TodoWrite
  - 'emerging': Some task decomposition, stepwise thinking
  - 'reactive': Minimal planning, direct implementation
- Transform each behavior into an insight with MEANINGFUL TITLE:
  - slash_plan_usage → "The Master Strategist", "The Blueprint Builder"
  - structure_first → "The Architect's Mind"
  - task_decomposition → "The Problem Breaker"
  - todowrite_usage → "The Task Tracker"
  - stepwise_approach → "The Methodical Engineer"
- **CRITICAL**: Include slashPlanStats if /plan was used:
  - totalUsage: count of /plan commands
  - avgStepsPerPlan: average steps in plans
  - problemDecompositionRate: ratio with decomposition
- If NO /plan usage: recommend "Try using /plan command to create a roadmap before complex tasks"
- Write summary emphasizing their planning sophistication

**Top 3 Focus Areas** (CRITICAL - from personalizedPriorities)
This is the MOST ACTIONABLE part of the report. Use personalizedPriorities from Stage 1:

- Transform each priority into an engaging, memorable narrative:
  - Lead with WHY this matters for THIS developer
  - Reference specific quotes that led to this priority (use quote.insight.rootCause)
  - Connect the situation (quote.context) to the recommendation
  - Make the expected impact feel tangible and motivating

- Use the priority's context + insight data to write deeper analysis:
  - "In your debugging sessions (context.situationType), you tend to..."
  - "This happens because (insight.rootCause)..."
  - "Developing this habit will (expectedImpact)..."

- Writing style for priorities:
  - Rank 1: Most urgent, most impactful - emphasize immediate actionability
  - Rank 2: Important for sustained growth - emphasize consistency
  - Rank 3: Long-term excellence - emphasize mastery mindset

- Include specific action steps for each priority:
  - What to START doing
  - What to STOP doing
  - What to CONTINUE doing

# Format

Return VerboseLLMResponse with all sections populated.

**IMPORTANT: FLATTENED FORMAT for nested data**
To reduce nesting depth, use SEMICOLON-SEPARATED STRINGS instead of nested arrays:

**dimensionInsights** - Use pipe-separated fields, semicolon between items:
- strengthsData: "title1|description1;title2|description2;..." (NOT an array)
- growthAreasData: "title1|description1|recommendation1;title2|..." (NOT an array)

**promptPatterns** - Use pipe-separated fields, semicolon between items:
- examplesData: "quote1|analysis1;quote2|analysis2;..." (NOT an array)

**topFocusAreas.areas** - Use pipe-separated fields for actions:
- actionsData: "start_action|stop_action|continue_action" (NOT an object)

**Required fields:**
- primaryType, controlLevel, distribution (from Stage 1 typeAnalysis)
- personalitySummary (300-1500 chars)
- dimensionInsights (exactly 6):
  - dimension, dimensionDisplayName
  - strengthsData: "title|description;title|description;..." (0-8 items)
  - growthAreasData: "title|description|recommendation;..." (0-5 items)
- promptPatterns (5-12):
  - patternName, description (600-800 chars with WHAT-WHY-HOW), frequency, effectiveness, tip
  - examplesData: "quote|analysis;quote|analysis;..." (1-5 items)
- actionablePractices (practiced + opportunities)
- antiPatternsAnalysis (if detectedAntiPatterns exists)
- criticalThinkingAnalysis (if criticalThinkingMoments exists)
- planningAnalysis (if planningBehaviors exists)
- **topFocusAreas** (transform personalizedPriorities into narrative):
  - areas: array of 1-3 objects with:
    - rank, dimension, title, narrative (WHY this matters), expectedImpact, priorityScore
    - actionsData: "start_action|stop_action|continue_action"
  - summary: explanation of priority selection

**Critical Rules:**
- Use ACTUAL quotes from the input data. Do not invent quotes.
- Every insight must be grounded in the provided data.
- Type classification values (primaryType, controlLevel, distribution) come from input data.
- ESCAPE any pipe (|) or semicolon (;) characters within text fields with backslash.`;

/**
 * Knowledge context for tip generation
 * Contains expert insights mapped to pattern types
 */
export interface KnowledgeContextItem {
  title: string;
  author: string;
  keyTakeaway: string;
  actionableAdvice: string[];
}

export interface PatternKnowledgeContext {
  /** Pattern type -> related KB items */
  [patternType: string]: KnowledgeContextItem[];
}

/**
 * Build KB context section for the prompt
 * Formats knowledge items for LLM consumption
 */
export function buildKnowledgeContextSection(
  kbContext: PatternKnowledgeContext,
  outputLanguage: SupportedLanguage = 'en'
): string {
  if (!kbContext || Object.keys(kbContext).length === 0) {
    return '';
  }

  const header = `## Knowledge Base Context (for tip generation)\n\nReference these expert insights when writing tips. Use natural attribution: "According to Anthropic's guide...", "As Simon Willison advises..."\n`;

  const sections: string[] = [header];

  const patternTypeLabels: Record<string, string> = {
    communication_style: 'Communication Style',
    problem_solving: 'Problem Solving',
    ai_interaction: 'AI Interaction',
    verification_habit: 'Verification Habit',
    tool_usage: 'Tool Usage',
  };

  for (const [patternType, items] of Object.entries(kbContext)) {
    if (items.length === 0) continue;

    const label = patternTypeLabels[patternType] || patternType;
    sections.push(`### ${label}\n`);

    for (const item of items) {
      sections.push(`- **"${item.title}"** (${item.author}): "${item.keyTakeaway}"`);
      if (item.actionableAdvice.length > 0) {
        sections.push(`  - Advice: ${item.actionableAdvice.slice(0, 2).join('; ')}`);
      }
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Language display names for output instructions
 */
const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

/**
 * Build the user prompt for Stage 2 content transformation
 * Places data context before instructions (Gemini best practice)
 *
 * @param structuredData - JSON string of Stage 1 analysis data (Module A)
 * @param sessionCount - Number of sessions analyzed
 * @param outputLanguage - Target output language (defaults to English)
 * @param kbContext - Optional knowledge base context for tip generation
 * @param productivityData - JSON string of productivity analysis (Module C) - optional
 * @param agentOutputsData - JSON string of Phase 2 agent outputs - optional
 */
export function buildContentWriterUserPrompt(
  structuredData: string,
  sessionCount: number,
  outputLanguage: SupportedLanguage = 'en',
  kbContext?: PatternKnowledgeContext,
  productivityData?: string,
  agentOutputsData?: string
): string {
  const useNonEnglish = outputLanguage !== 'en';
  const langName = LANGUAGE_DISPLAY_NAMES[outputLanguage];

  // Language-specific instructions for different sections
  const languageHeader = useNonEnglish
    ? `
## CRITICAL: ${langName} Output Required

**Write all output in ${langName}.**

The developer's quotes are in ${langName}. You MUST write EVERY field in **${langName}**:
- personalitySummary: Write in ${langName}
- patternName: Write in ${langName} (e.g., "Persona Anchoring", "Git Time Machine" should be expressed naturally in ${langName})
- pattern description: Write in ${langName}
- pattern tip: Write in ${langName}
- example analysis: Write in ${langName}
- strength/growth titles: Write in ${langName}
- strength/growth descriptions: Write in ${langName}
- ALL recommendations: Write in ${langName}

Keep technical terms in English (AI, IDE, debugging, Git, commit).
Match the developer's natural ${langName} style from their quotes.
`
    : '';

  const languagePatternReminder = useNonEnglish
    ? `
   - Write in ${langName}: patternName, description, tip, analysis must all be in ${langName}`
    : '';

  const languageDimensionReminder = useNonEnglish
    ? `
   - Write in ${langName}: title, description, recommendation must all be in ${langName}`
    : '';

  const languageSummaryReminder = useNonEnglish
    ? `
   - Write in ${langName}`
    : '';

  const languageFinalReminder = useNonEnglish
    ? `

---
## Final Reminder: Write all output fields in ${langName}!
Do NOT write pattern names, descriptions, tips, or analysis in English.
Example: "The Persona Anchor" in English should be expressed naturally in ${langName}.`
    : '';

  // Language reminder for agent insights translation
  const languageAgentInsightsReminder = useNonEnglish
    ? `
⚠️ TRANSLATION REQUIRED: The agent insights above are in English.
When integrating these insights into your ${langName} narrative:
- Translate all agent findings, pattern names, and recommendations to ${langName}
- Express insights naturally in ${langName} style
- Keep technical terms in English (AI, IDE, debugging, Git, commit, token, etc.)
`
    : '';

  // Build KB context section if provided
  const kbContextSection = kbContext
    ? buildKnowledgeContextSection(kbContext, outputLanguage)
    : '';

  // Build productivity data section if provided
  const productivityDataSection = productivityData
    ? `
## Productivity Analysis (from Module C - Efficiency Metrics)
${productivityData}
`
    : '';

  // Build agent outputs section if provided (Phase 2 insights)
  const agentInsightsSection = agentOutputsData
    ? `
## Agent Insights (from Phase 2 - Specialized Analysis)

These insights were generated by specialized AI agents analyzing different aspects of the developer's behavior.
Use these insights to ENHANCE your content generation:

${agentOutputsData}

### How to Integrate Agent Insights:

1. **Pattern Detective insights** → Enhance promptPatterns with discovered "wow moments"
2. **Anti-Pattern Spotter insights** → Use for antiPatternsAnalysis section
3. **Knowledge Gap insights** → Inform growthRoadmap and growth areas
4. **Context Efficiency insights** → Use for tokenEfficiency section
5. **Metacognition insights** → Highlight self-awareness in personalitySummary
6. **Temporal Analysis insights** → Use for sessionTrends and productivity patterns

⚠️ IMPORTANT: These agent outputs contain REAL discoveries. Reference them explicitly in your narrative!
${languageAgentInsightsReminder}`
    : '';

  return `# Context Data

This developer has ${sessionCount} sessions analyzed.
${languageHeader}
## Structured Analysis Data (from Module A - Behavioral Analysis)
${structuredData}
${productivityDataSection}${agentInsightsSection}${kbContextSection}
# Transformation Instructions

Using the extracted data above, create a VerboseLLMResponse:

1. **Type Result**
   - Use typeAnalysis from the data directly (primaryType, controlLevel, distribution)

2. **Personality Summary** (300-1500 characters for premium value)
   - Synthesize type reasoning into engaging, detailed prose
   - Reference 3-5 personality-revealing quotes from extractedQuotes
   - Emphasize 3-5 key phrases with **bold markers** (e.g., "Your **strategic planning approach**...")
   - Include insights on collaboration style, problem-solving, and growth mindset${languageSummaryReminder}

3. **Dimension Insights** (exactly 6 - USE CLUSTERS FROM STAGE 1)
   - Use dimensionSignals.clusters to determine number and order of sections
   - For each strength cluster: transform theme into engaging title (max 80 chars), write description (max 500 chars)
   - For each growth cluster: transform theme into title, write description and recommendation (max 400 chars)
   - Evidence quotes are added automatically - do NOT include evidence arrays
   - CRITICAL: Order of strengths/growthAreas MUST match order of clusters in Stage 1
   - **ABSENCE-BASED GROWTH**: For each absenceBasedGrowthSignal where wasAbsent=true:
     * Add to the appropriate dimension's growthAreasData
     * Use detailed descriptions (500+ chars) explaining why this matters
     * Cite sources when available (e.g., "According to Anthropic's best practices...")
     * These systematic insights should appear FIRST in growth areas (highest priority)${languageDimensionReminder}

4. **Prompt Patterns** (5-12 for comprehensive analysis)
   - Transform detectedPatterns into distinctively named patterns
   - **Description (600-800 chars):** Write in-depth analysis using WHAT-WHY-HOW framework:
     * WHAT: The concrete behavior pattern observed
     * WHY: What this reveals about their mindset and work philosophy
     * HOW: How this affects their AI collaboration and code quality
   - Include 2-5 example quotes each with detailed analysis
   - Rate effectiveness
   - **Tip (600-1000 chars):** Write expert coaching using Knowledge Base context below:
     * Reference expert insights with natural attribution
     * Include specific techniques from KB sources
     * Provide concrete "try this" examples
     * Connect to their behavior: "When you [quote], try..."${languagePatternReminder}

5. **Actionable Practices** (IMPORTANT - from actionablePatternMatches)
   - Split actionablePatternMatches by practiced=true/false
   - practiced=true → "practiced" array: celebrate what they did right
   - practiced=false → "opportunities" array: encourage adoption
   - Write a summary of their expert practice adoption

6. **Advanced Sections**
   - Generate all: toolUsageDeepDive, tokenEfficiency, growthRoadmap, comparativeInsights, sessionTrends

7. **Anti-Patterns Analysis** (if detectedAntiPatterns exists and not empty)
   - Transform each anti-pattern with memorable displayName
   - Frame as GROWTH OPPORTUNITIES, not criticisms
   - Provide specific, actionable growthOpportunity and tip
   - Calculate overallHealthScore (higher = fewer/milder anti-patterns)
   - Write supportive summary normalizing these as learning patterns

8. **Critical Thinking Highlights** (if criticalThinkingMoments exists and not empty)
   - CELEBRATE these as professional strengths
   - Give distinctive displayName to each highlight
   - Split into strengths (high confidence) vs opportunities
   - Calculate overallScore (higher = more/better critical thinking)
   - Write summary praising their verification habits

9. **Planning Assessment** (if planningBehaviors exists and not empty)
   - This is a KEY SENIORITY INDICATOR
   - Assign planningMaturityLevel: reactive → emerging → structured → expert
   - Include slashPlanStats if /plan was used (CRITICAL: totalUsage, avgStepsPerPlan, problemDecompositionRate)
   - If no /plan usage, recommend it in opportunities
   - Write summary emphasizing planning sophistication

10. **Top 3 Focus Areas** (output to topFocusAreas field)
   - Use personalizedPriorities from Stage 1 data
   - Output to topFocusAreas: { areas: [...], summary: string }
   - For each priority in topPriorities, create a TopFocusArea:
     * rank: same as priority.rank
     * dimension: same as priority.dimension
     * title: transform priority.focusArea into engaging title
     * narrative: WHY this matters (use insight.rootCause from related quotes)
     * expectedImpact: same as priority.expectedImpact
     * priorityScore: same as priority.priorityScore
     * actions: { start: "...", stop: "...", continue: "..." }
   - summary: transform priority.selectionRationale into narrative

Make this developer feel truly understood. Use their actual words.${languageFinalReminder}`;
}
