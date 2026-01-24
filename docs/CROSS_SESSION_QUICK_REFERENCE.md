# Cross-Session Anti-Pattern Detection: Quick Reference

## File Locations

- **Prompts**: `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
- **Full Documentation**: `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md`
- **Practical Examples**: `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`

## Core Principle

**Only patterns appearing in 2+ sessions are behavioral patterns. Single-session occurrences are isolated incidents.**

## Anti-Pattern Quick Reference

| Pattern | Severity | Indicators | Risk | Cross-Session Sign |
|---------|----------|-----------|------|-------------------|
| **blind_approval** | CRITICAL | "looks good", "ship it", approving without questions | Technical debt, security issues | Same approval behavior across multiple sessions |
| **sunk_cost_loop** | CRITICAL | "let me try again", repeating same fix after failures | Hours wasted, momentum blocked | Same error, same failed fix in different sessions |
| **passive_acceptance** | WARNING | Implementing first suggestion without alternatives | Suboptimal solutions, missed learning | Consistently accepting suggestions without evaluation |
| **blind_retry** | WARNING | "try again", same command repeated with no changes | Time wasted, reinforces magical thinking | Same command retried in different projects |
| **delegation_without_review** | INFO | "implement/fix this" without follow-up review | Bugs in production, knowledge gaps | Pattern of accepting AI output without verification |

## Prompt Structure Summary

### System Prompt (`CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT`)

Defines:
- **Persona**: Experienced software engineering coach
- **Task**: Identify 2+ session patterns (not isolated incidents)
- **Anti-patterns**: 5 types with detailed descriptions
- **Multi-language support**: Detect patterns in any language
- **Output format**: Structured JSON with session IDs and quotes

### User Prompt (`buildCrossSessionAntiPatternUserPrompt()`)

Parameters:
- `sessionCount`: Number of sessions (e.g., 30)
- `sessionsFormatted`: Formatted session data
- `moduleAOutput`: Previous analysis results (JSON)
- `outputLanguage`: Target language (en, ko, ja, zh)

Returns: Complete prompt for Gemini API

## Output Schema Overview

```typescript
interface CrossSessionAntiPatternOutput {
  // Semicolon-separated pattern data
  criticalAntiPatterns: string;    // 2+ sessions minimum
  warningAntiPatterns: string;     // 2+ sessions minimum
  infoAntiPatterns: string;        // 2+ sessions minimum
  isolatedIncidents: string;       // Single sessions only

  // Exactly 3 insights (Problem/Try/Keep)
  topInsights: string[];

  // Scoring (0-100 and 0-1)
  patternDensity: number;
  crossSessionConsistency: number;

  // Actionable recommendations
  recommendedInterventions: string[];

