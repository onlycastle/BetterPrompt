/**
 * Two-Stage Pipeline Exports
 *
 * Stage 1: Data Analyst (Gemini 3 Flash) - Extract structured behavioral data
 * Stage 2: Content Writer (Gemini 3 Flash) - Transform into engaging narrative
 *
 * @module analyzer/stages
 */

// Stage 1: Data Analyst
export { DataAnalystStage, type DataAnalystConfig } from './data-analyst';
export {
  DATA_ANALYST_SYSTEM_PROMPT,
  buildDataAnalystUserPrompt,
} from './data-analyst-prompts';

// Stage 2: Content Writer
export { ContentWriterStage, type ContentWriterConfig } from './content-writer';
export {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
} from './content-writer-prompts';
