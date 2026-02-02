/**
 * Knowledge-Dimension Mapping for Workers
 *
 * Maps each Worker to relevant dimension names, then filters Professional Insights
 * from INITIAL_INSIGHTS based on those dimensions.
 *
 * This enables Workers to receive domain-specific knowledge during LLM analysis,
 * connecting their output to verified research and best practices.
 *
 * Post-processing functions resolve [pi-XXX] references in Worker output
 * to human-readable titles and extract referenced insight metadata.
 *
 * @module analyzer/workers/prompts/knowledge-mapping
 */

import {
  INITIAL_INSIGHTS,
  type DimensionName,
} from '../../../domain/models/knowledge';

/**
 * Insight data formatted for prompt injection
 * Simplified version of ProfessionalInsight for token efficiency
 */
export interface InsightForPrompt {
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  category: string;
}

/**
 * Referenced insight with metadata for output
 * Used in Worker output to provide links to source materials
 */
export interface ReferencedInsight {
  id: string; // "pi-001"
  title: string; // "Skill Atrophy Self-Diagnosis"
  url: string; // "https://arxiv.org/abs/2601.02410"
}

/**
 * Context object returned by getInsightsForWorker
 * Contains insights for prompt injection plus lookup maps for post-processing
 */
export interface WorkerInsightContext {
  insights: InsightForPrompt[];
  urlLookup: Map<string, string>; // id -> url
  titleLookup: Map<string, string>; // id -> title
}

/**
 * Worker name to applicable dimension mapping
 *
 * Each Worker analyzes specific aspects of developer behavior.
 * This mapping connects Workers to the dimensions their analysis covers.
 */
export const WORKER_DIMENSION_MAP: Record<string, DimensionName[]> = {
  TrustVerification: ['aiControl', 'skillResilience'],
  WorkflowHabit: ['aiCollaboration', 'toolMastery'],
  KnowledgeGap: ['skillResilience'],
  ContextEfficiency: ['contextEngineering'],
};

/**
 * Maximum number of insights to inject per worker
 * Balances knowledge richness with token cost (~100-150 tokens per insight)
 */
const MAX_INSIGHTS_PER_WORKER = 5;

/**
 * Get relevant Professional Insights for a specific worker
 *
 * Filters INITIAL_INSIGHTS based on the worker's applicable dimensions,
 * returning only insights that are:
 * 1. Enabled
 * 2. Have applicableDimensions matching the worker's dimensions
 * 3. Limited to MAX_INSIGHTS_PER_WORKER for token efficiency
 *
 * Returns a WorkerInsightContext containing:
 * - insights: Array of insights formatted for prompt injection
 * - urlLookup: Map from insight ID to source URL (for post-processing)
 * - titleLookup: Map from insight ID to title (for post-processing)
 *
 * @param workerName - Name of the worker (e.g., "TrustVerification")
 * @returns WorkerInsightContext with insights and lookup maps
 *
 * @example
 * const { insights, urlLookup, titleLookup } = getInsightsForWorker("TrustVerification");
 * // insights: for 'aiControl' and 'skillResilience' dimensions
 * // urlLookup.get("pi-001") → "https://arxiv.org/..."
 */
