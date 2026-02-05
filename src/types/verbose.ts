/**
 * Verbose Analysis Types
 *
 * Types for hyper-personalized verbose analysis reports.
 * Mirrors backend VerboseEvaluation schema from src/models/verbose-evaluation.ts
 */

import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixKey, MatrixDistribution } from '../lib/models/coding-style';
import type { AggregatedWorkerInsights } from '../lib/models/worker-insights';
import type { DimensionResourceMatch, UtteranceLookupEntry, TopFocusAreas, TopFocusArea, FocusAreaActions, ProjectSummary } from '../lib/models/verbose-evaluation';

// Re-export for convenience
export type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixKey, MatrixDistribution, AggregatedWorkerInsights, DimensionResourceMatch, UtteranceLookupEntry, TopFocusAreas, TopFocusArea, FocusAreaActions, ProjectSummary };

// ============================================================================
// Activity Session Info - Lightweight metadata for ALL recent sessions
// ============================================================================

export interface ActivitySessionInfo {
  sessionId: string;
  projectName: string;
  startTime: string;       // ISO 8601
  durationMinutes: number;
  messageCount: number;
  summary: string;         // first user message, truncated to 80 chars
  totalInputTokens?: number;   // Sum of input_tokens from assistant messages
  totalOutputTokens?: number;  // Sum of output_tokens from assistant messages
}

// ============================================================================
// Analyzed Session Info - Metadata about sessions included in analysis
// ============================================================================

export interface AnalyzedSessionInfo {
  /** JSONL file name (e.g., "abc123.jsonl") */
  fileName: string;
  /** Session UUID */
  sessionId: string;
  /** Last segment of project path */
  projectName: string;
  /** Session start timestamp (ISO) */
  startTime: string;
  /** Number of messages in session */
  messageCount: number;
  /** Session duration in minutes */
  durationMinutes: number;
}

// ============================================================================
// Dimension Insights
// Evidence supports both legacy string format and structured EvidenceItem format.
// - string: Plain quote (legacy or when Phase1Output not available)
// - EvidenceItem: Verified quote with utteranceId for source tracking
// ============================================================================

/**
 * Structured evidence item with source tracking
 * Created by the evidence verification layer when Phase1Output is available.
 */
export interface EvidenceItem {
  /** Reference to Phase1Output utterance ID ("{sessionId}_{turnIndex}") */
  utteranceId: string;
  /** The verified quote from the developer */
  quote: string;
  /** Session ID for source tracking */
  sessionId?: string;
}

/** Evidence can be a plain string quote or a structured EvidenceItem */
export type Evidence = string | EvidenceItem;

export interface DimensionStrength {
  title: string;
  description: string;
  /** Quotes demonstrating this strength (string[] or EvidenceItem[]) */
  evidence?: Evidence[];
}

