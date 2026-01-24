# Blind Approval Detection: Quick Reference

## Problem Summary

NoMoreAISlop has a **critical blind spot** in detecting "blind confirmation without understanding"—the scenario where:

1. User requests something
2. AI generates a plan and asks for confirmation
3. User confirms with minimal scrutiny ("ok", "looks good", "do it")
4. AI implements based on plan
5. **FAILURE**: Implementation doesn't match user's actual needs

## Current Coverage vs. Gaps

| Scenario | Detectable? | Evidence |
|----------|---|---|
| User requests feature | ✅ Yes | Tracked in initial message |
| AI generates plan | ✅ Yes | `/plan` command, `structure_first` pattern |
| User approves plan | ✅ Yes | Passive acceptance detection |
| Code gets generated | ✅ Yes | Tool use tracking |
| **Failure occurs** | ❌ NO | No correlation with plan quality |
| **Plan was never understood** | ❌ NO | THIS IS THE GAP |

## The 5 Missing Detectors

### 1. Superficial Approval Pattern
- **What**: User sends "ok", "sure", "do it" (≤50 chars) immediately after plan
- **Why it matters**: Indicates no cognitive review
- **Implementation**: Regex matching + time check
- **Effort**: 30 minutes
- **Priority**: High

### 2. Zero-Latency Confirmation
- **What**: User confirms plan in <10 seconds
- **Why it matters**: Not enough time to read/parse complex plan
- **Implementation**: Timestamp-based analysis
- **Effort**: 2 hours (requires JSONL timestamp parsing)
- **Priority**: High

### 3. Deferment Language Flag
- **What**: "You decide", "Whatever works", "I trust you"
- **Why it matters**: User explicitly abdicates decision-making
- **Implementation**: Regex patterns on confirmation message
- **Effort**: 30 minutes
- **Priority**: High

### 4. Requirement Mapping Check
- **What**: User confirms plan without referencing original requirements
- **Why it matters**: Approved summary without validating logic alignment
- **Implementation**: Keyword extraction + reference checking
- **Effort**: 1.5 hours
- **Priority**: Medium

### 5. Post-Confirmation Incomprehension
- **What**: User asks basic questions after implementation that prove they didn't understand plan
- **Why it matters**: Definitively proves blind approval
- **Implementation**: Sequence detection (plan → approval → code → questions)
- **Effort**: 1 hour
- **Priority**: High

---

## Files to Modify

### Primary
- `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/stages/data-analyst-prompts.ts`
  - Add detector descriptions to system prompt
  - Add detection logic instructions
  - Update dimensionSignals for aiControl dimension

### Secondary
- `/Users/sungmancho/projects/nomoreaislop/src/lib/analyzer/dimension-keywords.ts`
  - Add deferment language patterns
  - Add control abdication keywords

- `/Users/sungmancho/projects/nomoreaislop/src/lib/domain/models/knowledge.ts`
  - Extend schema to support new growth signals
  - Add blind approval specific patterns

---

## Implementation Roadmap

### Phase 1 (2-3 hours, High Impact)
**Start here** - These are easiest and have immediate value

1. Add `deferment_language` anti-pattern (30 min)
2. Add `superficial_approval` anti-pattern (45 min)
3. Add `plan_verification` to absence-based checks (30 min)

### Phase 2 (2-3 hours, High Impact)
**Next** - Medium effort with clear value

1. Add `post_confirmation_incomprehension` detector (60 min)
2. Add `requirement_mapping_check` (90 min)
3. Update content-writer prompts for new growth signals (30 min)

### Phase 3 (2+ hours, Enhancement)
**Future** - More complex, lower immediate priority

1. Implement timestamp-based latency analysis (120 min)
2. Add planning depth index scoring (90 min)
3. Create comprehensive test suite (120 min)

---

## Integration Points

### Data Analyst Prompt
Location: `src/lib/analyzer/stages/data-analyst-prompts.ts`

Where to add:
- **System prompt**: Add each detector to "Anti-Pattern Detection" section (~line 450)
- **Extraction instructions**: Add to prompt building function
- **Output format**: Update schema documentation with new fields

### Dimension Keywords
Location: `src/lib/analyzer/dimension-keywords.ts`

Updates needed:
- Add `aiControl` improvement keywords for deferment patterns
- Add search queries for "active control" resources

### Domain Models
Location: `src/lib/domain/models/knowledge.ts`

Schema extensions:
- Add new growth signal pattern IDs
- Extend `absenceBasedGrowthSignal` type with blind approval fields

---

## Expected Outcomes

When fully implemented, the system will detect:

**Metric 1: Superficial Approval Rate**
- Percentage of confirmations using <50 char approval messages
- Growth signal if >20% of plans confirmed superficially

**Metric 2: Requirement Alignment Score**
- % of plan confirmations that explicitly reference original requirements
- Low score (<40%) = growth opportunity

**Metric 3: Control Abdication Rate**
- Frequency of deferment language in decision points
- Any occurrence = growth signal

**Metric 4: Comprehension Failure Detection**
- Sequences where user approved plan but questioned it post-implementation
- HIGH severity anti-pattern (proves blind approval)

---

## Example Report Content

### Current (Incomplete)
```
AIControl Score: 72/100
- Strengths: Good at asking verification questions
- Growth: Sometimes passive about accepting suggestions
```

### Future (With Blind Approval Detection)
```
AIControl Score: 65/100
- Strengths: Thorough code review process
- Growth Areas:
  1. **Superficial Plan Review**: 3 instances where you confirmed plans 
     with minimal acknowledgment. Take time to ask clarifying questions.
  2. **Requirement Alignment**: When approving plans, explicitly reference 
     which original requirements each step addresses
  3. **Active Direction**: Avoid phrases like "you decide" or "whatever 
     works". State your specific constraints and preferences.

Recommendation: Create a plan-review checklist:
  - Read all steps (minimum 60 seconds for complex plans)
  - Ask 3+ clarifying questions
  - Map each step back to your original request
  - Only confirm after full comprehension
```

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| BLIND_APPROVAL_ANALYSIS.md | Architecture analysis + gap identification | 556 |
| BLIND_APPROVAL_DETECTION_SPEC.md | Technical specifications for each detector | 688 |
| data-analyst-prompts.ts | Primary integration point (prompt updates) | ~1000 |
| dimension-keywords.ts | Keyword configs for search | ~300 |
| knowledge.ts (domain/models) | Schema definitions | ~500 |

---

## Testing Checklist

- [ ] Detector 1: Superficial Approval - test with 10 real/synthetic messages
- [ ] Detector 2: Zero-Latency - test with timestamp data
- [ ] Detector 3: Deferment Language - test regex on 20+ variations
- [ ] Detector 4: Requirement Mapping - test keyword extraction accuracy
- [ ] Detector 5: Post-Confirmation - test sequence detection logic
- [ ] Integration: All detectors work in data analyst pipeline
- [ ] Output: Reports show blind approval signals correctly
- [ ] User testing: Growth signals are actionable and non-offensive

---

## Success Criteria

✅ System detects >80% of blind approvals in test set
✅ False positive rate <15%
✅ New growth signals appear in 40%+ of free tier reports
✅ Users report signals as "helpful and accurate" (survey)
✅ User behavior changes: More plan questions, fewer "just do it" approvals

---

## Related Documentation

- [BLIND_APPROVAL_ANALYSIS.md](./BLIND_APPROVAL_ANALYSIS.md) - Deep architectural analysis
- [BLIND_APPROVAL_DETECTION_SPEC.md](./BLIND_APPROVAL_DETECTION_SPEC.md) - Technical implementation specs
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system design
