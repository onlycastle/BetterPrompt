# Cross-Session Anti-Pattern Detection

## Overview

Cross-session anti-pattern detection identifies problematic interaction patterns that **recur across multiple developer-AI collaboration sessions**. This specialized analysis focuses on behavioral tendencies that emerge when analyzing 20-30+ sessions from the same developer.

## Key Principle

**Only patterns appearing in 2+ sessions are behavioral patterns. Single-session occurrences are isolated incidents.**

This threshold is critical because:
- It distinguishes behavioral tendencies from one-off mistakes
- It prevents false positives from unusual or exceptional moments
- It ensures findings represent the developer's typical approach

## Anti-Pattern Hierarchy

### CRITICAL (Highest Risk)

#### 1. blind_approval
Approving/accepting AI suggestions at critical decision points without demonstrating understanding of implications.

**Indicators:**
- "looks good", "sounds right", "go ahead", "ship it" without asking clarifying questions
- Accepting architectural decisions without review
- Approving code changes without understanding what changed
- Delegating security decisions without validation

**Across Sessions:**
- Same type of approval behavior in multiple sessions (architectural, security, performance decisions)
- Pattern shows it's default approach, not situational

**Risk:**
- Technical debt from misunderstood implementations
- Security vulnerabilities not caught
- Architectural problems that compound over time
- Increased maintenance burden later

**Example Pattern Detection:**
```
Session 3: "looks good, ship it" (database migration)
Session 7: "go ahead with the refactor" (API changes)
Session 12: "sounds right, let's merge this" (authentication logic)
Session 15: "approve and deploy" (performance optimization)
→ Pattern appears in 4 sessions = HIGH FREQUENCY
```

#### 2. sunk_cost_loop
Continuing to pursue a failed approach despite clear evidence it's not working.

**Indicators:**
- "let me try again", "maybe if we just...", repeating same fix after failures
- Continuing to debug same issue for extended duration
- Retrying same approach with minor variations
- Escalating commitment to failing solution

**Across Sessions:**
- Same error in different sessions → same attempted fix → same failure
- Persisting with broken approach across multiple sessions
- Pattern shows developer's default response to blockers

**Risk:**
- Hours wasted on unsalvageable approaches
- Momentum lost on feature work
- Blocked from exploring better solutions
- Frustration accumulation

**Example Pattern Detection:**
```
Session 2: "npm install" fails → "let me try again" → fails → "maybe if we clear cache"
Session 8: Different project, same npm issue → "let me try again" → fails
Session 14: "npm install not working, let me try one more time" → fails again
→ Pattern appears in 3 sessions = MODERATE-HIGH FREQUENCY
```

### WARNING (Significant Risk)

#### 3. passive_acceptance
Passively accepting AI suggestions without active evaluation or pushback.

**Indicators:**
- Implementing suggestions without testing
- Not asking "why" or for clarifications
- Few clarifying questions or alternative explorations
- Taking suggestions as gospel without validation

**Across Sessions:**
- Consistent pattern of accepting first suggestion
- Rarely asking for alternatives or modifications
- Pattern shows limited critical thinking in collaboration

**Risk:**
- Suboptimal solutions that work but aren't best
- Missed learning opportunities
- Cargo cult programming (doing things without understanding why)
- Technical decisions made by default, not design

#### 4. blind_retry
Retrying commands/approaches without understanding what failed or modifying approach.

**Indicators:**
- "try again", "run it again", same command repeated with no changes
- Repeating failed command multiple times
- No investigation between attempts
- Hoping for different results from same input

**Across Sessions:**
- Same class of command retried in different projects (npm, git, build commands)
- Pattern shows lack of debugging approach

**Risk:**
- Time wasted on futile attempts
- Reinforces magical thinking about code
- Prevents learning debugging skills
- Frustration from repeated failures

### INFO (Lower Risk)

#### 5. delegation_without_review
Delegating tasks to AI without reviewing results before using them.

**Indicators:**
- "implement this", "fix it" without follow-up review questions
- Accepting code without inspection
- Deploying AI-generated code without testing
- Taking AI output directly to production

**Across Sessions:**
- Pattern of accepting AI output without verification
- Shows diffusion of responsibility

**Risk:**
- Bugs slip through to production
- Knowledge gaps persist (outsourced thinking)
- Responsibility unclear
- Quality degradation over time

## Prompt Design: PTCF Framework

The prompts follow the **PTCF (Persona, Task, Context, Format)** framework:

### 1. **Persona**
> You are an experienced software engineering coach who recognizes recurring behavioral patterns that developers often don't see in themselves. Your expertise is in spotting habits that emerge across multiple sessions.

