/**
 * Knowledge Taxonomy
 *
 * Defines the structure and relationships for organizing knowledge.
 */

import { TopicCategory, ContentType } from '../../models/index.js';

/**
 * Taxonomy node with subcategories
 */
export interface TaxonomyNode {
  category: TopicCategory;
  displayName: string;
  description: string;
  subcategories: string[];
  relatedCategories: TopicCategory[];
}

/**
 * Knowledge taxonomy for organizing AI engineering knowledge
 */
export const KNOWLEDGE_TAXONOMY: TaxonomyNode[] = [
  {
    category: 'context-engineering',
    displayName: 'Context Engineering',
    description: 'Techniques for managing and optimizing AI context windows',
    subcategories: [
      'CLAUDE.md patterns',
      'Context compaction',
      'Just-in-time retrieval',
      'File system as memory',
      'Context window optimization',
    ],
    relatedCategories: ['memory-management', 'prompt-engineering'],
  },
  {
    category: 'claude-code-skills',
    displayName: 'Claude Code Skills',
    description: 'Skills, hooks, and commands for Claude Code',
    subcategories: [
      'Custom slash commands',
      'Hooks and automation',
      'Skills development',
      'Plugin architecture',
      'Configuration patterns',
    ],
    relatedCategories: ['workflow-automation', 'tool-use'],
  },
  {
    category: 'subagents',
    displayName: 'Subagents',
    description: 'Multi-agent orchestration and delegation patterns',
    subcategories: [
      'Agent orchestration',
      'Task delegation',
      'Context isolation',
      'Agent communication',
      'Parallel execution',
    ],
    relatedCategories: ['workflow-automation', 'memory-management'],
  },
  {
    category: 'memory-management',
    displayName: 'Memory Management',
    description: 'Patterns for AI memory and state persistence',
    subcategories: [
      'Agentic memory',
      'Structured notes',
      'Knowledge persistence',
      'Session continuity',
      'Memory retrieval',
    ],
    relatedCategories: ['context-engineering', 'subagents'],
  },
  {
    category: 'prompt-engineering',
    displayName: 'Prompt Engineering',
    description: 'Techniques for effective AI prompting',
    subcategories: [
      'Structured prompts',
      'System prompts',
      'Few-shot examples',
      'Chain of thought',
      'Output formatting',
    ],
    relatedCategories: ['context-engineering', 'best-practices'],
  },
  {
    category: 'tool-use',
    displayName: 'Tool Use',
    description: 'Patterns for AI tool integration and function calling',
    subcategories: [
      'Tool definitions',
      'Structured outputs',
      'Function calling',
      'Tool selection',
      'Error handling',
    ],
    relatedCategories: ['claude-code-skills', 'workflow-automation'],
  },
  {
    category: 'workflow-automation',
    displayName: 'Workflow Automation',
    description: 'Automating development workflows with AI',
    subcategories: [
      'CI/CD integration',
      'Code review automation',
      'Test generation',
      'Documentation automation',
      'Task orchestration',
    ],
    relatedCategories: ['claude-code-skills', 'subagents'],
  },
  {
    category: 'best-practices',
    displayName: 'Best Practices',
    description: 'General best practices for AI collaboration',
    subcategories: [
      'Communication patterns',
      'Error recovery',
      'Quality assurance',
      'Security considerations',
      'Performance optimization',
    ],
    relatedCategories: ['prompt-engineering', 'context-engineering'],
  },
  {
    category: 'other',
    displayName: 'Other',
    description: 'Miscellaneous AI engineering topics',
    subcategories: [],
    relatedCategories: [],
  },
];

/**
 * Content type descriptions for organization
 */
export const CONTENT_TYPE_INFO: Record<
  ContentType,
  { displayName: string; description: string }
> = {
  technique: {
    displayName: 'Technique',
    description: 'A specific method or approach to accomplish something',
  },
  pattern: {
    displayName: 'Pattern',
    description: 'A reusable design pattern or architecture',
  },
  tool: {
    displayName: 'Tool',
    description: 'A tool, utility, or framework',
  },
  configuration: {
    displayName: 'Configuration',
    description: 'Settings, config examples, or setup instructions',
  },
  insight: {
    displayName: 'Insight',
    description: 'An observation, learning, or key understanding',
  },
  example: {
    displayName: 'Example',
    description: 'A code example or usage demonstration',
  },
  reference: {
    displayName: 'Reference',
    description: 'Documentation, specification, or authoritative source',
  },
};

/**
 * Get taxonomy node by category
 */
export function getTaxonomyNode(category: TopicCategory): TaxonomyNode | undefined {
  return KNOWLEDGE_TAXONOMY.find((node) => node.category === category);
}

/**
 * Format taxonomy for prompt context
 */
export function formatTaxonomyForPrompt(): string {
  return KNOWLEDGE_TAXONOMY.filter((t) => t.category !== 'other')
    .map(
      (t) => `### ${t.displayName} (${t.category})
${t.description}
Subcategories: ${t.subcategories.join(', ')}`
    )
    .join('\n\n');
}
