# Cross-Session Anti-Pattern Detection: Practical Examples

This document provides realistic examples of how cross-session anti-pattern detection works in practice.

## Example 1: blind_approval Pattern

### The Pattern Across Sessions

```
Session 3:
  Developer: "Looks good, ship it"
  Context: Database migration from PostgreSQL to MySQL

Session 7:
  Developer: "Go ahead with the refactor"
  Context: Restructuring authentication API, no questions asked

Session 12:
  Developer: "Sounds right, let's merge this"
  Context: Performance optimization in critical path, no review of impact

Session 15:
  Developer: "Approve and deploy"
  Context: Security middleware changes, high-risk component
```

### LLM Analysis Output

```json
{
  "criticalAntiPatterns": "blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it' when discussing database migration",
  
  "topInsights": [
    "CRITICAL: Blind approval pattern appears in Sessions 3, 7, 12, 15 (4 sessions). You consistently say **'looks good, ship it'** when major changes are proposed - from database migrations to security middleware - without asking clarifying questions. This risks technical debt and architectural problems because critical decisions aren't evaluated for consequences. For major changes, ask at least one question about implications: 'What's the test coverage?' or 'How does this affect our API contract?'",
    
    "Try this: Create a 30-second checkpoint before approving major changes. Ask yourself: Do I understand (1) what changed, (2) why it changed, (3) what could break? If you can't answer all three, ask the AI those questions instead of approving.",
    
    "STRENGTH: You show excellent systematic error analysis in Sessions 2, 5, 9. You read error messages carefully before trying fixes. Apply that same 'understand first' principle to architectural decisions."
  ],
  
  "sessionCrossReferences": "blind_approval|'looks good, ship it'|'go ahead with the refactor'|'sounds right, let's merge this'|'approve and deploy'",
  
  "patternDensity": 42,
  "crossSessionConsistency": 0.87,
  
  "recommendedInterventions": [
    "For any change affecting 3+ files, database schema, or auth/security: Add a mandatory clarifying question before approval",
    "Create a mental checklist: (1) Understand what, (2) Understand why, (3) Identify risks. Don't skip to approval until all three are complete"
  ]
}
```

### Why This Matters

- **Across 4 different sessions**: Shows this is default behavior, not situational
- **All major changes**: Database, auth, security, API - shows pattern applies to critical decisions
- **High consistency**: 0.87 confidence = This is a real, recurring tendency
- **Concrete risk**: Unreviewed changes compound over time as technical debt

---

## Example 2: sunk_cost_loop Pattern

### The Pattern Across Sessions

```
Session 2:
  Error: "npm ERR! code ENOENT"
  Developer: "let me try npm install again"
  [fails]
  Developer: "maybe if we clear node_modules"
  [still fails]
  Duration: 15+ minutes on same issue

Session 8:
  Different project, similar npm issue
  Error: "npm ERR! code ERESOLVE"
  Developer: "let me try again with different flags"
  [fails multiple times]
  Duration: 20+ minutes

Session 14:
  Same npm resolution error
  Developer: "npm install not working again, let me try one more time"
  [fails]
  Developer: "let me try --legacy-peer-deps"
  [works]
  Duration: 25+ minutes to resolution
```

### LLM Analysis Output

```json
{
  "criticalAntiPatterns": "sunk_cost_loop|CRITICAL|3|session_2,session_8,session_14|Moderate|npm install failing repeatedly with retry attempts that don't modify approach",
  
  "topInsights": [
    "CRITICAL: Sunk cost loop pattern appears in Sessions 2, 8, 14. When npm install fails, you say **'let me try again'** multiple times without investigating the actual error. In Session 2: retried 3 times over 15 minutes before exploring root cause. This pattern wastes significant time and blocks feature work. Instead: When a command fails, read the error message carefully - it usually tells you exactly what to try differently.",
    
    "Try this: Before retrying any failed command, write down your hypothesis about what will be different. 'I'll try --legacy-peer-deps because the error mentions peer dependency conflicts.' Not just 'let me try again.' This forces understanding before action.",
    
    "STRENGTH: In Sessions 5, 9, 11, when debugging code errors, you ask clarifying questions: 'what does this error mean?' and 'let me check the stack trace.' You have excellent debugging discipline for code problems - apply that same error-reading approach to build/npm errors."
  ],
  
  "sessionCrossReferences": "sunk_cost_loop|'let me try npm install again'|'maybe if we clear node_modules'|'let me try with different flags'|'npm install not working again, let me try one more time'",
  
  "patternDensity": 38,
  "crossSessionConsistency": 0.81,
  
  "recommendedInterventions": [
    "When any command fails: (1) Read the full error message, (2) Identify the specific error code/keyword, (3) Google that error + your context. Don't retry until you know what you're changing.",
    "Create a personal 'npm troubleshooting tree': error ENOENT → x, error ERESOLVE → y, etc. Reference it instead of random retries."
  ]
}
```

