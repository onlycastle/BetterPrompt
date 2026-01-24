/**
 * Agent Outputs - Zod schemas for 4 Wow-Focused Agents
 *
 * Each agent discovers unconscious patterns that create "wow moments":
 * - Pattern Detective: Conversation patterns, repeated questions
 * - Anti-Pattern Spotter: Error loops, bad habits
 * - Knowledge Gap Analyzer: Knowledge gaps + learning suggestions
 * - Context Efficiency Analyzer: Token inefficiency patterns
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-level nesting limit.
 *
 * @module models/agent-outputs
 */

import { z } from 'zod';

// ============================================================================
// Pattern Detective: Conversation Style Discovery
// ============================================================================

/**
 * Pattern Detective Output Schema
 *
 * Detects:
 * - Repeated questions across sessions
 * - Conversation style patterns (vague requests, etc.)
 * - Request start patterns
 *
 * @example
 * ```json
 * {
 *   "repeatedQuestionsData": "React hooks:5:useEffect cleanup;TypeScript generics:3:generic constraints",
 *   "conversationStyleData": "vague_request:23:'just do it' pattern;proactive_context:15:provides context upfront",
 *   "requestStartPatternsData": "Can you...:45;fix this:12;help me:8",
 *   "topInsights": [
 *     "TypeScript generics questions appeared 12 times across 5 sessions",
 *     "67% of requests start without specific context",
 *     "'Just do it' pattern detected 23 times"
 *   ],
 *   "overallStyleSummary": "Direct communicator who tends to skip context",
 *   "confidenceScore": 0.85
 * }
 * ```
 */
export const PatternDetectiveOutputSchema = z.object({
  // Repeated questions - "topic:count:example;..."
  repeatedQuestionsData: z.string().max(2000),

  // Conversation style patterns - "pattern:frequency:example;..."
  conversationStyleData: z.string().max(2000),

  // Request start patterns - "phrase:count;..."
  requestStartPatternsData: z.string().max(1000),

  // Top 3 Wow Insights (displayed directly in UI)
  topInsights: z.array(z.string().max(3000)).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  // These provide explicit categorization instead of relying on keyword matching
  kptKeep: z.array(z.string().max(500)).max(2).optional(),     // Strengths to maintain (0-2)
  kptProblem: z.array(z.string().max(500)).max(2).optional(),  // Issues to address (1-2, expected)
  kptTry: z.array(z.string().max(500)).max(2).optional(),      // Actionable suggestions (1-2, expected)

  // Overall summary
  overallStyleSummary: z.string().max(3000),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Repeated command patterns (multi-step instructions)
  // "pattern|frequency|example;..." where pattern uses → to show sequence
  // Example: "check code→analyze problem→create plan|5|check the code, analyze it, then make a plan"
  repeatedCommandPatternsData: z.string().max(3000).optional(),

  // NEW: Structured strengths with evidence (replaces topInsights for positive patterns)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().max(4000).optional(),

  // NEW: Growth areas with evidence and recommendations (replaces topInsights for improvements)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().max(4000).optional(),
});

export type PatternDetectiveOutput = z.infer<typeof PatternDetectiveOutputSchema>;

/**
 * Parsed repeated command pattern
 * Represents a multi-step instruction sequence that repeats across sessions
 */
export interface RepeatedCommandPattern {
  /** The command sequence pattern (e.g., "check code→analyze problem→create plan") */
  pattern: string;
  /** How many times this pattern appeared */
  frequency: number;
  /** An actual example from the user (e.g., "check the code, analyze it, then make a plan") */
  example: string;
}

/**
 * Parse repeatedCommandPatternsData string into structured array
 *
 * @example
 * parseRepeatedCommandPatternsData("check code→analyze problem→create plan|5|check the code, analyze it, then make a plan;run tests→fix errors|3|run tests and fix any failures")
 * // Returns:
 * // [
 * //   { pattern: "check code→analyze problem→create plan", frequency: 5, example: "check the code, analyze it, then make a plan" },
 * //   { pattern: "run tests→fix errors", frequency: 3, example: "run tests and fix any failures" }
 * // ]
 */
export function parseRepeatedCommandPatternsData(
  data: string | undefined
): RepeatedCommandPattern[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const [pattern, freq, example] = entry.split('|');
      return {
        pattern: pattern?.trim() || '',
        frequency: parseInt(freq, 10) || 0,
        example: example?.trim() || '',
      };
    })
    .filter((item) => item.pattern && item.frequency > 0);
}