export function getInsightsForWorker(workerName: string): WorkerInsightContext {
  const dimensions = WORKER_DIMENSION_MAP[workerName];

  if (!dimensions || dimensions.length === 0) {
    return { insights: [], urlLookup: new Map(), titleLookup: new Map() };
  }

  // Filter insights that apply to any of the worker's dimensions
  const relevantInsights = INITIAL_INSIGHTS.filter((insight) => {
    // Skip disabled insights
    if (!insight.enabled) {
      return false;
    }

    // Check if insight has applicable dimensions matching worker's dimensions
    const insightDimensions = insight.applicableDimensions as
      | DimensionName[]
      | undefined;
    if (!insightDimensions || insightDimensions.length === 0) {
      return false;
    }

    return insightDimensions.some((d) => dimensions.includes(d as DimensionName));
  });

  // Sort by priority (higher first) and limit to max count
  const sortedInsights = relevantInsights
    .sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5))
    .slice(0, MAX_INSIGHTS_PER_WORKER);

  // Build lookup maps and insights array
  const urlLookup = new Map<string, string>();
  const titleLookup = new Map<string, string>();

  const insights = sortedInsights.map((insight, index): InsightForPrompt => {
    const id = `pi-${String(index + 1).padStart(3, '0')}`;
    urlLookup.set(id, insight.source.url);
    titleLookup.set(id, insight.title);

    return {
      id,
      title: insight.title,
      keyTakeaway: insight.keyTakeaway,
      actionableAdvice: insight.actionableAdvice,
      category: insight.category,
    };
  });

  return { insights, urlLookup, titleLookup };
}

/**
 * Format insights into a prompt section for LLM injection
 *
 * Creates a structured PROFESSIONAL KNOWLEDGE section that can be
 * appended to Worker system prompts.
 *
 * @param insights - Array of insights from getInsightsForWorker()
 * @returns Formatted string for prompt injection, or empty string if no insights
 */
export function formatInsightsForPrompt(insights: InsightForPrompt[]): string {
  if (!insights || insights.length === 0) {
    return '';
  }

  const insightBlocks = insights
    .map(
      (insight, idx) => `
### ${idx + 1}. ${insight.title} [${insight.id}]
**Key Insight**: ${insight.keyTakeaway}
**What to look for**:
${insight.actionableAdvice.map((a) => `- ${a}`).join('\n')}`
    )
    .join('\n');

  return `
## PROFESSIONAL KNOWLEDGE

Based on verified research from AI collaboration experts, apply these insights during analysis:
${insightBlocks}

When detecting patterns, CONNECT them to the above professional knowledge where applicable.
For example, if you detect "error_loop", reference the "Sunk Cost Fallacy" insight.
When recommending improvements, cite the relevant insight ID (e.g., [pi-001]).
`;
}

/**
 * Regex pattern to match [pi-XXX] references (case-insensitive)
 * Matches: [pi-001], [PI-001], [pi-123], etc.
 */
const PI_PATTERN = /\[pi-(\d{3})\]/gi;

/**
 * Resolve knowledge base references in text
 *
 * Replaces [pi-XXX] patterns with human-readable titles (e.g., "Skill Atrophy")
 * and extracts referenced insights for metadata.
 *
 * @param text - Text containing [pi-XXX] references
 * @param insightContext - Context from getInsightsForWorker()
 * @returns Object with resolved text and array of referenced insights
 *
 * @example
 * const result = resolveKnowledgeBaseReferences(
 *   "Apply [pi-001] and [pi-003] principles.",
 *   insightContext
 * );
 * // result.resolvedText: "Apply \"Skill Atrophy Self-Diagnosis\" and \"Context Engineering\" principles."
 * // result.referencedInsights: [{ id: "pi-001", title: "...", url: "..." }, ...]
 */
export function resolveKnowledgeBaseReferences(
  text: string,
  insightContext: WorkerInsightContext
): {
  resolvedText: string;
  referencedInsights: ReferencedInsight[];
} {
  const { insights, urlLookup, titleLookup } = insightContext;
  const referencedInsights: ReferencedInsight[] = [];
  const seen = new Set<string>();

  const resolvedText = text.replace(PI_PATTERN, (match, numStr) => {
    const index = parseInt(numStr, 10) - 1; // pi-001 = index 0
    const insight = insights[index];

    if (!insight) {
      // Invalid ID - silently remove it
      return '';
    }

    const id = insight.id;
    if (!seen.has(id)) {
      seen.add(id);
      referencedInsights.push({
        id,
        title: titleLookup.get(id) || insight.title,
        url: urlLookup.get(id) || '',
      });
    }

    return `"${insight.title}"`; // [pi-001] → "Skill Atrophy"
  });

  return { resolvedText, referencedInsights };
}
