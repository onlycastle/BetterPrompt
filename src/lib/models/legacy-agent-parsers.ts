/**
 * Legacy Agent Parsing Utilities
 *
 * Shared parsing functions and types used by legacy agent schemas
 * (PatternDetective, AntiPatternSpotter, etc.) for backward compatibility
 * with cached data in the database (30-day retention).
 *
 * These utilities parse semicolon-separated string formats that comply
 * with Gemini's 4-level nesting limit.
 *
 * @module models/legacy-agent-parsers
 */

// ============================================================================
// Strengths & Growth Areas Types
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

// ============================================================================
// Strengths & Growth Areas Parsing
// ============================================================================

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
// Recommended Resources Types & Parsing
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
// Repeated Command Pattern Types & Parsing
// ============================================================================

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
