# Cross-Session Anti-Pattern Detection: Complete Documentation Index

## Quick Start

**If you're new to this system**, start with:
1. `/CROSS_SESSION_SUMMARY.md` - 5-minute overview
2. `/docs/CROSS_SESSION_QUICK_REFERENCE.md` - Quick reference tables
3. `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md` - See real examples

**If you're implementing**, go to:
1. `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts` - The actual prompts
2. `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md` - Detailed specifications
3. `/docs/CROSS_SESSION_ARCHITECTURE.md` - System design

---

## Documentation Files

### Core Implementation

#### 1. **Prompt File** (TypeScript)
**Location**: `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
- **Lines**: 346
- **Size**: 16 KB

**Contents**:
- `CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT` - Comprehensive system prompt
- `buildCrossSessionAntiPatternUserPrompt()` - User prompt builder function
- `CrossSessionAntiPatternInput` - TypeScript input interface
- `CrossSessionAntiPatternOutput` - TypeScript output interface
- `CrossSessionAntiPatternPrompts` - Exported prompts object

**Use when**: You need to call the Gemini API or understand the exact prompt format.

---

### User Documentation

#### 2. **Implementation Summary**
**Location**: `/CROSS_SESSION_SUMMARY.md`
- **Lines**: 310
- **Read time**: 5-10 minutes

**What it covers**:
- Complete overview of deliverables
- 5 anti-patterns with definitions
- Key features (PTCF framework, evidence-based analysis, multi-language support)
- File structure and usage
- Next implementation steps

**Use when**: You need a quick understanding of what's been built and how to implement it.

---

#### 3. **Complete Documentation**
**Location**: `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md`
- **Lines**: 425
- **Read time**: 15-20 minutes

**What it covers**:
- Overview and core principle (2+ session threshold)
- Detailed anti-pattern hierarchy with risk assessments
- PTCF framework breakdown
- Prompt design specifications
- Output format with examples
- Scoring metrics (pattern density, consistency)
- Multi-language support
- Implementation notes

**Use when**: You need comprehensive conceptual understanding before implementing.

---

#### 4. **Quick Reference Guide**
**Location**: `/docs/CROSS_SESSION_QUICK_REFERENCE.md`
- **Lines**: 275
- **Read time**: 5 minutes (for reference)

**What it covers**:
- File locations
- Anti-pattern quick reference table
- Prompt structure summary
- Output schema overview
- Data format examples
- Score interpretation guides
- Critical rules checklist
- Implementation checklist
- When to use vs. single-session analysis
- Troubleshooting guide

**Use when**: You need to quickly look up a specific detail, score meaning, or rule.

---

### Examples & Scenarios

#### 5. **Practical Examples**
**Location**: `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`
- **Lines**: 458
- **Read time**: 20-30 minutes

**What it covers**:
- 5 realistic complete examples:
  1. **blind_approval** - Developer approves major changes without understanding
  2. **sunk_cost_loop** - Developer repeats failing npm install
  3. **passive_acceptance** - Developer implements 5 suggestions without evaluation
  4. **blind_retry** - Developer retries identical commands
  5. **delegation_without_review** - Developer ships AI-generated code without testing
- Expected LLM output for each example
- Scoring examples (pattern density interpretation)
- Output format examples
- Multi-language example (Korean)
- False positive prevention examples
- Using insights for behavior change

**Use when**: You want to see how the prompts work in practice or understand expected output quality.

---

### Architecture & Design

#### 6. **System Architecture**
**Location**: `/docs/CROSS_SESSION_ARCHITECTURE.md`
- **Lines**: 300+
- **Read time**: 15-20 minutes

**What it covers**:
- System architecture diagram (text-based)
- Data flow from session collection to developer feedback
- Pattern detection logic and algorithm
- Scoring calculation details
- Evidence extraction specifications
- Anti-pattern hierarchy visualization
- Multi-language support architecture
- File dependencies
- Integration points with existing workers
- Performance characteristics
- Error handling and validation

**Use when**: You need to understand system design, integrate with existing code, or troubleshoot issues.

---

## Navigation by Task

### "I need to understand what this is"
Start here:
1. Read `/CROSS_SESSION_SUMMARY.md` (5 min)
2. Skim `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md` opening sections (5 min)
3. Look at examples in `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md` (10 min)

### "I need to implement this"
Follow this path:
1. Read `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md` (comprehensive)
2. Review `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts` (actual code)
3. Check `/docs/CROSS_SESSION_ARCHITECTURE.md` for integration points
4. Use `/docs/CROSS_SESSION_QUICK_REFERENCE.md` as implementation checklist

### "I need to fix a bug or optimize"
Use these resources:
1. `/docs/CROSS_SESSION_ARCHITECTURE.md` - Understand data flow
2. `/docs/CROSS_SESSION_QUICK_REFERENCE.md#troubleshooting` - Common issues
3. `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md` - Validate expected output
4. `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts` - Check prompt details

