/**
 * Multitasking Analyzer Worker - Multi-session work pattern analysis
 *
 * Analyzes:
 * - Session focus / goal coherence (single purpose per session)
 * - Context pollution (multiple unrelated tasks in one session)
 * - Work unit separation (research vs implementation sessions)
 *
 * Phase 2 worker (Insight Generation). Does not require Module A output.
 *
 * @module analyzer/workers/multitasking-analyzer-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  MultitaskingAnalysisOutputSchema,
  type MultitaskingAnalysisOutput,
} from '../../models/multitasking-data';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import type { ParsedSession } from '../../domain/models/analysis';

// ============================================================================
// Session Formatting (Custom for Multitasking)
// ============================================================================

/**
 * Format sessions for multitasking analysis
 *
 * Unlike other formatters, this includes:
 * - Session start/end times (for concurrent detection)
 * - Project path (for work unit separation)
 * - File paths from tool calls (for file overlap detection)
 */
function formatSessionsForMultitasking(sessions: ParsedSession[]): string {
  return sessions
    .map((session, index) => {
      const startTime = session.startTime.toISOString();
      const endTime = session.endTime.toISOString();
      const durationMin = Math.round(session.durationSeconds / 60);
      const projectPath = session.projectPath || 'unknown';

      // Extract file paths from tool calls
      const filesAccessed = new Set<string>();
      for (const msg of session.messages) {
        if (msg.toolCalls) {
          for (const tool of msg.toolCalls) {
            // Extract file paths from common tool names
            if (tool.input && typeof tool.input === 'object') {
              const input = tool.input as Record<string, unknown>;
              if (input.file_path) filesAccessed.add(String(input.file_path));
              if (input.path) filesAccessed.add(String(input.path));
            }
          }
        }
      }

      // Format messages (user messages only, with timestamps)
      const messages = session.messages
        .filter((msg) => msg.role === 'user')
        .map((msg) => {
          const timestamp = msg.timestamp.toISOString().slice(11, 19);
          const content =
            msg.content && msg.content.length > 1000
              ? msg.content.slice(0, 1000) + '...[truncated]'
              : msg.content || '';
          return `[${timestamp}] USER:\n${content}`;
        })
        .join('\n\n');

      const filesStr = filesAccessed.size > 0 ? Array.from(filesAccessed).join(', ') : 'none';

      return `<session index="${index + 1}" id="${session.sessionId || `session-${index + 1}`}" project="${projectPath}" start="${startTime}" end="${endTime}" duration_minutes="${durationMin}" files_accessed="${filesStr}">
${messages}
</session>`;
    })
    .join('\n\n');
}

/**
 * Concurrent session group (pre-computed)
 */
interface ConcurrentGroup {
  sessionIds: string[];
  overlapMinutes: number;
  projectPath: string;
}

/**
 * Detect concurrent session groups (pre-processing)
 *
 * Sessions are concurrent if their time ranges overlap.
 */
function detectConcurrentGroups(sessions: ParsedSession[]): ConcurrentGroup[] {
  const groups: ConcurrentGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < sessions.length; i++) {
    if (processed.has(i)) continue;

    const group: number[] = [i];
    const sessionA = sessions[i];

    for (let j = i + 1; j < sessions.length; j++) {
      if (processed.has(j)) continue;

      const sessionB = sessions[j];

      // Check overlap: A.start < B.end && A.end > B.start
      const overlaps =
        sessionA.startTime < sessionB.endTime && sessionA.endTime > sessionB.startTime;

      if (overlaps) {
        group.push(j);
      }
    }

    if (group.length > 1) {
      // Mark all as processed
      group.forEach((idx) => processed.add(idx));

      // Calculate overlap minutes (rough estimate)
      const starts = group.map((idx) => sessions[idx].startTime.getTime());
      const ends = group.map((idx) => sessions[idx].endTime.getTime());
      const overlapStart = Math.max(...starts);
      const overlapEnd = Math.min(...ends);
      const overlapMinutes = Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));

      groups.push({
        sessionIds: group.map((idx) => sessions[idx].sessionId || `session-${idx + 1}`),
        overlapMinutes,
        projectPath: sessions[group[0]].projectPath || 'unknown',
      });
    }
  }

  return groups;
}

