/**
 * Prompt Context Builders
 *
 * Produces stage- and domain-specific prompt payloads from the current
 * canonical run state so skills no longer need to reread the raw Phase 1 file.
 *
 * @module plugin/lib/prompt-context
 */
import type { CanonicalStageOutputs, DeterministicScores, DeterministicTypeResult, DomainResult, Phase1Output } from './core/types.js';
export declare const PROMPT_CONTEXT_KINDS: readonly ["sessionSummaries", "domainAnalysis", "projectSummaries", "weeklyInsights", "typeClassification", "evidenceVerification", "contentWriter", "translation"];
export type PromptContextKind = typeof PROMPT_CONTEXT_KINDS[number];
export type PromptContextDomain = 'thinkingQuality' | 'communicationPatterns' | 'learningBehavior' | 'contextEfficiency' | 'sessionOutcome';
interface PromptContextInput {
    kind: PromptContextKind;
    phase1Output: Phase1Output;
    deterministicScores: DeterministicScores;
    typeResult: DeterministicTypeResult | null;
    domainResults: DomainResult[];
    stageOutputs: CanonicalStageOutputs;
    domain?: PromptContextDomain;
}
export declare function buildPromptContext(input: PromptContextInput): Record<string, unknown>;
export {};
