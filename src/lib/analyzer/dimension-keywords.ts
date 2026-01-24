/**
 * Dimension Keywords - Mapping analysis dimensions to KB search parameters
 *
 * SIMPLIFIED: Now that Knowledge Items use applicableDimensions directly,
 * this file provides keyword configs for search refinement, not category mapping.
 *
 * Each dimension has two keyword sets:
 * - reinforcement: For strengths (score >= 70) - advanced resources
 * - improvement: For growth areas (score < 70) - beginner resources
 */

import type { DimensionName } from '../models/unified-report';

const STRENGTH_THRESHOLD = 70;
const ADVANCED_THRESHOLD = 85;
const INTERMEDIATE_THRESHOLD = 50;

export type InsightMode = 'reinforcement' | 'improvement';
export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface DimensionKeywordConfig {
  /**
   * Keywords for future semantic matching implementation.
   * Currently unused - Professional Insights matching uses DB fields only
   * (applicableDimensions, minScore, maxScore).
   * @future Implement embedding-based matching with these keywords
   */
  keywords: string[];
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
      level: 'beginner',
      searchQuery: 'AI collaboration basics effective prompting beginners',
    },
  },

  contextEngineering: {
    reinforcement: {
      keywords: [
        'advanced context management',
        'token optimization',
        'optimal context utilization',
        '/compact usage',
        'fresh session strategy',
        'context window ~50%',
      ],
      level: 'advanced',
      searchQuery: 'advanced context engineering token optimization compact command',
    },
    improvement: {
      keywords: [
        'context overload',
        'context window >70%',
        'high token usage',
        'long sessions without /compact',
        'context basics',
        'WRITE strategy',
        'file references',
      ],
      level: 'beginner',
      searchQuery: 'context engineering basics context window management compact',
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
      level: 'beginner',
      searchQuery: 'skill atrophy prevention VCP cold start practice',
    },
  },

  // ============================================================================
  // New Dimensions (Phase 3) - Premium/Enterprise
  // ============================================================================

  iterationEfficiency: {
    reinforcement: {
      keywords: [
        'targeted refinement',
        'specific changes',
        'focused iteration',
        'efficient debugging',
        'systematic approach',
      ],
      level: 'advanced',
      searchQuery: 'efficient iteration targeted debugging systematic approach',
    },
    improvement: {
      keywords: [
        'iteration cycles',
        'shotgun debugging',
        'retry patterns',
        'vague requests',
        'unclear requirements',
      ],
      level: 'beginner',
      searchQuery: 'reduce iteration cycles clear requirements targeted requests',
    },
  },

  learningVelocity: {
    reinforcement: {
      keywords: [
        'asking why',
        'deep understanding',
        'knowledge transfer',
        'pattern recognition',
        'independent application',
      ],
      level: 'advanced',
      searchQuery: 'deep learning AI understanding knowledge transfer patterns',
    },
    improvement: {
      keywords: [
        'shallow learning',
        'copy paste',
        'repeated questions',
        'AI dependency',
        'surface understanding',
      ],
      level: 'beginner',
      searchQuery: 'learning from AI deep understanding avoid dependency',
    },
  },

  scopeManagement: {
    reinforcement: {
      keywords: [
        'clear scope',
        'task boundaries',
        'step by step',
        'proper decomposition',
        'focused requests',
      ],
      level: 'advanced',
      searchQuery: 'scope management task decomposition focused requests',
    },
    improvement: {
      keywords: [
        'scope creep',
        'monolithic requests',
        'unclear boundaries',
        'expanding requirements',
        'kitchen sink prompts',
      ],
      level: 'beginner',
      searchQuery: 'avoid scope creep clear boundaries task decomposition',
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
