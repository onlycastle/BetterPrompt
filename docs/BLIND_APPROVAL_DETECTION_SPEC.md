# Technical Specification: Blind Approval Detection System

## Overview

This document specifies the implementation details for detecting "blind approval without understanding" patterns in the NoMoreAISlop analyzer. These patterns occur when users confirm AI-generated plans without demonstrating comprehension, leading to failed implementations.

## Architecture

### Integration Point

All detectors integrate into the **Data Analyst Stage (Stage 1)** of the two-stage pipeline:

```
JSONL Sessions → Data Analyst → [NEW: Approval Detectors] → Structured Data → Content Writer
```

**Primary file**: `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/stages/data-analyst-prompts.ts`

### Detection Levels

```typescript
enum ApprovalRiskLevel {
  'minimal',    // Normal verification + approval flow
  'medium',     // Some signals of reduced scrutiny
  'high',       // Multiple indicators of blind approval
  'critical',   // Clear evidence of uncomprehended acceptance
}
```

---

## Detector 1: Superficial Approval Pattern

### Definition

A user sends a minimal affirmation message (≤50 characters, approval keywords only) immediately after an AI-generated plan, with no follow-up questions or modifications.

### Detection Rules

```typescript
interface SuperficialApprovalDetection {
  // Rule 1: Message is approval keyword only
  approvalKeywords: RegExp = /^(ok|sure|do it|go|yes|looks good|lgtm|yep|gotcha|\+1|approved|fine|alright|sounds good)(?:\s*\.|\s*!)?$/i;
  messageLength: number ≤ 50;  // Including punctuation
  
  // Rule 2: Immediately follows plan/structure message
  previousMessagePattern: 'plan_detected' | 'structure_first' | 'task_decomposition';
  timeSincePrevious: number < 30_000;  // 30 seconds (milliseconds)
  
  // Rule 3: No modification or questioning signals
  noModificationSignals: boolean;  // No "change", "modify", "instead"
  noQuestioningSignals: boolean;   // No "why", "what about", "explain"
  
  // Context
  situationType: 'complex_decision' | 'feature_building' | 'refactoring';
}
```

### Output Format

```typescript
// In dimensionSignals.growthClusterThemes for aiControl:
"aiControl_g_X:Superficial Plan Approval"

// In absenceBasedGrowthSignals:
{
  patternId: "superficial_approval",
  dimension: "aiControl",
  wasAbsent: false,  // Pattern WAS detected
  occurrences: 3,
  growthTitle: "Deeper Plan Review Habit",
  growthDescription: "Analysis found 3 instances where you confirmed plans with minimal acknowledgment (≤50 chars, no follow-up questions). This suggests plans were approved without full comprehension.",
  recommendation: "When confirming a plan, take time to ask at least 2-3 clarifying questions. Explicitly reference which original requirements each step addresses.",
  severity: "medium",
  examples: [
    "Plan: [5-step architecture] → User: 'Looks good'",
    "Plan: [implementation strategy] → User: 'Do it'",
    "Plan: [refactoring plan] → User: 'OK'"
  ]
}
```

### Prompt Instructions

Add to `DATA_ANALYST_SYSTEM_PROMPT` under "Anti-Pattern Detection":

```markdown
**superficial_approval** (NEW)
- Look for: Minimal affirmation ("ok", "sure", "do it") after AI plan/structure
- Context: Message ≤50 chars, no modifications, no clarifying questions
- Time signal: Response < 30 seconds after plan = potential no-read confirmation
- Severity: medium
- Frame: "Plan Review Habit Development" (growth opportunity)
```

---

## Detector 2: Zero-Latency Confirmation

### Definition

User confirms a plan within 10 seconds of AI generation, indicating insufficient reading/parsing time.

### Detection Rules

```typescript
interface ZeroLatencyDetection {
  // Requires timestamp analysis (new capability)
  planGenerationTimestamp: Date;
  confirmationTimestamp: Date;
  elapsedSeconds: number = (confirmationTimestamp - planGenerationTimestamp) / 1000;
  
  // Thresholds
  instantApproval: elapsedSeconds < 10;     // Almost no read time
  quickApproval: elapsedSeconds < 30;       // Minimal read time
  thoughtfulApproval: elapsedSeconds ≥ 60;  // Adequate review
  
  // Additional context
  planComplexity: number;  // Count of steps/lines
  messageLength: number;   // User confirmation length
  
  riskScore: (elapsedSeconds, planComplexity) => {
    if (elapsedSeconds < 10) return 100;  // Critical
    if (elapsedSeconds < 30 && planComplexity > 3) return 75;  // High
    if (elapsedSeconds < 60 && planComplexity > 5) return 50;  // Medium
    return 0;  // Low risk
  }
}
```

