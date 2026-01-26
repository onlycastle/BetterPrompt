/**
 * Pipeline Stage Exports
 *
 * Content Writer (Gemini 3 Flash) - Transform Phase 2 outputs into engaging narrative
 * Translator (Gemini 3 Flash) - Dedicated translation stage (Phase 4, conditional)
 *
 * @module analyzer/stages
 */

// Content Writer
export { ContentWriterStage, type ContentWriterConfig } from './content-writer';
export {
  CONTENT_WRITER_SYSTEM_PROMPT,
  buildContentWriterUserPrompt,
} from './content-writer-prompts';

// Translator
export { TranslatorStage, type TranslatorConfig } from './translator';
export { TRANSLATOR_SYSTEM_PROMPT } from './translator-prompts';
