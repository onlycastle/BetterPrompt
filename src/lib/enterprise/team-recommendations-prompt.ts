/**
 * Team Recommendations LLM Generator
 *
 * Generates actionable team-level recommendations from detected cross-developer
 * patterns using LLM inference. Takes the output of aggregateGrowthAreasPEA()
 * and produces a manager-facing action plan with concrete, specific directives.
 *
 * This module adds LLM-generated context-awareness on top of the existing
 * deterministic template-based generateTeamActionItems() in aggregation.ts.
 *
 * Architecture note: LLM calls for individual analysis live in the plugin.
 * Team-level LLM calls live here (server-side) because team analysis aggregates
 * across multiple members and runs after all individual analyses are complete.
 *
 * Exports two generation functions:
 *   - generateLLMTeamRecommendations() — legacy: recommendations only
 *   - generateLLMTeamPatternAnalysis() — combined: freeform category tags + recommendations
 *     Produces team-level category tags (cross-developer perspective) alongside
 *     actionable manager directives in a single LLM call. Preferred for new code.
 *
 * @module enterprise/team-recommendations-prompt
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TeamGrowthAreaPEAAggregate, TeamActionItem } from '@/types/enterprise';

// ---------------------------------------------------------------------------
// Prompt constants
// ---------------------------------------------------------------------------

/**
 * System prompt for team recommendation generation.
 *
 * The LLM must:
 * - Reference specific cross-developer pattern names, not generic advice
 * - Map each pattern to a concrete manager-implementable directive
 * - Consider frequency (# affected / total) when assigning urgency
 * - Consider severity when choosing intervention intensity
 * - Output structured JSON matching the TeamActionItem schema
 */
export const TEAM_RECOMMENDATIONS_SYSTEM_PROMPT = `You are an expert engineering leader and coaching specialist helping managers improve their team's AI-assisted development practices.

You will receive a list of cross-developer behavior patterns detected across a software team. Each pattern represents a shared inefficiency or growth area identified from multiple developers' AI session logs.

Your task is to generate a prioritized list of actionable team-level recommendations — concrete management directives that can be implemented immediately, this sprint, or next sprint.

## Output Requirements

For each pattern provided, produce exactly one recommendation following these rules:

**Action quality standards:**
- Reference the specific pattern name and affected technology/domain
- The action must be a concrete directive a manager can schedule or assign (e.g., "Schedule a 90-minute workshop on X" or "Add a pre-merge checklist item for Y")
- Never write generic advice like "improve communication" or "focus on quality"
- Use the category tags to understand the pattern's technical context
- Mention concrete deliverables: workshop, checklist, template, pairing rotation, retro item, norm

**Urgency assignment rules:**
- immediate: critical severity AND >50% of team affected
- this-sprint: high severity OR >40% of team affected
- next-sprint: medium/low severity AND ≤40% of team affected

**Rationale format:**
"[N] of [total] developers ([%]) exhibit [pattern title] — [severity] severity in [domain]."

**Priority ordering:**
1. Sort by urgency (immediate > this-sprint > next-sprint)
2. Within same urgency: sort by affected member count descending
3. Assign priority numbers starting at 1

Return up to 7 recommendations total.

## Anti-patterns to avoid
- Do NOT repeat the same workshop/action type for multiple patterns (vary your directives)
- Do NOT reference "the LLM" or "AI tools" generically — reference specific tools or practices mentioned in tags
- Do NOT add items the manager cannot concretely check completion for

Respond only using the generate_team_recommendations tool.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Serialize cross-developer patterns into a human-readable prompt block.
 * Each pattern includes its title, domain, severity, affected count, and category tags.
 */
export function buildTeamRecommendationsUserPrompt(
  patterns: TeamGrowthAreaPEAAggregate[],
  totalMembers: number,
): string {
  const patternBlocks = patterns.map((p, idx) => {
    const pct = totalMembers > 0 ? Math.round((p.memberCount / totalMembers) * 100) : 0;
    const tagsDisplay = p.categoryTags.length > 0
      ? `Tags: ${p.categoryTags.slice(0, 6).join(', ')}`
      : 'Tags: (none)';
    const membersDisplay = p.affectedMembers.join(', ');
    const recommendationSample = p.sampleRecommendation
      ? `\n  Sample individual recommendation: "${p.sampleRecommendation}"`
      : '';

    return `Pattern ${idx + 1}:
  Title: "${p.title}"
  Domain: ${p.domain} (${p.domainLabel})
  Severity: ${p.predominantSeverity}
  Affected: ${p.memberCount} of ${totalMembers} developers (${pct}%)
  Members: ${membersDisplay}
  ${tagsDisplay}${recommendationSample}`;
  }).join('\n\n');

  return `Team size: ${totalMembers} developers

