/**
 * Evidence-Based Utterance Extraction Utilities
 *
 * Shared utilities for extracting utteranceIds from Phase 2 worker evidence.
 * Used by both ContentWriter (Phase 3) and TypeClassifier (Phase 2.5).
 *
 * @module analyzer/shared/evidence-utils
 */

import type { AgentOutputs } from '../../models/agent-outputs';

/**
 * Add utteranceId to the set if it exists
 */
export function addUtteranceId(ids: Set<string>, item: { utteranceId?: string }): void {
  if (item.utteranceId) {
    ids.add(item.utteranceId);
  }
}

/**
 * Extract utteranceIds from an array of items with evidence property
 */
export function extractFromEvidenceItems(ids: Set<string>, items: any[] | undefined): void {
  if (!items) return;
  for (const item of items) {
    for (const ev of item.evidence || []) {
      addUtteranceId(ids, ev);
    }
  }
}

/**
 * Extract utteranceIds from an array of items with examples property
 */
export function extractFromExampleItems(ids: Set<string>, items: any[] | undefined): void {
  if (!items) return;
  for (const item of items) {
    for (const ex of item.examples || []) {
      if (typeof ex === 'object' && ex !== null) {
        addUtteranceId(ids, ex);
      }
    }
  }
}

/**
 * Extract unique utteranceIds that Phase 2 workers used as evidence.
 *
 * These are the utterances that have already been identified as significant
 * by the Phase 2 analysis pipeline. Using these for topUtterances ensures:
 * - LLM only sees contextually relevant utterances
 * - Prevents pattern-example mismatch (e.g., "architecture blueprint" with "done")
 * - Avoids short, generic utterances that don't demonstrate patterns
 *
 * @param agentOutputs - All Phase 2 worker outputs
 * @returns Set of utteranceIds that workers used as evidence
 */
export function extractEvidenceUtteranceIds(agentOutputs: AgentOutputs): Set<string> {
  const ids = new Set<string>();
  const tq = agentOutputs.thinkingQuality;

  // ThinkingQuality extractions
  if (tq) {
    extractFromExampleItems(ids, tq.verificationAntiPatterns);
    extractFromExampleItems(ids, tq.planningHabits);

    // criticalThinkingMoments have direct utteranceId
    for (const ct of tq.criticalThinkingMoments || []) {
      addUtteranceId(ids, ct);
    }

    extractFromEvidenceItems(ids, tq.strengths);
    extractFromEvidenceItems(ids, tq.growthAreas);
  }

  // CommunicationPatterns extractions (v3.1 - separate worker)
  if (agentOutputs.communicationPatterns) {
    extractFromExampleItems(ids, agentOutputs.communicationPatterns.communicationPatterns);
    extractFromEvidenceItems(ids, agentOutputs.communicationPatterns.strengths);
    extractFromEvidenceItems(ids, agentOutputs.communicationPatterns.growthAreas);
  }

  // LearningBehavior extractions
  if (agentOutputs.learningBehavior) {
    extractFromEvidenceItems(ids, agentOutputs.learningBehavior.strengths);
    extractFromEvidenceItems(ids, agentOutputs.learningBehavior.growthAreas);
  }

  // Legacy workers (kept for cached data)
  if (agentOutputs.contextEfficiency) {
    extractFromEvidenceItems(ids, agentOutputs.contextEfficiency.strengths);
    extractFromEvidenceItems(ids, agentOutputs.contextEfficiency.growthAreas);
  }

  if (agentOutputs.knowledgeGap) {
    extractFromEvidenceItems(ids, agentOutputs.knowledgeGap.strengths);
    extractFromEvidenceItems(ids, agentOutputs.knowledgeGap.growthAreas);
  }

  return ids;
}
