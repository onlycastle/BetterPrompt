/**
 * Page Components
 * These are the main page components that are imported by App Router pages
 */

// Main page components (migrated from web-ui)
export { PersonalDashboardPage } from './PersonalDashboardPage';
export { DashboardPage } from './DashboardPage';
export { EnterpriseDashboardPage } from './EnterpriseDashboardPage';
export { BrowsePage } from './BrowsePage';
export { LearnPage } from './LearnPage';

// Legacy components (need react-router-dom, use wrappers instead)
// export { ReportPage } from './ReportPage';
// export { PublicResultPage } from './PublicResultPage';
// export { ComparisonPage } from './ComparisonPage';

// Next.js App Router wrappers (accept params as props)
export { ReportPageWrapper } from './ReportPageWrapper';
export { PublicResultPageWrapper } from './PublicResultPageWrapper';
export { ComparisonPageWrapper } from './ComparisonPageWrapper';
