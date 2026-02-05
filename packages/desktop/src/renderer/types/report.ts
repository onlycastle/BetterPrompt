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
  | 'analyst'
  | 'conductor'
  | 'speedrunner'
  | 'trendsetter';

export type AIControlLevel = 'explorer' | 'navigator' | 'cartographer';

export interface TypeDistribution {
  architect: number;
  analyst: number;
  conductor: number;
  speedrunner: number;
  trendsetter: number;
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
  analyst: {
    emoji: '🔬',
    name: 'Analyst',
    tagline: 'Deep investigator who verifies and questions everything',
    description:
      'You combine systematic verification with critical thinking. Your thorough approach catches bugs early, questions assumptions, and ensures high code quality through investigation.',
    strengths: [
      'Catches bugs early through systematic verification',
      'Questions assumptions and explores alternatives',
      'Low repeated mistakes through deep understanding',
    ],
    growthPoints: [
      'Thoroughness can slow velocity on simpler tasks',
      'Balancing depth with pragmatism',
    ],
  },
  conductor: {
    emoji: '🎼',
    name: 'Conductor',
    tagline: 'Orchestration master who commands AI tools like an ensemble',
    description:
      'You excel at orchestrating AI tools and workflows. Your mastery of slash commands, subagents, role assignments, and multi-tool workflows maximizes AI synergy and productivity.',
    strengths: [
      'High tool diversity and mastery',
      'Effective multi-agent orchestration',
      'Creative workflow composition',
    ],
    growthPoints: [
      'Complex orchestration can add overhead for simple tasks',
      'Direct approaches may be faster for focused work',
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
  trendsetter: {
    emoji: '🚀',
    name: 'Trendsetter',
    tagline: 'Innovation seeker who explores cutting-edge approaches',
    description:
      'You actively seek the latest tools, frameworks, and best practices. Your curiosity drives you to explore emerging technologies and modern approaches, keeping your stack ahead of the curve.',
    strengths: [
      'Early adoption of effective new tools',
      'Awareness of industry best practices',
      'Continuous learning mindset',
    ],
    growthPoints: [
      'Novelty bias may lead to premature adoption',
      'Proven solutions sometimes outperform trendy ones',
    ],
  },
};

// ============================================================================
// 15-Type Matrix (5 Styles × 3 Control Levels)
// ============================================================================

/**
 * Matrix names for each Style × Control combination
 * Creates memorable personalities like "Systems Architect" or "Yolo Coder"
 */
export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    explorer: 'Visionary',
    navigator: 'Strategist',
    cartographer: 'Systems Architect',
  },
  analyst: {
    explorer: 'Questioner',
    navigator: 'Research Lead',
    cartographer: 'Quality Sentinel',
  },
  conductor: {
    explorer: 'Improviser',
    navigator: 'Arranger',
    cartographer: 'Maestro',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  trendsetter: {
    explorer: 'Early Adopter',
    navigator: 'Tech Radar',
    cartographer: 'Innovation Lead',
  },
};

/**
 * Detailed metadata for each Matrix combination
 */
export const MATRIX_METADATA: Record<
  CodingStyleType,
  Record<
    AIControlLevel,
    {
      emoji: string;
      description: string;
      keyStrength: string;
      growthPath: string;
    }
  >
> = {
  architect: {
    explorer: {
      emoji: '💭',
      description: 'You explore solutions through open-ended planning and vision.',
      keyStrength: 'Clear vision and creative planning',
      growthPath: 'Try validating AI output against your plans more actively',
    },
    navigator: {
      emoji: '📐',
      description: 'You balance strategic planning with hands-on verification.',
      keyStrength: 'Structured approach with balanced control',
      growthPath: 'Keep building verification habits',
    },
    cartographer: {
      emoji: '🏛️',
      description: 'You map out the territory completely before advancing.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
    },
  },
  analyst: {
    explorer: {
      emoji: '🔎',
      description: 'You explore through curious questioning and open inquiry.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more systematically',
    },
    navigator: {
      emoji: '🧪',
      description: 'You navigate through hypothesis-driven investigation and verification.',
      keyStrength: 'Balanced depth with practical verification',
      growthPath: 'Add systematic testing to your workflow',
    },
    cartographer: {
      emoji: '🔬',
      description: 'You leave no stone unturned — rigorous verification meets deep analysis.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
    },
  },
  conductor: {
    explorer: {
      emoji: '🎵',
      description: 'You experiment with AI tools freely, discovering creative workflows.',
      keyStrength: 'Creative tool exploration and improvisation',
      growthPath: 'Build repeatable workflows from your discoveries',
    },
    navigator: {
      emoji: '🎼',
      description: 'You arrange AI tools into effective, coordinated workflows.',
      keyStrength: 'Effective multi-tool coordination',
      growthPath: 'Document your workflow patterns for team sharing',
    },
    cartographer: {
      emoji: '🎹',
      description: 'You orchestrate AI tools with masterful precision and control.',
      keyStrength: 'Masterful AI tool orchestration',
      growthPath: 'Mentor others in advanced AI workflow techniques',
    },
  },
  speedrunner: {
    explorer: {
      emoji: '🎲',
      description: 'You explore through rapid experimentation and iteration.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
    },
    navigator: {
      emoji: '🏃',
      description: 'You navigate quickly while building verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
    },
    cartographer: {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic optimization.',
      keyStrength: 'Efficient expertise - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
    },
  },
  trendsetter: {
    explorer: {
      emoji: '🌱',
      description: 'You eagerly try new tools and approaches, staying curious about what is emerging.',
      keyStrength: 'Early adoption and experimentation with new tech',
      growthPath: 'Evaluate new tools more critically before adopting',
    },
    navigator: {
      emoji: '📡',
      description: 'You track industry trends and selectively adopt what adds value.',
      keyStrength: 'Informed technology radar with selective adoption',
      growthPath: 'Share your technology insights with your team',
    },
    cartographer: {
      emoji: '🚀',
      description: 'You strategically lead innovation, charting paths through emerging technology.',
      keyStrength: 'Strategic innovation leadership',
      growthPath: 'Balance cutting-edge adoption with team readiness',
    },
  },
};

/**
 * Control level metadata for display
 */
export const CONTROL_LEVEL_METADATA: Record<
  AIControlLevel,
  {
    name: string;
    description: string;
    scoreRange: string;
  }
> = {
  explorer: {
    name: 'Explorer',
    description: 'Open exploration - you discover solutions through experimentation',
    scoreRange: '0-34',
  },
  navigator: {
    name: 'Navigator',
    description: 'Balanced navigation - you balance exploration with route planning',
    scoreRange: '35-64',
  },
  cartographer: {
    name: 'Cartographer',
    description: 'Strategic mapping - you chart the territory before advancing',
    scoreRange: '65-100',
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
// Agent Outputs (Phase 2 Workers - Premium Only)
// ============================================================================

/**
 * Pattern Detective: Conversation Style Discovery
 * Detects repeated questions, conversation patterns, request styles
 */
export interface PatternDetectiveOutput {
  /** Repeated questions - "topic:count:example;..." */
  repeatedQuestionsData: string;
  /** Conversation style patterns - "pattern:frequency:example;..." */
  conversationStyleData: string;
  /** Request start patterns - "phrase:count;..." */
  requestStartPatternsData: string;
  /** Top 3 Wow Insights (displayed directly in UI) */
  topInsights: string[];
  /** Overall style summary */
  overallStyleSummary: string;
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Anti-Pattern Spotter: Bad Habit Detection
 * Detects error loops, learning avoidance, repeated mistakes
 */
export interface AntiPatternSpotterOutput {
  /** Error loops - "error_type:repeat_count:avg_turns:example;..." */
  errorLoopsData: string;
  /** Learning avoidance patterns - "pattern:evidence:severity;..." */
  learningAvoidanceData: string;
  /** Repeated mistakes - "mistake:count:sessions;..." */
  repeatedMistakesData: string;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Overall health score (0-100) */
  overallHealthScore: number;
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Knowledge Gap Analyzer: Knowledge Gaps + Learning Suggestions
 * Detects knowledge gaps, learning progress, recommends resources
 */
export interface KnowledgeGapOutput {
  /** Knowledge gaps - "topic:question_count:depth:example;..." */
  knowledgeGapsData: string;
  /** Learning progress - "topic:start_level:current_level:evidence;..." */
  learningProgressData: string;
  /** Recommended resources - "topic:resource_type:url_or_name;..." */
  recommendedResourcesData: string;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Overall knowledge score (0-100) */
  overallKnowledgeScore: number;
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Context Efficiency Analyzer: Token Inefficiency Patterns
 * Detects context usage, inefficiency patterns, prompt length trends
 */
export interface ContextEfficiencyOutput {
  /** Context usage pattern - "session_id:avg_fill_percent:compact_trigger_percent;..." */
  contextUsagePatternData: string;
  /** Inefficiency patterns - "pattern:frequency:impact:example;..." */
  inefficiencyPatternsData: string;
  /** Prompt length trend - "session_part:avg_length;..." */
  promptLengthTrendData: string;
  /** Redundant info patterns - "info_type:repeat_count;..." */
  redundantInfoData: string;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Overall efficiency score (0-100) */
  overallEfficiencyScore: number;
  /** Average context fill percent (0-100) */
  avgContextFillPercent: number;
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Metacognition: Self-Awareness Pattern Detection
 * Detects self-reflection, blind spots, growth mindset
 */
export interface MetacognitionOutput {
  /** Awareness instances - "type|quote|context|implication;..." */
  awarenessInstancesData: string;
  /** Blind spots - "pattern|frequency|sessionIds|linkedAntiPattern;..." */
  blindSpotsData: string;
  /** Growth mindset - "curiosity:score|experimentation:score|resilience:score" */
  growthMindsetData: string;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Overall metacognitive awareness score (0-100) */
  metacognitiveAwarenessScore: number;
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Temporal Analysis: Time-Based Quality Patterns
 * Detects peak hours, fatigue signals, quality trends by time
 */
export interface TemporalAnalysisOutput {
  /** Hourly patterns - "hour:sampleCount:counterQ:critical:verification:typo:passive;..." */
  hourlyPatternsData: string;
  /** Peak hours - "hours|characteristics|evidence" */
  peakHoursData: string;
  /** Caution hours - "hours|characteristics|evidence" */
  cautionHoursData: string;
  /** Fatigue patterns - "type|hours|evidence|recommendation;..." */
  fatiguePatternsData: string;
  /** Qualitative insights - "type|insight|evidence|linkedHours;..." */
  qualitativeInsightsData: string;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Multitasking Analysis: Multi-Session Work Pattern Detection
 * Detects session focus, context pollution, work unit separation
 */
export interface MultitaskingAnalysisOutput {
  /** Session focus - "sessionId|workType|goalCoherence|pollutionScore|workDescription;..." */
  sessionFocusData: string;
  /** Context pollution - "sessionId|fromTask|toTask|signal|messageIndex;..." */
  contextPollutionData: string;
  /** Work unit separation - "projectPath|sessionId|workType|filesWorkedOn;..." */
  workUnitSeparationData: string;
  /** Strategy evaluation - "strategyType|evidence|recommendation;..." */
  strategyEvaluationData: string;
  /** Average goal coherence (0-100) */
  avgGoalCoherence: number;
  /** Average context pollution score (0-100) */
  avgContextPollutionScore: number;
  /** Work unit separation score (0-100) */
  workUnitSeparationScore: number;
  /** File overlap rate (0-100) */
  fileOverlapRate: number;
  /** Overall multitasking efficiency score (0-100) */
  multitaskingEfficiencyScore: number;
  /** Total sessions analyzed */
  totalSessionsAnalyzed: number;
  /** Number of project groups */
  projectGroupCount: number;
  /** Top 3 Wow Insights */
  topInsights: string[];
  /** Confidence score (0-1) */
  confidenceScore: number;
}

/**
 * Type Synthesis: Agent-Informed Classification Refinement
 * Refines initial pattern-based type into 15-combination matrix (5 styles × 3 control levels)
 */
export interface TypeSynthesisOutput {
  /** Refined primary type after agent synthesis */
  refinedPrimaryType: CodingStyleType;
  /** Refined distribution - "type:percent;..." format (sum to 100) */
  refinedDistribution: string;
  /** Refined control level based on agent insights */
  refinedControlLevel: AIControlLevel;
  /** Combined matrix name (e.g., "Systems Architect", "Yolo Coder") */
  matrixName: string;
  /** Combined matrix emoji */
  matrixEmoji: string;
  /** Reasons for adjustments from initial classification */
  adjustmentReasons: string[];
  /** Final confidence score (0-1) */
  confidenceScore: number;
  /** How much confidence increased from agent synthesis (0-1) */
  confidenceBoost: number;
  /** Evidence from agent outputs - "agent:key_signal:detail;..." */
  synthesisEvidence: string;
}

/**
 * Combined outputs from all Phase 2 workers
 * All fields are optional since workers may fail independently
 *
 * Legacy agent fields (patternDetective, metacognition, etc.) are kept
 * for backward compatibility with cached data.
 */
export interface AgentOutputs {
  // FREE tier agents
  patternDetective?: PatternDetectiveOutput;
  metacognition?: MetacognitionOutput;

  // PREMIUM tier agents (show teaser for free users)
  antiPatternSpotter?: AntiPatternSpotterOutput;
  knowledgeGap?: KnowledgeGapOutput;
  contextEfficiency?: ContextEfficiencyOutput;
  temporalAnalysis?: TemporalAnalysisOutput;
  multitasking?: MultitaskingAnalysisOutput;

  // Type Synthesis (15-type matrix classification)
  typeSynthesis?: TypeSynthesisOutput;
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

  // NEW: Top 3 Focus Areas (most actionable section)
  topFocusAreas?: TopFocusAreas;

  // NEW: Productivity Analysis (Module C output)
  productivityAnalysis?: ProductivityAnalysis;

  // NEW: Agent Outputs (4 Wow Agents - Premium only)
  agentOutputs?: AgentOutputs;
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
