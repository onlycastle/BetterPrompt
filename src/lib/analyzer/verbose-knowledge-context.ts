/**
 * Verbose Knowledge Context Builder
 *
 * Builds injectable knowledge context from existing assets:
 * - INITIAL_INSIGHTS: Research-backed professional insights
 * - DIMENSION_KEYWORDS: Behavioral signals for each dimension
 *
 * This context is injected into the system prompt to provide
 * the LLM with expert knowledge for more sophisticated analysis.
 *
 * @module analyzer/verbose-knowledge-context
 */

import { INITIAL_INSIGHTS, type ProfessionalInsight } from '../domain/models/knowledge';
import { DIMENSION_KEYWORDS, type DimensionMapping } from './dimension-keywords';

/**
 * Dimension display names for readable output
 */
const DIMENSION_DISPLAY_NAMES: Record<string, string> = {
  aiCollaboration: 'AI Collaboration Mastery',
  contextEngineering: 'Context Engineering',
  toolMastery: 'Tool Mastery',
  burnoutRisk: 'Burnout Risk Assessment',
  aiControl: 'AI Control Index',
  skillResilience: 'Skill Resilience',
};

/**
 * Format a single professional insight as XML
 */
function formatInsight(
  insight: Omit<ProfessionalInsight, 'id' | 'createdAt' | 'updatedAt'>
): string {
  const advice = insight.actionableAdvice.map((a) => `      - ${a}`).join('\n');
  const dimensions = insight.applicableDimensions?.join(', ') || 'all';

  return `    <insight category="${insight.category}" priority="${insight.priority}">
      <title>${insight.title}</title>
      <source author="${insight.source.author}" type="${insight.source.type}">${insight.source.url}</source>
      <key_takeaway>${insight.keyTakeaway}</key_takeaway>
      <actionable_advice>
${advice}
      </actionable_advice>
      <applicable_dimensions>${dimensions}</applicable_dimensions>
      ${insight.maxScore !== undefined ? `<trigger_condition>Show when dimension score &lt;= ${insight.maxScore}</trigger_condition>` : ''}
    </insight>`;
}

/**
 * Build the research insights section from INITIAL_INSIGHTS
 */
function buildResearchInsights(): string {
  const insights = INITIAL_INSIGHTS.filter((i) => i.enabled)
    .sort((a, b) => b.priority - a.priority)
    .map(formatInsight)
    .join('\n\n');

  return `  <research_insights>
    <!-- ${INITIAL_INSIGHTS.length} curated insights from verified research -->
    <!-- Sources: VCP Research (arXiv), Anthropic, MIT Technology Review, Karpathy -->

${insights}
  </research_insights>`;
}

/**
 * Format dimension keywords as behavioral signals
 */
function formatDimensionSignals(
  dimension: string,
  mapping: DimensionMapping
): string {
  const displayName = DIMENSION_DISPLAY_NAMES[dimension] || dimension;

  const strengthKeywords = mapping.reinforcement.keywords.slice(0, 4).join(', ');
  const growthKeywords = mapping.improvement.keywords.slice(0, 4).join(', ');

  return `    <dimension name="${dimension}" displayName="${displayName}">
      <strength_signals>
        <keywords>${strengthKeywords}</keywords>
        <categories>${mapping.reinforcement.categories.join(', ')}</categories>
        <look_for>${mapping.reinforcement.searchQuery}</look_for>
      </strength_signals>
      <growth_signals>
        <keywords>${growthKeywords}</keywords>
        <categories>${mapping.improvement.categories.join(', ')}</categories>
        <look_for>${mapping.improvement.searchQuery}</look_for>
      </growth_signals>
    </dimension>`;
}

/**
 * Build the behavioral signals section from DIMENSION_KEYWORDS
 */
function buildBehavioralSignals(): string {
  const dimensions = Object.entries(DIMENSION_KEYWORDS)
    .map(([dimension, mapping]) => formatDimensionSignals(dimension, mapping))
    .join('\n\n');

  return `  <behavioral_signals>
    <!-- 6 analysis dimensions with strength/growth signal indicators -->

${dimensions}
  </behavioral_signals>`;
}

/**
 * Build the complete expert knowledge context for injection into system prompt
 *
 * @returns XML-formatted knowledge context string
 */
export function buildExpertKnowledgeContext(): string {
  const researchInsights = buildResearchInsights();
  const behavioralSignals = buildBehavioralSignals();

  return `<expert_knowledge>
  <!-- This knowledge base informs your analysis with research-backed insights -->
  <!-- Use these signals to identify patterns and provide evidence-based recommendations -->

${researchInsights}

${behavioralSignals}

  <usage_guidelines>
    - Reference specific insights when they apply to the developer's patterns
    - Use behavioral signals to identify strengths and growth opportunities
    - Connect recommendations to actionable advice from research
    - Prioritize insights by their priority score when multiple apply
    - Consider trigger conditions (maxScore) when recommending insights
  </usage_guidelines>
</expert_knowledge>`;
}

/**
 * Get a compact version of the knowledge context (shorter, for token savings)
 * Use this when context window is constrained
 */
export function buildCompactKnowledgeContext(): string {
  // Top 5 insights by priority
  const topInsights = INITIAL_INSIGHTS.filter((i) => i.enabled)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  const insightSummaries = topInsights
    .map((i) => `  - ${i.title}: ${i.keyTakeaway}`)
    .join('\n');

  const dimensionSummaries = Object.entries(DIMENSION_KEYWORDS)
    .map(([dim, mapping]) => {
      const name = DIMENSION_DISPLAY_NAMES[dim] || dim;
      return `  - ${name}: Strength signals=[${mapping.reinforcement.keywords.slice(0, 2).join(', ')}] Growth signals=[${mapping.improvement.keywords.slice(0, 2).join(', ')}]`;
    })
    .join('\n');

  return `<expert_knowledge_compact>
Key Research Insights:
${insightSummaries}

Behavioral Signals by Dimension:
${dimensionSummaries}
</expert_knowledge_compact>`;
}

/**
 * Estimate token count for the knowledge context
 * Uses rough heuristic: ~4 chars per token
 */
export function estimateKnowledgeContextTokens(): {
  full: number;
  compact: number;
} {
  const fullContext = buildExpertKnowledgeContext();
  const compactContext = buildCompactKnowledgeContext();

  return {
    full: Math.ceil(fullContext.length / 4),
    compact: Math.ceil(compactContext.length / 4),
  };
}
