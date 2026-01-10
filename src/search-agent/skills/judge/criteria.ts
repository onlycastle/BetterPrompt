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
 * NoMoreAISlop relevance criteria
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
    ],
    negativeSignals: [
      'Off-topic content unrelated to AI development',
      'Generic programming advice without AI context',
      'Marketing or promotional content',
      'Outdated information (pre-2024)',
    ],
  },
  {
    name: 'projectFit',
    weight: 0.25,
    description: 'How applicable is this to NoMoreAISlop goals?',
    positiveSignals: [
      'Addresses planning, critical thinking, or code understanding',
      'Provides frameworks for evaluating AI collaboration quality',
      'Discusses patterns for effective human-AI interaction',
      'Offers metrics or criteria for assessment',
    ],
    negativeSignals: [
      'Focuses on AI capabilities rather than human skills',
      'Too theoretical without practical application',
      'Specific to non-programming use cases',
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
    ],
    negativeSignals: [
      'Purely theoretical or philosophical',
      'Vague or high-level without specifics',
      'Requires extensive interpretation',
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
    ],
    negativeSignals: [
      'Anonymous or unverified source',
      'Contains factual errors',
      'Speculative without evidence',
      'Low engagement or negative feedback',
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
