/**
 * Personal Dashboard Components
 * Barrel exports for individual developer growth components
 *
 * REFACTORED: Simplified tab structure
 * - DimensionInsightsClean REMOVED (replaced by WorkerInsightsSection)
 * - PromptPatternsClean REMOVED (integrated into WorkerInsightsSection via transformer)
 */

export { JourneyHeader } from './JourneyHeader';
export { ScoreComparisonCard } from './ScoreComparisonCard';
export { DimensionBreakdown } from './DimensionBreakdown';
export { RecommendationsList } from './RecommendationsList';
export { StreakCard } from './StreakCard';

// Tab content components
export {
  ReportTab,
  ProgressTab,
  InsightsTab,
  TypeResultMinimal,
  PersonalitySummaryClean,
  GrowthAreasSection,
  EmptyStatePrompt,
  WorkerInsightsSection,
} from './tabs';
