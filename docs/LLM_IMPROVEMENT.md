# LLM Pipeline Improvement Plan

> ⚠️ **STATUS: PARTIALLY IMPLEMENTED** (2025-01 Update)
>
> - ✅ **IMPLEMENTED**: 4 Wow Agents (PatternDetective, AntiPatternSpotter, KnowledgeGap, ContextEfficiency)
> - ✅ **IMPLEMENTED**: Orchestrator + Workers architecture (parallel execution)
> - ✅ **IMPLEMENTED**: Module C (ProductivityAnalyst)
> - ❌ **REMOVED**: Module B (Personality Analyst) - MBTI/fortune analysis removed
> - ⏳ **DEFERRED**: Original 5 agents (Economist, CodeReviewer, Librarian, Educator, Communicator)
>
> See [LLM_FLOW.md](./LLM_FLOW.md) for current implementation.

## Implemented Architecture

**Current (Orchestrator + Workers, 3-Phase):**
```
                    ┌─────────────────────────┐
                    │    ParsedSession[]       │
                    └───────────┬─────────────┘
                                │
                    ╔═══════════════════════════════════╗
                    ║     ANALYSIS ORCHESTRATOR          ║
                    ╠═══════════════════════════════════╣
                    ║                                    ║
                    ║  PHASE 1 (parallel):               ║
                    ║  ┌──────────────┐ ┌──────────────┐ ║
                    ║  │ Module A     │ │ Module C     │ ║
                    ║  │ DataAnalyst  │ │ Productivity │ ║
                    ║  └──────────────┘ └──────────────┘ ║
                    ║           │               │        ║
                    ║  PHASE 2 (parallel, Premium+):     ║
                    ║  ┌────────┐ ┌────────┐             ║
                    ║  │Pattern │ │AntiPat.│             ║
                    ║  │Detect. │ │Spotter │             ║
                    ║  └────────┘ └────────┘             ║
                    ║  ┌────────┐ ┌────────┐             ║
                    ║  │Knowled.│ │Context │             ║
                    ║  │Gap     │ │Effic.  │             ║
                    ║  └────────┘ └────────┘             ║
                    ║                                    ║
                    ║  PHASE 3:                          ║
                    ║  ┌─────────────────────────┐       ║
                    ║  │   ContentWriter          │       ║
                    ║  └─────────────────────────┘       ║
                    ╚═══════════════════════════════════╝
```

---

## Original Plan (Legacy Reference)

> The original 5-agent plan is preserved below for reference. Some concepts were adapted into the 4 Wow Agents.

**Original Proposal (3-Stage + 5 Agents):**
```
                    ┌─────────────────────────┐
                    │    ParsedSession[]       │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │  Module A    │   │  Module B    │   │  5 Agents    │
    │ DataAnalyst  │   │ Personality  │   │  (parallel)  │
    └──────────────┘   └──────────────┘   └──────────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   Stage 2: ContentWriter │
                    └─────────────────────────┘
```

## Design Principles

1. **Parallel Execution**: Agents run concurrently with Module A/B (not sequentially)
2. **MVP Approach**: Direct Gemini analysis without RAG/VectorDB
3. **Conditional Execution**: Execution depends on tier and session content
4. **Gemini Constraint Compliance**: 4-level nesting limit → use flattened schemas
5. **Naming Convention**: Role-based names (same pattern as DataAnalyst, ContentWriter)

---

## Session Data Availability Analysis

> Analyzed actual `~/.claude/projects/` session files to validate each Agent's feasibility

### Session Data Structure

```
JSONL Format (one line = one JSON object)

Message Types:
- user: User message or tool_result
- assistant: Claude response (with token usage)
- queue-operation: Session management
- file-history-snapshot: File backup

Key Fields:
- sessionId, timestamp, cwd, gitBranch
- message.usage.{input_tokens, output_tokens, cache_*}
- message.content (string or array)
```

### Extractable Data

| Data | Path | Agent Usage |
|------|------|-------------|
| **Token Usage** | `message.usage.*` | Economist ✅ |
| **Cache Efficiency** | `message.usage.cache_read_input_tokens` | Economist ✅ |
| **Model Info** | `message.model` | Economist ✅ |
| **User Text** | `message.content` (text type) | Communicator ✅ |
| **Command Patterns** | `<command-name>` tags | Communicator ✅ |
| **Tool Usage** | `message.content[].name` | Work pattern analysis |
| **Edit Data** | `input.{file_path, old_string, new_string}` | CodeReviewer ✅ |
| **Error Messages** | `tool_result.is_error: true` | Librarian/Educator ⚠️ |

### Agent Data Availability

