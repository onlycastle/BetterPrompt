/**
 * Enterprise Dashboard Types
 * Types for B2B team analytics and member analysis tracking
 */

// Import shared types from canonical source
import type { CodingStyleType, AIControlLevel } from '../lib/models/coding-style';
import type { InefficiencyPattern } from '../lib/models/agent-outputs';

// Re-export for consumers
export type { CodingStyleType, AIControlLevel, InefficiencyPattern };

// Dimension scores (0-100 scale)
export interface DimensionScores {
  aiCollaboration: number;
  contextEngineering: number;
  burnoutRisk: number;      // Lower is better
  aiControl: number;
  skillResilience: number;
}

// Individual team member analysis result
export interface TeamMemberAnalysis {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  department: string;

  // Latest analysis results
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
  overallScore: number;
  dimensions: DimensionScores;

  // Historical tracking
  history: HistoryEntry[];

  // Manager-actionable data
  tokenUsage: MemberTokenUsage;
  antiPatterns: MemberAntiPattern[];
  projects: MemberProjectActivity[];
  strengthSummaries: MemberStrengthSummary[];
  growth: MemberGrowthSnapshot;
  growthAreas: MemberGrowthArea[];
  kpt: MemberKPT;

  // Metadata
  lastAnalyzedAt: string;
  analysisCount: number;
}

// Historical data point
export interface HistoryEntry {
  date: string;           // ISO date string
  overallScore: number;
  dimensions?: DimensionScores;
}

// Per-member weekly token usage trend point
export interface WeeklyTokenTrend {
  weekStart: string;
  totalTokens: number;
  sessions: number;
}

// Per-member token usage metrics
export interface MemberTokenUsage {
  totalSessions: number;
  totalMessages: number;
  avgContextFillPercent: number;
  maxContextFillPercent: number;
  contextFillExceeded90Count: number;
  weeklyTokenTrend: WeeklyTokenTrend[];
}

// Per-member anti-pattern occurrence
export interface MemberAntiPattern {
  pattern: InefficiencyPattern;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
}

// Per-member project activity
export interface MemberProjectActivity {
  projectName: string;
  sessionCount: number;
  lastActiveDate: string;
  summaryLines: string[];
}

// Per-member strength summary (aggregated from workers)
export interface MemberStrengthSummary {
  domain: string;
  domainLabel: string;
  topStrength: string;
  domainScore: number;
}

// Per-member growth snapshot
export interface MemberGrowthSnapshot {
  currentScore: number;
  previousWeekScore: number;
  previousMonthScore: number;
  weekOverWeekDelta: number;
  monthOverMonthDelta: number;
  trend: 'improving' | 'stable' | 'declining';
}

// Anti-pattern human-readable labels
export const ANTI_PATTERN_LABELS: Record<InefficiencyPattern, string> = {
  late_compact: 'Late Context Compaction',
  context_bloat: 'Context Bloat',
  redundant_info: 'Redundant Information',
  prompt_length_inflation: 'Prompt Length Inflation',
  no_session_separation: 'No Session Separation',
  verbose_error_pasting: 'Verbose Error Pasting',
  no_knowledge_persistence: 'No Knowledge Persistence',
};

// Anti-pattern aggregate for team-level view
export interface AntiPatternAggregate {
  pattern: InefficiencyPattern;
  label: string;
  memberCount: number;
  totalOccurrences: number;
  predominantImpact: 'high' | 'medium' | 'low';
}

// Skill gap identification
export interface SkillGap {
  dimension: keyof DimensionScores;
  label: string;
  avgScore: number;
  membersBelowThreshold: number;
  threshold: number;
}

// Team-level aggregate analytics
export interface TeamAnalytics {
  teamId: string;
  teamName: string;
  memberCount: number;

  // Aggregate scores
  averageOverallScore: number;
  averageDimensions: DimensionScores;

  // Distribution analysis
  typeDistribution: Record<CodingStyleType, number>;
  controlLevelDistribution: Record<AIControlLevel, number>;