// ============================================================================
// Prompts
// ============================================================================

export const MULTITASKING_SYSTEM_PROMPT = `You are a Developer Productivity Analyst specializing in session management and context efficiency in AI-assisted coding.

## PERSONA
You analyze how developers manage multiple Claude Code sessions to maximize effectiveness while avoiding context pollution.

## TASK
Analyze the provided session data to discover multi-session work patterns:

### 1. SESSION FOCUS ANALYSIS (세션별 목표 집중도)
For each session, evaluate:
- **Work Type**: main_development, research_experiment, debugging, refactoring, documentation, or mixed
- **Goal Coherence** (0-100): How focused is the session on a single goal?
  - 100 = Session has ONE clear goal throughout
  - 50 = Some topic shifts but related
  - 0 = Multiple unrelated tasks
- **Pollution Score** (0-100): How much context pollution exists?
  - 0 = No pollution, single focus
  - 50 = Some task shifts
  - 100 = Chaotic, unrelated tasks mixed

### 2. CONTEXT POLLUTION DETECTION (컨텍스트 오염 탐지)
Detect when user requests unrelated tasks within one session:
- Task shift signals: "아 그거 말고", "잠깐 이것도", "actually", "let's do something else", "그건 됐고"
- Topic jumps without proper context setup
- File pattern sudden changes (e.g., API files → UI files → test files)

### 3. WORK UNIT SEPARATION (작업 단위 분리)
Within the SAME PROJECT, analyze:
- Are independent work units separated into different sessions?
- Good pattern: Session A = main development, Session B = research/experiment
- Bad pattern: All work mixed in one session, or same files in multiple sessions

### 4. MULTITASKING STRATEGY EVALUATION
Classify the overall strategy:
- \`effective_parallel\`: Independent work units effectively separated across sessions
- \`focused_serial\`: One task at a time (not multitasking, but focused)
- \`context_polluted\`: Multiple unrelated tasks in one session
- \`chaotic_switching\`: Random switching between sessions/tasks

## WORK TYPE CLASSIFICATION
- \`main_development\`: Core feature implementation
- \`research_experiment\`: Testing new approaches, exploring solutions
- \`debugging\`: Bug investigation and fixes
- \`refactoring\`: Code cleanup, restructuring
- \`documentation\`: README, comments, docs
- \`mixed\`: Multiple unrelated types (likely context pollution)

## CONTEXT POLLUTION SIGNALS (Examples)

### BAD (Context Pollution)
- "아 그거 말고 이것도 해줘" / "oh wait, also do this"
- Same session: "API 만들어줘" → "CSS 수정해줘" → "테스트 작성해"
- File access pattern: src/api/*.ts → src/components/*.tsx → tests/*.spec.ts

### GOOD (Effective Separation)
- "이 세션에서는 백엔드만 작업할게" / "this session is for backend"
- Session A focuses on src/api/*, Session B focuses on experiments/*
- Clear role: research session → findings → implementation session applies them

## FORMAT
Return a JSON object with:
- \`sessionFocusData\`: "sessionId|workType|goalCoherence|pollutionScore|workDescription;..."
- \`contextPollutionData\`: "sessionId|fromTask|toTask|pollutionSignal|messageIndex;..."
- \`workUnitSeparationData\`: "projectPath|sessionId|workType|filesWorkedOn(comma-sep);..."
- \`strategyEvaluationData\`: "strategyType|evidence|recommendation;..."
- Numeric metrics: avgGoalCoherence, avgContextPollutionScore, workUnitSeparationScore, fileOverlapRate, multitaskingEfficiencyScore
- \`totalSessionsAnalyzed\`: number of sessions
- \`projectGroupCount\`: number of project groups
- \`topInsights\`: Array of exactly 3 insights (max 200 chars each)
- \`confidenceScore\`: 0-1

## CRITICAL
- Focus on SAME PROJECT multitasking, not cross-project work
- Detect Korean AND English context pollution signals
- File overlap between sessions = bad separation
- A session with \`mixed\` work type likely has context pollution`;