### "I need to explain this to someone"
Pick materials by audience:
- **Technical audience**: Use `/docs/CROSS_SESSION_ARCHITECTURE.md`
- **Product/design audience**: Use `/CROSS_SESSION_SUMMARY.md` + `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`
- **Engineering team**: Use `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md`
- **Quick pitch**: Use `/CROSS_SESSION_SUMMARY.md` (first section)

### "I need to validate output quality"
Compare your results to:
1. `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md` - See expected formats
2. `/docs/CROSS_SESSION_QUICK_REFERENCE.md#data-format-examples` - Validate data structure
3. `/docs/CROSS_SESSION_QUICK_REFERENCE.md#critical-rules` - Check evidence requirements

---

## Content Map

### Core Concepts
| Concept | Location | Details |
|---------|----------|---------|
| 2+ session threshold | SUMMARY, DETECTION | Why patterns need 2+ sessions |
| PTCF framework | SUMMARY, DETECTION, ARCHITECTURE | How prompts are structured |
| Anti-pattern hierarchy | SUMMARY, QUICK_REF, EXAMPLES | 5 types with severity levels |
| Evidence requirements | DETECTION, QUICK_REF, EXAMPLES | What makes good findings |
| Multi-language support | DETECTION, EXAMPLES, ARCHITECTURE | How to handle non-English |

### Anti-Patterns
| Pattern | Example | Severity |
|---------|---------|----------|
| blind_approval | EXAMPLES.md #1, SUMMARY | CRITICAL |
| sunk_cost_loop | EXAMPLES.md #2, SUMMARY | CRITICAL |
| passive_acceptance | EXAMPLES.md #3, SUMMARY | WARNING |
| blind_retry | EXAMPLES.md #4, SUMMARY | WARNING |
| delegation_without_review | EXAMPLES.md #5, SUMMARY | INFO |

### Scores & Metrics
| Metric | Location | Interpretation |
|--------|----------|-----------------|
| Pattern Density (0-100) | DETECTION, QUICK_REF | How many patterns |
| Consistency (0-1) | DETECTION, QUICK_REF | How confident |
| Frequency (High/Moderate) | EXAMPLES | How often pattern occurs |

### Troubleshooting
| Issue | Location |
|-------|----------|
| No patterns detected | QUICK_REF#troubleshooting |
| Missing session IDs | QUICK_REF#troubleshooting |
| Quotes truncated | QUICK_REF#troubleshooting |
| False positives | EXAMPLES#false-positive-prevention |

---

## File Statistics