  // Cross-session evidence tracking
  sessionCrossReferences: string;
  strengthsAcrossSessions: string;
}
```

## Data Format Examples

### Anti-Pattern Entry
```
pattern_name|severity|sessions_count|session_ids|frequency|evidence
```

Example:
```
blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it' when discussing database migration
```

### Session Cross-Reference
```
pattern_name|quote_session_1|quote_session_2|quote_session_3
```

Example:
```
blind_approval|'looks good, ship it'|'go ahead with refactor'|'sounds right, let's merge'
```

### Strengths Across Sessions
```
positive_behavior|sessions_list|quote1,quote2,quote3
```

Example:
```
Systematic error analysis|Sessions 2,5,9|'let me read carefully','stack trace first','understand the error'
```

## Pattern Density Score Interpretation

| Score | Range | Interpretation |
|-------|-------|-----------------|
| 0-20 | Minimal | Healthy collaboration |
| 21-40 | Some | Occasional issues |
| 41-60 | Moderate | Several areas for improvement |
| 61-80 | High | Significant behavioral issues |
| 81-100 | Critical | Pervasive problematic patterns |

## Cross-Session Consistency Score

| Score | Interpretation |
|-------|-----------------|
| 0.0-0.3 | Low (patterns may be situational) |
| 0.3-0.6 | Moderate (patterns appear consistently) |
| 0.6-0.8 | High (clear recurring patterns) |
| 0.8-1.0 | Very high (pervasive, unmistakable) |

## Multi-Language Support

### Supported Languages
- English (en)
- Korean (ko)
- Japanese (ja)
- Chinese (zh)

### Key Features
- **Quote Preservation**: Extracts evidence in original language (no translation)
- **Pattern Detection**: Detects behavioral patterns by MEANING, not keywords
- **Output Localization**: Can generate insights in target language
- **Technical Terms**: Remain in English (normal and expected)

## Critical Rules (Non-Negotiable)

1. **Minimum 2 sessions** for any pattern (1 session = isolated incident)
2. **Session traceability** in all findings (e.g., "Sessions 3, 7, 12, 15")
3. **Direct quotes** for all evidence (in **bold**)
4. **Behavioral focus** (analyze what they DID, not what they think)
5. **No generic feedback** (specific to this developer's actual sessions)
6. **Avoid false positives** (only genuine recurring patterns)

## topInsights Format (Exactly 3)

### Index 0: PROBLEM Insight
- Identifies highest-priority anti-pattern
- Uses problem-words: "struggles with", "tends to", "pattern of"
- MUST include: pattern name, severity, session count, direct quote, concrete risk

### Index 1: TRY Insight
- Specific, actionable intervention
- Uses suggestion-words: "try", "consider", "could improve"
- MUST include: specific behavioral change, recognition when working, why it matters

### Index 2: KEEP or PROBLEM
- Either a strength to maintain OR secondary anti-pattern
- If KEEP: positive pattern to reinforce
- If PROBLEM: secondary pattern to address
- MUST include: evidence from actual sessions

## Implementation Checklist

- [ ] Import `buildCrossSessionAntiPatternUserPrompt` from prompts module
- [ ] Format 20-30 sessions using `formatSessionsForAnalysis()`
- [ ] Prepare Module A output (structured behavioral data)
- [ ] Call Gemini API with structured output schema
- [ ] Parse results into `CrossSessionAntiPatternOutput`
- [ ] Verify: All patterns appear in 2+ sessions
- [ ] Verify: All quotes have session IDs
- [ ] Verify: topInsights has exactly 3 elements

## When to Use This vs. Single-Session Analysis

### Use Single-Session (`AntiPatternSpotterWorker`)
- Analyzing 1 session in isolation
- Looking for any anti-pattern occurrence
- Understanding one specific session's issues

### Use Cross-Session
- Analyzing 20-30+ sessions
- Identifying behavioral patterns and tendencies
- Understanding developer's default collaboration style
- Distinguishing habits from situational issues
- Providing high-confidence coaching feedback

## Integration with Existing System

### Fits Into Analysis Pipeline
```
Session Data → Module A (Data Analyst) → Cross-Session Detection → Content Writer
```

### Differs from Pattern Detective
- **Pattern Detective**: Finds repeated QUESTIONS and conversation STYLE
- **Cross-Session Anti-Pattern**: Finds problematic BEHAVIORS across sessions

### Builds On Anti-Pattern Spotter
- **Anti-Pattern Spotter**: Single-session pattern detection
- **Cross-Session Anti-Pattern**: Multi-session behavioral patterns (2+ session minimum)

## Example Integration Code

```typescript
import { buildCrossSessionAntiPatternUserPrompt } from './cross-session-anti-pattern-prompts';
import { CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT } from './cross-session-anti-pattern-prompts';

async function analyzeCrossSessionPatterns(
  sessions: Session[],
  moduleAOutput: any
) {
  const systemPrompt = CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT;
  const userPrompt = buildCrossSessionAntiPatternUserPrompt(
    sessions.length,
    formatSessionsForAnalysis(sessions, {
      maxContentLength: 1500,
      includeAssistantMessages: true,
      includeToolCalls: true,
    }),
    JSON.stringify(moduleAOutput),
    'en' // or 'ko', 'ja', 'zh'
  );

  const result = await geminiClient.generateStructured({
    systemPrompt,
    userPrompt,
    responseSchema: CrossSessionAntiPatternSchema,
    maxOutputTokens: 12288,
  });

  return result.data;
}
```

## Troubleshooting

### Issue: No patterns detected (all empty fields)
- Check: Are there genuinely 2+ sessions with same anti-pattern?
- Check: Are sessions substantially different enough to show patterns?
- Check: Is Module A output being analyzed properly?

### Issue: Session IDs missing from results
- Ensure prompt clearly shows which session each quote comes from
- Verify formatter is tagging sessions with IDs
- Check Gemini output schema requirement for sessionCrossReferences

### Issue: Quotes missing or truncated
- Verify input sessionsFormatted preserves exact developer text
- Check max string lengths in output schema
- Ensure Unicode/multi-language quotes handled properly

### Issue: Pattern appears but missing from output
- Verify it appears in 2+ different sessions (not just 2 occurrences in same session)
- Check pattern meets minimum severity requirement for its category
- Ensure quote evidence is clear and attributable

## Performance Notes

- **Optimal session count**: 20-30 sessions
- **Token usage**: ~12K output tokens for comprehensive analysis
- **Latency**: Typical Gemini 3 Flash call completes in 3-5 seconds
- **Cost**: Structured output pricing for JSON schema

## Related Files

- **Workers**: `/src/lib/analyzer/workers/`
  - `anti-pattern-spotter-worker.ts` (single-session)
  - Future: `cross-session-anti-pattern-worker.ts`

- **Models**: `/src/lib/models/`
  - `agent-outputs.ts` - Schema definitions

- **Shared**: `/src/lib/analyzer/shared/`
  - `session-formatter.ts` - Session formatting utilities

