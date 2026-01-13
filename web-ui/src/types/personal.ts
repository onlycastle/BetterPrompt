/**
 * Personal Dashboard Types
 * Types for individual developer journey tracking and personalized recommendations
 */

import type { DimensionScores, CodingStyleType, AIControlLevel, HistoryEntry } from './enterprise';

// Main personal analytics container
export interface PersonalAnalytics {
  // Top-level properties for JourneyHeader
  currentType: CodingStyleType;
  firstAnalysisDate: string;
  analysisCount: number;
  totalImprovement: number;

  // Current dimension scores
  currentDimensions: DimensionScores;
  dimensionImprovements: DimensionScores;

  // Detailed analysis comparisons
  firstAnalysis: AnalysisSummary;
  latestAnalysis: AnalysisSummary;

  // Journey tracking
  journey: {
    totalAnalyses: number;
    currentStreak: number;
    longestStreak: number;
  };

  // Growth data
  history: HistoryEntry[];
  recommendations: Recommendation[];
}

// Analysis summary for comparison
export interface AnalysisSummary {
  date: string;
  score: number; // alias for overallScore
  overallScore: number;
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
  dimensions: DimensionScores;
}

// Re-export HistoryEntry from enterprise (defined there as source of truth)
export type { HistoryEntry };

// Recommendation types
export type RecommendationType = 'article' | 'video' | 'exercise' | 'course';
export type RecommendationPriority = 'high' | 'medium' | 'low';

// Personalized learning recommendation
export interface Recommendation {
  id: string;
  priority: RecommendationPriority;
  dimension: keyof DimensionScores;
  title: string;
  description: string;
  type: RecommendationType;
  url?: string;
  estimatedMinutes?: number;
}

// Re-export for convenience
export type { DimensionScores, CodingStyleType, AIControlLevel };
