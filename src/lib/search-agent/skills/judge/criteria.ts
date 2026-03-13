/**
 * Relevance Criteria
 *
 * Defines the evaluation criteria for judging content relevance.
 */

/**
 * Relevance criteria definition
 */
export interface RelevanceCriterion {
  name: string;
  weight: number;
  description: string;
  positiveSignals: string[];
  negativeSignals: string[];
}

/**
 * BetterPrompt relevance criteria
 *
 * These criteria evaluate whether content is valuable for
 * helping developers improve their AI collaboration skills.
 */
export const RELEVANCE_CRITERIA: RelevanceCriterion[] = [
  {
    name: 'topicRelevance',
    weight: 0.25,
    description: 'How relevant is this to AI engineering topics?',
    positiveSignals: [
      'Discusses context engineering, prompt design, or AI workflows',
      'Mentions Claude, Claude Code, or similar AI coding tools',
      'Covers memory management, subagents, or multi-agent systems',
      'Provides techniques for better AI collaboration',
      'Discusses vibe coding, vibe-based development, or AI-first coding',
      'Covers agentic workflows, autonomous coding agents, or multi-agent orchestration',
      'Addresses context window management, context pruning, or context offloading',
    ],
    negativeSignals: [
      'Off-topic content unrelated to AI development',
      'Generic programming advice without AI context',
      'Marketing or promotional content',
      'Outdated information (pre-2024)',
      'Pure hype without substance or practical insights',
    ],
  },
  {
    name: 'projectFit',
    weight: 0.25,
    description: 'How applicable is this to BetterPrompt goals?',
    positiveSignals: [
      'Addresses planning, critical thinking, or code understanding',
      'Provides frameworks for evaluating AI collaboration quality',
      'Discusses patterns for effective human-AI interaction',
      'Offers metrics or criteria for assessment',
      'Covers human-AI collaboration best practices and workflows',
      'Distinguishes between vibe coding and professional AI-assisted engineering',
      'Discusses cognitive offloading strategies with AI assistants',
    ],
    negativeSignals: [
      'Focuses on AI capabilities rather than human skills',
      'Too theoretical without practical application',
      'Specific to non-programming use cases',
      'Promotes uncritical acceptance of AI output without review',
    ],
  },
  {
    name: 'actionability',
    weight: 0.2,
    description: 'Can this be turned into practical guidance?',
    positiveSignals: [
      'Includes concrete examples or code snippets',
      'Provides step-by-step techniques',
      'Offers clear do/don\'t recommendations',
      'Has measurable outcomes or criteria',
      'Provides CLAUDE.md templates or project instruction examples',
      'Includes specific tool configurations or workflow setups',
    ],
    negativeSignals: [
      'Purely theoretical or philosophical',
      'Vague or high-level without specifics',
      'Requires extensive interpretation',
      'Only anecdotal without reproducible guidance',
    ],
  },
  {
    name: 'novelty',
    weight: 0.15,
    description: 'Does this provide new insights?',
    positiveSignals: [
      'Introduces new techniques or approaches',
      'Provides unique perspective on known topics',
      'Shares original research or findings',
      'Offers fresh examples or use cases',
    ],
    negativeSignals: [
      'Repeats commonly known information',
      'Rehashes existing documentation',
      'No new value beyond basics',
    ],
  },
  {
    name: 'credibility',
    weight: 0.15,
    description: 'Is this from a credible source?',
    positiveSignals: [
      'From official documentation or announcements',
      'Written by known experts or practitioners',
      'Backed by evidence or real-world experience',
      'Has community validation (upvotes, engagement)',
      'From recognized AI engineering voices (Karpathy, Willison, swyx, etc.)',
      'Published on reputable platforms (Anthropic blog, LangChain, major tech blogs)',
    ],
    negativeSignals: [
      'Anonymous or unverified source',
      'Contains factual errors',
      'Speculative without evidence',
      'Low engagement or negative feedback',
      'Aggregated or rewritten content without original insights',
    ],
  },
];

/**
 * Format criteria as prompt context
 */
export function formatCriteriaForPrompt(): string {
  return RELEVANCE_CRITERIA.map(
    (c) => `### ${c.name} (weight: ${c.weight})
${c.description}

**Positive signals:**
${c.positiveSignals.map((s) => `- ${s}`).join('\n')}

**Negative signals:**
${c.negativeSignals.map((s) => `- ${s}`).join('\n')}`
  ).join('\n\n');
}
