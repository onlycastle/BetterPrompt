/**
 * HTML Report Template Generator
 *
 * Generates a standalone HTML report with inlined CSS/JS/SVG.
 * Uses the notebook-sketch design system from the main app.
 *
 * @module plugin/lib/report-template
 */
import type { AnalysisReport } from './core/types.js';
export declare function generateReportHtml(report: AnalysisReport): string;