Cross-developer patterns detected:

${patternBlocks}

Generate actionable team-level recommendations for these patterns.`;
}

// ---------------------------------------------------------------------------
// Tool definition (Anthropic structured output)
// ---------------------------------------------------------------------------

/**
 * Anthropic tool definition for structured team recommendation output.
 * Schema mirrors TeamActionItem (without the computed priority field).
 */
export const TEAM_RECOMMENDATIONS_TOOL: Anthropic.Tool = {
  name: 'generate_team_recommendations',
  description: 'Generate a prioritized list of actionable team-level recommendations from cross-developer patterns',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendations: {
        type: 'array',
        description: 'Prioritized list of team action items (max 7)',
        items: {
          type: 'object',
          properties: {
            urgency: {
              type: 'string',
              enum: ['immediate', 'this-sprint', 'next-sprint'],
              description: 'Urgency tier based on severity and frequency',
            },
            action: {
              type: 'string',
              description: 'Concrete manager-implementable directive (specific, not generic)',
            },
            rationale: {
              type: 'string',
              description: 'Frequency and impact context: "N of M developers (P%) exhibit [pattern] — [severity] severity in [domain]."',
            },
            pattern: {
              type: 'string',
              description: 'Title of the source cross-developer pattern',
            },
            domain: {
              type: 'string',
              description: 'Analysis domain identifier (e.g., thinkingQuality, contextEfficiency)',
            },
            domainLabel: {
              type: 'string',
              description: 'Human-readable domain label',
            },
            affectedMembers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Names of developers affected by this pattern',
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: 'Predominant severity of the pattern',
            },
          },
          required: ['urgency', 'action', 'rationale', 'pattern', 'domain', 'domainLabel', 'affectedMembers', 'severity'],
        },
      },
    },
    required: ['recommendations'],
  },
};

// ---------------------------------------------------------------------------
// Raw LLM output type (before priority assignment)
// ---------------------------------------------------------------------------

interface RawRecommendation {
  urgency: 'immediate' | 'this-sprint' | 'next-sprint';
  action: string;
  rationale: string;
  pattern: string;
  domain: string;
  domainLabel: string;
  affectedMembers: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface ToolOutput {
  recommendations: RawRecommendation[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TeamRecommendationsConfig {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /**
   * Model to use for generation.
   * Defaults to claude-haiku-4-20250514 (fast, sufficient for structured output).
   */
  model?: string;
  /** Max output tokens. Defaults to 2048. */
  maxTokens?: number;
}

const DEFAULT_CONFIG: Required<TeamRecommendationsConfig> = {
  apiKey: '',
  model: 'claude-haiku-4-20250514',
  maxTokens: 2048,
};

// ---------------------------------------------------------------------------
// Generator function
// ---------------------------------------------------------------------------

/**
 * Generate LLM-powered team-level recommendations from cross-developer patterns.
 *
 * Takes the output of aggregateGrowthAreasPEA() and calls the Anthropic API
 * to produce a context-aware, pattern-specific manager action plan.
 *
 * Each returned TeamActionItem has an LLM-generated `action` string that
 * references the specific pattern title, domain, and severity — unlike the
 * deterministic fallback in generateTeamActionItems() which uses fixed templates.
 *
 * Error handling: follows the codebase "No Fallback Policy" — errors propagate
 * to callers rather than returning empty or default data.
 *
 * @param patterns Cross-developer pattern aggregates from aggregateGrowthAreasPEA()
 * @param totalMembers Total number of developers in the team
 * @param config Optional Anthropic API configuration
 * @returns Prioritized team action items with LLM-generated directives
 *
 * @throws {Error} If API key is missing, the Anthropic call fails, or the
 *   response cannot be parsed as structured output.
 *
 * @example
 * const patterns = aggregateGrowthAreasPEA(teamMembers);
 * const items = await generateLLMTeamRecommendations(patterns, teamMembers.length);
 * // items[0].action → "Schedule a 90-minute code review workshop..."
 */
export async function generateLLMTeamRecommendations(
  patterns: TeamGrowthAreaPEAAggregate[],
  totalMembers: number,
  config: TeamRecommendationsConfig = {},
): Promise<TeamActionItem[]> {
  if (patterns.length === 0 || totalMembers === 0) return [];

  const resolvedConfig: Required<TeamRecommendationsConfig> = {
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? DEFAULT_CONFIG.apiKey,
    model: config.model ?? DEFAULT_CONFIG.model,
    maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
  };

  if (!resolvedConfig.apiKey) {
    throw new Error(
      'generateLLMTeamRecommendations: ANTHROPIC_API_KEY is required. ' +
      'Set the environment variable or pass config.apiKey.',
    );
  }

  const client = new Anthropic({ apiKey: resolvedConfig.apiKey });

  const userPrompt = buildTeamRecommendationsUserPrompt(patterns, totalMembers);

  const response = await client.messages.create({
    model: resolvedConfig.model,
    max_tokens: resolvedConfig.maxTokens,
    system: TEAM_RECOMMENDATIONS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [TEAM_RECOMMENDATIONS_TOOL],
    tool_choice: { type: 'tool', name: 'generate_team_recommendations' },
  });

  // Extract tool use block
  const toolUseBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error(
      'generateLLMTeamRecommendations: LLM response did not contain a tool_use block. ' +
      `Stop reason: ${response.stop_reason}`,
    );
  }

  const output = toolUseBlock.input as ToolOutput;

  if (!Array.isArray(output?.recommendations)) {
    throw new Error(
      'generateLLMTeamRecommendations: tool output missing "recommendations" array. ' +
      `Got: ${JSON.stringify(output).slice(0, 200)}`,
    );
  }

  // Validate and assign priority numbers
  const urgencyRank: Record<RawRecommendation['urgency'], number> = {
    immediate: 3,
    'this-sprint': 2,
    'next-sprint': 1,
  };
  const severityRank: Record<RawRecommendation['severity'], number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };

  const sorted = output.recommendations
    .filter((r): r is RawRecommendation =>
      typeof r.urgency === 'string' &&
      typeof r.action === 'string' &&
      typeof r.rationale === 'string' &&
      typeof r.pattern === 'string' &&
      typeof r.domain === 'string' &&
      typeof r.domainLabel === 'string' &&
      Array.isArray(r.affectedMembers) &&
      typeof r.severity === 'string',
    )
    .sort((a, b) =>
      urgencyRank[b.urgency] - urgencyRank[a.urgency] ||
      severityRank[b.severity] - severityRank[a.severity] ||
      b.affectedMembers.length - a.affectedMembers.length,
    )
    .slice(0, 7);

  return sorted.map((r, idx) => ({
    priority: idx + 1,
    urgency: r.urgency,
    action: r.action,
    rationale: r.rationale,
    pattern: r.pattern,
    domain: r.domain,
    domainLabel: r.domainLabel,
    affectedMembers: r.affectedMembers,
    severity: r.severity,
  }));
}

// ===========================================================================
// Combined team pattern analysis: freeform category tags + recommendations
// ===========================================================================

/**
 * System prompt for the combined team pattern analysis.
 *
 * Instructs the LLM to produce TWO outputs per pattern in a single call:
 *   1. Freeform category tags — team-level descriptors from a manager/cross-developer
 *      perspective. Different from individual developer tags because they capture
 *      the shared behavioral concern that spans multiple team members.
 *   2. Actionable team-level recommendation — a concrete manager directive.
 *
 * Category tags quality requirements:
 * - 2-5 tags per pattern (lowercase, hyphenated when multi-word)
 * - Describe the behavioral category, technical domain, and team-level impact
 * - NOT constrained to any fixed taxonomy — freeform descriptions that best
 *   capture what the pattern means at the team level
 * - DIFFERENT from individual developer tags — capture the cross-developer,
 *   manager-facing concern (e.g., "backend-resilience-gap" rather than "express")
 */
export const TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT = `You are an expert engineering leader and coaching specialist analyzing cross-developer behavior patterns in a software team.

