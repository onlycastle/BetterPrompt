/**
 * Dimension Keywords - Mapping analysis dimensions to KB search parameters
 *
 * Each dimension has two keyword sets:
 * - reinforcement: For strengths (score >= 70) - advanced resources
 * - improvement: For growth areas (score < 70) - beginner resources
 */

import type { DimensionName } from '../models/unified-report.js';

const STRENGTH_THRESHOLD = 70;
const ADVANCED_THRESHOLD = 85;
const INTERMEDIATE_THRESHOLD = 50;

export type InsightMode = 'reinforcement' | 'improvement';
export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced';

export type TopicCategory =
  | 'context-engineering'
  | 'claude-code-skills'
  | 'subagents'
  | 'memory-management'
  | 'prompt-engineering'
  | 'tool-use'
  | 'workflow-automation'
  | 'best-practices'
  | 'other';

export interface DimensionKeywordConfig {
  keywords: string[];
  categories: TopicCategory[];
  professionalInsightIds: string[];
  level: ResourceLevel;
  searchQuery: string;
}

export interface DimensionMapping {
  reinforcement: DimensionKeywordConfig;
  improvement: DimensionKeywordConfig;
}

/**
 * Maps each analysis dimension to KB search parameters.
 * Provides both reinforcement (strength) and improvement (growth) configurations.
 */
export const DIMENSION_KEYWORDS: Record<DimensionName, DimensionMapping> = {
  aiCollaboration: {
    reinforcement: {
      keywords: [
        'advanced prompting',
        'expert collaboration',
        'AI pair programming mastery',
        'optimal AI interaction',
      ],
      categories: ['prompt-engineering', 'best-practices'],
      professionalInsightIds: ['pi-003'],
      level: 'advanced',
      searchQuery: 'advanced AI collaboration techniques expert prompting',
    },
    improvement: {
      keywords: [
        'AI collaboration basics',
        'effective prompts',
        'clear instructions',
        'AI communication',
      ],
      categories: ['prompt-engineering', 'best-practices'],
      professionalInsightIds: ['pi-003'],
      level: 'beginner',
      searchQuery: 'AI collaboration basics effective prompting beginners',
    },
  },

  contextEngineering: {
    reinforcement: {
      keywords: [
        'advanced context management',
        'token optimization',
        'multi-context strategies',
        'context compaction',
      ],
      categories: ['context-engineering', 'memory-management'],
      professionalInsightIds: ['pi-006'],
      level: 'advanced',
      searchQuery: 'advanced context engineering token optimization techniques',
    },
    improvement: {
      keywords: [
        'context basics',
        'WRITE strategy',
        'file references',
        'context window',
        'providing context',
      ],
      categories: ['context-engineering', 'prompt-engineering'],
      professionalInsightIds: ['pi-006', 'pi-010'],
      level: 'beginner',
      searchQuery: 'context engineering basics WRITE strategy file references',
    },
  },

  toolMastery: {
    reinforcement: {
      keywords: [
        'advanced tool orchestration',
        'multi-tool workflows',
        'tool chain optimization',
        'subagent mastery',
      ],
      categories: ['tool-use', 'subagents', 'workflow-automation'],
      professionalInsightIds: ['pi-006'],
      level: 'advanced',
      searchQuery: 'advanced tool use orchestration multi-agent workflows',
    },
    improvement: {
      keywords: [
        'tool basics',
        'when to use tools',
        'tool selection',
        'basic automation',
      ],
      categories: ['tool-use', 'claude-code-skills'],
      professionalInsightIds: [],
      level: 'beginner',
      searchQuery: 'tool use basics when to use AI tools beginners',
    },
  },

  burnoutRisk: {
    reinforcement: {
      keywords: [
        'sustainable AI workflow',
        'productivity balance',
        'efficient sessions',
        'healthy AI usage',
      ],
      categories: ['best-practices', 'workflow-automation'],
      professionalInsightIds: [],
      level: 'advanced',
      searchQuery: 'sustainable AI workflow productivity balance efficiency',
    },
    improvement: {
      keywords: [
        'session management',
        'break strategies',
        'overreliance prevention',
        'healthy boundaries',
      ],
      categories: ['best-practices'],
      professionalInsightIds: ['pi-009'],
      level: 'beginner',
      searchQuery: 'AI burnout prevention session management healthy usage',
    },
  },

  aiControl: {
    reinforcement: {
      keywords: [
        'AI guidance mastery',
        'direction control',
        'output steering',
        'expert verification',
      ],
      categories: ['prompt-engineering', 'best-practices'],
      professionalInsightIds: ['pi-002', 'pi-007'],
      level: 'advanced',
      searchQuery: 'AI control mastery output steering verification expert',
    },
    improvement: {
      keywords: [
        'taking control',
        'guiding AI',
        'verification basics',
        'code review',
        'modification practice',
      ],
      categories: ['best-practices', 'prompt-engineering'],
      professionalInsightIds: ['pi-002', 'pi-007'],
      level: 'beginner',
      searchQuery: 'AI control basics verification code review modification',
    },
  },

  skillResilience: {
    reinforcement: {
      keywords: [
        'skill maintenance',
        'independent coding',
        'cold start mastery',
        'continuous learning',
      ],
      categories: ['best-practices'],
      professionalInsightIds: ['pi-001'],
      level: 'advanced',
      searchQuery: 'skill resilience maintenance independent coding mastery',
    },
    improvement: {
      keywords: [
        'skill atrophy',
        'VCP practice',
        'cold start exercises',
        'dependency reduction',
        'manual coding',
      ],
      categories: ['best-practices'],
      professionalInsightIds: ['pi-001', 'pi-009'],
      level: 'beginner',
      searchQuery: 'skill atrophy prevention VCP cold start practice',
    },
  },
};

/**
 * Get keyword configuration for a specific dimension and mode
 */
export function getKeywordConfig(
  dimension: DimensionName,
  mode: InsightMode
): DimensionKeywordConfig {
  return DIMENSION_KEYWORDS[dimension][mode];
}

/**
 * Get all categories relevant to a dimension
 */
export function getDimensionCategories(dimension: DimensionName): TopicCategory[] {
  const reinforcement = DIMENSION_KEYWORDS[dimension].reinforcement.categories;
  const improvement = DIMENSION_KEYWORDS[dimension].improvement.categories;
  return [...new Set([...reinforcement, ...improvement])];
}

/**
 * Determine the mode based on score threshold
 */
export function getModeFromScore(score: number): InsightMode {
  return score >= STRENGTH_THRESHOLD ? 'reinforcement' : 'improvement';
}

/**
 * Get appropriate resource level based on score thresholds
 */
export function getResourceLevel(score: number): ResourceLevel {
  if (score >= ADVANCED_THRESHOLD) return 'advanced';
  if (score >= INTERMEDIATE_THRESHOLD) return 'intermediate';
  return 'beginner';
}
