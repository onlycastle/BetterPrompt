/**
 * Personal Tab Components
 * Barrel exports for tab content components
 *
 * Organized into domain subfolders:
 * - containers/: Entry point containers (TabbedReportContainer, ReportTab, etc.)
 * - insights/: Domain-specific insights (WorkerInsightsSection, GrowthAreasSection)
 * - type-result/: Type classification display (TypeResultMinimal, DualRadarCharts)
 * - resources/: Learning resources sidebar (ResourceSidebar, ResourceBubble)
 * - shared/: Reusable UI elements (DataQualityBadge, EmptyStatePrompt, FloatingProgressDots)
 *
 * Note: Communication Patterns are now integrated into WorkerInsightsSection
 * via the prompt-pattern-transformer utility, not as a separate component.
 */

// Container components
export { TabbedReportContainer, type ReportTabId, ReportTab, ProgressTab, InsightsTab } from './containers';

// Type result components
export { TypeResultMinimal, DualRadarCharts, RadarChart, PersonalitySummaryClean } from './type-result';

// Insights components
export { WorkerInsightsSection, GrowthAreasSection, ExpandableEvidence } from './insights';

// Resources components
export { ResourceSidebar, ResourcePreviewCard, ResourceBubble } from './resources';

// Shared components
export { DataQualityBadge, EmptyStatePrompt, FloatingProgressDots } from './shared';
