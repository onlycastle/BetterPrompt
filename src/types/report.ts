/**
 * Report Types
 *
 * Types for the report page that mirror backend models.
 * These types align with the API response from /api/reports/:reportId
 */

// Import shared types from canonical source
import type {
  CodingStyleType,
  AIControlLevel as BaseAIControlLevel,
  TypeDistribution,
  MatrixKey,
  MatrixDistribution,
} from '../lib/models/coding-style';

// Re-export for convenience
export type { CodingStyleType, TypeDistribution, MatrixKey, MatrixDistribution };

export interface TypeMetrics {
  avgPromptLength: number;
  avgFirstPromptLength: number;
  avgTurnsPerSession: number;
  questionFrequency: number;
  modificationRate: number;
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

/**
 * Session metadata in API response format (nullable fields, durationMinutes).
 * Different from domain SessionMetadata which uses Date types and durationSeconds.
 */
export interface ReportSessionMetadata {
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
  sessionMetadata: ReportSessionMetadata;
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
