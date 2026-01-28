/**
 * Personal Tab Components
 * Barrel exports for tab content components
 *
 * REFACTORED: Simplified to 2-tab structure
 * - Communication Patterns (promptPatterns)
 * - Your Insights (Worker-specific strengths/growthAreas)
 *
 * REMOVED: DimensionInsightsClean, AgentInsightsSection, GrowthInsightsSection
 *          These are replaced by WorkerInsightsSection
 */

export { ReportTab } from './ReportTab';
export { ProgressTab } from './ProgressTab';
export { InsightsTab } from './InsightsTab';

export { TypeResultMinimal } from './TypeResultMinimal';
export { PersonalitySummaryClean } from './PersonalitySummaryClean';
export { PromptPatternsClean } from './PromptPatternsClean';
export { GrowthAreasSection } from './GrowthAreasSection';
export { EmptyStatePrompt } from './EmptyStatePrompt';

// New tabbed components
export { TabbedReportContainer } from './TabbedReportContainer';
export { WorkerInsightsSection } from './WorkerInsightsSection';
export { NextTabButton } from './NextTabButton';