// ============================================================================
// Strengths & Growth Areas Parsing (NEW)
// ============================================================================

/**
 * Parsed strength item for agent insights
 * Represents a positive pattern with supporting evidence
 */
export interface AgentStrength {
  /** Clear pattern name (e.g., "Systematic Problem Decomposition") */
  title: string;
  /** 2-3 sentence detailed description */
  description: string;
  /** Direct quotes from user's actual messages */
  evidence: string[];
}

/**
 * Severity level for growth areas
 */
export type AgentSeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Parsed growth area for agent insights
 * Represents an area for improvement with recommendation
 *
 * Enhanced with quantification fields for definitive assessment.
 */
export interface AgentGrowthArea {
  /** Clear pattern name (e.g., "Context Provision Pattern") */
  title: string;
  /** 2-3 sentence description of the issue */
  description: string;
  /** Direct quotes from user's actual messages */
  evidence: string[];
  /** Specific, actionable recommendation */
  recommendation: string;
  /** Percentage of sessions where this pattern was observed (0-100) */
  frequency?: number;
  /** How critical this growth area is to address */
  severity?: AgentSeverityLevel;
  /** Computed priority based on frequency × impact (0-100) */
  priorityScore?: number;
}

/**
 * Parse strengthsData string into structured array
 * Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
 *
 * @example
 * parseStrengthsData("Systematic Approach|You break down complex problems into clear steps|'first understand the structure','then implement details'")
 * // Returns:
 * // [{ title: "Systematic Approach", description: "You break down...", evidence: ["first understand the structure", "then implement details"] }]
 */
export function parseStrengthsData(data: string | undefined): AgentStrength[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';

      // Parse evidence: comma-separated, remove surrounding quotes
      const evidence = evidenceStr
        .split(',')
        .map((e) => e.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);

      return { title, description, evidence };
    })
    .filter((item) => item.title && item.description);
}

/**
 * Parse growthAreasData string into structured array
 *
 * Supported formats:
 * - Extended: "title|description|evidence|recommendation|frequency|severity|priorityScore;..."
 * - Standard: "title|description|evidence|recommendation;..."
 *
 * @example
 * parseGrowthAreasData("Context Provision|Tends to skip context|'fix this','why?'|Provide context|75|high|82")
 * // Returns:
 * // [{ title: "Context Provision", description: "Tends to...", evidence: [...], recommendation: "Provide...", frequency: 75, severity: "high", priorityScore: 82 }]
 */
export function parseGrowthAreasData(data: string | undefined): AgentGrowthArea[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';
      const recommendation = parts[3]?.trim() || '';

      // Parse evidence: comma-separated, remove surrounding quotes
      const evidence = evidenceStr
        .split(',')
        .map((e) => e.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);

      // Parse optional quantification fields (extended format)
      const freq = parts[4] ? parseFloat(parts[4]) : undefined;
      const sev = parts[5]?.trim() as AgentSeverityLevel | undefined;
      const priority = parts[6] ? parseFloat(parts[6]) : undefined;

      const result: AgentGrowthArea = { title, description, evidence, recommendation };

      // Only add quantification fields if present and valid
      if (freq !== undefined && !isNaN(freq)) result.frequency = freq;
      if (sev && ['critical', 'high', 'medium', 'low'].includes(sev)) result.severity = sev;
      if (priority !== undefined && !isNaN(priority)) result.priorityScore = priority;

      return result;
    })
    .filter((item) => item.title && item.description);
}

// ============================================================================
// Recommended Resources Parsing (NEW)
// ============================================================================

/**
 * Parsed resource item for learning recommendations
 * Links to external documentation, tutorials, courses, etc.
 */
export interface ParsedResource {
  /** Topic the resource covers (e.g., "TypeScript generics") */
  topic: string;
  /** Type of resource */
  type: 'docs' | 'tutorial' | 'course' | 'article' | 'video';
  /** Full URL to the resource */
  url: string;
}

/**
 * Parse recommendedResourcesData string into structured array
 * Format: "topic:resource_type:full_url;..."
 *
 * Note: URLs contain colons (https://...) so we rejoin parts after the first two
 *
 * @example
 * parseRecommendedResourcesData("TypeScript generics:docs:https://www.typescriptlang.org/docs/handbook/2/generics.html;React hooks:tutorial:https://react.dev/learn/hooks-overview")
 * // Returns:
 * // [
 * //   { topic: "TypeScript generics", type: "docs", url: "https://www.typescriptlang.org/..." },
 * //   { topic: "React hooks", type: "tutorial", url: "https://react.dev/learn/hooks-overview" }
 * // ]
 */
