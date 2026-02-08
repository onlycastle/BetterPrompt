/**
 * Personal Tab Components
 * Barrel exports for tab content components
 *
 * Organized into domain subfolders:
 * - containers/: Entry point containers (TabbedReportContainer, ReportTab, etc.)
 * - insights/: Domain-specific insights (WorkerInsightsSection, GrowthAreasSection)
 * - type-result/: Type classification display (TypeResultMinimal, MatrixDistributionDisplay)
 * - resources/: Learning resources sidebar (ResourceSidebar, ResourceBubble)
 * - shared/: Reusable UI elements (DataQualityBadge, EmptyStatePrompt, FloatingProgressDots)
 *
 * Note: Communication Patterns are now integrated into WorkerInsightsSection
 * via the prompt-pattern-transformer utility, not as a separate component.
 */

// Container components
export { TabbedReportContainer, type ReportTabId } from './containers';
export { ReportTab } from './containers';
export { ProgressTab } from './containers';
export { InsightsTab } from './containers';

// Type result components
export { TypeResultMinimal } from './type-result';
export { MatrixDistributionDisplay } from './type-result';
export { PersonalitySummaryClean } from './type-result';

// Insights components
export { WorkerInsightsSection } from './insights';
export { GrowthAreasSection } from './insights';
export { ExpandableEvidence } from './insights';

// Resources components
export { ResourceSidebar } from './resources';
export { ResourcePreviewCard } from './resources';
export { ResourceBubble } from './resources';

// Shared components
export { DataQualityBadge } from './shared';
export { EmptyStatePrompt } from './shared';
export { FloatingProgressDots } from './shared';
