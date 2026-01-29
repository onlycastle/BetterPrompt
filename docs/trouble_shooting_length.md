# Troubleshooting: Report Content Length Problem

## Problem Definition

**Issue**: Content generated across the analysis pipeline is too short (both Free tier and Premium)

**Symptoms**:
- `personalitySummary` generates at 300-500 chars (target: 2500-3000 chars)
- Dimension insights descriptions are only 1-2 sentences (target: 8-12 sentences)
- Prompt pattern analysis is superficial (target: comprehensive WHAT-WHY-HOW)
- Overall "personalized feel" is lacking

## Root Cause Analysis

### 1. No Minimum Length Validation
- `truncatePersonalitySummary()` only validates max (3000 chars), not min
- Short content passes through without error

### 2. Weak Prompt Instructions
- Original prompt said "300-1500 chars" as a recommendation, not requirement
- LLM defaults to minimal output when given a range

### 3. Gemini API Limitations
- Zod min constraints removed (Gemini doesn't reliably follow min length)
- `responseJsonSchema` doesn't enforce content length

### 4. No Fallback Policy Conflict
- Short content doesn't trigger errors
- Passes silently, stored in database as valid

## Solution History

### Attempt 1: Prompt Enhancement (2025-01-30)

**Changes Made**:

1. **personalitySummary**:
   - Changed from "300-1500 chars" to "MINIMUM 2500 chars, target 2500-3000 chars"
   - Added requirement for 8-10 direct quotes
   - Added requirement for 15-20 sentences minimum

2. **Dimension insights**:
   - Changed from "up to 500 chars" to "MINIMUM 800 chars, target 1000-1500 chars"
   - Added requirement for 8-12 sentences per item
   - Added requirement for 2-3 quotes per insight

3. **Prompt patterns**:
   - Changed from "600-800 chars" to "MINIMUM 1500 chars, target 2000-2500 chars"
   - Enhanced WHAT-WHY-HOW section requirements (5-7, 4-5, 4-5 sentences each)

4. **Added warning log**:
   - `truncatePersonalitySummary()` now logs warning when < 2000 chars

**Files Modified**:
- `src/lib/analyzer/stages/content-writer-prompts.ts`
- `src/lib/analyzer/stages/evaluation-assembler.ts`

**Status**: Testing required

## Verification Steps

1. **Local test**:
   ```bash
   npm run dev
   # Upload 4+ sessions, check report
   ```

2. **Debug script**:
   ```bash
   npx tsx scripts/debug-analysis.ts
   ```

3. **Expected lengths**:
   - personalitySummary: 2500-3000 chars
   - Dimension description: 800-1500 chars per item
   - Prompt pattern description: 1500-2500 chars

## Future Work (If Needed)

If prompt enhancement alone doesn't resolve:

1. **Add content validation + regeneration**:
   - Check output length in ContentWriter
   - If below threshold, regenerate with stronger instructions
   - Trade-off: API cost increase

2. **Structured output with length hints**:
   - Explore Gemini's structured output options
   - May require schema changes

3. **Post-processing padding**:
   - Add elaboration pass for short content
   - Trade-off: May feel artificial

## Results Log

| Date | Test Type | personalitySummary | Dimension Avg | Pattern Avg | Status |
|------|-----------|-------------------|---------------|-------------|--------|
| 2025-01-30 | Baseline | ~400 chars | ~150 chars | ~350 chars | Too short |
| | | | | | |

---

*Last updated: 2025-01-30*