```
IMPLEMENTATION:
src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts
├─ Lines: 346
├─ Size: 16 KB
├─ Language: TypeScript
└─ Status: Ready to use

DOCUMENTATION:
docs/
├─ CROSS_SESSION_ANTI_PATTERN_DETECTION.md
│  ├─ Lines: 425
│  ├─ Size: 15 KB
│  └─ Topics: 10 major sections
├─ CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md
│  ├─ Lines: 458
│  ├─ Size: 17 KB
│  └─ Examples: 5 complete + scoring + multilingual
├─ CROSS_SESSION_QUICK_REFERENCE.md
│  ├─ Lines: 275
│  ├─ Size: 9.5 KB
│  └─ Reference sections: 15+
├─ CROSS_SESSION_ARCHITECTURE.md
│  ├─ Lines: 300+
│  ├─ Size: 12 KB
│  └─ Diagrams: 5 ASCII diagrams
└─ CROSS_SESSION_INDEX.md (this file)
   ├─ Lines: 250+
   ├─ Size: 8 KB
   └─ Purpose: Navigation

ROOT SUMMARY:
CROSS_SESSION_SUMMARY.md
├─ Lines: 310
├─ Size: 10 KB
└─ Purpose: Executive overview

TOTAL: ~57 KB of comprehensive documentation
```

---

## Quick Links

### By File
- **Prompts**: `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
- **Main Docs**: `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md`
- **Examples**: `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`
- **Quick Ref**: `/docs/CROSS_SESSION_QUICK_REFERENCE.md`
- **Architecture**: `/docs/CROSS_SESSION_ARCHITECTURE.md`
- **Summary**: `/CROSS_SESSION_SUMMARY.md`

### By Section
- **Introduction**: See `/CROSS_SESSION_SUMMARY.md`
- **Anti-Patterns**: See `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md#anti-pattern-hierarchy`
- **PTCF Design**: See `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md#prompt-design-ptcf-framework`
- **Output Format**: See `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md#output-format-specification`
- **Real Examples**: See `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`
- **Architecture**: See `/docs/CROSS_SESSION_ARCHITECTURE.md`
- **Troubleshooting**: See `/docs/CROSS_SESSION_QUICK_REFERENCE.md#troubleshooting`

---

## Implementation Path

1. **Understand** (30 min)
   - Read `/CROSS_SESSION_SUMMARY.md`
   - Read `/docs/CROSS_SESSION_ANTI_PATTERN_DETECTION.md`

2. **Design** (30 min)
   - Review `/docs/CROSS_SESSION_ARCHITECTURE.md`
   - Plan worker integration

3. **Implement** (2-3 hours)
   - Copy prompts from `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
   - Create `CrossSessionAntiPatternWorker` class
   - Add output schema to `agent-outputs.ts`
   - Integrate with orchestrator

4. **Validate** (1-2 hours)
   - Test with sample sessions
   - Compare output to `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md`
   - Verify 2+ session threshold enforcement
   - Check quote evidence requirements

5. **Optimize** (1+ hours)
   - Measure latency and token usage
   - Adjust maxOutputTokens if needed
   - Fine-tune false positive detection
   - Monitor consistency scores

---

## Key Reminders

- **Core Rule**: Patterns must appear in 2+ sessions (not single sessions)
- **Language**: All prompts in English, but support multi-language input
- **Evidence**: Every finding needs direct quote with session IDs
- **Format**: Semicolon-separated for anti-patterns, exactly 3 topInsights
- **Confidence**: Report pattern density (0-100) and consistency (0-1) scores

---

## Document Maintenance

**Last Updated**: January 24, 2026
**Status**: Complete and ready for implementation
**Maintenance**: Update when anti-pattern definitions change or new types added

---

## Support

If you need help:
1. Check `/docs/CROSS_SESSION_QUICK_REFERENCE.md#troubleshooting`
2. Review `/docs/CROSS_SESSION_ANTI_PATTERN_EXAMPLES.md` for similar cases
3. Verify prompt format in `/src/lib/analyzer/workers/prompts/cross-session-anti-pattern-prompts.ts`
4. Check `/docs/CROSS_SESSION_ARCHITECTURE.md` for system design questions

---

**Ready to implement?** Start with `/CROSS_SESSION_SUMMARY.md` then dive into the implementation files.

