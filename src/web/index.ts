/**
 * Web Server Module
 *
 * Exports web server functionality for displaying reports.
 */

export {
  startReportServer,
  startVerboseReportServer,
  stopReportServer,
  type WebServerOptions,
  type ReportData,
  type VerboseReportData,
} from './server.js';
export {
  generateReportHTML,
  generateUnifiedReportHTML,
  type ExtendedAnalysisData,
  type ReportOptions,
} from './template.js';
export * from './components.js';