export function parseRecommendedResourcesData(data: string | undefined): ParsedResource[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(':');
      const topic = parts[0]?.trim() || '';
      const type = parts[1]?.trim() || 'docs';
      // Handle URLs with colons (https://...) by rejoining remaining parts
      const url = parts.slice(2).join(':').trim();

      return { topic, type: type as ParsedResource['type'], url };
    })
    .filter((item) => item.topic && item.url);
}

// ============================================================================
// Anti-Pattern Spotter: Bad Habit Detection
// ============================================================================

/**
 * Anti-Pattern Spotter Output Schema
 *
 * Detects:
 * - Error loops (same error repeated)
 * - Learning avoidance patterns
 * - Repeated mistakes
 *
 * @example
 * ```json
 * {
 *   "errorLoopsData": "TypeScript type error:8:4.2:same error in 3 sessions;ESLint warning:5:2.1:ignored warnings",
 *   "learningAvoidanceData": "copy_paste_no_read:code copied without understanding:high;skip_explanation:skips AI explanations:medium",
 *   "repeatedMistakesData": "ESLint ignore abuse:12:session1,session3,session7;missing type annotations:8:session2,session5",
 *   "topInsights": [
 *     "ESLint errors repeated 8 times with avg 4.2 turns to resolve",
 *     "34% of code was copied without understanding verification",
 *     "Same approach persisted 3+ times in 8 cases"
 *   ],
 *   "overallHealthScore": 72,
 *   "confidenceScore": 0.78
 * }
 * ```
 */
export const AntiPatternSpotterOutputSchema = z.object({
  // Error loops - "error_type:repeat_count:avg_turns:example;..."
  errorLoopsData: z.string().max(2000),

  // Learning avoidance patterns - "pattern:evidence:severity;..."
  learningAvoidanceData: z.string().max(1500),

  // Repeated mistakes - "mistake:count:sessions;..."
  repeatedMistakesData: z.string().max(1500),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(3000)).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string().max(500)).max(2).optional(),     // Healthy habits to maintain (0-1)
  kptProblem: z.array(z.string().max(500)).max(2).optional(),  // Anti-patterns to address (1-2, expected)
  kptTry: z.array(z.string().max(500)).max(2).optional(),      // Actionable improvements (1-2, expected)

  // Overall health score (0-100)
  overallHealthScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Structured strengths with evidence (healthy habits)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().max(4000).optional(),

  // NEW: Growth areas with evidence and recommendations (anti-patterns to address)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().max(4000).optional(),
});

export type AntiPatternSpotterOutput = z.infer<typeof AntiPatternSpotterOutputSchema>;

// ============================================================================
// Cross-Session Anti-Pattern Detection (NEW)
// ============================================================================

/**
 * Anti-Pattern Hierarchy - Severity levels for cross-session pattern detection
 *
 * CRITICAL: Patterns that pose immediate risk to code quality and learning
 * WARNING: Patterns that slow progress and prevent optimal learning
 * INFO: Patterns worth noting but lower impact
 */
export const ANTI_PATTERN_HIERARCHY = {
  critical: ['blind_approval', 'sunk_cost_loop'] as const,
  warning: ['passive_acceptance', 'blind_retry'] as const,
  info: ['delegation_without_review'] as const,
} as const;

export type AntiPatternSeverity = 'critical' | 'warning' | 'info';
export type CriticalAntiPattern = (typeof ANTI_PATTERN_HIERARCHY.critical)[number];
export type WarningAntiPattern = (typeof ANTI_PATTERN_HIERARCHY.warning)[number];
export type InfoAntiPattern = (typeof ANTI_PATTERN_HIERARCHY.info)[number];
export type AntiPatternType = CriticalAntiPattern | WarningAntiPattern | InfoAntiPattern;

/**
 * Cross-Session Anti-Pattern Output Schema
 *
 * Detects behavioral patterns that repeat across 2+ sessions.
 * Only patterns appearing in multiple sessions qualify - single-session
 * occurrences are isolated incidents, not patterns.
 *
 * Uses semicolon-separated strings to comply with Gemini's 4-level nesting limit.
 *
 * @example
 * ```json
 * {
 *   "criticalAntiPatterns": "blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it'",
 *   "warningAntiPatterns": "passive_acceptance|WARNING|3|session_2,session_8,session_14|Moderate|accepting without evaluation",
 *   "infoAntiPatterns": "delegation_without_review|INFO|2|session_5,session_10|Moderate|shipped without testing",
 *   "isolatedIncidents": "blind_retry|session_6|single occurrence",
 *   "topInsights": [
 *     "CRITICAL: blind_approval pattern in 4 sessions - 'looks good, ship it' risks technical debt",
 *     "Try: Before approving, ask 'What could go wrong?' to break blind approval habit",
 *     "KEEP: Systematic error analysis in Sessions 2, 5, 9"
 *   ],
 *   "patternDensity": 45,
 *   "crossSessionConsistency": 0.72
 * }
 * ```
 */
