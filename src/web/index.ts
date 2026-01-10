/**
 * Web Server Module
 *
 * Exports web server functionality for displaying reports.
 */

export {
  startReportServer,
  stopReportServer,
  type WebServerOptions,
  type ReportData,
} from './server.js';
export { generateReportHTML, type ExtendedAnalysisData } from './template.js';
