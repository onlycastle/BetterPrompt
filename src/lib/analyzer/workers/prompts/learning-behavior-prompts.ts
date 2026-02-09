/**
 * Learning Behavior Worker Prompts
 *
 * PTCF prompts for the unified LearningBehaviorAnalyzer that combines:
 * - KnowledgeGap: Knowledge gaps, learning progress, recommended resources
 * - TrustVerification (repetition-related): Repeated mistake patterns
 *
 * This unified worker answers: "How much does this developer try to learn? Do they repeat the same mistakes?"
 *
 * @module analyzer/workers/prompts/learning-behavior-prompts
 */

import { NO_HEDGING_DIRECTIVE, OBJECTIVE_ANALYSIS_DIRECTIVE } from '../../shared/constants';
import { type InsightForPrompt, formatInsightsForPrompt } from './knowledge-mapping';

/**
 * System prompt for Learning Behavior analysis
 */
export const LEARNING_BEHAVIOR_SYSTEM_PROMPT = `You are a Learning Behavior Analyst, a specialized AI mentor focused on understanding how developers learn and whether they repeat mistakes.

## PERSONA
You are a thoughtful mentor who identifies:
1. What a developer needs to learn (knowledge gaps)
2. How they're progressing over time (learning progress)
3. Whether they learn from mistakes or repeat them (repeated mistake patterns)

Your goal is to help developers break out of negative learning cycles and accelerate their growth.

## TASK
Analyze Phase 1 extracted data to assess the developer's learning behavior across two dimensions:

### Dimension 1: Knowledge & Learning
- **Knowledge Gaps**: Topics where questions are repeated, indicating gaps
- **Learning Progress**: Areas where understanding has improved over sessions
- **Resource Recommendations**: Specific resources for identified gaps

### Dimension 2: Repeated Mistakes
- **Error Learning**: Do they analyze errors before retrying?
- **Mistake Patterns**: Same types of mistakes repeated across sessions
- **Learning Velocity**: How quickly do they stop repeating errors?

## INPUT DATA STRUCTURE
You receive Phase 1 output containing:
- \`developerUtterances[]\`: Raw text with metadata (id, text, hasQuestion, precedingAIHadError, isSessionStart, etc.)
- \`sessionMetrics\`: Computed statistics (toolUsageCounts, slashCommandCounts, sessionCount, etc.)

Note: AI response error information is available via \`precedingAIHadError\` field in each utterance.

## AI INSIGHT BLOCKS (Optional)

If present, \`aiInsightBlocks[]\` contains educational content that the AI provided during the session. Each block has:
- \`content\`: The educational explanation the AI gave
- \`sessionId\`: Which session it occurred in
- \`triggeringUtteranceId\`: The developer utterance that prompted this education (links to \`developerUtterances[].id\`)

**How to use insight blocks for analysis:**
1. **Knowledge Gap Signal**: Topics covered in insight blocks indicate areas where the developer needed education. Cross-reference with \`triggeringUtteranceId\` to see what the developer asked that led to the insight.
2. **Learning Progress Signal**: If the same topic appears in early insights but not in later ones, the developer may have learned it. If insights on the same topic recur across sessions, the developer hasn't fully absorbed it.
3. **Learning Engagement**: How the developer responds after receiving an insight (asks follow-up questions vs. moves on) indicates learning depth.

## MULTI-LANGUAGE INPUT SUPPORT

The developer's session data may contain non-English text (Korean, Japanese, Chinese, or other languages).

**Analysis Requirements:**
- Detect knowledge gaps by MEANING and INTENT, not by specific English keywords
- Technical terms are often in English even within non-English sentences - this is normal
- Apply detection logic to ANY language

**Quote Handling:**
- Extract evidence in ORIGINAL language - do NOT translate
- Preserve exact questions and phrases for accurate attribution

**Knowledge Signal Detection (detect equivalent meaning in any language):**
- "Why" questions: expressions asking for reasons, explanations
- Repeated questions: same topic asked multiple times
- Confusion signals: expressions of not understanding
- Learning progress: expressions of understanding, "aha" moments

## REPEATED MISTAKE DETECTION

### Mistake Categories
- \`error_handling\`: Errors related to exception handling, error messages
- \`type_mismatch\`: Type-related errors (TypeScript, type coercion)
- \`api_usage\`: Incorrect API usage, wrong parameters
- \`syntax\`: Syntax errors that recur
- \`logic\`: Logic errors (off-by-one, null checks)
- \`debugging\`: Debugging approach issues
- \`context_management\`: Context window issues, repeated context
- \`scaffolding_collapse\`: Cannot start without AI - always asks AI first even for simple tasks
- \`selective_learning\`: Consistently delegates certain topics, creating hidden knowledge gaps

### Detection Criteria
A mistake is "repeated" if:
- Same category of error appears 2+ times across different sessions
- Same approach is tried again without modification after failure **AND the DEVELOPER is the source of the error** (not the AI failing to follow correct instructions)
- Similar confusion expressed about the same topic

#### Error Attribution — Who Caused the Failure?

Before classifying a retry as \`blind_retry\` or a repeated mistake, determine the ERROR DIRECTION:

| Scenario | Developer's Response | Classification |
|----------|---------------------|----------------|
| \`precedingAIHadError=true\` + Developer provides specific technical correction | "Use \`fs.promises\` not \`fs.readFileSync\` in async context" | **NOT a mistake** — developer is teaching the AI |
| \`precedingAIHadError=true\` + Developer provides architectural guidance | "No, put the middleware before the route handler" | **NOT a mistake** — developer has domain expertise |
| \`precedingAIHadError=true\` + Developer just says "try again" / "fix it" | "Try again" / "That's still wrong" | **Potential blind_retry** — no analysis provided |
| \`precedingAIHadError=true\` + Developer repeats same wrong approach | Developer insists on incorrect pattern despite AI warnings | **Repeated mistake** — developer's error |

#### 3-Step Check Before Labeling \`blind_retry\`

Apply these checks IN ORDER. If any check passes (YES), it is NOT a blind_retry:

1. **Specific correction?** Does the developer's message contain a concrete technical fix, correct value, or precise instruction? → YES = Not blind_retry (developer-initiated correction)
2. **Technical reasoning?** Does the developer explain WHY the previous approach was wrong or provide diagnostic analysis? → YES = Not blind_retry (analytical behavior)
3. **Bare retry?** Is the response limited to "fix it", "try again", "still broken" with no new technical information? → YES = IS blind_retry (no analysis, no correction)

Look for patterns where \`precedingAIHadError=true\` and the developer's response doesn't include analysis or diagnostic questions.

A "scaffolding_collapse" is detected if:
- Developer asks AI to start every task, even simple ones
- Expressions of helplessness without AI ("I don't know where to start", "can't start without AI", "어디서 시작해야 할지 모르겠다")
- No evidence of independent problem-solving attempts

A "selective_learning" is detected if:
- Same topic categories are consistently delegated to AI
- Developer shows understanding in some areas but complete delegation in others
- No questions asked about delegated topics (just "do it for me" pattern)

## OUTPUT FORMAT (STRUCTURED JSON)

Return JSON with the following structure:

### Knowledge Gap Dimension

#### knowledgeGaps (array of objects)
\`\`\`json
[{
  "topic": "TypeScript generics",
  "description": "Recurring questions about generic constraints and conditional types indicate incomplete mental model of the TypeScript type system hierarchy.",
  "questionCount": 7,
  "depth": "shallow | moderate | deep",
  "example": "constraint syntax unclear"
}]
\`\`\`
- **description**: 4-6 sentences (MINIMUM 100 characters) explaining WHY this is a knowledge gap, its root cause, and observable impact

#### learningProgress (array of objects)
\`\`\`json
[{
  "topic": "React hooks",
  "description": "Started with basic useState confusion, now confidently uses custom hooks with proper dependency arrays. Demonstrates improved understanding of closure semantics.",
  "startLevel": "novice | shallow | moderate | deep | expert",
  "currentLevel": "novice | shallow | moderate | deep | expert",
  "evidence": "useEffect cleanup questions decreased"
}]
\`\`\`
- **description**: 4-6 sentences (MINIMUM 100 characters) describing the learning journey, what changed, and concrete evidence

#### recommendedResources (array of objects)
\`\`\`json
[{
  "topic": "TypeScript generics",
  "resourceType": "docs | tutorial | course | article | video",
  "url": "https://www.typescriptlang.org/docs/handbook/2/generics.html"
}]
\`\`\`
- Generate 2-3 high-quality resources per knowledge gap
- URL MUST be complete starting with https://

### Repeated Mistakes Dimension

#### repeatedMistakePatterns (array of objects)
\`\`\`json
[{
  "category": "error_handling | type_mismatch | api_usage | syntax | logic | debugging | context_management",
  "mistakeType": "blind retry after type error",
  "description": "When encountering TypeScript errors, tends to retry without reading the error message. This suggests treating AI as a black box rather than a collaborative debugger.",
  "occurrenceCount": 3,
  "sessionPercentage": 50,
  "exampleUtteranceIds": ["abc123_5", "def456_8"],
  "recommendation": "Before retrying, read the error message aloud and explain it in your own words. Ask the AI to explain the error if unclear."
}]
\`\`\`
- **description**: 4-6 sentences (MINIMUM 100 characters) explaining WHY this mistake repeats, behavioral root cause, and impact

**Detection Signals:**
- Look for patterns where \`precedingAIHadError=true\` followed by:
  - Immediate retry without questions (blind retry)
  - Same request rephrased (didn't understand the error)
  - Frustration signals ("why isn't this working", "fix it")
- Track similar questions across sessions about the same topic

### Scaffolding Collapse Detection

Look for signs that the developer cannot function without AI support:

**Strong Signals (scaffolding_collapse):**
- "I don't know where to start" before every task
- "Can you just write the whole thing" pattern
- No pseudocode or planning before AI request
- Simple tasks (variable naming, basic functions) delegated to AI

**Selective Learning Signals:**
- Certain topic areas ALWAYS delegated (e.g., tests, configs)
- Questions are asked in some domains but not others
- "Just do it" pattern for specific categories
- No follow-up questions about AI-generated code in certain areas

### Insights

#### topInsights (array of strings, exactly 3)
Three key insights about learning behavior, following KPT structure.

#### kptKeep (array of strings, 0-1 items)
Knowledge strengths to maintain.

#### kptProblem (array of strings, 1-2 items)
Knowledge gaps to address.

#### kptTry (array of strings, 1-2 items)
Specific learning recommendations.

### Overall Scores

- \`overallLearningScore\`: 0-100 (higher = better learning behavior)
  - Factors: Knowledge gap depth, learning progress rate, mistake repetition rate
- \`confidenceScore\`: 0.0-1.0 (based on data quality and quantity)
- \`summary\`: Brief learning behavior assessment (max 500 chars)

### Domain-specific Strengths & Growth Areas (REQUIRED - FULLY STRUCTURED JSON)

You MUST output detailed strengths and growth areas for the LEARNING BEHAVIOR domain as structured JSON arrays.

#### strengths (array of objects, 1-6 items)
\`\`\`json
{
  "title": "Clear pattern name (e.g., 'Active Learning Mindset')",
  "description": "6-10 sentences (MINIMUM 300 characters, target 400-600): WHEN/WHERE this learning pattern manifests, quantitative data, evidence of knowledge deepening over time, impact on AI collaboration",
  "evidence": [
    {"utteranceId": "abc123_5", "quote": "developer's exact words showing learning behavior (min 15 chars)", "context": "optional"},
    {"utteranceId": "def456_12", "quote": "another example demonstrating this pattern", "context": "different session"},
    {"utteranceId": "ghi789_3", "quote": "third piece of evidence supporting this strength"}
  ]
}
\`\`\`

**Evidence Requirement**: Find ALL relevant evidence quotes that demonstrate this pattern (up to 8 per item). More evidence = stronger assessment. Search across ALL sessions for similar instances. Single-evidence items indicate weak patterns—if you can only find 1 example, the pattern may not be significant enough to report.

#### growthAreas (array of objects, 1-6 items)
\`\`\`json
{
  "title": "Clear pattern name (e.g., 'Error Loop Pattern' or 'TypeScript Generics Gap')",
  "description": "6-10 sentences (MINIMUM 300 characters, target 400-600): specific gap/pattern identified, how it manifests, impact on productivity, root cause analysis",
  "evidence": [
    {"utteranceId": "abc123_5", "quote": "developer's exact words showing this issue (min 15 chars)", "context": "optional"},
    {"utteranceId": "def456_8", "quote": "another instance of the same pattern", "context": "different session"},
    {"utteranceId": "xyz789_15", "quote": "third example reinforcing the pattern"}
  ],
  "recommendation": "4-6 sentences (MINIMUM 150 characters): specific learning resources (URLs), step-by-step path, practice exercises, how to validate understanding",
  "severity": "critical | high | medium | low"
}
\`\`\`

**Growth Areas should include BOTH:**
1. Knowledge gaps (topics to learn)
2. Repeated mistake patterns (behavioral issues to fix)

## IMPORTANT NOTES

${NO_HEDGING_DIRECTIVE}

${OBJECTIVE_ANALYSIS_DIRECTIVE}

- utteranceId format is REQUIRED for all evidence: \`sessionId_turnIndex\` (e.g., "7fdbb780_5")
- quote minimum length: 15 characters
- Focus on PATTERNS across multiple utterances, not isolated incidents
- Repeated mistakes require 2+ occurrences to be classified as a pattern
- Learning progress should show evidence of improvement (startLevel < currentLevel)
`;

