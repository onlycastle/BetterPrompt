/**
 * Report Types for Desktop App
 *
 * Simplified types for the report display, extracted from web app.
 */

// ============================================================================
// Base Types
// ============================================================================

export type CodingStyleType =
  | 'architect'
  | 'scientist'
  | 'collaborator'
  | 'speedrunner'
  | 'craftsman';

export type AIControlLevel = 'passive' | 'balanced' | 'directive' | 'authoritative';

export interface TypeDistribution {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

// ============================================================================
// Type Metadata
// ============================================================================

export interface TypeMetadata {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  strengths: string[];
  growthPoints: string[];
}

export const REPORT_TYPE_METADATA: Record<CodingStyleType, TypeMetadata> = {
  architect: {
    emoji: '🏗️',
    name: 'Architect',
    tagline: 'Strategic thinker who plans before diving into code',
    description:
      'You approach AI collaboration with a clear vision. Your structured prompts and systematic planning maximize AI implementation speed while maintaining consistency.',
    strengths: [
      'Systematic approach to complex systems',
      "Maximizes AI's implementation speed",
      'High consistency in output',
    ],
    growthPoints: [
      'Quick prototyping can sometimes be more efficient',
      'Over-planning may delay execution',
    ],
  },
  scientist: {
    emoji: '🔬',
    name: 'Scientist',
    tagline: 'Truth-seeker who always verifies AI output',
    description:
      "You maintain healthy skepticism toward AI output. Your verification habits catch bugs early and ensure high code quality while keeping your skills sharp.",
    strengths: [
      'Catches bugs early',
      'High code quality',
      'Low AI dependency, maintains skills',
    ],
    growthPoints: [
      'Verifying everything can slow velocity',
      'More AI trust could improve efficiency',
    ],
  },
  collaborator: {
    emoji: '🤝',
    name: 'Collaborator',
    tagline: 'Partnership master who finds answers through dialogue',
    description:
      'You excel at iterative refinement through conversation. Your collaborative approach maximizes AI synergy and leads to quality improvement through iteration.',
    strengths: [
      'Maximizes AI synergy',
      'Quality improvement through iteration',
      'Flexible problem solving',
    ],
    growthPoints: [
      'Clearer initial requirements could reduce turns',
      'Sometimes one clear request is more efficient',
    ],
  },
  speedrunner: {
    emoji: '⚡',
    name: 'Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
    strengths: [
      'Rapid prototyping',
      'New discoveries through experimentation',
      'High output per time',
    ],
    growthPoints: [
      'Technical debt may accumulate',
      'Sometimes slower design is more efficient',
    ],
  },
  craftsman: {
    emoji: '🔧',
    name: 'Craftsman',
    tagline: 'Artisan who prioritizes code quality above all',
    description:
      'You care deeply about code quality and consistency. Your attention to detail produces maintainable code and minimizes long-term technical debt.',
    strengths: [
      'Produces maintainable code',
      'Maintains team codebase consistency',
      'Minimizes long-term technical debt',
    ],
    growthPoints: [
      'Perfectionism may delay deployment',
      'Speed matters too at MVP stage',
    ],
  },
};

// ============================================================================
// Session Info
// ============================================================================

export interface AnalyzedSessionInfo {
  fileName: string;
  sessionId: string;
  projectName: string;
  startTime: string;
  messageCount: number;
  durationMinutes: number;
}

// ============================================================================
// Verbose Evaluation (from Lambda)
// ============================================================================

export interface PersonalizedEvidence {
  quote: string;
  sessionDate: string;
  context: string;
  significance: string;
  sentiment: 'positive' | 'neutral' | 'growth_opportunity';
}

export interface PersonalizedStrength {
  title: string;
  description: string;
  evidence: PersonalizedEvidence[];
  percentile?: number;
}

export interface GrowthArea {
  title: string;
  description: string;
  evidence: PersonalizedEvidence[];
  recommendation: string;
  resources?: string[];
}

export interface PromptPattern {
  patternName: string;
  description: string;
  frequency: 'frequent' | 'occasional' | 'rare';
  examples: Array<{
    quote: string;
    analysis: string;
  }>;
  impact: string;
  isStrength: boolean;
}

export interface PerDimensionInsight {
  dimensionId: string;
  overallScore: number;
  interpretation: string;
  strengths: Array<{ title: string; description: string }>;
  growthAreas: Array<{ title: string; description: string; recommendation: string }>;
}

export interface VerboseEvaluation {
  // Metadata
  sessionId: string;
  analyzedAt: string;
  sessionsAnalyzed: number;
  avgPromptLength?: number;
  avgTurnsPerSession?: number;
  analyzedSessions?: AnalyzedSessionInfo[];

  // Type result
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
  distribution: TypeDistribution;

  // FREE TIER - Verbose content
  personalitySummary: string;
  strengths: PersonalizedStrength[];
  growthAreas: GrowthArea[];
  promptPatterns: PromptPattern[];
  perDimensionInsights?: PerDimensionInsight[];

  // Context efficiency metrics
  contextEfficiencyScore?: number;
  contextEfficiencyExplanation?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AnalysisResultResponse {
  resultId: string;
  isPaid: boolean;
  evaluation: VerboseEvaluation;
  preview?: {
    totalPromptPatterns: number;
    totalGrowthAreas: number;
    previewCount: number;
  };
}