| Agent | Data Availability | Feasibility | Notes |
|-------|-------------------|-------------|-------|
| **Economist** | ✅ Rich | **4/5** | Token data complete, only cost baseline needs external injection |
| **Communicator** | ✅ Sufficient | **3/5** | Requires tool_result filtering, multi-session aggregation recommended |
| **CodeReviewer** | ⚠️ Conditional | **1-4/5** | Only works on sessions with code edits |
| **Librarian** | ⚠️ Limited | **3/5** | Cannot detect "difficulty" in error-free sessions |
| **Educator** | ❌ Insufficient | **2/5** | Hard to derive "growth areas" from successful sessions |

### Data Filtering Requirements

**Communicator - Extract actual user text:**
```typescript
// Filter conditions
if (message.type === 'user') {
  const content = message.content;
  // Exclude tool_result (AI tool execution results)
  if (isArray(content) && content[0]?.type === 'tool_result') continue;
  // Exclude isMeta (system-injected messages)
  if (message.isMeta) continue;
  // Actual user text
  extractText(content);
}
```

**CodeReviewer - Code session filter:**
```typescript
// Only code files from Edit tool usage
const codeExtensions = ['.ts', '.js', '.py', '.tsx', '.jsx'];
const hasCodeEdit = edits.some(e =>
  codeExtensions.some(ext => e.file_path.endsWith(ext))
);
```

**Librarian/Educator - Error session filter:**
```typescript
// Check for tool_result with is_error: true
const hasErrors = toolResults.some(r => r.is_error === true);
```

### Discovered Error Types (for Librarian/Educator)

| Error Type | Example | Analysis Value |
|------------|---------|----------------|
| TypeScript Error | `error TS1205: Re-exporting...` | Technical understanding |
| Edit Failure | `String to replace not found` | Code comprehension gap |
| File Sync | `File has been modified since read` | Workflow issue |
| Missing Read | `File has not been read yet` | Process issue |

### Recommended Implementation Priority

**Phase 1 (Data Rich):**
1. Economist - Token data fully available
2. Communicator - Sufficient data after filtering

**Phase 2 (Conditional Execution):**
3. CodeReviewer - Only runs on code sessions

**Phase 3 (Redesign Review Needed):**
4. Librarian - Error session analysis or multi-session aggregation
5. Educator - Integrate with Librarian or separate approach

---

## 5 New Agents

| Agent | Role | Min Tier | Execution Condition | Data Availability |
|-------|------|----------|---------------------|-------------------|
| **Economist** | Token efficiency, cost analysis, ROI | Premium | Always | ✅ Rich |
| **Communicator** | Prompt patterns, communication effectiveness | Premium | Always | ✅ Sufficient |
| **CodeReviewer** | Security vulnerabilities, code quality | Enterprise | When code edits exist | ⚠️ Conditional |
| **Librarian** | Knowledge gaps, learning pattern analysis | Premium | When errors exist | ⚠️ Limited |
| **Educator** | Learning guide, exercise generation | Premium | When growth areas detected | ❌ Redesign needed |

## Communicator Agent: Bottom-up Pattern Discovery

### Approach
- ❌ Define categories then find patterns (Top-down)
- ✅ Discover repeated patterns then categorize (Bottom-up)

### Pattern Discovery Method: AI-based

**N-gram approach limitations:**
- Recognizes "do it" ≠ "please do it" ≠ "could you do it" as different (string matching)
- Requires language-specific tokenizer
- Cannot understand context

**AI-based approach advantages:**
- Recognizes "do it", "please do it", "could you do it" → same intent pattern
- Naturally handles mixed languages
- Can evaluate effectiveness based on context

### Processing Steps

```
Step 1: AI discovers semantically repeated patterns from all user messages
        - Group expressions with similar intent
        - Sentence structure patterns (question, command, explanation)
        - Context provision patterns

Step 2: Select top patterns by frequency/impact
        - Patterns semantically repeated 3+ times
        - Patterns that affected AI response quality

Step 3: Categorize discovered patterns post-hoc
        - Categories derived from data (not predefined)

Step 4: Evaluate each pattern's effectiveness + suggest improvements
```

### Output Example

```
Discovered Pattern #1: "just do it" (12 occurrences)
- Category: Request style
- Effectiveness: ⚠️ Low - Missing goal/context requires AI to ask follow-up questions
- Alternative: "To achieve X, implement Y feature. Current state is Z"

Discovered Pattern #2: Code block only transmission (8 occurrences)
- Category: Context provision
- Effectiveness: ⚠️ Medium - Code present but intent unclear
- Alternative: "In this code, [problem] prevents [desired result]"
```

## File Structure

### New Files to Create

```
src/lib/analyzer/
├── agents/                           # NEW
│   ├── base-agent.ts                 # BaseAgent abstract class
│   ├── economist.ts
│   ├── code-reviewer.ts
│   ├── librarian.ts
│   ├── educator.ts
│   ├── communicator.ts               # Bottom-up pattern discovery
│   ├── agent-prompts.ts              # PTCF prompts for each agent
│   └── index.ts

src/lib/models/
└── agent-outputs.ts                  # Agent output Zod schemas
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/analyzer/verbose-analyzer.ts` | Agent orchestration, parallel execution |
| `src/lib/analyzer/stages/content-writer.ts` | Accept AgentOutputs, integrate into narrative |
| `src/lib/analyzer/content-gateway.ts` | Tier-based Agent field filtering |
| `src/lib/models/verbose-evaluation.ts` | Add Agent output schema fields |