You will receive a list of shared patterns detected across multiple developers' AI session logs. Each pattern includes existing individual-level category tags for context — but you must generate NEW team-level category tags that describe the cross-developer behavioral concern from a manager's perspective.

Your task is to produce for each pattern:
1. Freeform team-level category tags
2. An actionable team-level recommendation

## Category Tag Requirements

Generate 2-5 freeform tags per pattern that:
- Describe the behavioral category at the TEAM level, not individual developer level
- Capture what the pattern means to a manager (e.g., "backend-error-resilience-gap", "systematic-test-avoidance", "context-window-mismanagement")
- Use lowercase with hyphens for multi-word tags (e.g., "error-handling", "test-coverage-gap")
- Are NOT constrained to any fixed taxonomy — pick whatever words best describe the team-level concern
- Supplement, not duplicate, the individual member tags shown in context
- Examples: ["api-error-resilience", "backend-quality-gap"], ["test-coverage-deficit", "ci-pipeline-risk"], ["context-engineering", "session-discipline"]

## Recommendation Requirements

For each pattern, produce one concrete recommendation:
- Reference the specific pattern name and affected technology/domain
- The action must be schedulable or assignable (e.g., "Schedule a 90-minute workshop on X" or "Add a pre-merge checklist item for Y")
- Never write generic advice like "improve communication" or "focus on quality"
- Mention concrete deliverables: workshop, checklist, template, pairing rotation, retro item, norm
- Vary the recommendation type across patterns (not every pattern gets a workshop)