### 2. **Task**
Analyze 30 Claude coding sessions to identify cross-session behavioral anti-patterns:
- Identify patterns appearing in 2+ sessions only
- Trace patterns across session boundaries
- Map behavioral tendencies, not isolated incidents

### 3. **Context**
- Developer provides ~30 sessions from their project work
- Each session shows collaboration style, problem-solving approach, error handling
- Module A analysis provides structured behavioral data
- Multi-language support (sessions may contain Korean, Japanese, Chinese)

### 4. **Format**
Return structured JSON with:
- Anti-patterns organized by severity level
- Session cross-references proving the pattern is recurring
- Direct quotes as evidence
- Behavioral insights (Problem/Try/Keep structure)
- Scoring metrics (pattern density, consistency)

## Prompt Implementation

### System Prompt Structure

```typescript
export const CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT = `
## PERSONA
[Expert behavioral analyst persona]

## CORE PRINCIPLE
Only patterns appearing in 2+ sessions are behavioral patterns...

## TASK
Analyze sessions to identify cross-session anti-patterns...

## CRITICAL ANTI-PATTERNS
1. blind_approval - detailed description
2. sunk_cost_loop - detailed description
3. passive_acceptance - detailed description
4. blind_retry - detailed description
5. delegation_without_review - detailed description

## MULTI-LANGUAGE INPUT SUPPORT
[Language detection and quote preservation]

## FORMAT
Return JSON with:
- criticalAntiPatterns: pattern data with session IDs
- warningAntiPatterns: pattern data with session IDs
- infoAntiPatterns: pattern data with session IDs
- isolatedIncidents: single-session occurrences
- topInsights: 3 Problem/Try/Keep insights
- patternDensity: 0-100 score
- crossSessionConsistency: 0-1 confidence
- recommendedInterventions: 1-3 suggestions
- sessionCrossReferences: pattern tracking across sessions
- strengthsAcrossSessions: positive behavioral patterns
`
```

### User Prompt Template

```typescript
export function buildCrossSessionAntiPatternUserPrompt(
  sessionCount: number,
  sessionsFormatted: string,
  moduleAOutput: string,
  outputLanguage: SupportedLanguage = 'en'
): string {
  return `
## DEVELOPER SESSION CORPUS
**Dataset**: ${sessionCount} Claude coding sessions from the same developer
**Analysis Goal**: Identify behavioral anti-patterns that repeat across 2+ sessions

## SESSION DATA
${sessionsFormatted}

## MODULE A ANALYSIS
${moduleAOutput}

## ANALYSIS INSTRUCTIONS
1. Cross-Session Pattern Detection: Examine all ${sessionCount} sessions
2. Minimum Threshold: Only report patterns in 2+ sessions
3. Session Tracking: List which sessions demonstrate pattern
4. Evidence Collection: Support with actual developer quotes
5. Anti-Pattern Hierarchy: Prioritize CRITICAL patterns
6. Isolation Check: Distinguish patterns from one-off incidents
  `;
}
```

## Output Format Specification

### Anti-Pattern Data String Format

Each anti-pattern type uses semicolon-separated entries:

```
pattern_name|severity|sessions_count|session_ids|frequency|evidence;
pattern_name|severity|sessions_count|session_ids|frequency|evidence
```

**Example:**
```
blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it' when discussing database migration
sunk_cost_loop|CRITICAL|3|session_2,session_8,session_14|Moderate|npm install repeated 3+ times with same failure
passive_acceptance|WARNING|5|session_1,session_4,session_6,session_10,session_18|High|Implementing first suggestion without asking alternatives
```

### Session Cross-References Format

Track the pattern across specific sessions with actual quotes:

```
pattern_name|session_1_quote|session_2_quote|session_3_quote;
```

**Example:**
```
blind_approval|'looks good, ship it'|'go ahead with refactor'|'approve and deploy';
sunk_cost_loop|'npm install, let me try again'|'maybe clear cache'|'one more time with different flags'
```

### Strengths Across Sessions Format

Identify positive recurring patterns:

```
positive_behavior|sessions_shown|example_quotes;
```

**Example:**
```
Systematic error analysis|Sessions 2,5,9|'let me read the error carefully','checking stack trace first','what does the stack trace tell us';
Proactive testing|Sessions 3,7,11|'let me write a test for this','testing before shipping','what are edge cases'
```

### topInsights Array (Exactly 3 Elements)

Each insight follows Problem/Try/Keep structure:

**Index 0 - PROBLEM:**
```
"CRITICAL: Blind approval pattern appears in 4 sessions (Sessions 3,7,12,15).
You said **'looks good, ship it'** multiple times when approving major changes
like database migrations and API refactors. This risks technical debt and
architectural issues because critical decisions aren't being evaluated for
implications. Consider: for any change marked as 'major', ask at least
one clarifying question about consequences before approving."
```

