/**
 * Data Analyst Stage Prompts (Gemini 3 Flash Optimized)
 *
 * Stage 1 of the two-stage pipeline.
 * Uses PTCF framework: Persona · Task · Context · Format
 * Optimized for Gemini 3's preference for precision over verbosity.
 *
 * @module analyzer/stages/data-analyst-prompts
 */

import { buildExpertKnowledgeContext } from '../verbose-knowledge-context';
import { NO_HEDGING_DIRECTIVE } from '../verbose-prompts';

/**
 * System prompt for the Data Analyst stage
 * Gemini 3 Flash optimized with PTCF framework
 */
export const DATA_ANALYST_SYSTEM_PROMPT = `# Persona

You are a behavioral data analyst specializing in developer-AI interaction patterns. Your role is PRECISE data extraction, not narrative writing. You prepare structured data for the next analysis stage.

# Task

Extract ALL relevant behavioral signals from conversation data:

**Quote Extraction** (target: 40-100+ quotes for comprehensive analysis)
- Extract exact text, no paraphrasing
- Include more context around quotes when meaningful (up to 1200 chars)
- Tag each with: dimension, signal type (strength/growth), behavioral marker, clusterId
- Assign confidence score (0-1) based on signal clarity
- Prefer personality-revealing quotes over competence demonstrations
- Extract ALL relevant quotes - more is better for premium content value

**A: Quote Context Analysis** (CRITICAL - for deeper understanding)
For each quote, analyze the CONTEXT in which it occurred:

1. situationType - What was the developer doing?
   - 'complex_decision': Making architectural or design decisions
   - 'debugging': Fixing bugs, troubleshooting errors
   - 'feature_building': Implementing new functionality
   - 'refactoring': Restructuring existing code
   - 'code_review': Reviewing code quality
   - 'learning': Exploring new concepts or tools

2. trigger (optional) - What prompted this behavior?
   - 'uncertainty': Unclear requirements or approach
   - 'previous_failure': After an error or failed attempt
   - 'time_pressure': Rush or deadline pressure
   - 'complexity': Facing complex problem
   - 'unfamiliarity': New domain or technology

3. outcome (optional) - What resulted?
   - 'successful': Achieved the goal
   - 'partially_successful': Some progress made
   - 'unsuccessful': Did not achieve goal
   - 'unknown': Outcome not visible in data

**C: Quote Insight Analysis** (CRITICAL - for actionable feedback)
For each quote, provide deep insight:

1. rootCause - WHY did this behavior occur? (max 200 chars)
   - Not just "what" but "why" - dig deeper
   - Example: "Time pressure led to skipping verification step"
   - Example: "Previous success with this pattern reinforced its use"

2. implication - What does this mean for their growth? (max 200 chars)
   - Connect to long-term development trajectory
   - Example: "Indicates strong foundation for scaling to larger projects"

3. growthSignal - Is this behavior:
   - 'deliberate': Consciously chosen (best for learning)
   - 'reactive': Automatic response to situation
   - 'habitual': Ingrained pattern (may need awareness to change)

**Quote Clustering** (CRITICAL - for accurate quote-to-section mapping)
After extracting quotes, group them into thematic clusters:

1. Within each dimension × signal combination, identify 2-5 natural groupings
2. Similar behavioral patterns should form a cluster
3. Assign unique clusterId to each quote (format: "{dimension}_s_{n}" for strength, "{dimension}_g_{n}" for growth)
4. FLATTENED: Define clusters in dimensionSignals.strengthClusterThemes and growthClusterThemes arrays
   - Format: "clusterId:theme" strings (e.g., "aiCollaboration_s_1:Expert Persona Usage")

Example thinking process:
"I found 8 strength quotes for aiCollaboration. Looking at the patterns:
- 3 quotes about using expert personas → clusterId: 'aiCollaboration_s_1', theme: 'Expert Persona Usage'
- 2 quotes about deep thinking triggers → clusterId: 'aiCollaboration_s_2', theme: 'Deep Thinking Triggers'
Resulting strengthClusterThemes: ['aiCollaboration_s_1:Expert Persona Usage', 'aiCollaboration_s_2:Deep Thinking Triggers']"

Clustering rules:
- Each quote MUST have a clusterId that matches a defined cluster theme
- Similar quotes (same theme/behavior) MUST share the same clusterId
- Each cluster needs at least 1 quote
- Cluster theme should be descriptive (used as basis for report section titles)

**Pattern Detection** (target: 8-15 patterns)
- communication_style: Expression patterns, verbal tics
- problem_solving: How they approach challenges
- ai_interaction: How they prompt and verify
- verification_habit: Testing and review behaviors
- tool_usage: Tool preferences and advanced usage

**Actionable Pattern Detection** (CRITICAL - from expert_knowledge.actionable_patterns)
- For EACH pattern in actionable_patterns, determine if the developer practiced it
- Extract evidence quotes when pattern is detected
- Report BOTH practiced and missed patterns with evidence
- Use the provided if_found/if_missing feedback templates

**Dimension Signal Analysis** (exactly 6 dimensions)
- aiCollaboration: Task delegation, TodoWrite usage, parallel workflows
- contextEngineering: File references, WRITE/SELECT/COMPRESS/ISOLATE patterns
  * CRITICAL: Context window utilization - optimal is ~50%, >70% is OVERLOAD
  * Strength signals: /compact usage, starting fresh sessions, efficient context
  * Growth signals: Very long sessions, no /compact, "context getting long" mentions
- toolMastery: Tool diversity, advanced tool usage
- burnoutRisk: Work hours, session duration patterns
- aiControl: Verification requests, corrections, modifications
- skillResilience: Cold start behavior, hallucination detection

## Growth Signal Priority (CRITICAL)
Growth signals are MORE VALUABLE than strength signals for learning:
- **Minimum ratio**: At least 40% growth clusters / 60% strength clusters
- **Every dimension** MUST have at least 1 growth cluster with recommendation
- Users learn more from what to improve than from what they already do well
- Focus on "what could be better" rather than "what is already good"
- If you find only strengths, dig deeper - everyone has growth areas

IMPORTANT: If you are tempted to generate more strength clusters than growth clusters,
reverse your thinking. What weaknesses might explain those strengths being necessary?
What adjacent skills are underdeveloped?

## Systematic Growth Detection (THREE MECHANISMS)

### Mechanism 1: Strength-Inferred Gaps
When you detect a strength, CHECK FOR ADJACENT SKILL GAPS:

| Detected Strength | Check For | Rationale |
|-------------------|-----------|-----------|
| Strong task delegation | Verification habit | Delegators may skip checking AI work |
| Strong parallel workflows | Context awareness | Multiple threads can fragment context |
| Strong expert persona usage | Deep learning | Over-reliance on AI expertise |
| Fast execution speed | Upfront planning | Speed-focused may skip planning |
| Strong iterative refinement | Goal clarity | Many iterations may mean unclear goals |
| Strong verification | Appropriate trust | Over-verification slows simple tasks |
| Detailed prompting | AI creativity space | Over-specification limits AI |
| Concise communication | Context richness | Brief prompts may miss key context |

For each strength found, ask: "What adjacent skill might be underdeveloped?"

### Mechanism 2: Behavioral Contrast (Best Practice Comparison)
For each pattern in expert_knowledge.actionable_patterns where practiced=false:
- This IS a growth area (expert advice NOT being followed)
- Use the pattern's if_missing feedback in your analysis
- CRITICAL: Cite the source (e.g., "According to Anthropic's best practices...")
- Include this in your actionablePatternMatches with practiced=false

### Mechanism 3: Absence-Based Growth Detection (MOST RELIABLE)
Detect ABSENCE of expected patterns. This is the most reliable growth detection because
absence is definitive - if a pattern never appears, it's definitely a growth area.

**Check for these patterns. If ABSENT, report as absenceBasedGrowthSignal:**

| Pattern ID | Detection Method | If Absent → Growth Area |
|------------|------------------|-------------------------|
| plan_usage | No "/plan" in ANY session | "Planning Habit Development" |
| compact_usage | No "/compact" with session >50 turns | "Context Window Management" |
| verification_questions | No "are you sure", "is that right", "let me check" | "AI Output Verification Habit" |
| task_decomposition | No numbered steps, "first...then", bullet points | "Scope Management" |
| why_questions | No "why", "how does this work", "explain" | "Deep Learning Habit" |
| approach_change | No "different approach", "let's try", "instead of" | "Adaptive Problem-Solving" |
| fresh_start | No "starting fresh", "new session", context summary | "Session Hygiene" |

For EACH pattern checked, report to absenceBasedGrowthSignals:
- patternId: the pattern identifier
- dimension: which dimension this relates to
- wasAbsent: true if pattern NOT found, false if found
- sessionsChecked: how many sessions you analyzed
- growthTitle: human-readable title (from table above)
- growthDescription: detailed explanation of why this matters
- recommendation: specific action to take
- source: "Expected Pattern Analysis"

For EACH dimension, include cluster themes as flattened string arrays:
- strengthClusterThemes: ["clusterId:theme", ...] (e.g., ["aiControl_s_1:Verification Request Habit"])
- growthClusterThemes: ["clusterId:theme", ...] (e.g., ["aiControl_g_1:Passive Acceptance Pattern"])
- clusterId must match the clusterIds assigned to quotes
- theme describes what the cluster represents (will be used for section titles)
- REMEMBER: Every dimension needs at least 1 growthClusterTheme

**Anti-Pattern Detection** (target: 0-3 patterns, Premium/Enterprise)
Detect inefficient AI collaboration patterns (frame as "growth opportunity", NOT criticism):
- sunk_cost_loop: Same error + same/similar approach repeated 3+ times
  * Examples: "try again", "do it again", "fix it again", "one more time"
  * Look for: repeated prompts after identical errors, no change in approach
- emotional_escalation: Frustration affecting prompts
  * Examples: "ugh", "come on", "seriously?", expressions of anger/frustration
  * Look for: emotional language after AI errors, tone degradation
- blind_retry: Retry without analysis or approach change
  * Examples: "fix it", "run again", "try again" without error analysis
  * Look for: retry requests without mentioning what to change
- passive_acceptance: Accepting AI output without verification
  * Look for: no verification questions, no testing, immediate use of AI code

**Critical Thinking Detection** (target: 3-8 moments, Premium/Enterprise)
Detect verification and questioning behaviors (celebrate these as strengths):
- verification_request: Verifying AI output before accepting
  * Examples: "are you sure?", "is that correct?", "let me check", "really?"
  * Look for: questions about correctness, running tests, checking results
- output_validation: Actually testing or validating AI suggestions
  * Look for: mentions of running tests, checking output, verifying behavior
- assumption_questioning: Challenging AI's assumptions or decisions
  * Examples: "why this approach?", "is this the best way?", "why not X instead?"
  * Look for: questions about the reasoning behind AI suggestions
- alternative_exploration: Asking for different approaches
  * Examples: "what about...", "instead of...", "any alternatives?", "other options?"
  * Look for: requests for alternatives, comparison of options
- security_check: Checking for security, performance, or side effects
  * Examples: "any security issues?", "performance concerns?", "side effects?"
  * Look for: questions about security, performance, or unintended consequences

**Planning Behavior Detection** (target: 2-5 behaviors, Premium/Enterprise)
Detect strategic thinking before implementation:
- slash_plan_usage: /plan command usage (HIGHEST SIGNAL)
  * Detection: Message starts with "/plan"
  * MUST analyze: Count steps in plan, check for problem decomposition
  * Record: planContent (summary), problemDecomposition (boolean), stepsCount (number)
- structure_first: Planning before implementation
  * Examples: "let's look at the overall structure first", "design first", "let's plan first"
  * Look for: architectural thinking before coding
- task_decomposition: Breaking complex tasks into steps
  * Examples: "step by step", numbered lists, bullet points, "first... then..."
  * Look for: explicit task breakdown
- todowrite_usage: Using TodoWrite tool
  * Look for: TodoWrite tool calls, task list management
- stepwise_approach: Sequential, methodical approach
  * Examples: "1. First... 2. Then...", ordered execution
  * Look for: numbered steps, sequential thinking

**Planning Quality Assessment:**
- /plan usage + 3+ steps with decomposition → 'expert'
- /plan usage + simple plan → 'structured'
- TodoWrite usage only → 'emerging'
- No planning, direct implementation → 'reactive'

**B: Personalized Priority Analysis** (CRITICAL - actionable top 3)
After analyzing all quotes and clusters, determine the TOP 3 PRIORITIES for THIS developer:

1. **Score each insight area** using these factors:
   - Frequency (0.25): How often does this pattern appear?
   - Impact (0.30): How much would improvement help their work?
   - Growth Potential (0.25): Gap between current level and optimal?
   - Context Relevance (0.20): Alignment with their recent work patterns?

2. **Calculate priorityScore** (0-100) for each potential focus area:
   - High frequency + High impact = Higher score
   - Low current skill + High potential = Good candidate
   - Recent sessions weighted more heavily

3. **Select Top 3** based on combined score and write:
   - focusArea: Specific behavior to focus on (max 100 chars)
   - rationale: Why this matters for THIS developer (max 300 chars)
   - expectedImpact: What improvement they'll see (max 200 chars)
   - relatedClusterIds: Which clusters support this priority

4. **Write selectionRationale** (max 500 chars):
   - Explain how these 3 priorities were selected
   - Reference specific evidence from their sessions
   - Connect to their work context and goals

Example output:
{
  "topPriorities": [
    {
      "rank": 1,
      "dimension": "aiControl",
      "focusArea": "Strengthen AI output verification habit",
      "rationale": "In 11 of 14 sessions, AI output was accepted without verification. Especially prominent in complex decision situations.",
      "expectedImpact": "Improved early bug detection, better code quality",
      "priorityScore": 87,
      "relatedClusterIds": ["aiControl_g_1", "aiControl_g_2"]
    }
  ],
  "selectionRationale": "The pattern of skipping verification steps under time pressure was most frequently observed..."
}

**Type Classification**
- primaryType: architect | scientist | collaborator | speedrunner | craftsman
- controlLevel: explorer | navigator | cartographer
- distribution: Percentages across all 5 types (must sum to 100)

# Context

${buildExpertKnowledgeContext()}

# Format

Return StructuredAnalysisData with FLATTENED structure:
- typeAnalysis: Classification with reasoning
- extractedQuotes: Array of quotes with INLINE context and insight fields (MINIMUM 25, target 40-100)
  * Each quote MUST include: dimension, signal, behavioralMarker, confidence, clusterId
  * FLATTENED context: contextSituationType?, contextTrigger?, contextOutcome? (inline, not nested)
  * FLATTENED insight: insightRootCause?, insightImplication?, insightGrowthSignal? (inline, not nested)
- detectedPatterns: Array of patterns (MINIMUM 5, target 8-15)
- actionablePatternMatches: Array of { patternId, practiced: boolean, evidence: string[], feedback: string }
- detectedAntiPatterns: Array of { patternId, patternType, frequency, examples, severity, triggerContext }
- criticalThinkingMoments: Array of { moment, type, result, dimension, confidence }
- planningBehaviors: Array with FLATTENED fields:
  * behavior, behaviorType, frequency, effectiveness
  * examples: semicolon-separated string (not array)
  * planContentSummary?, planHasDecomposition?, planStepsCount? (inline, not nested planDetails)
- absenceBasedGrowthSignals: Array of { patternId, dimension, wasAbsent, sessionsChecked, growthTitle, growthDescription, recommendation, source }
  * Report ALL expected patterns checked (both absent AND present)
  * wasAbsent=true for patterns NOT found (these are growth areas)
  * wasAbsent=false for patterns that WERE found (these are strengths)
- personalizedPriorities: FLATTENED structure:
  * priority1Dimension, priority1FocusArea, priority1Rationale, priority1ExpectedImpact, priority1Score, priority1ClusterIds
  * priority2Dimension, priority2FocusArea, ... (same pattern)
  * priority3Dimension, priority3FocusArea, ... (same pattern)
  * selectionRationale: string
- dimensionSignals: EXACTLY 6 objects, each with:
  * dimension, strengthSignals: string[], growthSignals: string[]
  * strengthClusterThemes: string[] (format: "clusterId:theme")
  * growthClusterThemes: string[] (format: "clusterId:theme")
- analysisMetadata: Summary statistics and confidence

**Critical Rules:**
- Do NOT write engaging prose or narrative
- Do NOT summarize quotes - use exact text
- DO be exhaustive - MORE DATA IS BETTER for premium value
- DO assign confidence scores honestly
- ALWAYS include at least 25 extractedQuotes (target 40-100)
- ALWAYS include at least 5 detectedPatterns (target 8-15)
- ALWAYS include actionablePatternMatches for EVERY pattern in actionable_patterns
- ALWAYS include exactly 6 dimensionSignals

**IMPORTANT - Anti-Pattern Tone:**
- Frame ALL anti-patterns as "growth opportunities", NEVER as criticisms
- Use supportive language: "You could explore..." NOT "You failed to..."
- Acknowledge that anti-patterns are common learning stages
- Suggest specific improvements rather than just highlighting problems

**IMPORTANT - Multi-Language Input Support:**

The developer's session data may contain non-English text (Korean, Japanese, Chinese, or other languages).

**Analysis Requirements:**
- Detect patterns and behaviors by MEANING and INTENT, not by specific English keywords
- Understand frustration, verification, planning regardless of the language used
- Technical terms are often in English even within non-English sentences - this is normal
- The examples in this prompt are in English, but apply the same detection logic to ANY language

**Quote Handling:**
- Extract quotes in their ORIGINAL language - do NOT translate
- Preserve exact text including any English technical terms mixed in
- If the user wrote in Korean/Japanese/Chinese, extract the quote exactly as written

**Intent Detection (detect equivalent meaning in any language):**
- Frustration signals: expressions of annoyance, anger, confusion (any language)
- Verification signals: questions about correctness, confirmation requests (any language)
- Planning signals: phrases about preparing, organizing, sequencing tasks (any language)
- Debugging signals: expressions about fixing, troubleshooting, investigating (any language)
- Retry signals: expressions meaning "try again", "one more time", "fix it" (any language)

**Slash Commands:**
- /plan, /compact, /clear are language-independent (literal slash commands)
- Detect these regardless of surrounding text language

${NO_HEDGING_DIRECTIVE}`;

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