**Urgency assignment:**
- immediate: critical severity AND >50% of team affected
- this-sprint: high severity OR >40% of team affected
- next-sprint: medium/low severity AND ≤40% of team affected

**Rationale format:** "[N] of [total] developers ([%]) exhibit [pattern title] — [severity] severity in [domain]."

**Priority:** Sort by urgency (immediate > this-sprint > next-sprint), then by affected count. Assign priority numbers starting at 1. Return up to 7 recommendations total.

## Anti-patterns to avoid
- Do NOT copy the individual developer tags as team tags — generate genuinely team-level descriptors
- Do NOT repeat the same action type for multiple patterns
- Do NOT reference "the LLM" or "AI tools" generically
- Do NOT add recommendations the manager cannot concretely verify

Respond only using the generate_team_pattern_analysis tool.`;

// ---------------------------------------------------------------------------
// User prompt builder for combined analysis
// ---------------------------------------------------------------------------

/**
 * Build the user prompt for combined category tag + recommendation generation.
 *
 * Extends buildTeamRecommendationsUserPrompt() by exposing the individual
 * developer tags as explicit "member-level context" — the LLM sees them as
 * background context but must generate NEW team-level tags.
 */
export function buildTeamPatternAnalysisUserPrompt(
  patterns: TeamGrowthAreaPEAAggregate[],
  totalMembers: number,
): string {
  const patternBlocks = patterns.map((p, idx) => {
    const pct = totalMembers > 0 ? Math.round((p.memberCount / totalMembers) * 100) : 0;
    const membersDisplay = p.affectedMembers.join(', ');
    const existingTagsDisplay = p.categoryTags.length > 0
      ? `Member-level tags (context only): ${p.categoryTags.slice(0, 8).join(', ')}`
      : 'Member-level tags (context only): (none)';
    const recommendationSample = p.sampleRecommendation
      ? `\n  Individual recommendation sample: "${p.sampleRecommendation}"`
      : '';

    return `Pattern ${idx + 1}:
  Title: "${p.title}"
  Domain: ${p.domain} (${p.domainLabel})
  Severity: ${p.predominantSeverity}
  Affected: ${p.memberCount} of ${totalMembers} developers (${pct}%)
  Members: ${membersDisplay}
  ${existingTagsDisplay}${recommendationSample}`;
  }).join('\n\n');

  return `Team size: ${totalMembers} developers

Cross-developer patterns detected:

${patternBlocks}

