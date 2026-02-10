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
  toolMastery: number;
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
  toolMastery: {
    label: 'Tool Mastery',
    description: 'Proficiency with AI development tools'
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
