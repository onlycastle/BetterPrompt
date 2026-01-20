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

export type PromptFrequency = 'frequent' | 'occasional' | 'rare';
export type PromptEffectiveness = 'highly_effective' | 'effective' | 'could_improve';

export interface PromptPattern {
  patternName: string;
  description: string;
  frequency: PromptFrequency;
  examples: Array<{
    quote: string;
    analysis: string;
  }>;
  effectiveness: PromptEffectiveness;
  tip?: string;
}

// Dimension types matching backend schema
export type DimensionName =
  | 'aiCollaboration'
  | 'contextEngineering'
  | 'toolMastery'
  | 'burnoutRisk'
  | 'aiControl'
  | 'skillResilience';

export interface DimensionStrength {
  title: string;
  description: string;
  evidence?: string[];
}

export interface DimensionGrowthArea {
  title: string;
  description: string;
  evidence?: string[];
  recommendation: string;
}

export interface PerDimensionInsight {
  dimension: DimensionName;
  dimensionDisplayName: string;
  strengths: DimensionStrength[];
  growthAreas: DimensionGrowthArea[];
}

// ============================================================================
// Personality Insights (4 Storytelling Techniques)
// ============================================================================

/**
 * Personality insights using 4 storytelling techniques:
 * 1. Specific Evidence - "You said '/plan' 8 times..."
 * 2. Confirmation Pattern - "You like to see the whole picture, don't you?"
 * 3. Strength-Shadow Connection - "That speed is great, but sometimes..."
 * 4. Daily Life Bridge - "Probably your motto outside coding too, right?"
 */
export interface PersonalityInsights {
  /** Core observation with evidence and confirmation question */
  coreObservation: string;
  /** How their personality connects to coding strengths */
  strengthConnection: string;
  /** Growth opportunity framed through strength-shadow */
  growthOpportunity: string;
  /** Daily life connection for deeper rapport (optional) */
  dailyLifeConnection?: string;
}

// ============================================================================
// Top Focus Areas (Personalized Priorities)
// ============================================================================

export interface FocusAreaActions {
  start: string;
  stop: string;
  continue: string;
}

export interface TopFocusArea {
  rank: number;
  dimension: DimensionName;
  title: string;
  narrative: string;
  expectedImpact: string;
  priorityScore: number;
  actions?: FocusAreaActions;
}

export interface TopFocusAreas {
  areas: TopFocusArea[];
  summary: string;
}

// ============================================================================
// Productivity Analysis (Module C Output)
// ============================================================================

export type IterationTrigger = 'error_fix' | 'feature_refinement' | 'clarification' | 'exploration' | 'optimization';
export type IterationResolution = 'resolved' | 'abandoned' | 'escalated' | 'deferred';
export type IterationEfficiency = 'efficient' | 'normal' | 'inefficient';
export type LearningCategory = 'new_api' | 'debugging_skill' | 'architecture' | 'tool_usage' | 'language_feature' | 'best_practice';
export type LearningDepth = 'shallow' | 'moderate' | 'deep';
export type LearningStyle = 'explorer' | 'deep_diver' | 'balanced' | 'reactive';
export type EfficiencyInterpretation = 'excellent' | 'good' | 'average' | 'needs_improvement';

export interface IterationSummary {
  totalCycles: number;
  avgTurnsPerCycle: number;
  efficientCycleRate: number;
  mostCommonTrigger: IterationTrigger;
  predominantResolution: IterationResolution;
}

export interface LearningVelocity {
  signalsPerSession: number;
  avgDepth: LearningDepth;
  learningStyle: LearningStyle;
  overallTransferability: number;
}

export interface KeyIndicators {
  firstTrySuccessRate: number;
  contextSwitchFrequency: number;
  productiveTurnRatio: number;
  avgTurnsToFirstSolution: number;
}

export interface CollaborationEfficiency {
  requestClarity: number;
  specificationCompleteness: number;
  proactiveVsReactiveRatio: number;
  contextProvisionFrequency: number;
}

export interface ProductivityAnalysis {
  iterationCyclesData?: string;
  learningSignalsData?: string;
  efficiencyMetricsData?: string;
  iterationSummary: IterationSummary;
  learningVelocity: LearningVelocity;
  keyIndicators: KeyIndicators;
  collaborationEfficiency: CollaborationEfficiency;
  overallProductivityScore: number;
  confidenceScore: number;
  summary?: string;
}

// ============================================================================
// Verbose Evaluation (from Lambda)
// ============================================================================

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
  dimensionInsights?: PerDimensionInsight[];

  // Context efficiency metrics
  contextEfficiencyScore?: number;
  contextEfficiencyExplanation?: string;

  // NEW: Personality Insights (4 storytelling techniques)
  personalityInsights?: PersonalityInsights;

  // NEW: Top 3 Focus Areas (most actionable section)
  topFocusAreas?: TopFocusAreas;

  // NEW: Productivity Analysis (Module C output)
  productivityAnalysis?: ProductivityAnalysis;
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
    hasPartialItem?: boolean;
  };
  credits?: number | null;
}
