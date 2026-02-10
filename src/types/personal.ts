/**
 * Personal Dashboard Types
 * Types for individual developer journey tracking and personalized recommendations
 */

import type { CodingStyleType, AIControlLevel } from './enterprise';

// Worker domain scores matching pipeline output (workerInsights.*.domainScore)
export interface WorkerDomainScores {
  thinkingQuality: number;        // 0-100
  communicationPatterns: number;   // 0-100
  learningBehavior: number;        // 0-100
  contextEfficiency: number;       // 0-100
  sessionOutcome: number;          // 0-100
}

// Personal history data point (uses worker domain scores, not enterprise DimensionScores)
export interface HistoryEntry {
  date: string;           // ISO date string
  overallScore: number;
  domainScores?: WorkerDomainScores;
}

// Main personal analytics container
export interface PersonalAnalytics {
  // Top-level properties for JourneyHeader
  currentType: CodingStyleType;
  firstAnalysisDate: string;
  analysisCount: number;
  totalImprovement: number;

  // Current dimension scores
  currentDimensions: WorkerDomainScores;
  dimensionImprovements: WorkerDomainScores;

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
  domainScores: WorkerDomainScores;
}

// Recommendation types
export type RecommendationType = 'article' | 'video' | 'exercise' | 'course';
export type RecommendationPriority = 'high' | 'medium' | 'low';

// Personalized learning recommendation
export interface Recommendation {
  id: string;
  priority: RecommendationPriority;
  dimension: keyof WorkerDomainScores;
  title: string;
  description: string;
  type: RecommendationType;
  url?: string;
  estimatedMinutes?: number;
}

// Re-export for convenience
export type { CodingStyleType, AIControlLevel };
