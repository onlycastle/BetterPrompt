/**
 * Agent Configuration - Desktop App
 *
 * IMPORTANT: This mirrors the configuration in src/lib/domain/models/agent-config.ts
 * When updating agent tiers, update BOTH files to maintain consistency.
 *
 * The web app's agent-config.ts is the primary source of truth.
 *
 * @module types/agent-config
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type AgentTier = 'free' | 'premium';

export type AgentId =
  | 'metacognition'
  | 'knowledgeGap'
  | 'patternDetective'
  | 'antiPatternSpotter'
  | 'contextEfficiency'
  | 'temporalAnalysis'
  | 'multitasking'
  | 'typeSynthesis';

export interface AgentConfig {
  id: AgentId;
  tier: AgentTier;
  name: string;
  icon: string;
  color: string; // For UI rendering
  scoreLabel: string;
  scoreKey: string;
  scoreMax: number;
}

// ============================================================================
// AGENT CONFIGURATIONS
// Mirror of src/lib/domain/models/agent-config.ts
// ============================================================================

/**
 * Master agent configuration array.
 *
 * To change an agent's tier, update BOTH this file AND
 * src/lib/domain/models/agent-config.ts to maintain consistency.
 */
export const AGENT_CONFIGS: AgentConfig[] = [
  // FREE tier - full data for all users
  {
    id: 'metacognition',
    tier: 'free',
    name: 'Metacognition',
    icon: '🧠',
    color: 'indigo',
    scoreLabel: 'Awareness',
    scoreKey: 'metacognitiveAwarenessScore',
    scoreMax: 100,
  },
  {
    id: 'knowledgeGap',
    tier: 'free',
    name: 'Knowledge Gap',
    icon: '📚',
    color: 'cyan',
    scoreLabel: 'Knowledge Score',
    scoreKey: 'overallKnowledgeScore',
    scoreMax: 100,
  },

  // PREMIUM tier - teaser only for free users
  {
    id: 'patternDetective',
    tier: 'premium',
    name: 'Pattern Detective',
    icon: '🔍',
    color: 'purple',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
  },
  {
    id: 'antiPatternSpotter',
    tier: 'premium',
    name: 'Anti-Pattern Spotter',
    icon: '⚠️',
    color: 'orange',
    scoreLabel: 'Health',
    scoreKey: 'overallHealthScore',
    scoreMax: 100,
  },
  {
    id: 'contextEfficiency',
    tier: 'premium',
    name: 'Context Efficiency',
    icon: '⚡',
    color: 'yellow',
    scoreLabel: 'Efficiency',
    scoreKey: 'overallEfficiencyScore',
    scoreMax: 100,
  },
  {
    id: 'temporalAnalysis',
    tier: 'premium',
    name: 'Temporal Analysis',
    icon: '⏱️',
    color: 'blue',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
  },
  {
    id: 'multitasking',
    tier: 'premium',
    name: 'Multitasking',
    icon: '🔄',
    color: 'green',
    scoreLabel: 'Efficiency',
    scoreKey: 'multitaskingEfficiencyScore',
    scoreMax: 100,
  },
  {
    id: 'typeSynthesis',
    tier: 'premium',
    name: 'Type Synthesis',
    icon: '🎭',
    color: 'pink',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/** IDs of all FREE tier agents */
export const FREE_AGENT_IDS = AGENT_CONFIGS.filter((c) => c.tier === 'free').map((c) => c.id);

/** IDs of all PREMIUM tier agents */
export const PREMIUM_AGENT_IDS = AGENT_CONFIGS.filter((c) => c.tier === 'premium').map((c) => c.id);

/** Check if an agent is in the FREE tier */
export function isAgentFree(id: AgentId): boolean {
  return FREE_AGENT_IDS.includes(id);
}

/** Get configuration for a specific agent */
export function getAgentConfig(id: AgentId): AgentConfig | undefined {
  return AGENT_CONFIGS.find((c) => c.id === id);
}

/** Get all agents filtered by tier */
export function getAgentsByTier(tier: AgentTier): AgentConfig[] {
  return AGENT_CONFIGS.filter((c) => c.tier === tier);
}