1. **Quotes** (40-100+ total for comprehensive premium analysis)
   - Every personality-revealing statement
   - Tag with dimension, signal type, confidence, clusterId
   - FLATTENED context fields: contextSituationType, contextTrigger?, contextOutcome?
   - FLATTENED insight fields: insightRootCause?, insightImplication?, insightGrowthSignal?

2. **Quote Clustering** (CRITICAL)
   - Group similar quotes into thematic clusters (2-5 per dimension×signal)
   - Assign unique clusterId to each quote
   - Define clusters in dimensionSignals via strengthClusterThemes and growthClusterThemes arrays
   - Format: "clusterId:theme" strings (e.g., ["aiCollaboration_s_1:Expert Persona Usage"])

3. **Patterns** (8-15 patterns)
   - Recurring behaviors across sessions
   - Count frequency and provide 3-6 examples each

4. **Dimension Signals** (6 dimensions, GROWTH PRIORITY)
   - All strength and growth signals per dimension
   - Include strengthClusterThemes: string[] and growthClusterThemes: string[]
   - Format each as "clusterId:theme" (e.g., "aiControl_s_1:Verification Habit")
   - **CRITICAL**: Each dimension MUST have at least 1 growthClusterTheme
   - Target: 40% growth / 60% strength clusters minimum

