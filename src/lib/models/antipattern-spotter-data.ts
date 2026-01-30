/**
 * Anti-Pattern Spotter Data Schema - Legacy Agent Output
 *
 * AntiPatternSpotter detects:
 * - Error loops (same error repeated)
 * - Learning avoidance patterns
 * - Repeated mistakes
 *
 * Also includes CrossSession anti-pattern detection schemas.
 *
 * Legacy agent kept for backward compatibility with cached data
 * in the database (30-day retention).
 *
 * @module models/antipattern-spotter-data
 */

import { z } from 'zod';

// ============================================================================
// Anti-Pattern Spotter Output Schema
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
  errorLoopsData: z.string(),

  // Learning avoidance patterns - "pattern:evidence:severity;..."
  learningAvoidanceData: z.string(),

  // Repeated mistakes - "mistake:count:sessions;..."
  repeatedMistakesData: z.string(),

  // Top 3 Wow Insights
  topInsights: z.array(z.string()).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).max(2).optional(),     // Healthy habits to maintain (0-1)
  kptProblem: z.array(z.string()).max(2).optional(),  // Anti-patterns to address (1-2, expected)
  kptTry: z.array(z.string()).max(2).optional(),      // Actionable improvements (1-2, expected)

  // Overall health score (0-100)
  overallHealthScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Structured strengths with evidence (healthy habits)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().optional(),

  // NEW: Growth areas with evidence and recommendations (anti-patterns to address)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().optional(),
});

export type AntiPatternSpotterOutput = z.infer<typeof AntiPatternSpotterOutputSchema>;

// ============================================================================
// Cross-Session Anti-Pattern Detection
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
  criticalAntiPatterns: z.string(),

  // Warning patterns - "pattern|severity|count|session_ids|frequency|evidence;..."
  warningAntiPatterns: z.string(),

  // Info patterns - "pattern|severity|count|session_ids|frequency|evidence;..."
  infoAntiPatterns: z.string(),

  // Single-session occurrences (not patterns) - "incident|session_id|description;..."
  isolatedIncidents: z.string(),

  // Top 3 insights (Problem/Try/Keep structure)
  topInsights: z.array(z.string()).max(3),

  // Pattern density score (0-100, higher = more anti-patterns)
  patternDensity: z.number().min(0).max(100),

  // Cross-session consistency (0-1, confidence in pattern detection)
  crossSessionConsistency: z.number().min(0).max(1),

  // Actionable recommendations (1-3)
  recommendedInterventions: z.array(z.string()).max(3),

  // Cross-references: "pattern|quote1|quote2|quote3;..." (tracks pattern across sessions)
  sessionCrossReferences: z.string().optional(),

  // Strengths: "behavior|sessions|quotes;..." (positive patterns across sessions)
  strengthsAcrossSessions: z.string().optional(),
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
