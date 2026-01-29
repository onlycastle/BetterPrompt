/**
 * Pipeline Stage Exports
 *
 * Content Writer (Gemini 3 Flash) - Transform Phase 2 outputs into engaging narrative
 * Translator (Gemini 3 Flash) - Dedicated translation stage (Phase 4, conditional)
 * Evidence Verifier (Gemini 3 Flash) - Validate evidence relevance (Phase 2.8)
 *
 * @module analyzer/stages
 */

// Content Writer
export { ContentWriterStage, type ContentWriterConfig } from './content-writer';

// Translator
export { TranslatorStage, type TranslatorConfig } from './translator';
export { TRANSLATOR_SYSTEM_PROMPT } from './translator-prompts';

// Evidence Verifier (Phase 2.8)
export { EvidenceVerifierStage, type EvidenceVerifierResult } from './evidence-verifier';
export { EVIDENCE_VERIFIER_SYSTEM_PROMPT } from './evidence-verifier-prompts';
