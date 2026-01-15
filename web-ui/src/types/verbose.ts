/**
 * Verbose Analysis Types
 *
 * Types for hyper-personalized verbose analysis reports.
 * Mirrors backend VerboseEvaluation schema from src/models/verbose-evaluation.ts
 */

import type { CodingStyleType, AIControlLevel } from './enterprise.js';
import type { TypeDistribution } from './report.js';

// Re-export for convenience
export type { CodingStyleType, AIControlLevel, TypeDistribution };

// ============================================================================
// Dimension Insights
// NOTE: Evidence is now a string array (just quotes) instead of object array
// to reduce nesting depth for Gemini API compatibility.
// ============================================================================

export interface DimensionStrength {
  title: string;
  description: string;
  /** Array of quote strings demonstrating this strength */
  evidence: string[];
}

export interface DimensionGrowthArea {
  title: string;
  description: string;
  /** Array of quote strings showing this growth opportunity */
  evidence: string[];
  recommendation: string;
}

export type DimensionName =
  | 'aiCollaboration'
  | 'contextEngineering'
  | 'toolMastery'
  | 'burnoutRisk'
  | 'aiControl'
  | 'skillResilience';

export interface PerDimensionInsight {
  dimension: DimensionName;
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
  // Session metrics (computed)
  avgPromptLength?: number;
  avgTurnsPerSession?: number;
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
  strengths: string[];
}

export const VERBOSE_TYPE_METADATA: Record<CodingStyleType, VerboseTypeMetadata> = {
  architect: {
    emoji: '🏗️',
    name: 'The Architect',
    tagline: 'Strategic thinker who plans before diving into code',
    description:
      'You approach AI collaboration with a clear vision. Your structured prompts and systematic planning maximize AI implementation speed while maintaining consistency.',
    strengths: ['Strategic planning', 'Systematic approach', 'Clear communication'],
  },
  scientist: {
    emoji: '🔬',
    name: 'The Scientist',
    tagline: 'Truth-seeker who always verifies AI output',
    description:
      "You maintain healthy skepticism toward AI output. Your verification habits catch bugs early and ensure high code quality while keeping your skills sharp.",
    strengths: ['Verification habits', 'Critical thinking', 'Quality assurance'],
  },
  collaborator: {
    emoji: '🤝',
    name: 'The Collaborator',
    tagline: 'Partnership master who finds answers through dialogue',
    description:
      'You excel at iterative refinement through conversation. Your collaborative approach maximizes AI synergy and leads to quality improvement through iteration.',
    strengths: ['Iterative refinement', 'Communication skills', 'AI synergy'],
  },
  speedrunner: {
    emoji: '⚡',
    name: 'The Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
    strengths: ['Rapid prototyping', 'High output', 'Experimentation'],
  },
  craftsman: {
    emoji: '🔧',
    name: 'The Craftsman',
    tagline: 'Artisan who prioritizes code quality above all',
    description:
      'You care deeply about code quality and consistency. Your attention to detail produces maintainable code and minimizes long-term technical debt.',
    strengths: ['Code quality', 'Attention to detail', 'Maintainability'],
  },
};