### Why This Matters

- **Appears in 3 sessions**: Consistent pattern, not one-time frustration
- **Hours wasted**: Sessions 2, 8, 14 show 15-25 minutes each on same issue type
- **Growth opportunity**: Developer has excellent debugging skills for code, but applies different standard to build errors
- **Easy to fix**: Once they understand error messages, this pattern disappears quickly

---

## Example 3: passive_acceptance Pattern

### The Pattern Across Sessions

```
Session 1:
  AI: "You should use middleware here"
  Developer: Implements suggestion immediately
  (no questions about why, when, or alternatives)

Session 4:
  AI: "Refactor this function into smaller pieces"
  Developer: Accepts refactoring suggestion
  (no testing, no questions about API stability)

Session 6:
  AI: "Add caching at the database level"
  Developer: Implements exactly as suggested
  (doesn't ask about cache invalidation strategy)

Session 10:
  AI: "Use a singleton for configuration"
  Developer: Deploys the pattern
  (doesn't ask about testing implications for single instances)

Session 18:
  AI: "Index this column for performance"
  Developer: Applies migration
  (doesn't ask about disk space impact or whether index is actually needed)
```

### LLM Analysis Output

```json
{
  "warningAntiPatterns": "passive_acceptance|WARNING|5|session_1,session_4,session_6,session_10,session_18|High|Consistently implementing first AI suggestion without asking alternatives or testing implications",
  
  "topInsights": [
    "WARNING: Passive acceptance pattern in Sessions 1, 4, 6, 10, 18 (5 sessions). You implement AI suggestions without asking 'why', 'what are alternatives', or 'what could break?' In Session 6: accepted caching strategy without asking about cache invalidation. In Session 10: deployed singleton pattern without discussing test implications. You're following a recipe without understanding ingredients. This leads to suboptimal solutions and missed learning.",
    
    "Try this: Before implementing ANY suggestion, ask three questions: (1) Why this approach vs. alternatives? (2) What assumptions does it make? (3) What could break? You're smart enough to evaluate - use that skill.",
    
    "OPPORTUNITY: You show good testing instincts in Sessions 3, 7, 11 - you proactively ask 'should we write tests?' in those sessions. Use that same 'test-first thinking' when evaluating architectural suggestions."
  ],
  
  "patternDensity": 35,
  "crossSessionConsistency": 0.79,
  
  "recommendedInterventions": [
    "Create a habit: For any suggestion affecting architecture or data, ask 'What could go wrong with this approach?' and 'What would happen if...?'",
    "Engage your testing instinct earlier: Don't just test after implementation - think about testability BEFORE accepting a suggestion"
  ]
}
```

### Why This Matters

- **5 different sessions**: Shows it's default collaboration style, not situational
- **Pattern of first-suggestion acceptance**: No exploration of alternatives
- **Positive counterexample exists**: They have good testing instincts in other sessions
- **Growth potential**: With small mindset shift, quality of decisions improves significantly

---

## Example 4: blind_retry Pattern

### The Pattern Across Sessions

```
Session 2:
  Command: npm install
  Output: "peer dependencies not satisfied"
  Developer: "let me try npm install again" [same command]
  Output: [same error]
  Developer: "try again" [same command]
  Attempts: 3+ identical attempts

Session 8:
  Command: git push
  Output: "permission denied"
  Developer: "let me try again" [same command, no auth change]
  Output: [same error]
  Developer: "maybe try one more time"
  Attempts: Multiple retries of exact same command

Session 14:
  Command: npm install
  Output: "peer dependencies error"
  Developer: "let me try npm install again"
  [Repeats Session 2 pattern with same error]
  Attempts: 4+ retries before trying --legacy-peer-deps
```