### Implementation Requirement

**Note**: Timestamp analysis requires parsing message timestamps from JSONL format:

```typescript
// JSONL message structure (already available)
{
  type: "user" | "assistant",
  timestamp?: number,  // Unix timestamp in milliseconds
  content: string,
  // ... other fields
}
```

Current status: Timestamps are **available in JSONL** but **not analyzed** in data extraction.

### Output Format

```typescript
// In criticalThinkingMoments or new section planApprovalTimings:
{
  planTimestamp: "2024-01-20T14:23:45Z",
  approvalTimestamp: "2024-01-20T14:23:52Z",
  elapsedSeconds: 7,
  planComplexity: 5,  // 5-step plan
  riskAssessment: "critical",
  evidence: "User approved complex 5-step plan in 7 seconds (indicates no reading time)",
  dimension: "aiControl",
  signal: "growth",
  recommendation: "Take at least 30-60 seconds to read complex plans. Review each step for alignment with your requirements."
}
```

---

## Detector 3: Requirement Mapping Check

### Definition

When a plan is confirmed, validate that the user's confirmation message explicitly references back to the original request, showing comprehension alignment.

### Detection Rules

```typescript
interface RequirementMappingDetection {
  // Extract original request
  originalRequest: string;  // T1: User's initial request
  requestKeywords: string[];  // Extract: [action verbs, nouns, constraints]
  requestEntities: string[];  // Named entities, domain terms
  
  // Extract plan
  planSummary: string;  // T2: AI's proposed plan
  planSteps: string[];  // Individual steps
  
  // Analyze confirmation
  confirmationMessage: string;  // T3: User's approval
  
  // Check for requirement references
  referencedRequirements: string[];  // Requirements mentioned in confirmation
  mappingScore: number = referencedRequirements.length / requestKeywords.length;
  
  // Thresholds
  fullyMapped: mappingScore ≥ 0.7;      // 70%+ requirements referenced
  partiallyMapped: mappingScore ≥ 0.4;  // 40-70%
  unmapped: mappingScore < 0.4;         // <40% (gap)
}
```

### Example Detection

```
T1: "Build an authentication system with JWT tokens, 
     OAuth support, and rate limiting"

Original request keywords: [auth, JWT, OAuth, rate_limiting, tokens]

T2: AI Plan
[5-step architecture for auth system with JWT, OAuth, rate limiting]

T3a (Good mapping): "Great! This plan covers JWT tokens, 
     OAuth flow, and the rate limiting I wanted. Let's proceed."
→ referencedRequirements: [JWT, OAuth, rate_limiting]
→ mappingScore: 3/5 = 0.6 (partially mapped) ⚠️

T3b (Poor mapping): "Looks good. Do it."
→ referencedRequirements: []
→ mappingScore: 0/5 = 0.0 (unmapped) 🔴

T3c (Full mapping): "Perfect. This covers JWT auth, enables OAuth 
     integrations, and implements rate limiting as discussed. 
     Proceed with implementation."
→ referencedRequirements: [JWT, OAuth, rate_limiting]
→ mappingScore: 3/5 = 0.6 (acceptable) ✅
```

### Output Format

```typescript
// In growthClusterThemes for aiControl:
"aiControl_g_X:Explicit Requirement Validation"

// In absenceBasedGrowthSignals:
{
  patternId: "unmapped_plan_acceptance",
  dimension: "aiControl",
  wasAbsent: false,
  occurrences: 2,
  growthTitle: "Requirement-Plan Alignment Verification",
  growthDescription: "In 2 instances, you confirmed plans without explicitly referencing your original requirements. This increases risk of implementation misalignment.",
  growthExamples: [
    "Original: 'Build auth with JWT + OAuth'. Confirmation: 'Looks good' (no requirement references)",
    "Original: 'Refactor with performance optimization'. Confirmation: 'OK' (no mapping to performance goals)"
  ],
  recommendation: "Before confirming a plan, explicitly map each step back to your original requirements. Use language like: 'This addresses X because...', 'Yes, this covers Y...'",
  severity: "medium",
  source: "Requirement Validation Analysis"
}
```

### Prompt Instructions

Add to `DATA_ANALYST_SYSTEM_PROMPT` under "Quote Insight Analysis":