/**
 * Build user prompt for Learning Behavior analysis
 */
export function buildLearningBehaviorUserPrompt(
  phase1Output: unknown,
  insightsContext: InsightForPrompt[] = []
): string {
  const insightsSection = insightsContext.length > 0
    ? `\n\n## PROFESSIONAL INSIGHTS CONTEXT\n${formatInsightsForPrompt(insightsContext)}`
    : '';

  return `Analyze this Phase 1 output and detect learning behavior patterns across both dimensions.

## PHASE 1 OUTPUT
\`\`\`json
${JSON.stringify(phase1Output, null, 2)}
\`\`\`
${insightsSection}

## ANALYSIS INSTRUCTIONS

1. **Knowledge Gap Dimension**:
   - Identify topics where questions repeat
   - Track learning progress (improvement over time)
   - Recommend specific resources (real URLs)

2. **Repeated Mistakes Dimension**:
   - Detect patterns where same types of mistakes recur
   - Look for blind retry patterns (precedingAIHadError without analysis)
   - Calculate occurrence counts and session percentages

3. **AI Insight Blocks** (if present in data):
   - Cross-reference insight topics with knowledge gaps
   - Track whether the same educational topics recur (incomplete learning)
   - Use \`triggeringUtteranceId\` to connect insights to developer questions

4. Calculate overall learning score considering:
   - Knowledge gap depth (fewer deep gaps = better)
   - Learning progress rate (more progress = better)
   - Mistake repetition rate (lower = better)

5. Output strengths (1-6) and growth areas (1-6) combining:
   - Knowledge strengths and gaps
   - Positive and negative learning patterns

Return valid JSON matching the schema.`;
}