### Key Insight

Blind retry differs from sunk_cost_loop:
- **blind_retry**: Same command, no investigation, hoping for different result
- **sunk_cost_loop**: Extended commitment to failing approach with minor variations

Both appear in Session 2, 8, 14 but blind_retry is the more prominent pattern.

### Why Distinguish?

Different interventions:
- **blind_retry**: Teach error reading and command modification
- **sunk_cost_loop**: Teach root cause analysis before continuing

---

## Example 5: delegation_without_review Pattern

### The Pattern Across Sessions

```
Session 2:
  Developer: "Implement the user authentication system"
  AI: [Generates 400+ lines of auth code]
  Developer: "Great, thanks" [Ships directly to staging]
  (No review, no testing, no security audit)

Session 5:
  Developer: "Fix the database migration"
  AI: [Generates migration script]
  Developer: "Perfect, let's run it" [Executes immediately]
  (No review of SQL, no backup check, no rollback plan)

Session 9:
  Developer: "Add the API endpoint"
  AI: [Generates endpoint handler]
  Developer: "Looks good, merged" [Commits immediately]
  (No local testing, no integration testing)

Session 16:
  Developer: "Set up the deployment pipeline"
  AI: [Generates configuration]
  Developer: "Ship it" [Deploys to production]
  (No staging validation, no dry-run)
```

### LLM Analysis Output

```json
{
  "infoAntiPatterns": "delegation_without_review|INFO|4|session_2,session_5,session_9,session_16|High|Consistently shipping AI-generated code/config without verification or testing",
  
  "topInsights": [
    "INFO: Delegation without review pattern in Sessions 2, 5, 9, 16. You consistently say **'looks good'** and ship AI output directly without testing, code review, or validation. In Session 5: ran database migration without reviewing SQL. In Session 16: deployed production configuration without staging validation. You're diffusing responsibility - code needs YOUR verification before production.",
    
    "Try this: Create a simple checkpoint: (1) I've read and understand the entire change, (2) I've tested it in a non-production environment, (3) I could explain it to my team. If all three are true, ship. If not, review and ask questions.",
    
    "GROWTH: In Sessions 3, 7, 11, you DO review changes and ask questions like 'will this affect existing users?' - you have good instincts about impact analysis. Apply that same rigor to all AI-generated code."
  ],
  
  "patternDensity": 28,
  "crossSessionConsistency": 0.82,
  
  "recommendedInterventions": [
    "For production changes: Mandatory local test + staging validation before any production deployment",
    "For code changes: Read the diff and make sure you could explain the logic to someone else"
  ]
}
```

### Why This Matters

- **Appears in 4 sessions**: Consistent pattern of shipping without verification
- **Varies by component**: Auth, database, API, deployment - shows pattern applies across all areas
- **Positive counter-example exists**: They HAVE good review instincts in other sessions
- **Clear risk**: Unreviewed code leads to bugs, security issues, and debugging nightmares later

---

## Scoring Example

### Developer A Profile

```json
{
  "patternDensity": 68,
  "crossSessionConsistency": 0.89,
  "interpretations": "High density + High consistency = SIGNIFICANT BEHAVIORAL ISSUES"
}
```

- **Pattern Density 68**: Falls in "61-80: High density" range
- **Consistency 0.89**: Very high confidence these are real patterns
- **Implications**: Multiple anti-patterns show up repeatedly → needs intervention

### Developer B Profile

```json
{
  "patternDensity": 15,
  "crossSessionConsistency": 0.68,
  "interpretations": "Low density + Moderate consistency = MINIMAL ISSUES, HEALTHY COLLABORATION"
}
```

- **Pattern Density 15**: Falls in "0-20: Minimal patterns" range
- **Consistency 0.68**: Patterns that do appear are somewhat inconsistent
- **Implications**: Excellent collaboration style, occasional situational issues only

---