## Zod Schemas (Gemini 4-level nesting compliant)

```typescript
// Flattened schemas - semicolon-separated strings for nested data
export const EconomistAnalysisSchema = z.object({
  tokenEfficiencyScore: z.number().min(0).max(100),
  estimatedMonthlyCost: z.string(),
  costLeakageAreas: z.string(), // "area:severity:suggestion;..."
  roiAssessment: z.string(),
  recommendations: z.string(),
});

export const CodeReviewerAnalysisSchema = z.object({
  securityFindings: z.string(),    // "type:severity:location:fix;..."
  codeQualityScore: z.number().min(0).max(100),
  logicIssues: z.string(),
  bestPracticeViolations: z.string(),
});

export const LibrarianAnalysisSchema = z.object({
  knowledgeGaps: z.string(),       // "topic:evidence:priority;..."
  learningPatterns: z.string(),
  skillProgression: z.string(),
  recommendedResources: z.string(),
});

export const EducatorAnalysisSchema = z.object({
  keyConceptsToLearn: z.string(),
  commonMistakes: z.string(),
  practiceExercises: z.string(),
  studyPriorities: z.string(),
});

export const CommunicatorAnalysisSchema = z.object({
  discoveredPatterns: z.string(),  // "pattern:frequency:category:effectiveness:alternative;..."
  overallCommunicationScore: z.number().min(0).max(100),
  topStrengths: z.string(),
  topImprovements: z.string(),
  promptingStyleSummary: z.string(),
});
```

## Pipeline Integration

```typescript
private async runSpecializedAgents(
  data: StructuredAnalysisData,
  tier: UserTier
): Promise<AgentOutputs> {
  const agents = [
    new Economist(this.geminiClient, tier),
    new Librarian(this.geminiClient, tier),
    new Educator(this.geminiClient, tier),
    new CodeReviewer(this.geminiClient, tier),
    new Communicator(this.geminiClient, tier),
  ].filter(agent => agent.canRun());

  const results = await Promise.allSettled(
    agents.map(agent => agent.analyze(data))
  );

  return this.mergeAgentResults(results);
}
```

## Tier Access Rights

| Content | Free | Premium | Enterprise |
|---------|------|---------|------------|
| EconomistAnalysis | - | Summary | Full |
| CodeReviewerAnalysis | - | - | Full |
| LibrarianAnalysis | - | Partial | Full |
| EducatorAnalysis | - | Summary | Full |
| CommunicatorAnalysis | - | Top 3 patterns | Full |

## Cost Estimation (MVP)

| Agent | Est. Tokens | Est. Cost/Call |
|-------|-------------|----------------|
| Economist | 20K | ~$0.015 |
| Librarian | 25K | ~$0.02 |
| Educator | 25K | ~$0.02 |
| CodeReviewer | 35K | ~$0.03 |
| Communicator | 30K | ~$0.025 |
| **Total** | ~135K | **~$0.11** |

**Existing pipeline:** ~$0.06/analysis
**With Agents:** ~$0.17/analysis (Enterprise, all Agents)

## Future Plans: RAG Integration (Optional)

After MVP, when adding RAG:

1. Create `src/lib/analyzer/knowledge/` directory
2. Implement `KnowledgeLayer` interface:
   ```typescript
   interface KnowledgeLayer {
     retrieve(query: string): Promise<KnowledgeItem[]>;
     getGuruQuotes(context: string): Promise<Quote[]>;
   }
   ```
3. Implement vector search with Supabase pgvector
4. Inject KnowledgeLayer into Agent constructor

## Implementation Order (Based on Data Availability)

### Phase 1: Infrastructure & Data-Rich Agents
1. Schema & Infrastructure (`agent-outputs.ts`, `base-agent.ts`)
2. **Economist** - Token/cost analysis (data fully available)
3. **Communicator** - Prompt pattern analysis (data sufficient)

### Phase 2: Conditional Execution Agents
4. **CodeReviewer** - Code quality analysis (only runs on code sessions)

### Phase 3: After Redesign Review
5. **Librarian** - Knowledge gap analysis (requires error session analysis or multi-session aggregation)
6. **Educator** - Learning guide (review integration with Librarian)

### Phase 4: Pipeline Integration & Testing
7. Modify `verbose-analyzer.ts`
8. Testing & Validation

## Verification Methods

1. `npm run build` passes
2. `npm run typecheck` passes
3. `npm test` passes
4. Manual test with `noslop analyze`:
   - Verify Agent parallel execution (logs)
   - Verify Agent output included in final report
   - Verify Tier filtering works correctly
