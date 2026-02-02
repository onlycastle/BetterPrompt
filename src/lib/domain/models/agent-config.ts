/**
 * Agent Configuration - Single Source of Truth
 *
 * Defines agent tiers and metadata for all AI analysis agents.
 * This is THE canonical source - all other files must import from here.
 *
 * @module domain/models/agent-config
 */

import { z } from 'zod';

// ============================================================================
// Schema Definitions
// ============================================================================

export const AgentTierSchema = z.enum(['free', 'premium']);
export type AgentTier = z.infer<typeof AgentTierSchema>;

export const AgentIdSchema = z.enum([
  // Legacy agent IDs (kept for backward compatibility with stored data)
  'metacognition',
  'knowledgeGap',
  'patternDetective',
  'antiPatternSpotter',
  'contextEfficiency',
  'temporalAnalysis',
  'multitasking',
  'typeClassifier',
]);
export type AgentId = z.infer<typeof AgentIdSchema>;

// ============================================================================
// Configuration Interface
// ============================================================================

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
// SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * Master agent configuration array.
 *
 * To change an agent's tier, ONLY modify this array.
 * All consumers (API, Web UI, Desktop) import from here.
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
    id: 'typeClassifier',
    tier: 'free',
    name: 'Type Classifier',
    icon: '🎯',
    color: 'violet',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Derived Constants & Helper Functions
// ============================================================================

/** Get all agents filtered by tier */
export function getAgentsByTier(tier: AgentTier): AgentConfig[] {
  return AGENT_CONFIGS.filter((c) => c.tier === tier);
}

/** IDs of all FREE tier agents */
export const FREE_AGENT_IDS = getAgentsByTier('free').map((c) => c.id);

/** IDs of all PREMIUM tier agents */
export const PREMIUM_AGENT_IDS = getAgentsByTier('premium').map((c) => c.id);

/** Check if an agent is in the FREE tier */
export function isAgentFree(id: AgentId): boolean {
  const config = AGENT_CONFIGS.find((c) => c.id === id);
  return config?.tier === 'free';
}

/** Get configuration for a specific agent */
export function getAgentConfig(id: AgentId): AgentConfig | undefined {
  return AGENT_CONFIGS.find((c) => c.id === id);
}