  // Skill gaps (dimensions below threshold)
  skillGaps: SkillGap[];

  // Trend data
  weeklyTrend: HistoryEntry[];
  weekOverWeekChange: number;
  monthOverMonthChange: number;

  // Manager-actionable aggregates
  totalTokensThisWeek: number;
  antiPatternAggregates: AntiPatternAggregate[];
  activeProjects: string[];
  growthDistribution: { improving: number; stable: number; declining: number };
}

// Organization-level analytics
export interface OrganizationAnalytics {
  organizationId: string;
  organizationName: string;
  teams: TeamAnalytics[];
  totalMembers: number;
  overallAverageScore: number;
}

// Type metadata for display
export const TYPE_METADATA: Record<CodingStyleType, { emoji: string; label: string; color: string }> = {
  architect: { emoji: '🏗️', label: 'Architect', color: '#3B82F6' },      // Blue
  analyst: { emoji: '🔬', label: 'Analyst', color: '#8B5CF6' },          // Purple
  conductor: { emoji: '🎼', label: 'Conductor', color: '#F59E0B' },      // Amber
  speedrunner: { emoji: '⚡', label: 'Speedrunner', color: '#EF4444' },   // Red
  trendsetter: { emoji: '🚀', label: 'Trendsetter', color: '#06B6D4' },  // Cyan
};

/**
 * Evidence moment captured from a specific session exchange.
 * Subset of the full EvidenceMoment for team-level aggregation.
 */
export interface MemberEvidenceMoment {
  sessionId: string;
  quote: string;
  behaviorDescription: string;
  /**
   * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
   * Optional for backward compatibility; populated by new analysis runs.
   * Enables chronological ordering and temporal verification of distinctness.
   */
  timestamp?: string;
}

/**
 * KB tip attachment on a growth area — one best-match tip per growth area,
 * or absent if no match exceeds the relevance threshold.
 * Populated by the deterministic KB matcher during report assembly.
 */
export interface MemberKbTipAttachment {
  tipId: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceAuthor: string;
  sourcePlatform?: string;
  credibilityTier?: 'high' | 'medium' | 'standard';
  relevanceScore: number;
}

// Per-member growth area (from worker insights)
export interface MemberGrowthArea {
  title: string;
  domain: string;       // 'thinkingQuality' | 'communicationPatterns' | ...
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  /**
   * v2 evidence moments — distinct session exchanges demonstrating
   * the growth pattern. Present when analysis uses Pattern→Evidence→Action format.
   */
  evidenceMoments?: MemberEvidenceMoment[];
  /** Low-confidence flag for sparse evidence scenarios */
  lowConfidence?: boolean;
  /**
   * Why this growth area matters for the builder's specific goals.
   * Connects the pattern to the builder's actual project context,
   * technology stack, or stated objectives — not abstract best practices.
   *
   * Populated from WorkerGrowth.actionGoalRelevance when available.
   * Used in team views to show goal-contextualized growth areas.
   */
  goalRelevance?: string;
  /**
   * Specific tools, files, APIs, or technologies the builder actually interacted
   * with that are relevant to this growth area pattern.
   *
   * Examples: ["Express.js", "middleware/auth.ts", "vitest"]
   *
   * Populated when growth area originates from the PEA pipeline.
   * Renders as tag pills in growth area cards (tool_file_naming rubric).
   */
  toolsFilesApis?: string[];
  /**
   * Best-match KB tip attached by the deterministic KB matcher.
   * One tip per growth area, or absent if below relevance threshold.
   * Source credibility tier included for scoring transparency.
   */
  kbTip?: MemberKbTipAttachment;

  /**
   * Best-match knowledge tip — canonical display field name for UI components.
   *
   * Same content as `kbTip` but uses the canonical user-facing name.
   * Populated by `peaToMemberGrowthArea()` when the source PEA has a kbTip.
   * Use `knowledgeTip` in new code; `kbTip` is the legacy field.
   */
  knowledgeTip?: MemberKbTipAttachment;
}