**Index 1 - TRY:**
```
"Try this: Before saying 'looks good' or 'let's ship it', ask one specific
question about implications - architecture, performance, testing, or security.
For example: 'What's the testing strategy for this?' or 'Does this affect the
API contract?' You'll start catching issues and learning more deeply."
```

**Index 2 - KEEP or PROBLEM:**
```
"Keep this: You show systematic error analysis across sessions 2,5,9 - you
consistently read error messages carefully before trying fixes. That
foundations-first approach is excellent and prevents blind retries. Apply
the same rigor to architectural decisions as you do debugging."
```

## Implementation Example

### Complete Flow

```typescript
import { buildCrossSessionAntiPatternUserPrompt } from './cross-session-anti-pattern-prompts';

// 1. Format 30 sessions
const sessionsFormatted = formatSessionsForAnalysis(sessions, {
  maxContentLength: 1500,
  includeAssistantMessages: true,
  includeToolCalls: true,
});

// 2. Get Module A analysis
const moduleAOutput = previousAnalysisResult;

// 3. Build prompts
const systemPrompt = CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT;
const userPrompt = buildCrossSessionAntiPatternUserPrompt(
  30,
  sessionsFormatted,
  JSON.stringify(moduleAOutput),
  'en'
);

// 4. Call Gemini API with structured output
const result = await geminiClient.generateStructured({
  systemPrompt,
  userPrompt,
  responseSchema: CrossSessionAntiPatternSchema,
  maxOutputTokens: 12288,
});

// 5. Process results
const findings = result.data;
// findings.criticalAntiPatterns - patterns that appear 2+ times
// findings.topInsights - Problem/Try/Keep recommendations
// findings.patternDensity - overall behavioral pattern score
// findings.recommendedInterventions - specific actions to improve
```

## Scoring Metrics

### Pattern Density (0-100)

Score reflecting how many anti-patterns exist across the session corpus:

- **0-20**: Minimal patterns (healthy collaboration)
- **21-40**: Some patterns (occasional issues)
- **41-60**: Moderate patterns (several areas for improvement)
- **61-80**: High density patterns (significant behavioral issues)
- **81-100**: Critical density (pervasive problematic patterns)

### Cross-Session Consistency (0-1)

Confidence that identified patterns are truly recurring behaviors, not random variations:

- **0.0-0.3**: Low confidence (patterns may be situational)
- **0.3-0.6**: Moderate confidence (patterns appear consistently)
- **0.6-0.8**: High confidence (clear recurring patterns)
- **0.8-1.0**: Very high confidence (pervasive, unmistakable patterns)

## Multi-Language Support

The prompts support analysis of sessions in any language while maintaining English technical terminology:

### Quote Extraction
- Extract evidence in ORIGINAL language (preserve Korean, Japanese, Chinese text)
- Do NOT translate quotes
- Technical terms often remain in English (this is normal)

### Output Language
- Can generate insights in target language (en, ko, ja, zh)
- All anti-pattern names remain in English
- Descriptions and recommendations can be localized

### Pattern Detection
- Detect behavioral patterns by MEANING, not by English keywords
- "approval" concepts work in any language
- "retry" patterns recognizable in any language context

## Implementation Notes

### Key Differences from Single-Session Analysis

| Aspect | Single-Session | Cross-Session |
|--------|---|---|
| **Threshold** | Any occurrence | 2+ sessions minimum |
| **Focus** | Isolated incidents in one session | Behavioral tendencies across sessions |
| **Evidence** | Single quote sufficient | Multiple session examples required |
| **Goal** | Understand one session | Identify developer's default patterns |
| **Scoring** | Session-specific health | Developer's overall collaboration style |

### Critical Rules (Non-Negotiable)

1. **Cross-Session Requirement**: Minimum 2 sessions for pattern. Single session = isolated incident
2. **Session Traceability**: Always cite which sessions show pattern (e.g., "Sessions 3, 7, 12")
3. **Quote Evidence**: Every finding must include actual developer quotes in **bold**
4. **Behavioral Focus**: Analyze what developer DID, not what they think
5. **No Generic Feedback**: Every insight must be specific to this developer's actual sessions
6. **Avoid False Positives**: Only report genuine recurring patterns, not speculation

## File Location

- **Prompts**: `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
- **Types**: `CrossSessionAntiPatternOutput` interface with schema
- **Worker**: Can be implemented as new `CrossSessionAntiPatternWorker` extending `BaseWorker`

## Related Concepts

- **Single-Session Analysis**: `AntiPatternSpotterWorker` - detects patterns within one session
- **Pattern Detective**: `PatternDetectiveWorker` - finds repeated questions and conversation styles
- **Knowledge Gap Analyzer**: Identifies learning gaps from repeated questions