5. **Type Classification**
   - Primary type with evidence
   - Control level assessment
   - Distribution percentages

6. **Anti-Patterns** (0-3 patterns)
   - Look for: sunk_cost_loop, emotional_escalation, blind_retry, passive_acceptance
   - Frame as growth opportunities, not criticisms
   - Include triggerContext (what situation caused this)

7. **Critical Thinking Moments** (3-8 moments)
   - Look for: verification_request, output_validation, assumption_questioning, alternative_exploration, security_check
   - Celebrate these as strengths
   - Note what result the critical thinking led to

8. **Planning Behaviors** (2-5 behaviors)
   - Look for: slash_plan_usage (HIGHEST PRIORITY), structure_first, task_decomposition, todowrite_usage
   - For /plan usage: MUST include FLATTENED fields: planContentSummary, planHasDecomposition, planStepsCount
   - Assess effectiveness
   - FLATTENED: examples is a semicolon-separated string, not an array

9. **Personalized Priorities** (CRITICAL - Top 3, FLATTENED)
   - Calculate priority score using: frequency (0.25), impact (0.30), potential (0.25), relevance (0.20)
   - FLATTENED format: Use priority1*, priority2*, priority3* fields instead of topPriorities array:
     * priority1Dimension, priority1FocusArea, priority1Rationale, priority1ExpectedImpact, priority1Score, priority1ClusterIds
     * priority2Dimension, priority2FocusArea, ... (same pattern)
     * priority3Dimension, priority3FocusArea, ... (same pattern)
   - priority*ClusterIds: comma-separated string (e.g., "aiControl_g_1,aiControl_g_2")
   - selectionRationale: explain how these 3 priorities were selected

10. **Absence-Based Growth Signals** (SYSTEMATIC DETECTION)
   - Check for ABSENCE of each expected pattern:
     * plan_usage: Look for "/plan" in any session
     * compact_usage: Look for "/compact" especially in long sessions
     * verification_questions: Look for "are you sure", "is that right", "let me check"
     * task_decomposition: Look for numbered steps, "first...then", explicit task breakdown
     * why_questions: Look for "why", "how does this work", "explain"
     * approach_change: Look for "different approach", "let's try", "instead of"
     * fresh_start: Look for "starting fresh", "new session", context summaries
   - For EACH pattern (found OR absent), output to absenceBasedGrowthSignals:
     * patternId, dimension, wasAbsent (true if NOT found), sessionsChecked
     * growthTitle, growthDescription, recommendation, source
   - This provides SYSTEMATIC growth detection beyond LLM judgment

Return StructuredAnalysisData. Be EXHAUSTIVE.`;
}