// Per-member KPT (Keep / Problem / Try)
export interface MemberKPT {
  keep: string[];
  problem: string[];
  tryNext: string[];
}

// Team-level growth area aggregate
export interface TeamGrowthAreaAggregate {
  title: string;
  domain: string;
  domainLabel: string;
  memberCount: number;
  /**
   * Total developers in the team at the time of aggregation.
   * Enables "X of Y devs" frequency display without requiring a separate
   * totalMembers prop on consuming components.
   *
   * Example: memberCount=3, totalDevs=5 → "3 of 5 developers share this pattern"
   */
  totalDevs: number;
  affectedMembers: string[];
  predominantSeverity: 'critical' | 'high' | 'medium' | 'low';
  sampleRecommendation: string;
  /**
   * Representative evidence moments across team members.
   * Shows up to 3 representative moments from different members
   * to illustrate the cross-team pattern.
   */
  representativeEvidence?: Array<{
    memberName: string;
    moment: MemberEvidenceMoment;
  }>;
  /** True if any contributing member has lowConfidence on this growth area */
  hasLowConfidenceContributors?: boolean;
}

// Per-member PEA growth area (full Pattern → Evidence → Action format)
export interface MemberGrowthAreaPEA extends MemberGrowthArea {
  /** Specific tools, files, APIs the builder interacted with */
  toolsFilesApis: string[];
  /** Freeform LLM-generated category tags for team clustering */
  categoryTags: string[];
  /** Concrete verifiable action for next session */
  actionInstruction: string;
  /** How to verify the action was taken in future logs */
  verificationCheck: string;
  /** Why this matters for the builder's goals */
  goalRelevance: string;
  /** Number of distinct evidence moments */
  evidenceCount: number;
  /**
   * Attached KB tip ID (if any, from deterministic matcher).
   * @deprecated Use `knowledgeTip` for the full structured attachment.
   */
  kbTipId?: string;
  /**
   * Attached KB tip title (if any).
   * @deprecated Use `knowledgeTip` for the full structured attachment.
   */
  kbTipTitle?: string;
  /**
   * Full KB tip attachment — structured knowledge tip from deterministic matcher.
   * Carries complete tip data: title, summary, sourceUrl, credibilityTier, relevanceScore.
   * Supersedes `kbTipId` and `kbTipTitle` for new code.
   * Absent if no KB item exceeds the relevance threshold for this growth area.
   */
  knowledgeTip?: MemberKbTipAttachment;
}