```markdown
**Requirement Mapping Analysis** (NEW)
For each plan-confirmation sequence:
1. Extract original user request keywords/constraints
2. Identify plan elements addressing each requirement
3. Check if user's confirmation message references these mappings
4. Score: fullyMapped (70%+), partiallyMapped (40-70%), unmapped (<40%)
5. Report to absenceBasedGrowthSignals as "unmapped_plan_acceptance" if unmapped
```

---

## Detector 4: Deferment Language Flag

### Definition

User explicitly abdicates decision-making control: "You decide", "Whatever works", "I trust you", etc.

### Detection Rules

```typescript
interface DefermentLanguageDetection {
  // Regex patterns for control abdication
  defermentPatterns: RegExp[] = [
    /you\s+(decide|choose|pick|recommend|think|prefer)/i,
    /whatever\s+(works|you\s+think|you\s+prefer)/i,
    /I\s+trust\s+you/i,
    /your\s+call/i,
    /make\s+it\s+up/i,
    /suit\s+yourself/i,
    /I'll\s+go\s+with\s+(?:your|whatever)/i,
    /you\s+know\s+(?:best|what's\s+right)/i,
    /I'm\s+(?:leaving|trusting|putting)\s+it\s+to\s+you/i,
    /just\s+(?:do|implement|choose)\s+(?:what|whatever)/i,
    /(?:best|best_approach|best_way)(?:\s+is)?\s+(?:up\s+to|on)\s+you/i,
  ];
  
  // Context
  isApprovalContext: boolean;  // Message follows plan/structure
  isDecisionPoint: boolean;    // Message precedes implementation
  
  // Severity modifiers
  hasNegationOrQualifier: boolean = /(?:not\s+|but\s+|though|however)/i.test(message);
  severity: number = hasNegationOrQualifier ? 'medium' : 'high';
}
```

### Example Detection

```
Deferment:
- "You decide which database to use"
- "I trust you to figure out the best approach"
- "Whatever works, just implement it"
- "Your call on the architecture"

Not Deferment (qualified):
- "You know the codebase better, but I think we should use PostgreSQL"
- "I trust your judgment, though I want to review the authentication scheme"
```

### Output Format

```typescript
// In dimensionSignals.growthClusterThemes for aiControl:
"aiControl_g_X:Active Direction Setting"

// In detectedPatterns:
{
  patternId: "deferment_language",
  patternType: "control_abdication",
  frequency: 3,  // Appears 3 times
  dimension: "aiControl",
  signal: "growth",
  confidence: 0.95,
  examples: [
    "You decide which framework to use",
    "Whatever works for you",
    "I trust you on this"
  ],
  severity: "medium",
  recommendation: "Provide specific requirements rather than deferring decisions. Example: 'Use PostgreSQL because we need ACID compliance' instead of 'Whatever you think'",
  source: "Control Measurement Analysis"
}

// In topPriorities:
{
  dimension: "aiControl",
  focusArea: "Active Decision-Making Direction",
  rationale: "In 3 sessions, you used deferential language that handed control to AI. This reduces your oversight capacity.",
  expectedImpact: "Better alignment between your intent and AI implementation; increased confidence in generated solutions",
  priorityScore: 72
}
```

### Prompt Instructions

Add to `DATA_ANALYST_SYSTEM_PROMPT` under "AI Interaction Pattern Detection":

```markdown
**deferment_language_flag** (NEW)
- Pattern: User explicitly abdicates control ("you decide", "I trust you")
- Context: Often appears in confirmation/direction messages
- Signal: growth (not strength) - indicates reduced oversight
- Frame: "Active Decision Direction" (encourage specificity)
- Keywords: you decide, you choose, whatever, I trust you, your call, suit yourself
```

---

## Detector 5: Post-Confirmation Incomprehension

### Definition

User confirms a plan, but immediately after implementation asks basic questions revealing they didn't understand the plan.

### Detection Rules

```typescript
interface PostConfirmationIncomprehensionDetection {
  // Phase detection
  phase1_planGeneration: Message;  // AI creates plan
  phase2_confirmation: Message;    // User approves (with low scrutiny)
  phase3_implementation: Message;  // AI generates code
  phase4_questions: Message[];     // User asks basic questions
  
  // Question classification
  basicQuestions: RegExp[] = [
    /why\s+(?:did|does|is)\s+it/i,        // "Why did it..."
    /what.*(?:this|that|these|those)\s+(?:for|is|does)/i,  // "What's this for..."
    /how\s+(?:does|do|is)\s+it/i,         // "How does it..."
    /explain\s+(?:this|the)\s+(?:code|part|step|logic)/i,  // "Explain this..."
    /(?:what|can you)\s+clarify/i,        // "Can you clarify..."
    /I\s+(?:don't understand|don't get|didn't realize)/i,  // "I don't understand..."
  ];
  
  // Timing
  timeBetweenConfirmationAndQuestions: number;  // milliseconds
  questionTimesOut: timeBetweenConfirmationAndQuestions < 300_000;  // 5 min
  
  // Evidence chain
  evidenceQuotes: string[];  // Confirmation quote + question quote
  confidence: number;  // Based on question clarity
}
```