## Output Format in Practice

### Raw Data Field Example

```
criticalAntiPatterns:
blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it' when discussing database migration;sunk_cost_loop|CRITICAL|3|session_2,session_8,session_14|Moderate|npm install failing repeatedly with retry attempts

warningAntiPatterns:
passive_acceptance|WARNING|5|session_1,session_4,session_6,session_10,session_18|High|Consistently implementing first suggestion without alternatives;blind_retry|WARNING|3|session_2,session_8,session_14|Moderate|Retrying failed commands without understanding errors

infoAntiPatterns:
delegation_without_review|INFO|4|session_2,session_5,session_9,session_16|High|Shipping AI output without verification
```

### Session Cross-References Example

```
sessionCrossReferences:
blind_approval|'looks good, ship it'|'go ahead with refactor'|'sounds right, let's merge'|'approve and deploy';
sunk_cost_loop|'let me try npm install again'|'maybe clear cache'|'let me try different flags'|'npm install one more time';
passive_acceptance|'implement middleware'|'refactor function'|'add caching'|'use singleton'|'index this column'
```

### Strengths Across Sessions Example

```
strengthsAcrossSessions:
Systematic error analysis|Sessions 2,5,9,11|'let me read the error carefully','checking stack trace first','what does the stack trace tell us','let me understand this error';
Proactive testing thinking|Sessions 3,7,11|'should we write tests?','let me add a test first','test coverage looks low';
Collaborative communication|Sessions 1,4,8,12|'does this make sense?','let me understand why','what are my options?','help me think through this'
```

---

## Multi-Language Example: Korean Developer

### Session Data (Korean)

```
Session 3:
  Developer: "좋아 보이는데, 배포해도 될까?" ("Looks good, should we deploy?")
  Context: Database migration discussion

Session 7:
  Developer: "괜찮아 보여, 진행해도 될까?" ("Looks fine, can we proceed?")
  Context: API refactor
```

### LLM Detection

Despite Korean text, LLM detects:
1. **Semantic pattern**: Approval phrases in Korean
2. **Behavioral pattern**: Asking about deployment/proceeding without clarification
3. **Quote preservation**: Extracts Korean text exactly as written

### Output (English Analysis, Korean Evidence)

```
blind_approval|CRITICAL|2|session_3,session_7|Moderate|'좋아 보이는데, 배포해도 될까?' when discussing database migration
```

The system:
- Detects the MEANING of approval (Korean or any language)
- Preserves ORIGINAL language quotes
- Outputs analysis in requested language

---

## False Positive Prevention

### NOT a Pattern (Single Session = Isolated Incident)

```
Session 8:
  Developer: "I'm tired, let me just ship this"
  [Approves without review]
  →  Goes in isolatedIncidents, NOT patterns
```

**Why**: Single occurrence could be situational (tired, deadline pressure, edge case).

### IS a Pattern (Multiple Sessions)

```
Session 3: "ship it" [without review]
Session 7: "ship it" [without review]  
Session 12: "ship it" [without review]
Session 15: "ship it" [without review]
→ Goes in criticalAntiPatterns
```

**Why**: 4 different sessions show consistent behavior regardless of context.

---

## Using Insights for Intervention

### PROBLEM Insight → Identify Issue
```
"Blind approval pattern appears in 4 sessions.
You say 'looks good, ship it' without asking clarifying questions."
```
Developer now SEES the pattern they weren't aware of.

### TRY Insight → Specific Action
```
"For major changes, ask: 'What's the test coverage?' or 'How does this
affect our API contract?' instead of approving."
```
Developer now KNOWS what to do differently.

### KEEP Insight → Reinforce Strength
```
"You show systematic error analysis in other sessions - you read error
messages carefully. Apply that same rigor to architectural decisions."
```
Developer now UNDERSTANDS they have the capability, just applied inconsistently.

---

## Summary

Cross-session anti-pattern detection reveals:
- **Behavioral tendencies** (not one-off incidents)
- **Blind spots** (patterns developers don't see in themselves)
- **Opportunities** (specific, actionable growth areas)

By requiring 2+ session evidence and using direct quotes, it avoids false positives while providing compelling, personalized feedback.
