/**
 * Multitasking Data - Zod schemas for multi-session work pattern analysis
 *
 * Detects:
 * - Session focus / goal coherence (single purpose per session)
 * - Context pollution (multiple unrelated tasks in one session)
 * - Work unit separation (research vs implementation sessions)
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-level nesting limit.
 *
 * @module models/multitasking-data
 */

import { z } from 'zod';

// ============================================================================
// Work Type Enum
// ============================================================================

/**
 * Types of work detected in a session
 */
export type WorkType =
  | 'main_development'
  | 'research_experiment'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'mixed';

/**
 * Multitasking strategy types
 */
export type MultitaskingStrategyType =
  | 'effective_parallel'    // Independent work units effectively separated
  | 'focused_serial'        // One task at a time (not multitasking)
  | 'context_polluted'      // Multiple unrelated tasks in one session
  | 'chaotic_switching';    // Random switching between sessions/tasks

// ============================================================================
// Multitasking Analysis Output Schema (LLM-friendly, flattened)
// ============================================================================

/**
 * Multitasking Analysis Output Schema
 *
 * Analyzes multi-session work patterns:
 * - Goal coherence per session (single purpose)
 * - Context pollution detection (task bleeding)
 * - Work unit separation quality
 *
 * @example
 * ```json
 * {
 *   "sessionFocusData": "sess-001|main_development|85|15|API 엔드포인트 구현;sess-002|research_experiment|90|10|새 라이브러리 테스트",
 *   "contextPollutionData": "sess-003|백엔드 API|프론트엔드 CSS|아 그거 말고 이것도|12",
 *   "workUnitSeparationData": "project-alpha|sess-001|main_development|src/api/user.ts,src/api/auth.ts;project-alpha|sess-002|research_experiment|experiments/test.ts",
 *   "strategyEvaluationData": "effective_parallel|메인 개발과 리서치를 별도 세션으로 분리|독립 작업 단위별 세션 분리가 효과적입니다",
 *   "avgGoalCoherence": 87,
 *   "avgContextPollutionScore": 12,
 *   "workUnitSeparationScore": 92,
 *   "fileOverlapRate": 5,
 *   "multitaskingEfficiencyScore": 88,
 *   "totalSessionsAnalyzed": 5,
 *   "projectGroupCount": 2,
 *   "topInsights": [
 *     "메인 개발과 리서치를 별도 세션으로 효과적으로 분리하고 있습니다",
 *     "세션 3에서 작업 전환이 잦아 컨텍스트 오염이 발생했습니다",
 *     "파일 중복 5%로 작업 경계가 명확합니다"
 *   ],
 *   "confidenceScore": 0.82
 * }
 * ```
 */
export const MultitaskingAnalysisOutputSchema = z.object({
  // Session focus data - "sessionId|workType|goalCoherence:0-100|pollutionScore:0-100|workDescription;..."
  sessionFocusData: z
    .string()
    .max(5000)
    .describe(
      'Session focus metrics: "sessionId|workType|goalCoherence:0-100|pollutionScore:0-100|workDescription;..."'
    ),

  // Context pollution instances - "sessionId|fromTask|toTask|signal|messageIndex;..."
  contextPollutionData: z
    .string()
    .max(3000)
    .describe(
      'Context pollution instances: "sessionId|fromTask|toTask|pollutionSignal|messageIndex;..."'
    ),

  // Work unit separation data - "projectPath|sessionId|workType|filesWorkedOn;..."
  workUnitSeparationData: z
    .string()
    .max(5000)
    .describe(
      'Work unit separation: "projectPath|sessionId|workType|filesWorkedOn(comma-sep);..."'
    ),

  // Strategy evaluation - "strategyType|evidence|recommendation;..."
  strategyEvaluationData: z
    .string()
    .max(2000)
    .describe(
      'Strategy evaluation: "strategyType|evidence|recommendation;..."'
    ),

  // Average goal coherence (0-100, higher = better)
  avgGoalCoherence: z.number().min(0).max(100),

  // Average context pollution score (0-100, lower = better)
  avgContextPollutionScore: z.number().min(0).max(100),

  // Work unit separation quality score (0-100, higher = better)
  workUnitSeparationScore: z.number().min(0).max(100),

  // File overlap rate between sessions (0-100%, lower = better)
  fileOverlapRate: z.number().min(0).max(100),

  // Overall multitasking efficiency score (0-100)
  multitaskingEfficiencyScore: z.number().min(0).max(100),

  // Total sessions analyzed
  totalSessionsAnalyzed: z.number().min(0),

  // Number of project groups (same project sessions grouped)
  projectGroupCount: z.number().min(0),

  // Top 3 multitasking insights
  topInsights: z.array(z.string().max(200)).max(3),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type MultitaskingAnalysisOutput = z.infer<typeof MultitaskingAnalysisOutputSchema>;

// ============================================================================
// Parsed Types (for storage/display - full nested objects)
// ============================================================================

/**
 * Session focus metrics
 */
export interface SessionFocus {
  sessionId: string;
  workType: WorkType;
  goalCoherence: number;      // 0-100
  pollutionScore: number;     // 0-100
  workDescription: string;
}

/**
 * Context pollution instance
 */
export interface ContextPollutionInstance {
  sessionId: string;
  fromTask: string;
  toTask: string;
  pollutionSignal: string;    // e.g., "아 그거 말고 이것도"
  messageIndex: number;
}

/**
 * Work unit in a project
 */
export interface WorkUnit {
  projectPath: string;
  sessionId: string;
  workType: WorkType;
  filesWorkedOn: string[];
}

/**
 * Strategy evaluation
 */
export interface StrategyEvaluation {
  strategyType: MultitaskingStrategyType;
  evidence: string;
  recommendation: string;
}

/**
 * Full multitasking analysis result (parsed from LLM output)
 */
export interface MultitaskingAnalysis {
  sessionFocuses: SessionFocus[];
  contextPollutionInstances: ContextPollutionInstance[];
  workUnits: WorkUnit[];
  strategyEvaluations: StrategyEvaluation[];
  avgGoalCoherence: number;
  avgContextPollutionScore: number;
  workUnitSeparationScore: number;
  fileOverlapRate: number;
  multitaskingEfficiencyScore: number;
  totalSessionsAnalyzed: number;
  projectGroupCount: number;
  topInsights: string[];
  confidenceScore: number;
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse work type string to WorkType
 */
function parseWorkType(str: string): WorkType {
  const validTypes: WorkType[] = [
    'main_development',
    'research_experiment',
    'debugging',
    'refactoring',
    'documentation',
    'mixed',
  ];
  return validTypes.includes(str as WorkType) ? (str as WorkType) : 'mixed';
}

/**
 * Parse strategy type string to MultitaskingStrategyType
 */
function parseStrategyType(str: string): MultitaskingStrategyType {
  const validTypes: MultitaskingStrategyType[] = [
    'effective_parallel',
    'focused_serial',
    'context_polluted',
    'chaotic_switching',
  ];
  return validTypes.includes(str as MultitaskingStrategyType)
    ? (str as MultitaskingStrategyType)
    : 'focused_serial';
}

/**
 * Parse session focus data from flattened string
 *
 * @param data - "sessionId|workType|goalCoherence|pollutionScore|workDescription;..."
 * @returns Parsed session focuses
 */
export function parseSessionFocusData(data: string | undefined): SessionFocus[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        sessionId: parts[0] || '',
        workType: parseWorkType(parts[1] || ''),
        goalCoherence: parseInt(parts[2], 10) || 50,
        pollutionScore: parseInt(parts[3], 10) || 0,
        workDescription: parts[4] || '',
      };
    });
}

