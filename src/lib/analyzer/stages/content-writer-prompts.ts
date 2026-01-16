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
 * Detect if the given quotes contain significant Korean text
 * Returns true if Korean characters make up >= 30% of alphanumeric content
 */
export function detectKoreanContent(quotes: string[]): boolean {
  if (quotes.length === 0) return false;

  const combinedText = quotes.join(' ');

  // Count Korean characters (Hangul syllables + Jamo)
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
  const koreanMatches = combinedText.match(koreanRegex);
  const koreanCount = koreanMatches ? koreanMatches.length : 0;

  // Count total meaningful characters (letters, numbers, Korean)
  const meaningfulRegex = /[a-zA-Z0-9\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
  const meaningfulMatches = combinedText.match(meaningfulRegex);
  const totalCount = meaningfulMatches ? meaningfulMatches.length : 0;

  if (totalCount === 0) return false;

  const koreanRatio = koreanCount / totalCount;
  return koreanRatio >= 0.3; // 30% threshold
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

**Personality Summary** (200-800 chars)
- Synthesize type analysis into memorable prose
- Lead with their most distinctive trait
- Reference 2-3 specific quotes that capture their essence
- Use **bold markers** to emphasize 2-4 key personality traits or distinctive phrases
- Example: "Your **systematic verification habit** sets you apart..."

**Dimension Insights** (exactly 6)
For each dimension:
- Create 2-4 themed STRENGTH CLUSTERS from raw signals
  - Give each cluster a specific, descriptive title (not generic)
  - Write descriptions that feel personal, not templated
- Create 1-2 GROWTH AREAS (only where signals warrant)
  - Frame as opportunities, not criticisms
  - Include specific, actionable recommendations

**Prompt Patterns** (3-6 patterns)
- Name each pattern distinctively based on its characteristics
- Show examples with actual quotes
- Rate effectiveness and provide improvement tips

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
- If NO /plan usage: recommend "복잡한 작업 전 /plan 명령어로 로드맵을 세워보세요"
- Write summary emphasizing their planning sophistication

# Format

Return VerboseLLMResponse with all sections populated.

**Critical Rules:**
- Use ACTUAL quotes from the input data. Do not invent quotes.
- Every insight must be grounded in the provided data.
- Type classification values (primaryType, controlLevel, distribution) come from input data.`;

/**
 * Build the user prompt for Stage 2 content transformation
 * Places data context before instructions (Gemini best practice)
 *
 * @param structuredData - JSON string of Stage 1 analysis data
 * @param sessionCount - Number of sessions analyzed
 * @param useKorean - Whether to generate content in Korean
 */
export function buildContentWriterUserPrompt(
  structuredData: string,
  sessionCount: number,
  useKorean: boolean = false
): string {
  const languageInstruction = useKorean
    ? `
## Language Requirement

**IMPORTANT**: The developer's quotes are primarily in Korean. You MUST write ALL content (personalitySummary, strength/growth descriptions, pattern descriptions, tips, analysis, recommendations, etc.) in **Korean (한국어)**.

- Write naturally in Korean, not translated English
- Keep technical terms in English where appropriate (e.g., "AI", "IDE", "debugging")
- Match the developer's communication style from their quotes
`
    : '';

  return `# Context Data

This developer has ${sessionCount} sessions analyzed.

## Structured Analysis Data (from Stage 1)
${structuredData}
${languageInstruction}
# Transformation Instructions

Using the extracted data above, create a VerboseLLMResponse:

1. **Type Result**
   - Use typeAnalysis from the data directly (primaryType, controlLevel, distribution)

2. **Personality Summary** (200-800 characters)
   - Synthesize type reasoning into engaging prose
   - Reference 2-3 personality-revealing quotes from extractedQuotes
   - Emphasize 2-4 key phrases with **bold markers** (e.g., "Your **strategic planning approach**...")

3. **Dimension Insights** (exactly 6)
   - Create strength clusters by grouping related strengthSignals
   - Each cluster: title (max 50 chars), description (max 300 chars), evidence as string array (3-5 actual quote strings)
   - Create growth areas from growthSignals (only if meaningful signals exist)
   - For growth areas: include 1-4 evidence quote strings and a recommendation

4. **Prompt Patterns** (3-6)
   - Transform detectedPatterns into named, illustrated patterns
   - Include 1-3 example quotes each
   - Rate effectiveness and provide improvement tips

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

Make this developer feel truly understood. Use their actual words.`;
}
