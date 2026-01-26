/**
 * Pipeline Stage Exports
 *
 * Content Writer (Gemini 3 Flash) - Transform Phase 2 outputs into engaging narrative
 *
 * @module analyzer/stages
 */

// Content Writer
export { ContentWriterStage, type ContentWriterConfig } from './content-writer';
export {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
} from './content-writer-prompts';