export const CrossSessionAntiPatternOutputSchema = z.object({
  // Critical patterns - "pattern|severity|count|session_ids|frequency|evidence;..."
  criticalAntiPatterns: z.string().max(3000),

  // Warning patterns - "pattern|severity|count|session_ids|frequency|evidence;..."
  warningAntiPatterns: z.string().max(3000),

  // Info patterns - "pattern|severity|count|session_ids|frequency|evidence;..."
  infoAntiPatterns: z.string().max(3000),

  // Single-session occurrences (not patterns) - "incident|session_id|description;..."
  isolatedIncidents: z.string().max(2000),

  // Top 3 insights (Problem/Try/Keep structure)
  topInsights: z.array(z.string().max(3000)).max(3),

  // Pattern density score (0-100, higher = more anti-patterns)
  patternDensity: z.number().min(0).max(100),

  // Cross-session consistency (0-1, confidence in pattern detection)
  crossSessionConsistency: z.number().min(0).max(1),

  // Actionable recommendations (1-3)
  recommendedInterventions: z.array(z.string().max(1000)).max(3),

  // Cross-references: "pattern|quote1|quote2|quote3;..." (tracks pattern across sessions)
  sessionCrossReferences: z.string().max(4000).optional(),

  // Strengths: "behavior|sessions|quotes;..." (positive patterns across sessions)
  strengthsAcrossSessions: z.string().max(3000).optional(),
});

export type CrossSessionAntiPatternOutput = z.infer<typeof CrossSessionAntiPatternOutputSchema>;

// ============================================================================
// Cross-Session Anti-Pattern Parsing Functions
// ============================================================================

/**
 * Parsed cross-session anti-pattern occurrence
 */
export interface ParsedCrossSessionPattern {
  /** Anti-pattern type (e.g., 'blind_approval') */
  patternType: AntiPatternType;
  /** Severity level */
  severity: AntiPatternSeverity;
  /** Number of sessions where pattern appears */
  sessionCount: number;
  /** Session IDs where pattern appears */
  sessionIds: string[];
  /** Frequency classification ('High' if 3+, 'Moderate' if 2) */
  frequency: 'High' | 'Moderate';
  /** Evidence quote from one session */
  evidence: string;
}

/**
 * Parse cross-session anti-pattern data string into structured array
 * Format: "pattern|severity|count|session_ids|frequency|evidence;..."
 *
 * @example
 * parseCrossSessionPatternsData("blind_approval|CRITICAL|4|session_3,session_7,session_12,session_15|High|'looks good, ship it'")
 * // Returns:
 * // [{
 * //   patternType: 'blind_approval',
 * //   severity: 'critical',
 * //   sessionCount: 4,
 * //   sessionIds: ['session_3', 'session_7', 'session_12', 'session_15'],
 * //   frequency: 'High',
 * //   evidence: "'looks good, ship it'"
 * // }]
 */
export function parseCrossSessionPatternsData(
  data: string | undefined
): ParsedCrossSessionPattern[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const patternType = parts[0]?.trim().toLowerCase() as AntiPatternType;
      const severityRaw = parts[1]?.trim().toUpperCase();
      const severity = (
        severityRaw === 'CRITICAL' ? 'critical' :
        severityRaw === 'WARNING' ? 'warning' : 'info'
      ) as AntiPatternSeverity;
      const sessionCount = parseInt(parts[2], 10) || 0;
      const sessionIds = (parts[3]?.trim() || '').split(',').map((s) => s.trim()).filter(Boolean);
      const frequencyRaw = parts[4]?.trim();
      const frequency = (frequencyRaw === 'High' ? 'High' : 'Moderate') as 'High' | 'Moderate';
      const evidence = parts[5]?.trim() || '';

      return {
        patternType,
        severity,
        sessionCount,
        sessionIds,
        frequency,
        evidence,
      };
    })
    .filter((item) => item.patternType && item.sessionCount >= 2);
}