/**
 * Parse context pollution data from flattened string
 *
 * @param data - "sessionId|fromTask|toTask|signal|messageIndex;..."
 * @returns Parsed context pollution instances
 */
export function parseContextPollutionData(data: string | undefined): ContextPollutionInstance[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        sessionId: parts[0] || '',
        fromTask: parts[1] || '',
        toTask: parts[2] || '',
        pollutionSignal: parts[3] || '',
        messageIndex: parseInt(parts[4], 10) || 0,
      };
    });
}

/**
 * Parse work unit separation data from flattened string
 *
 * @param data - "projectPath|sessionId|workType|filesWorkedOn;..."
 * @returns Parsed work units
 */
export function parseWorkUnitSeparationData(data: string | undefined): WorkUnit[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        projectPath: parts[0] || '',
        sessionId: parts[1] || '',
        workType: parseWorkType(parts[2] || ''),
        filesWorkedOn: parts[3]?.split(',').filter(Boolean) || [],
      };
    });
}

/**
 * Parse strategy evaluation data from flattened string
 *
 * @param data - "strategyType|evidence|recommendation;..."
 * @returns Parsed strategy evaluations
 */
export function parseStrategyEvaluationData(data: string | undefined): StrategyEvaluation[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        strategyType: parseStrategyType(parts[0] || ''),
        evidence: parts[1] || '',
        recommendation: parts[2] || '',
      };
    });
}

/**
 * Parse full MultitaskingAnalysisOutput into MultitaskingAnalysis
 *
 * @param output - LLM output (flattened)
 * @returns Parsed analysis
 */
export function parseMultitaskingAnalysisOutput(output: MultitaskingAnalysisOutput): MultitaskingAnalysis {
  return {
    sessionFocuses: parseSessionFocusData(output.sessionFocusData),
    contextPollutionInstances: parseContextPollutionData(output.contextPollutionData),
    workUnits: parseWorkUnitSeparationData(output.workUnitSeparationData),
    strategyEvaluations: parseStrategyEvaluationData(output.strategyEvaluationData),
    avgGoalCoherence: output.avgGoalCoherence,
    avgContextPollutionScore: output.avgContextPollutionScore,
    workUnitSeparationScore: output.workUnitSeparationScore,
    fileOverlapRate: output.fileOverlapRate,
    multitaskingEfficiencyScore: output.multitaskingEfficiencyScore,
    totalSessionsAnalyzed: output.totalSessionsAnalyzed,
    projectGroupCount: output.projectGroupCount,
    topInsights: output.topInsights || [],
    confidenceScore: output.confidenceScore,
  };
}

// ============================================================================
// Default/Empty Values
// ============================================================================

/**
 * Create default/empty multitasking analysis output
 */
export function createDefaultMultitaskingAnalysisOutput(): MultitaskingAnalysisOutput {
  return {
    sessionFocusData: '',
    contextPollutionData: '',
    workUnitSeparationData: '',
    strategyEvaluationData: '',
    avgGoalCoherence: 50,
    avgContextPollutionScore: 50,
    workUnitSeparationScore: 50,
    fileOverlapRate: 50,
    multitaskingEfficiencyScore: 50,
    totalSessionsAnalyzed: 0,
    projectGroupCount: 0,
    topInsights: [],
    confidenceScore: 0,
  };
}