export interface DimensionGrowthArea {
  title: string;
  description: string;
  /** Quotes showing this growth opportunity (string[] or EvidenceItem[]) */
  evidence?: Evidence[];
  recommendation: string;
  /** Frequency of this growth area observed (0-100) */
  frequency?: number;
  /** Severity level of this growth area */
  severity?: 'critical' | 'high' | 'medium' | 'low';
  /** Computed priority score (0-100) */
  priorityScore?: number;
  /** Trend direction of this growth area */
  trend?: 'improving' | 'stable' | 'declining';
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
  // Analyzed session files (metadata for display)
  analyzedSessions?: AnalyzedSessionInfo[];
  // Activity sessions (deterministic CLI-side scan of ALL recent sessions)
  activitySessions?: ActivitySessionInfo[];
  // Session summaries (legacy Phase 1.5 - LLM-generated 1-line summaries, kept for cached data)
  sessionSummaries?: { sessionId: string; summary: string }[];
  // Project summaries (LLM-generated 2-3 line summaries per project, from ProjectSummarizer)
  projectSummaries?: ProjectSummary[];
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
  /** Raw control score (0-100) for matrix distribution calculation */
  controlScore?: number;
  distribution: TypeDistribution;
  personalitySummary: string;
  dimensionInsights: PerDimensionInsight[];
  promptPatterns: PromptPattern[];
  // Agent outputs (from Wow Agents - Premium)
  agentOutputs?: import('../lib/models/agent-outputs').AgentOutputs;
  // Aggregated worker insights from Phase 2 workers (from DB cache or aggregated at runtime)
  workerInsights?: AggregatedWorkerInsights;
  // Translated agent insights (for non-English output)
  // Contains translated strengths/growthAreas from Content Writer
  translatedAgentInsights?: import('../lib/models/verbose-evaluation').TranslatedAgentInsights;
  // Analysis metadata with confidence scores (for transparency)
  analysisMetadata?: AnalysisMetadata;
  // Matched Knowledge Resources from Phase 2.75 (deterministic matching)
  // Contains validated resources from Knowledge Base, NOT LLM-generated URLs
  knowledgeResources?: DimensionResourceMatch[];
  // Utterance Lookup for evidence linking (only includes referenced utterances)
  // Enables frontend to display full original text when user expands an evidence item
  utteranceLookup?: UtteranceLookupEntry[];
  // Top Focus Areas (Phase 3 Content Writer - partial free, full paid)
  topFocusAreas?: TopFocusAreas;
  // Premium fields (optional)
  toolUsageDeepDive?: unknown[];
  tokenEfficiency?: unknown;
  growthRoadmap?: unknown;
  comparativeInsights?: unknown[];
  sessionTrends?: unknown[];
}

/**
 * Analysis metadata for transparency and trust
 * Shows users what data was analyzed and how confident the system is
 */
export interface AnalysisMetadata {
  /** Overall confidence score (0-1, weighted average of agent scores) */
  overallConfidence: number;
  /** Confidence scores by individual agent */
  agentConfidences?: {
    agentId: string;
    agentName: string;
    confidenceScore: number;
  }[];
  /** Total messages analyzed across all sessions */
  totalMessagesAnalyzed: number;
  /** Date range of analyzed sessions */
  analysisDateRange?: {
    earliest: string;
    latest: string;
  };
  /** Data quality indicator: high (10+), medium (5-9), low (<5 sessions) */
  dataQuality: 'high' | 'medium' | 'low';
  /** Minimum confidence threshold applied */
  confidenceThreshold?: number;
  /** Number of insights filtered due to low confidence */
  insightsFiltered?: number;
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
  analyst: {
    emoji: '🔬',
    name: 'The Analyst',
    tagline: 'Deep investigator who verifies and questions everything',
    description:
      'You combine systematic verification with critical thinking. Your thorough approach catches bugs early, questions assumptions, and ensures high code quality through investigation.',
    strengths: ['Systematic verification', 'Critical thinking', 'Quality assurance'],
  },
  conductor: {
    emoji: '🎼',
    name: 'The Conductor',
    tagline: 'Orchestration master who commands AI tools like an ensemble',
    description:
      'You excel at orchestrating AI tools and workflows. Your mastery of slash commands, subagents, role assignments, and multi-tool workflows maximizes AI synergy and productivity.',
    strengths: ['Tool orchestration', 'Multi-agent mastery', 'Workflow composition'],
  },
  speedrunner: {
    emoji: '⚡',
    name: 'The Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
    strengths: ['Rapid prototyping', 'High output', 'Experimentation'],
  },
  trendsetter: {
    emoji: '🚀',
    name: 'The Trendsetter',
    tagline: 'Innovation seeker who explores cutting-edge approaches',
    description:
      'You actively seek the latest tools, frameworks, and best practices. Your curiosity drives you to explore emerging technologies and modern approaches, keeping your stack ahead of the curve.',
    strengths: ['Early adoption', 'Best practice awareness', 'Continuous learning'],
  },
};