/**
 * Get all cross-session patterns from output, sorted by severity
 */
export function getAllCrossSessionPatterns(
  output: CrossSessionAntiPatternOutput
): ParsedCrossSessionPattern[] {
  const critical = parseCrossSessionPatternsData(output.criticalAntiPatterns);
  const warning = parseCrossSessionPatternsData(output.warningAntiPatterns);
  const info = parseCrossSessionPatternsData(output.infoAntiPatterns);

  return [...critical, ...warning, ...info];
}

/**
 * Get severity level for a given anti-pattern type
 */
export function getAntiPatternSeverity(patternType: string): AntiPatternSeverity {
  if (ANTI_PATTERN_HIERARCHY.critical.includes(patternType as CriticalAntiPattern)) {
    return 'critical';
  }
  if (ANTI_PATTERN_HIERARCHY.warning.includes(patternType as WarningAntiPattern)) {
    return 'warning';
  }
  return 'info';
}

/**
 * Parsed isolated incident (single-session occurrence, not a pattern)
 */
export interface ParsedIsolatedIncident {
  /** Incident type */
  incidentType: string;
  /** Session ID where it occurred */
  sessionId: string;
  /** Description */
  description: string;
}

/**
 * Parse isolated incidents data string
 * Format: "incident|session_id|description;..."
 */
export function parseIsolatedIncidentsData(
  data: string | undefined
): ParsedIsolatedIncident[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        incidentType: parts[0]?.trim() || '',
        sessionId: parts[1]?.trim() || '',
        description: parts[2]?.trim() || '',
      };
    })
    .filter((item) => item.incidentType && item.sessionId);
}

// ============================================================================
// Knowledge Gap Analyzer: Knowledge Gaps + Learning Suggestions
// ============================================================================

/**
 * Knowledge Gap Analyzer Output Schema
 *
 * Detects:
 * - Knowledge gaps from repeated questions
 * - Learning progress tracking
 * - Resource recommendations
 *
 * @example
 * ```json
 * {
 *   "knowledgeGapsData": "async/await:7:shallow:Promise chaining not understood;TypeScript generics:4:moderate:constraint syntax unclear",
 *   "learningProgressData": "React hooks:shallow:moderate:useEffect cleanup questions decreased;CSS Grid:novice:intermediate:fewer layout questions",
 *   "recommendedResourcesData": "TypeScript generics:docs:typescriptlang.org;async/await:tutorial:javascript.info",
 *   "topInsights": [
 *     "async/await questions appeared 7 times - fundamental concept learning needed",
 *     "React hooks understanding: shallow -> moderate (progress over 5 sessions)",
 *     "Recommended: TypeScript generics official documentation"
 *   ],
 *   "overallKnowledgeScore": 68,
 *   "confidenceScore": 0.82
 * }
 * ```
 */
export const KnowledgeGapOutputSchema = z.object({
  // Knowledge gaps - "topic:question_count:depth:example;..."
  knowledgeGapsData: z.string().max(2000),

  // Learning progress - "topic:start_level:current_level:evidence;..."
  learningProgressData: z.string().max(1500),

  // Recommended resources - "topic:resource_type:url_or_name;..."
  recommendedResourcesData: z.string().max(1000),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(3000)).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string().max(500)).max(2).optional(),     // Knowledge strengths (0-1)
  kptProblem: z.array(z.string().max(500)).max(2).optional(),  // Knowledge gaps to address (1-2, expected)
  kptTry: z.array(z.string().max(500)).max(2).optional(),      // Learning recommendations (1-2, expected)

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Structured strengths with evidence (knowledge strengths)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().max(4000).optional(),

  // NEW: Growth areas with evidence and recommendations (knowledge gaps)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().max(4000).optional(),
});

export type KnowledgeGapOutput = z.infer<typeof KnowledgeGapOutputSchema>;

// ============================================================================
// Context Efficiency Analyzer: Token Inefficiency Patterns
// ============================================================================

/**
 * Context Efficiency Analyzer Output Schema
 *
 * Detects:
 * - Context usage patterns (fill %)
 * - Inefficiency patterns (late compact, etc.)
 * - Prompt length trends
 * - Redundant information patterns
 *
 * @example
 * ```json
 * {
 *   "contextUsagePatternData": "session1:85:92;session2:78:88;session3:91:95",
 *   "inefficiencyPatternsData": "late_compact:15:high:always compacts at 90%+;context_bloat:8:medium:never uses /clear",
 *   "promptLengthTrendData": "early:150;mid:280;late:450",
 *   "redundantInfoData": "project_structure:5;tech_stack:3;file_paths:7",
 *   "topInsights": [
 *     "Average 85% context fill before compact - consider earlier compaction",
 *     "Prompt length increases 2.3x in late session",
 *     "Project structure explained 5 times - set in context once"
 *   ],
 *   "overallEfficiencyScore": 65,
 *   "avgContextFillPercent": 84,
 *   "confidenceScore": 0.79
 * }
 * ```
 */
