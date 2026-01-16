/**
 * Report Types
 *
 * Types for the report page that mirror backend models.
 * These types align with the API response from /api/reports/:reportId
 */

// Import shared types from enterprise (single source of truth)
import type { CodingStyleType, AIControlLevel as BaseAIControlLevel } from './enterprise';

// Re-export for convenience
export type { CodingStyleType };

// ============================================================================
// Type Distribution and Metrics
// ============================================================================

export interface TypeDistribution {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

export interface TypeMetrics {
  avgPromptLength: number;
  avgFirstPromptLength: number;
  avgTurnsPerSession: number;
  questionFrequency: number;
  modificationRate: number;
  toolUsageHighlight: string;
}

export interface ConversationEvidence {
  type: CodingStyleType;
  quote: string;
  timestamp: string;
  explanation: string;
}

export interface TypeResult {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  sessionCount: number;
  analyzedAt: string;
  metrics: TypeMetrics;
  evidence: ConversationEvidence[];
}

// ============================================================================
// Type Metadata for Display
// ============================================================================

export interface TypeMetadata {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  strengths: string[];
  growthPoints: string[];
}

// Extended type metadata with detailed information for report display
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
// Analysis Dimension Types
// ============================================================================

export type DimensionLevel = 'novice' | 'developing' | 'proficient' | 'expert';

export interface DimensionEvidence {
  quote: string;
  explanation: string;
}

// AI Collaboration Dimension
export interface AICollaborationResult {
  score: number;
  level: DimensionLevel;
  breakdown: {
    structuredPlanning: {
      score: number;
      todoWriteUsage: number;
      stepByStepPlans: number;
      specFileReferences: number;
    };
    aiOrchestration: {
      score: number;
      taskToolUsage: number;
      multiAgentSessions: number;
      parallelWorkflows: number;
    };
    criticalVerification: {
      score: number;
      codeReviewRequests: number;
      testRequests: number;
      outputModifications: number;
    };
  };
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

// Context Engineering Dimension
export interface ContextEngineeringResult {
  score: number;
  level: DimensionLevel;
  breakdown: {
    write: {
      score: number;
      fileReferences: number;
      codeElementReferences: number;
      constraintsMentioned: number;
      patternReferences: number;
    };
    select: {
      score: number;
      specificity: number;
      codebaseNavigation: number;
      existingPatternUsage: number;
    };
    compress: {
      score: number;
      compactUsageCount: number;
      iterationEfficiency: number;
      avgTurnsPerSession: number;
    };
    isolate: {
      score: number;
      taskToolUsage: number;
      agentDelegation: number;
      workPartitioning: number;
    };
  };
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

// Burnout Risk Dimension
export interface BurnoutRiskResult {
  score: number;
  level: 'healthy' | 'moderate' | 'concerning' | 'critical';
  breakdown: {
    sessionIntensity: {
      score: number;
      avgSessionDuration: number;
      longSessionCount: number;
      avgDailySessionCount: number;
    };
    workLifeBalance: {
      score: number;
      offHoursWorkRate: number;
      weekendWorkRate: number;
      restPeriodQuality: number;
    };
    stressSignals: {
      score: number;
      urgentLanguageCount: number;
      frustrationSignals: number;
      rushPatterns: number;
    };
  };
  warnings: string[];
  recommendations: string[];
  interpretation: string;
}

// Tool Mastery Dimension
export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ToolMasteryResult {
  score: number;
  level: MasteryLevel;
  breakdown: {
    basicTools: {
      score: number;
      readWriteEdit: number;
      grepGlob: number;
    };
    advancedTools: {
      score: number;
      taskTool: number;
      regexUsage: number;
      composedWorkflows: number;
    };
    expertTools: {
      score: number;
      backgroundExecution: number;
      parallelTasks: number;
      customScripts: number;
    };
  };
  toolUsagePatterns: Record<string, number>;
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

// AI Control Dimension (re-export from enterprise)
export type AIControlLevel = BaseAIControlLevel;

export interface AIControlResult {
  score: number;
  level: AIControlLevel;
  breakdown: {
    verificationRate: number;
    constraintSpecification: number;
    outputCritique: number;
    contextControl: number;
  };
  signals: string[];
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

// Skill Resilience Dimension
export type SkillResilienceLevel = 'dependent' | 'balanced' | 'independent';

export interface SkillResilienceResult {
  score: number;
  level: SkillResilienceLevel;
  breakdown: {
    manualCoding: {
      score: number;
      editVsWrite: number;
      directManipulation: number;
    };
    problemSolving: {
      score: number;
      debuggingApproach: number;
      solutionOriginality: number;
    };
    skillPreservation: {
      score: number;
      codeReading: number;
      understandingDepth: number;
    };
  };
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}

// Full analysis combining all dimensions
export interface FullAnalysisResult {
  aiCollaboration: AICollaborationResult;
  contextEngineering: ContextEngineeringResult;
  burnoutRisk: BurnoutRiskResult;
  toolMastery: ToolMasteryResult;
  aiControl: AIControlResult;
  skillResilience: SkillResilienceResult;
}

// ============================================================================
// Dimension Metadata for Display (Extended)
// ============================================================================

export interface ReportDimensionMetadata {
  label: string;
  icon: string;
  description: string;
  shortDescription: string;
}

// Extended dimension metadata for report display with detailed descriptions
export const REPORT_DIMENSION_METADATA: Record<keyof FullAnalysisResult, ReportDimensionMetadata> = {
  aiCollaboration: {
    label: 'AI Collaboration',
    icon: '🤝',
    description: 'How effectively you collaborate with AI assistants',
    shortDescription: 'Planning, orchestration, verification',
  },
  contextEngineering: {
    label: 'Context Engineering',
    icon: '🎯',
    description: 'How well you manage AI context and information',
    shortDescription: 'Write, select, compress, isolate',
  },
  burnoutRisk: {
    label: 'Burnout Risk',
    icon: '🔥',
    description: 'Work pattern health and work-life balance indicators',
    shortDescription: 'Session intensity, balance, stress signals',
  },
  toolMastery: {
    label: 'Tool Mastery',
    icon: '🛠️',
    description: 'How effectively you use available development tools',
    shortDescription: 'Basic, advanced, expert tool usage',
  },
  aiControl: {
    label: 'AI Control',
    icon: '🎮',
    description: 'How well you control AI output vs. passively accepting it',
    shortDescription: 'Verification, constraints, critique',
  },
  skillResilience: {
    label: 'Skill Resilience',
    icon: '💪',
    description: 'Your ability to code independently without AI assistance',
    shortDescription: 'Manual coding, problem solving, skill preservation',
  },
};

// ============================================================================
// Report Data (API Response)
// ============================================================================

export interface SessionMetadata {
  sessionId: string | null;
  durationMinutes: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

export interface ReportStats {
  viewCount: number;
  shareCount: number;
}

export interface ReportData {
  reportId: string;
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
  sessionMetadata: SessionMetadata;
  stats: ReportStats;
  createdAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ShareReportRequest {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
  sessionId?: string;
  sessionDuration?: number;
  messageCount?: number;
  toolCallCount?: number;
  expiresInDays?: number;
}

export interface ShareReportResponse {
  reportId: string;
  shareUrl: string;
  accessToken: string;
  expiresAt: string;
  ogImageUrl: string;
}

export interface DeleteReportRequest {
  accessToken: string;
}