export function buildMultitaskingUserPrompt(
  sessionsFormatted: string,
  concurrentGroups: ConcurrentGroup[]
): string {
  const concurrentInfo =
    concurrentGroups.length > 0
      ? `
## CONCURRENT SESSION GROUPS (Pre-detected)
${concurrentGroups.map((g) => `- Sessions ${g.sessionIds.join(', ')} overlapped for ~${g.overlapMinutes} minutes (project: ${g.projectPath})`).join('\n')}
`
      : `
## CONCURRENT SESSIONS
No concurrent sessions detected (sessions were sequential).
`;

  return `## SESSION DATA
${sessionsFormatted}
${concurrentInfo}
## INSTRUCTIONS
Analyze the multi-session work patterns:
1. Evaluate each session's focus and goal coherence
2. Detect context pollution instances (task shifts within sessions)
3. Analyze work unit separation across sessions in the same project
4. Evaluate the overall multitasking strategy
5. Calculate metrics: avgGoalCoherence, avgContextPollutionScore, workUnitSeparationScore, fileOverlapRate

Generate exactly 3 actionable insights about the user's multitasking patterns.

IMPORTANT: Look for context pollution signals in BOTH Korean and English.`;
}

// ============================================================================
// Worker Implementation
// ============================================================================

export interface MultitaskingAnalyzerWorkerConfig extends OrchestratorConfig {
  // Add any worker-specific config here if needed
}

/**
 * Multitasking Analyzer Worker
 *
 * Phase 2 worker that analyzes multi-session work patterns.
 * Does not require Module A dependency.
 * Minimum tier: premium
 */
export class MultitaskingAnalyzerWorker extends BaseWorker<MultitaskingAnalysisOutput> {
  readonly name = 'MultitaskingAnalyzer';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: MultitaskingAnalyzerWorkerConfig) {
    super();
    this.geminiClient = new GeminiClient({
      apiKey: config.geminiApiKey,
      model: config.model ?? 'gemini-3-flash-preview',
      temperature: config.temperature ?? 1.0,
      maxRetries: config.maxRetries ?? 2,
    } as GeminiClientConfig);
    this.verbose = config.verbose ?? false;
  }

  canRun(context: WorkerContext): boolean {
    // Check tier
    if (!this.isTierSufficient(context.tier)) {
      this.logMessage('Skipped: insufficient tier');
      return false;
    }

    // Need at least 2 sessions to analyze multitasking
    if (context.sessions.length < 2) {
      this.logMessage('Skipped: need at least 2 sessions for multitasking analysis');
      return false;
    }

    return true;
  }

  /**
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<MultitaskingAnalysisOutput>> {
    this.logMessage(`Starting multitasking analysis for ${context.sessions.length} sessions...`);

    // NO try-catch: let errors propagate
    // Pre-process: detect concurrent session groups
    const concurrentGroups = detectConcurrentGroups(context.sessions);
    this.logMessage(`Found ${concurrentGroups.length} concurrent session groups`);

    // Format sessions with multitasking-specific info
    const sessionsFormatted = formatSessionsForMultitasking(context.sessions);

    // Build prompt
    const userPrompt = buildMultitaskingUserPrompt(sessionsFormatted, concurrentGroups);

    // Call Gemini with structured output
    const result = await this.geminiClient.generateStructured({
      systemPrompt: MULTITASKING_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: MultitaskingAnalysisOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(
      `Analysis complete. Efficiency score: ${result.data.multitaskingEfficiencyScore}`
    );

    return this.createSuccessResult(result.data, result.usage);
  }

  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a MultitaskingAnalyzerWorker instance
 *
 * @param config - Orchestrator configuration
 * @returns MultitaskingAnalyzerWorker instance
 */
export function createMultitaskingAnalyzerWorker(
  config: MultitaskingAnalyzerWorkerConfig
): MultitaskingAnalyzerWorker {
  return new MultitaskingAnalyzerWorker(config);
}