export const ContextEfficiencyOutputSchema = z.object({
  // Context usage pattern - "session_id:avg_fill_percent:compact_trigger_percent;..."
  contextUsagePatternData: z.string().max(1500),

  // Inefficiency patterns - "pattern:frequency:impact:example;..."
  inefficiencyPatternsData: z.string().max(2000),

  // Prompt length trend - "session_part:avg_length;..."
  promptLengthTrendData: z.string().max(500),

  // Redundant info patterns - "info_type:repeat_count;..."
  redundantInfoData: z.string().max(1000),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(3000)).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string().max(500)).max(2).optional(),     // Efficient habits (0-1)
  kptProblem: z.array(z.string().max(500)).max(2).optional(),  // Inefficiencies to address (1-2, expected)
  kptTry: z.array(z.string().max(500)).max(2).optional(),      // Efficiency improvements (1-2, expected)

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Structured strengths with evidence (efficient habits)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().max(4000).optional(),

  // NEW: Growth areas with evidence and recommendations (inefficiencies)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().max(4000).optional(),
});

export type ContextEfficiencyOutput = z.infer<typeof ContextEfficiencyOutputSchema>;

// ============================================================================
// Metacognition Output (NEW)
// ============================================================================

// Import from dedicated schema file
import { MetacognitionOutputSchema, type MetacognitionOutput } from './metacognition-data';
export { MetacognitionOutputSchema, type MetacognitionOutput };

// ============================================================================
// Temporal Analysis Output (REDESIGNED)
// ============================================================================

// Import from dedicated schema file
// Legacy schema kept for backward compatibility with stored data
import {
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
} from './temporal-data';
import { TemporalMetricsSchema, type TemporalMetrics } from './temporal-metrics';
export {
  // Legacy (deprecated, kept for stored data)
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
  // New (recommended)
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
  TemporalMetricsSchema,
  type TemporalMetrics,
};

// ============================================================================
// Multitasking Analysis Output (NEW)
// ============================================================================

// Import from dedicated schema file
import { MultitaskingAnalysisOutputSchema, type MultitaskingAnalysisOutput } from './multitasking-data';
export { MultitaskingAnalysisOutputSchema, type MultitaskingAnalysisOutput };

// ============================================================================
// Type Synthesis Output (NEW) - Agent-Informed Classification
// ============================================================================

/**
 * Type Synthesis Output Schema
 *
 * Refines the initial pattern-based type classification using insights
 * from all other agents (Pattern Detective, Anti-Pattern Spotter, etc.)
 *
 * This creates a more accurate 15-combination matrix (5 styles × 3 control levels)
 * by incorporating semantic information from LLM analysis.
 *
 * @example
 * ```json
 * {
 *   "refinedPrimaryType": "architect",
 *   "refinedDistribution": "architect:42;scientist:25;craftsman:18;collaborator:10;speedrunner:5",
 *   "refinedControlLevel": "cartographer",
 *   "matrixName": "Systems Architect",
 *   "matrixEmoji": "🏛️",
 *   "adjustmentReasons": [
 *     "High metacognition score (78) elevated control level from navigator to cartographer",
 *     "Low error loop count supports architect classification",
 *     "Strong context efficiency patterns reinforce systematic approach"
 *   ],
 *   "confidenceScore": 0.85,
 *   "confidenceBoost": 0.15,
 *   "synthesisEvidence": "metacognition:78:self-aware patterns;antiPattern:low_error_loops;context:high_efficiency"
 * }
 * ```
 */
