/**
 * Knowledge-Dimension Mapping for Workers
 *
 * Maps each Worker to relevant dimension names, then filters Professional Insights
 * from INITIAL_INSIGHTS based on those dimensions.
 *
 * This enables Workers to receive domain-specific knowledge during LLM analysis,
 * connecting their output to verified research and best practices.
 *
 * @module analyzer/workers/prompts/knowledge-mapping
 */

import {
  INITIAL_INSIGHTS,
  type DimensionName,
  type ProfessionalInsight,
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
 * @param workerName - Name of the worker (e.g., "TrustVerification")
 * @returns Array of insights formatted for prompt injection
 *
 * @example
 * const insights = getInsightsForWorker("TrustVerification");
 * // Returns insights for 'aiControl' and 'skillResilience' dimensions
 */
export function getInsightsForWorker(workerName: string): InsightForPrompt[] {
  const dimensions = WORKER_DIMENSION_MAP[workerName];

  if (!dimensions || dimensions.length === 0) {
    return [];
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

  // Map to simplified format for prompt injection
  return sortedInsights.map(
    (insight, index): InsightForPrompt => ({
      // Generate a stable ID based on index and title
      id: `pi-${String(index + 1).padStart(3, '0')}`,
      title: insight.title,
      keyTakeaway: insight.keyTakeaway,
      actionableAdvice: insight.actionableAdvice,
      category: insight.category,
    })
  );
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
