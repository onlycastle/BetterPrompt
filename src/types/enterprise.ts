/**
 * Enterprise Dashboard Types
 * Types for B2B team analytics and member analysis tracking
 */

// Coding style personality types (matches src/models/coding-style.ts)
export type CodingStyleType =
  | 'architect'
  | 'scientist'
  | 'collaborator'
  | 'speedrunner'
  | 'craftsman';

// AI Control levels (exploration metaphor)
export type AIControlLevel = 'explorer' | 'navigator' | 'cartographer';

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
  scientist: { emoji: '🔬', label: 'Scientist', color: '#8B5CF6' },      // Purple
  collaborator: { emoji: '🤝', label: 'Collaborator', color: '#10B981' }, // Green
  speedrunner: { emoji: '⚡', label: 'Speedrunner', color: '#F59E0B' },   // Amber
  craftsman: { emoji: '🎨', label: 'Craftsman', color: '#EC4899' },       // Pink
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