export const TypeSynthesisOutputSchema = z.object({
  // Refined primary type after agent synthesis
  refinedPrimaryType: z.enum(['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman']),

  // Refined distribution - "type:percent;..." format (sum to 100)
  refinedDistribution: z.string().max(3000),

  // Refined control level based on agent insights (exploration metaphor)
  refinedControlLevel: z.enum(['explorer', 'navigator', 'cartographer']),

  // Raw control score (0-100) for level distribution calculation
  controlScore: z.number().min(0).max(100).optional(),

  // Combined matrix name (e.g., "Systems Architect", "Yolo Coder")
  matrixName: z.string().max(50),

  // Combined matrix emoji
  matrixEmoji: z.string().max(10),

  // Reasons for adjustments from initial classification
  adjustmentReasons: z.array(z.string().max(3000)).max(5),

  // Final confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // How much confidence increased from agent synthesis (0-1)
  confidenceBoost: z.number().min(0).max(1),

  // Evidence from agent outputs - "agent:key_signal:detail;..."
  synthesisEvidence: z.string().max(1000),
});

export type TypeSynthesisOutput = z.infer<typeof TypeSynthesisOutputSchema>;

// ============================================================================
// Combined Agent Outputs
// ============================================================================

/**
 * Combined outputs from all Wow-Focused Agents
 *
 * Original 4 agents:
 * - Pattern Detective: Conversation patterns, repeated questions
 * - Anti-Pattern Spotter: Error loops, bad habits
 * - Knowledge Gap: Knowledge gaps + learning suggestions
 * - Context Efficiency: Token inefficiency patterns
 *
 * NEW agents (Premium+):
 * - Metacognition: Self-awareness patterns, blind spots, growth mindset
 * - Temporal Analyzer: Time-based quality patterns, fatigue signals
 *
 * All fields are optional since agents may fail independently.
 */
export const AgentOutputsSchema = z.object({
  // Original 4 agents
  patternDetective: PatternDetectiveOutputSchema.optional(),
  antiPatternSpotter: AntiPatternSpotterOutputSchema.optional(),
  knowledgeGap: KnowledgeGapOutputSchema.optional(),
  contextEfficiency: ContextEfficiencyOutputSchema.optional(),

  // NEW: Metacognition + Temporal Analysis agents
  metacognition: MetacognitionOutputSchema.optional(),
  // REDESIGNED: Now uses TemporalAnalysisResult (metrics + insights)
  temporalAnalysis: TemporalAnalysisResultSchema.optional(),

  // NEW: Multitasking Analysis
  multitasking: MultitaskingAnalysisOutputSchema.optional(),

  // NEW: Type Synthesis (Agent-Informed Classification)
  typeSynthesis: TypeSynthesisOutputSchema.optional(),

  // NEW: Cross-Session Anti-Pattern Detection
  crossSessionAntiPatterns: CrossSessionAntiPatternOutputSchema.optional(),
});

export type AgentOutputs = z.infer<typeof AgentOutputsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty/default agent outputs
 */
export function createEmptyAgentOutputs(): AgentOutputs {
  return {};
}

/**
 * Check if any agent produced output
 */
export function hasAnyAgentOutput(outputs: AgentOutputs): boolean {
  return !!(
    outputs.patternDetective ||
    outputs.antiPatternSpotter ||
    outputs.knowledgeGap ||
    outputs.contextEfficiency ||
    outputs.metacognition ||
    outputs.temporalAnalysis ||
    outputs.multitasking ||
    outputs.typeSynthesis ||
    outputs.crossSessionAntiPatterns
  );
}

/**
 * Get all top insights from all agents (flattened)
 */
export function getAllTopInsights(outputs: AgentOutputs): string[] {
  const insights: string[] = [];

  if (outputs.patternDetective?.topInsights) {
    insights.push(...outputs.patternDetective.topInsights);
  }
  if (outputs.antiPatternSpotter?.topInsights) {
    insights.push(...outputs.antiPatternSpotter.topInsights);
  }
  if (outputs.knowledgeGap?.topInsights) {
    insights.push(...outputs.knowledgeGap.topInsights);
  }
  if (outputs.contextEfficiency?.topInsights) {
    insights.push(...outputs.contextEfficiency.topInsights);
  }
  // NEW: Include metacognition and temporal insights
  if (outputs.metacognition?.topInsights) {
    insights.push(...outputs.metacognition.topInsights);
  }
  // REDESIGNED: Temporal insights are now nested under insights.topInsights
  if (outputs.temporalAnalysis?.insights?.topInsights) {
    insights.push(...outputs.temporalAnalysis.insights.topInsights);
  }
  // NEW: Include multitasking insights
  if (outputs.multitasking?.topInsights) {
    insights.push(...outputs.multitasking.topInsights);
  }
  // NEW: Include cross-session anti-pattern insights
  if (outputs.crossSessionAntiPatterns?.topInsights) {
    insights.push(...outputs.crossSessionAntiPatterns.topInsights);
  }

  return insights;
}

