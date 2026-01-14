/**
 * Verbose Analysis Types
 *
 * Types for hyper-personalized verbose analysis reports.
 * Mirrors backend VerboseEvaluation schema from src/models/verbose-evaluation.ts
 */

import type { CodingStyleType, AIControlLevel, TypeDistribution } from './enterprise.js';

// Re-export for convenience
export type { CodingStyleType, AIControlLevel, TypeDistribution };

// ============================================================================
// Dimension Evidence & Insights
// ============================================================================

export interface DimensionEvidence {
  quote: string;
  sessionDate: string;
  context: string;
}

export interface DimensionStrength {
  title: string;
  description: string;
  evidence: DimensionEvidence[];
}

export interface DimensionGrowthArea {
  title: string;
  description: string;
  evidence: DimensionEvidence[];
  recommendation: string;
}

export interface PerDimensionInsight {
  dimension: string;
  dimensionDisplayName: string;
  strengths: DimensionStrength[];
  growthAreas: DimensionGrowthArea[];
}

// ============================================================================
// Prompt Patterns
// ============================================================================

export type PromptFrequency = 'frequent' | 'occasional' | 'rare';
export type PromptEffectiveness = 'highly_effective' | 'effective' | 'could_improve';

export interface PromptPatternExample {
  quote: string;
  analysis: string;
}

export interface PromptPattern {
  patternName: string;
  description: string;
  frequency: PromptFrequency;
  examples: PromptPatternExample[];
  effectiveness: PromptEffectiveness;
  tip?: string;
}

// ============================================================================
// Verbose Analysis Data (API Response)
// ============================================================================

export interface VerboseAnalysisData {
  sessionId: string;
  analyzedAt: string;
  sessionsAnalyzed: number;
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
  distribution: TypeDistribution;
  personalitySummary: string;
  dimensionInsights: PerDimensionInsight[];
  promptPatterns: PromptPattern[];
  // Premium fields (optional)
  toolUsageDeepDive?: unknown[];
  tokenEfficiency?: unknown;
  growthRoadmap?: unknown;
  comparativeInsights?: unknown[];
  sessionTrends?: unknown[];
}

// ============================================================================
// Local Analysis Storage
// ============================================================================

export interface LocalAnalysis {
  id: string;
  type: 'verbose' | 'unified';
  createdAt: string;
  expiresAt?: string;
  data: VerboseAnalysisData;
  metadata?: {
    sessionCount?: number;
    projectPath?: string;
    version?: string;
  };
}

// ============================================================================
// Type Metadata for Display
// ============================================================================

export interface VerboseTypeMetadata {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
}

export const VERBOSE_TYPE_METADATA: Record<CodingStyleType, VerboseTypeMetadata> = {
  architect: {
    emoji: '🏗️',
    name: 'The Architect',
    tagline: 'Strategic thinker who plans before diving into code',
    description:
      'You approach AI collaboration with a clear vision. Your structured prompts and systematic planning maximize AI implementation speed while maintaining consistency.',
  },
  scientist: {
    emoji: '🔬',
    name: 'The Scientist',
    tagline: 'Truth-seeker who always verifies AI output',
    description:
      "You maintain healthy skepticism toward AI output. Your verification habits catch bugs early and ensure high code quality while keeping your skills sharp.",
  },
  collaborator: {
    emoji: '🤝',
    name: 'The Collaborator',
    tagline: 'Partnership master who finds answers through dialogue',
    description:
      'You excel at iterative refinement through conversation. Your collaborative approach maximizes AI synergy and leads to quality improvement through iteration.',
  },
  speedrunner: {
    emoji: '⚡',
    name: 'The Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
  },
  craftsman: {
    emoji: '🔧',
    name: 'The Craftsman',
    tagline: 'Artisan who prioritizes code quality above all',
    description:
      'You care deeply about code quality and consistency. Your attention to detail produces maintainable code and minimizes long-term technical debt.',
  },
};
