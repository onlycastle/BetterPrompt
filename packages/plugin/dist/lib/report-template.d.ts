/**
 * HTML Report Template Generator
 *
 * Generates a standalone HTML report with inlined CSS/JS/SVG.
 * Uses the notebook-sketch design system from the main app.
 *
 * @module plugin/lib/report-template
 */
import type { AnalysisReport, CanonicalAnalysisRun } from './core/types.js';
export declare function generateReportHtml(report: AnalysisReport): string;
export declare function generateCanonicalReportHtml(run: CanonicalAnalysisRun): string;