/**
 * Collect growth areas from ALL agents (both free and premium tiers)
 *
 * This aggregation function enables free users to see growth areas from
 * Pattern Detective and Metacognition, while premium users see growth
 * areas from all 7 agents.
 *
 * @example
 * const allAreas = getAllAgentGrowthAreas(agentOutputs);
 * // Returns: AgentGrowthArea[] from all agents that produced data
 */
export function getAllAgentGrowthAreas(outputs: AgentOutputs): AgentGrowthArea[] {
  const allAreas: AgentGrowthArea[] = [];

  // Free tier agents
  if (outputs.patternDetective?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.patternDetective.growthAreasData));
  }
  if (outputs.metacognition?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.metacognition.growthAreasData));
  }

  // Premium tier agents
  if (outputs.antiPatternSpotter?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.antiPatternSpotter.growthAreasData));
  }
  if (outputs.knowledgeGap?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.knowledgeGap.growthAreasData));
  }
  if (outputs.contextEfficiency?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.contextEfficiency.growthAreasData));
  }
  // Temporal insights are nested under insights.growthAreasData
  if (outputs.temporalAnalysis?.insights?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.temporalAnalysis.insights.growthAreasData));
  }
  if (outputs.multitasking?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(outputs.multitasking.growthAreasData));
  }

  return allAreas;
}

// ============================================================================
// Diagnosis / Prescription Separation
// ============================================================================

/**
 * Diagnosis - FREE tier content
 *
 * Contains: WHAT is the issue and WHY it matters
 * - Title and description of the growth area
 * - Evidence quotes showing the pattern
 * - Frequency and severity metrics
 *
 * This content answers "What needs to improve?" and is shown to all users.
 */
export interface GrowthDiagnosis {
  /** Clear pattern name */
  title: string;
  /** Description of the issue and why it matters */
  description: string;
  /** Evidence quotes from actual sessions */
  evidence: string[];
  /** Session occurrence percentage (0-100) */
  frequency?: number;
  /** Severity level: critical | high | medium | low */
  severity?: AgentSeverityLevel;
  /** Computed priority score (0-100) */
  priorityScore?: number;
}

/**
 * Prescription - PREMIUM tier content
 *
 * Contains: HOW to fix the issue
 * - Specific actionable recommendations
 * - Learning resources and links
 * - Step-by-step improvement path
 *
 * This content answers "How do I improve?" and is shown only to paid users.
 */
export interface GrowthPrescription {
  /** Specific, actionable recommendation */
  recommendation: string;
  /** Learning resources (URLs, courses, docs) */
  resources?: string[];
  /** Step-by-step action items */
  actionSteps?: string[];
}

/**
 * Complete growth insight combining diagnosis and prescription
 */
export interface GrowthInsight {
  /** FREE: The problem identification */
  diagnosis: GrowthDiagnosis;
  /** PREMIUM: The solution */
  prescription: GrowthPrescription;
}

/**
 * Convert AgentGrowthArea to separated Diagnosis and Prescription
 *
 * @param area - Full growth area data
 * @returns Separated diagnosis and prescription
 */
export function separateDiagnosisPrescription(area: AgentGrowthArea): GrowthInsight {
  return {
    diagnosis: {
      title: area.title,
      description: area.description,
      evidence: area.evidence,
      frequency: area.frequency,
      severity: area.severity,
      priorityScore: area.priorityScore,
    },
    prescription: {
      recommendation: area.recommendation,
      // resources and actionSteps can be extracted from recommendation if structured
      resources: undefined,
      actionSteps: undefined,
    },
  };
}

/**
 * Extract only the diagnosis (FREE tier) from a growth area
 *
 * Use this to create free tier content that shows the problem but not the solution.
 *
 * @param area - Full growth area data
 * @returns Diagnosis only (no recommendation)
 */
export function extractDiagnosisOnly(area: AgentGrowthArea): GrowthDiagnosis {
  return {
    title: area.title,
    description: area.description,
    evidence: area.evidence,
    frequency: area.frequency,
    severity: area.severity,
    priorityScore: area.priorityScore,
  };
}

/**
 * Create a locked growth area for free tier users
 *
 * Retains all diagnosis information but removes the recommendation.
 *
 * @param area - Full growth area data
 * @returns Growth area with empty recommendation
 */
export function createLockedGrowthArea(area: AgentGrowthArea): AgentGrowthArea {
  return {
    ...area,
    recommendation: '', // Prescription is locked
  };
}