### Example Detection

```
Timeline:
T1: User: "Build login system with JWT and OAuth"
T2: AI: "I'll implement: 1. JWT schema 2. OAuth flow 3. Rate limit..."
T3: User: "Looks good"  ← LOW SCRUTINY APPROVAL
T4: AI: [Generates 200 lines of code for auth implementation]
T5: User: "Why did it put the token in localStorage?" ← BASIC QUESTION
   → Proves user didn't understand T2 before confirming at T3

Detected as: blind_confirmation_revealed
```

### Output Format

```typescript
// In detectedAntiPatterns:
{
  patternId: "blind_confirmation_revealed",
  patternType: "comprehension_failure",
  severity: "high",
  frequency: 1,  // Detected 1 time
  dimension: "aiControl",
  signal: "growth",
  triggerContext: "complex_decision",
  evidence: [
    {
      type: "confirmation",
      timestamp: "2024-01-20T14:25:00Z",
      quote: "Looks good",
      analysis: "Low-scrutiny approval with no clarifying questions"
    },
    {
      type: "implementation",
      timestamp: "2024-01-20T14:26:30Z",
      quote: "Why did it put the token in localStorage? Is that secure?",
      analysis: "Question reveals lack of understanding about T2 plan"
    }
  ],
  recommendation: "Review complex plans in detail before confirming. Ask for step-by-step walkthroughs if any part is unclear. Avoid approving then learning - learn then approve.",
  source: "Sequence-Based Pattern Analysis"
}

// In absenceBasedGrowthSignals:
{
  patternId: "plan_pre_implementation_verification",
  dimension: "aiControl",
  wasAbsent: false,
  growthTitle: "Plan Comprehension Before Implementation",
  growthDescription: "Detected 1 instance where you confirmed a plan but asked clarifying questions only after implementation. This indicates the plan was approved without full understanding.",
  recommendation: "Create a checklist for plan review: 1. Read all steps, 2. Ask 3+ clarifying questions, 3. Confirm only after understanding",
  severity: "high"
}
```

### Prompt Instructions

Add to `DATA_ANALYST_SYSTEM_PROMPT` under "Sequence-Based Pattern Detection":

```markdown
**blind_confirmation_revealed** (NEW - Sequence Detection)
After extracting all messages in order, look for this sequence:
1. AI generates plan/structure (complex_decision context)
2. User confirms with low scrutiny (≤50 chars, no questions)
3. AI implements code
4. User asks basic "Why did it..." or "What is..." questions

This sequence proves the plan was approved without comprehension.
Report with HIGHEST severity as anti-pattern + recommendation.
```

---

## Implementation Order

### Priority 1: Low-Effort, High-Impact

1. **Deferment Language Flag** (30 min)
   - Add regex patterns to dimension-keywords.ts
   - Update data-analyst-prompts.ts with detection rules
   - No new data structures needed

2. **Superficial Approval Pattern** (45 min)
   - Add keyword matching to anti-pattern detection
   - Simple length + keyword check
   - Integrate into existing dimensionSignals

### Priority 2: Medium-Effort, High-Impact

3. **Post-Confirmation Incomprehension** (60 min)
   - Add sequence detection logic to data-analyst-prompts.ts
   - Cross-reference confirmation message with subsequent questions
   - Minimal timestamp logic needed (compare message order, not absolute times)

4. **Requirement Mapping Check** (90 min)
   - Extract keywords from original request
   - Analyze confirmation message for references
   - Could use simple string matching initially

### Priority 3: High-Effort, High-Impact

5. **Zero-Latency Confirmation** (120 min)
   - Requires JSONL timestamp parsing
   - Add temporal analysis to data extraction
   - Complex threshold tuning needed

---

## Testing Strategy

### Test Cases for Each Detector

#### Superficial Approval Pattern

