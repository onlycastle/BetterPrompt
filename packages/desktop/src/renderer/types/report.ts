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

export type AIControlLevel = 'vibe-coder' | 'developing' | 'ai-master';

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
// 15-Type Matrix (5 Styles × 3 Control Levels)
// ============================================================================

/**
 * Matrix names for each Style × Control combination
 * Creates memorable personalities like "Systems Architect" or "Yolo Coder"
 */
export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    'vibe-coder': 'Dreamer',
    developing: 'Planner',
    'ai-master': 'Systems Architect',
  },
  scientist: {
    'vibe-coder': 'Curious',
    developing: 'Investigator',
    'ai-master': 'Research Master',
  },
  collaborator: {
    'vibe-coder': 'Follower',
    developing: 'Partner',
    'ai-master': 'Conductor',
  },
  speedrunner: {
    'vibe-coder': 'Yolo Coder',
    developing: 'Fast Learner',
    'ai-master': 'Efficient Master',
  },
  craftsman: {
    'vibe-coder': 'Perfectionist',
    developing: 'Quality Seeker',
    'ai-master': 'Code Artisan',
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
    'vibe-coder': {
      emoji: '💭',
      description: 'You plan well but tend to let AI take over implementation.',
      keyStrength: 'Clear vision and planning',
      growthPath: 'Try validating AI output against your plans more actively',
    },
    developing: {
      emoji: '📐',
      description: 'You balance planning with hands-on verification.',
      keyStrength: 'Structured approach with growing control',
      growthPath: 'Keep building verification habits',
    },
    'ai-master': {
      emoji: '🏛️',
      description: 'You orchestrate AI with precision, using plans as control mechanisms.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
    },
  },
  scientist: {
    'vibe-coder': {
      emoji: '🔎',
      description: 'You ask questions but may accept answers too readily.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more often',
    },
    developing: {
      emoji: '🧪',
      description: 'You verify AI output and are building critical thinking habits.',
      keyStrength: 'Growing verification skills',
      growthPath: 'Add systematic testing to your workflow',
    },
    'ai-master': {
      emoji: '🔬',
      description: 'You treat every AI output as a hypothesis to be tested.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
    },
  },
  collaborator: {
    'vibe-coder': {
      emoji: '👥',
      description: 'You converse with AI but let it lead the dialogue.',
      keyStrength: 'Open communication style',
      growthPath: 'Try directing conversations more actively',
    },
    developing: {
      emoji: '🤝',
      description: 'You engage in balanced dialogue with AI.',
      keyStrength: 'Effective back-and-forth refinement',
      growthPath: 'Focus on asking more probing questions',
    },
    'ai-master': {
      emoji: '🎭',
      description: 'You conduct AI like an orchestra, directing every iteration.',
      keyStrength: 'Masterful iterative refinement',
      growthPath: 'Document your collaboration patterns for others',
    },
  },
  speedrunner: {
    'vibe-coder': {
      emoji: '🎲',
      description: 'You move fast but may skip important verifications.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
    },
    developing: {
      emoji: '🏃',
      description: 'You balance speed with growing verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
    },
    'ai-master': {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic AI delegation.',
      keyStrength: 'Efficient mastery - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
    },
  },
  craftsman: {
    'vibe-coder': {
      emoji: '🎨',
      description: 'You care about quality but rely heavily on AI to achieve it.',
      keyStrength: 'High standards and attention to detail',
      growthPath: 'Practice writing quality code without AI assistance',
    },
    developing: {
      emoji: '🔧',
      description: 'You actively refine AI output to meet your quality standards.',
      keyStrength: 'Active quality improvement process',
      growthPath: 'Keep developing your manual coding skills',
    },
    'ai-master': {
      emoji: '💎',
      description: 'You use AI as a precision tool to achieve exceptional quality.',
      keyStrength: 'Masterful quality control with AI assistance',
      growthPath: 'Set quality benchmarks for your team',
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
  'vibe-coder': {
    name: 'Vibe Coder',
    description: 'High AI dependency - you tend to accept AI output without much modification',
    scoreRange: '0-34',
  },
  developing: {
    name: 'Developing',
    description: 'Learning balance - you are building control habits over AI',
    scoreRange: '35-64',
  },
  'ai-master': {
    name: 'AI Master',
    description: 'Strategic control - you direct AI effectively as a tool',
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
// Agent Outputs (4 Wow-Focused Agents - Premium Only)
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
 * Combined outputs from all Wow-Focused Agents
 * All fields are optional since agents may fail independently
 *
 * Tier access:
 * - FREE: patternDetective, metacognition (full data)
 * - PREMIUM: all agents (antiPatternSpotter, knowledgeGap, contextEfficiency, temporalAnalysis, multitasking)
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