For each pattern:
1. Generate 2-5 NEW team-level category tags (different from the member-level tags shown)
2. Generate one actionable team-level recommendation`;
}

// ---------------------------------------------------------------------------
// Tool definition for combined output
// ---------------------------------------------------------------------------

/**
 * Anthropic tool for combined freeform category tags + recommendations output.
 *
 * Each pattern analysis entry ties a pattern title to:
 * - teamCategoryTags: freeform team-level behavioral descriptors (NOT the individual member tags)
 * - Recommendation fields matching TeamActionItem (minus computed priority)
 */
export const TEAM_PATTERN_ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'generate_team_pattern_analysis',
  description: 'Generate freeform team-level category tags and actionable recommendations for each cross-developer pattern',
  input_schema: {
    type: 'object' as const,
    properties: {
      patternAnalyses: {
        type: 'array',
        description: 'One analysis entry per pattern (max 7 for recommendations)',
        items: {
          type: 'object',
          properties: {
            patternTitle: {
              type: 'string',
              description: 'Exact title of the source pattern (must match input)',
            },
            teamCategoryTags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Freeform team-level category tags (2-5, lowercase, hyphenated multi-word). NOT the individual member tags — describe the cross-developer concern from manager perspective.',
            },
            urgency: {
              type: 'string',
              enum: ['immediate', 'this-sprint', 'next-sprint'],
              description: 'Urgency tier based on severity and frequency',
            },
            action: {
              type: 'string',
              description: 'Concrete manager-implementable directive (specific, not generic)',
            },
            rationale: {
              type: 'string',
              description: 'Frequency and impact context: "N of M developers (P%) exhibit [pattern] — [severity] severity in [domain]."',
            },
            domain: {
              type: 'string',
              description: 'Analysis domain identifier',
            },
            domainLabel: {
              type: 'string',
              description: 'Human-readable domain label',
            },
            affectedMembers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Names of developers affected by this pattern',
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: 'Predominant severity of the pattern',
            },
          },
          required: [
            'patternTitle', 'teamCategoryTags',
            'urgency', 'action', 'rationale',
            'domain', 'domainLabel', 'affectedMembers', 'severity',
          ],
        },
      },
    },
    required: ['patternAnalyses'],
  },
};

// ---------------------------------------------------------------------------
// Output type for combined analysis
// ---------------------------------------------------------------------------

/**
 * Output of generateLLMTeamPatternAnalysis().
 *
 * Combines freeform category tag generation and recommendation generation
 * in a single LLM call, replacing the need for separate
 * enrichPatternCategoryTags() + generateLLMTeamRecommendations() calls.
 */
export interface TeamPatternAnalysisResult {
  /**
   * Freeform team-level category tags keyed by pattern title.
   * LLM-generated from a cross-developer manager perspective.
   * These supplement or replace the aggregated individual developer tags.
   *
   * Map key: pattern.title (exact match)
   * Map value: 2-5 freeform lowercase tags
   */
  patternCategoryTags: Record<string, string[]>;
  /**
   * Prioritized manager-facing action items, same shape as TeamActionItem[].
   * Same output contract as generateLLMTeamRecommendations().
   */
  recommendations: TeamActionItem[];
}

// ---------------------------------------------------------------------------
// Raw LLM output type for combined analysis
// ---------------------------------------------------------------------------

interface RawPatternAnalysis {
  patternTitle: string;
  teamCategoryTags: string[];
  urgency: 'immediate' | 'this-sprint' | 'next-sprint';
  action: string;
  rationale: string;
  domain: string;
  domainLabel: string;
  affectedMembers: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface PatternAnalysisToolOutput {
  patternAnalyses: RawPatternAnalysis[];
}

// ---------------------------------------------------------------------------
// Combined generator function
// ---------------------------------------------------------------------------

/**
 * Generate LLM-powered freeform category tags AND team-level recommendations
 * from cross-developer patterns in a single Anthropic API call.
 *
 * Preferred over calling generateLLMTeamRecommendations() + enrichPatternCategoryTags()
 * separately because:
 * - Single API call: fewer round-trips, lower latency, lower cost
 * - Coherent output: tags and recommendations are generated with shared context,
 *   so the recommendation text naturally aligns with the category tags
 * - Team-level tags: the LLM generates tags that describe the cross-developer
 *   behavioral concern, not just aggregated individual developer tags
 *
 * Category tags are keyed by exact pattern title and intended to be applied
 * back to TeamGrowthAreaPEAAggregate.categoryTags after the call.
 *
 * Error handling: follows the codebase "No Fallback Policy" — errors propagate
 * to callers rather than returning empty or default data.
 *
 * @param patterns Cross-developer pattern aggregates from aggregateGrowthAreasPEA()
 * @param totalMembers Total number of developers in the team
 * @param config Optional Anthropic API configuration
 * @returns Combined result: patternCategoryTags map + prioritized recommendations
 *
 * @throws {Error} If API key is missing, the Anthropic call fails, or the
 *   response cannot be parsed as structured output.
 *
 * @example
 * const patterns = aggregateGrowthAreasPEA(teamMembers);
 * const { patternCategoryTags, recommendations } =
 *   await generateLLMTeamPatternAnalysis(patterns, teamMembers.length);
 *
 * // Apply team-level tags back to patterns
 * const enrichedPatterns = patterns.map(p => ({
 *   ...p,
 *   categoryTags: patternCategoryTags[p.title] ?? p.categoryTags,
 * }));
 */
export async function generateLLMTeamPatternAnalysis(
  patterns: TeamGrowthAreaPEAAggregate[],
  totalMembers: number,
  config: TeamRecommendationsConfig = {},
): Promise<TeamPatternAnalysisResult> {
  if (patterns.length === 0 || totalMembers === 0) {
    return { patternCategoryTags: {}, recommendations: [] };
  }

  const resolvedConfig: Required<TeamRecommendationsConfig> = {
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? DEFAULT_CONFIG.apiKey,
    model: config.model ?? DEFAULT_CONFIG.model,
    maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
  };

  if (!resolvedConfig.apiKey) {
    throw new Error(
      'generateLLMTeamPatternAnalysis: ANTHROPIC_API_KEY is required. ' +
      'Set the environment variable or pass config.apiKey.',
    );
  }

  const client = new Anthropic({ apiKey: resolvedConfig.apiKey });
  const userPrompt = buildTeamPatternAnalysisUserPrompt(patterns, totalMembers);

  const response = await client.messages.create({
    model: resolvedConfig.model,
    max_tokens: resolvedConfig.maxTokens,
    system: TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [TEAM_PATTERN_ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'generate_team_pattern_analysis' },
  });

  // Extract tool use block
  const toolUseBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error(
      'generateLLMTeamPatternAnalysis: LLM response did not contain a tool_use block. ' +
      `Stop reason: ${response.stop_reason}`,
    );
  }

  const output = toolUseBlock.input as PatternAnalysisToolOutput;

  if (!Array.isArray(output?.patternAnalyses)) {
    throw new Error(
      'generateLLMTeamPatternAnalysis: tool output missing "patternAnalyses" array. ' +
      `Got: ${JSON.stringify(output).slice(0, 200)}`,
    );
  }

  // Validate items — filter out malformed entries
  const validAnalyses = output.patternAnalyses.filter(
    (r): r is RawPatternAnalysis =>
      typeof r.patternTitle === 'string' &&
      Array.isArray(r.teamCategoryTags) &&
      typeof r.urgency === 'string' &&
      typeof r.action === 'string' &&
      typeof r.rationale === 'string' &&
      typeof r.domain === 'string' &&
      typeof r.domainLabel === 'string' &&
      Array.isArray(r.affectedMembers) &&
      typeof r.severity === 'string',
  );

  // Build patternCategoryTags map: patternTitle → team-level tags
  // Tags are lowercased and filtered to non-empty strings for consistency.
  const patternCategoryTags: Record<string, string[]> = {};
  for (const analysis of validAnalyses) {
    const tags = analysis.teamCategoryTags
      .map(t => t.toLowerCase().trim())
      .filter(t => t.length > 0)
      .slice(0, 5); // enforce max 5 tags
    if (tags.length > 0) {
      patternCategoryTags[analysis.patternTitle] = tags;
    }
  }

  // Build recommendations from the same analyses, applying urgency/severity ordering
  const urgencyRank: Record<RawPatternAnalysis['urgency'], number> = {
    immediate: 3,
    'this-sprint': 2,
    'next-sprint': 1,
  };
  const severityRank: Record<RawPatternAnalysis['severity'], number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };

  const sortedForRecs = [...validAnalyses]
    .sort((a, b) =>
      urgencyRank[b.urgency] - urgencyRank[a.urgency] ||
      severityRank[b.severity] - severityRank[a.severity] ||
      b.affectedMembers.length - a.affectedMembers.length,
    )
    .slice(0, 7);

  const recommendations: TeamActionItem[] = sortedForRecs.map((r, idx) => ({
    priority: idx + 1,
    urgency: r.urgency,
    action: r.action,
    rationale: r.rationale,
    pattern: r.patternTitle,
    domain: r.domain,
    domainLabel: r.domainLabel,
    affectedMembers: r.affectedMembers,
    severity: r.severity,
  }));

  return { patternCategoryTags, recommendations };
}
