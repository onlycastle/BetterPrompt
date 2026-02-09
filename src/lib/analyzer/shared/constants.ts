/**
 * Shared Constants for Analysis Pipeline
 *
 * Directives and constants used across multiple LLM prompt files.
 */

/**
 * No-hedging directive for confident, direct language in all outputs.
 * This directive is injected into all LLM prompts to ensure definitive assessments.
 */
/**
 * Phase 1 sampling limits.
 *
 * Phase 2 workers consume at most ~400 utterances and ~300 AI responses each.
 * Phase 1 samples to these limits so Phase 2 workers don't need to re-sample.
 */
export const PHASE1_MAX_UTTERANCES = 500;
export const PHASE1_MAX_AI_RESPONSES = 350;

/**
 * Objective analysis directive for balanced strengths/growthAreas output.
 * Prevents LLM "positivity bias" that causes weak or missing growthAreas.
 */
export const OBJECTIVE_ANALYSIS_DIRECTIVE = `
## OBJECTIVE ANALYSIS REQUIREMENT

Analyze developer behavior OBJECTIVELY, not optimistically.

**For STRENGTHS:**
- Identify behaviors that demonstrably improve outcomes
- Base on evidence, not intention

**For GROWTH AREAS:**
- Every developer has room for improvement
- Identify patterns that limit effectiveness
- This is NOT criticism — it's objective assessment for professional growth
- Minimum 1 growth area required (no developer is perfect)

**For High-Scoring Developers (80+ score):**
Growth areas for skilled developers focus on nuanced improvements:
- Advanced techniques they haven't yet explored
- Edge cases where their strong patterns occasionally break down
- Opportunities to evolve good habits into excellent ones
- Preventing complacency in areas where they're already strong
- Next-level skills that separate great from exceptional

**Balanced Assessment Principle:**
A 90/100 score indicates 10% room for growth. Identify what that 10% represents.
A 100/100 score is impossible — even the best developers have areas to improve.
Constructive growth areas help developers continue improving, not criticize their work.

**Balance Rule:**
- Strengths and Growth Areas should be roughly balanced
- If you identify 3 strengths, aim for 2-4 growth areas

**Tone:**
- Professional and direct, not harsh or gentle
- Evidence-based statements
- Actionable recommendations
`;

/**
 * Patterns that identify a `/clear` command in Claude Code sessions.
 * Used to split a single JSONL session into logical segments.
 *
 * Must match against raw message.content (before stripSystemTags)
 * so that the XML-tagged variant is detected.
 */
export const CLEAR_COMMAND_PATTERNS: RegExp[] = [
  /^\/clear\s*$/m,
  /<command-name>\/clear<\/command-name>/,
];

export const NO_HEDGING_DIRECTIVE = `
<language_requirements>
## CRITICAL: Direct, Confident Language

Write with absolute certainty. Your assessments are evidence-based facts, not possibilities.

**BANNED WORDS (never use these):**
- Hedging: "may", "might", "could", "tends to", "seems", "appears", "possibly", "likely", "probably", "potentially"
- Vague frequency: "often", "sometimes", "usually", "typically", "generally"
- Weak qualifiers: "somewhat", "fairly", "rather", "quite", "a bit"

**REQUIRED LANGUAGE:**
- Use definitive verbs: "is", "does", "demonstrates", "shows", "indicates", "reveals", "exhibits"
- Use quantified statements: "in X of Y sessions", "X% of the time", "consistently across N sessions"
- Use direct observations: "You skip verification" NOT "You tend to skip verification"

**EXAMPLES of required corrections:**
- ❌ "You may struggle with X" → ✅ "You struggle with X (observed in 4 of 6 sessions)"
- ❌ "You tend to ask about X" → ✅ "You ask about X repeatedly"
- ❌ "This seems to indicate" → ✅ "This indicates"
- ❌ "You often accept AI output" → ✅ "You accept AI output without verification"
- ❌ "You might benefit from" → ✅ "You will benefit from"

Every finding is a fact derived from evidence. State it as such.
</language_requirements>
`;