// Enhanced team-level growth area aggregate with PEA data
export interface TeamGrowthAreaPEAAggregate extends TeamGrowthAreaAggregate {
  /** Freeform LLM-generated category tags, de-duplicated and frequency-ranked */
  categoryTags: string[];
  /** Actionable team-level recommendation a manager could implement */
  teamRecommendation: string;
  /** Per-member severity breakdown */
  memberSeverities: Array<{
    memberName: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  /**
   * Best-match KB tip from among individual members' tips.
   * @deprecated Use `knowledgeTip` for the full structured attachment.
   */
  kbTipId?: string;
  /** @deprecated Use `knowledgeTip` for the full structured attachment. */
  kbTipTitle?: string;
  /** @deprecated Use `knowledgeTip` for the full structured attachment. */
  kbTipSourceAuthor?: string;
  /** @deprecated Use `knowledgeTip` for the full structured attachment. */
  kbTipRelevanceScore?: number;
  /**
   * Full KB tip attachment for the team-level aggregate.
   * Best-match tip from among individual members' kbTips, selected by highest relevanceScore.
   * Absent if no member had a qualifying KB tip.
   */
  knowledgeTip?: MemberKbTipAttachment;
}

// Team-level KPT aggregate
export interface TeamKPTItem {
  text: string;
  memberCount: number;
  affectedMembers: string[];
}

export interface TeamKPTAggregate {
  keep: TeamKPTItem[];
  problem: TeamKPTItem[];
  tryNext: TeamKPTItem[];
}

// Enhanced anti-pattern with description and actionable insight
export interface EnhancedAntiPatternAggregate extends AntiPatternAggregate {
  description: string;
  affectedMembers: string[];
  actionableInsight: string;
}

/**
 * A single prioritized manager-facing action item derived from cross-developer patterns.
 *
 * Produced by generateTeamActionItems() (deterministic) or
 * generateLLMTeamRecommendations() (LLM-powered). Both generators return the
 * same shape so consumers are source-agnostic.
 *
 * Defined here (canonical types file) rather than in aggregation.ts to
 * prevent circular imports — aggregation.ts imports from this module.
 */
export interface TeamActionItem {
  /** Numeric rank — 1 is highest priority, max 7. */
  priority: number;
  /** Urgency tier based on severity and affected-member frequency. */
  urgency: 'immediate' | 'this-sprint' | 'next-sprint';
  /** Concrete, manager-implementable directive (not generic advice). */
  action: string;
  /** Frequency and impact context: "N of M developers (P%) exhibit [pattern]." */
  rationale: string;
  /** Title of the source cross-developer pattern. */
  pattern: string;
  /** Analysis domain identifier. */
  domain: string;
  /** Human-readable domain label. */
  domainLabel: string;
  /** Names of developers affected by this pattern. */
  affectedMembers: string[];
  /** Predominant severity of the source pattern. */
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Team analysis output — combines cross-developer patterns with actionable
 * manager recommendations in a single unified schema.
 *
 * This is the canonical output of the team analysis pipeline:
 *   aggregateGrowthAreasPEA() → patterns
 *   generateLLMTeamRecommendations() OR generateTeamActionItems() → recommendations
 *
 * Both are co-located here so callers receive patterns and their derived
 * recommendations in a single atomic response. This satisfies the
 * "persisted alongside pattern data" requirement — recommendations are never
 * generated without their source patterns being present in the same object.
 *
 * The `recommendationSource` field makes the generation mode explicit and
 * observable: 'llm' when ANTHROPIC_API_KEY is configured, 'deterministic'
 * when falling back to template-based generation.
 */
export interface TeamAnalysisOutput {
  teamId: string;
  teamName: string;
  /**
   * Cross-developer patterns detected across team members.
   * Produced by aggregateGrowthAreasPEA() — two-pass clustering (exact title
   * match → semantic tag overlap) with frequency counts, category tags,
   * per-member severity breakdowns, and best-match KB tips.
   */
  patterns: TeamGrowthAreaPEAAggregate[];
  /**
   * Prioritized manager-facing action items derived from patterns.
   * Co-located with patterns so recommendations always reference the
   * same pattern set they were generated from.
   *
   * Generated by:
   * - generateLLMTeamRecommendations() when ANTHROPIC_API_KEY is configured
   * - generateTeamActionItems() (deterministic templates) otherwise
   */
  recommendations: TeamActionItem[];
  /**
   * Which generator produced the recommendations.
   * 'llm' — context-aware Anthropic-powered directives specific to pattern titles and tags.
   * 'deterministic' — template-based directives keyed by domain and severity.
   */
  recommendationSource: 'llm' | 'deterministic';
  /** ISO 8601 timestamp when this analysis was generated server-side. */
  generatedAt: string;
  /** Total developers in the team at time of analysis. */
  totalMembers: number;
}

// Dimension metadata for display
export const DIMENSION_METADATA: Record<keyof DimensionScores, { label: string; description: string }> = {
  aiCollaboration: {
    label: 'AI Collaboration',
    description: 'Ability to effectively partner with AI tools'
  },
  contextEngineering: {
    label: 'Context Engineering',
    description: 'Skill in providing clear, relevant context to AI'
  },
  burnoutRisk: {
    label: 'Burnout Risk',
    description: 'Work pattern sustainability (lower is better)'
  },
  aiControl: {
    label: 'AI Control',
    description: 'Ability to guide and verify AI outputs'
  },
  skillResilience: {
    label: 'Skill Resilience',
    description: 'Maintaining core skills while using AI'
  },
};
