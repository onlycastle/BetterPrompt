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