```typescript
// Test 1: Should detect
{
  previousMessage: "Plan: 1. Create table 2. Add indexes 3. Create views",
  userMessage: "Ok",
  timeDelta: 5000,  // 5 seconds
  expectedDetection: true,
}

// Test 2: Should NOT detect (good approval)
{
  previousMessage: "Plan: 1. Create table 2. Add indexes",
  userMessage: "Good plan. This covers the data schema I need. Let's proceed with step 1 creating the table for user records.",
  expectedDetection: false,
}

// Test 3: Should detect (follow-up question means NOT superficial)
{
  previousMessage: "Plan: Use PostgreSQL with JWT auth",
  userMessage: "Sure, but why PostgreSQL instead of MongoDB?",
  expectedDetection: false,  // Not superficial - has critical question
}
```

#### Deferment Language

```typescript
// Test 1: Should detect
{
  message: "You decide which framework to use",
  expectedDetection: true,
}

// Test 2: Should detect
{
  message: "I trust you on the best approach",
  expectedDetection: true,
}

// Test 3: Should NOT detect (qualified deferment)
{
  message: "You know the codebase, but I think we should use TypeScript for type safety",
  expectedDetection: false,  // Has preference/constraint
}
```

---

## Schema Changes Required

### Add to DetectedAntiPatternSchema

```typescript
// File: src/lib/models/agent-outputs.ts or relevant schema file
export interface DetectedAntiPattern {
  // ... existing fields ...
  
  // NEW: Blind approval detection fields
  confirmationLatency?: number;           // Seconds between plan and approval
  requirementMappingFound?: boolean;      // Did user reference requirements?
  defermentLanguageDetected?: boolean;    // Abdication language used?
  postImplementationQuestions?: string[]; // Questions revealing incomprehension?
  comprehensionScore?: number;            // 0-100, derived from above
}
```

### Add to DimensionSignalSchema

```typescript
export interface DimensionSignal {
  // ... existing fields ...
  
  // NEW: Sub-dimension for aiControl
  confirmationQuality?: 'thorough' | 'adequate' | 'superficial' | 'absent';
  requirementAlignment?: 'aligned' | 'partial' | 'misaligned' | 'unknown';
  controlAbdication?: 'none' | 'mild' | 'strong';
}
```

---

## Configuration & Thresholds

### Configurable Parameters

```typescript
// src/lib/analyzer/stages/data-analyst-config.ts (new file)

export const BLIND_APPROVAL_CONFIG = {
  // Superficial Approval
  maxApprovalMessageLength: 50,         // characters
  maxApprovalLatency: 30,               // seconds
  approvalKeywordsRegex: /^(ok|sure|.../i,
  
  // Zero-Latency
  criticalLatencyThreshold: 10,         // seconds
  highRiskLatencyThreshold: 30,         // seconds
  thoughtfulLatencyThreshold: 60,       // seconds
  
  // Requirement Mapping
  mappingScoreFull: 0.7,                // 70%+ is "fully mapped"
  mappingScorePartial: 0.4,             // 40-70% is "partial"
  
  // Deferment Language
  defermentPatterns: [
    /you\s+(decide|choose)/i,
    // ... more patterns
  ],
  
  // Post-Confirmation
  questionLatencyWindow: 300_000,       // 5 minutes (milliseconds)
  basicQuestionPatterns: [
    /why\s+did/i,
    /what.*for/i,
    // ... more patterns
  ],
  
  // Risk Calculation
  weights: {
    latency: 0.25,
    mappingScore: 0.30,
    messageLength: 0.20,
    defermentLanguage: 0.15,
    postImplementationQuestions: 0.10,
  }
};
```

---

## Monitoring & Metrics

### Metrics to Track

```typescript
// For analytics/debugging
{
  detectorName: "superficial_approval_pattern",
  timestamp: Date,
  sessionId: string,
  detected: boolean,
  confidence: number,  // 0-1
  evidence: {
    messageLength: number,
    timeSincePlan: number,
    hasFollowupQuestions: boolean,
    approvalKeywordMatched: string,
  },
  dimension: "aiControl",
  signal: "growth",
}
```

### Success Metrics

- **Coverage**: Detection triggers for 80%+ of actual blind confirmations in test set
- **Precision**: False positive rate < 15% (avoid over-flagging)
- **User reception**: Growth signal accepted/acted-upon in 60%+ of reports

---

## Related Files

- Source: `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/stages/data-analyst-prompts.ts`
- Keywords: `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/dimension-keywords.ts`
- Domain Models: `/Users/sungmancho/projects/nomoreaislop/src/lib/domain/models/knowledge.ts`
- Content Writer: `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/stages/content-writer-prompts.ts`

---

## References

- Main Analysis: `/Users/sungmancho/projects/nomoreaislop/docs/BLIND_APPROVAL_ANALYSIS.md`
- Architecture: `/Users/sungmancho/projects/nomoreaislop/docs/ARCHITECTURE.md`
