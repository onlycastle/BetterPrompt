/**
 * Prompt Pattern Transformer
 *
 * Transforms PromptPattern data (from ContentWriter Phase 3) into
 * WorkerStrength/WorkerGrowth formats for unified display in WorkerDomainSection.
 *
 * Classification Rules:
 * - highly_effective, effective → Strengths
 * - could_improve → Growth Areas
 *
 * The _meta field preserves source information and frequency/effectiveness
 * for badge rendering in the UI.
 */

import type {
  PromptPattern,
  PromptFrequency,
  PromptEffectiveness,
} from '../../types/verbose';
import type { WorkerStrength, WorkerGrowth, EvidenceItem } from '../models/worker-insights';

/**
 * Extended WorkerStrength with communication pattern metadata.
 * The _meta field identifies this as a communication pattern and provides
 * frequency/effectiveness for badge display.
 */
export interface CommunicationStrength extends WorkerStrength {
  _meta: {
    source: 'communication_pattern';
    frequency: PromptFrequency;
    effectiveness: PromptEffectiveness;
  };
}

/**
 * Extended WorkerGrowth with communication pattern metadata.
 * The _meta field identifies this as a communication pattern and provides
 * frequency/effectiveness for badge display.
 */
export interface CommunicationGrowth extends WorkerGrowth {
  _meta: {
    source: 'communication_pattern';
    frequency: PromptFrequency;
    effectiveness: PromptEffectiveness;
  };
}

/**
 * Map frequency to severity for growth areas.
 * More frequent issues = higher severity priority.
 */
function frequencyToSeverity(frequency: PromptFrequency): 'high' | 'medium' | 'low' {
  switch (frequency) {
    case 'frequent':
      return 'high';
    case 'occasional':
      return 'medium';
    case 'rare':
      return 'low';
  }
}

/**
 * Convert PromptPattern examples to EvidenceItem array.
 * Returns InsightEvidence (expandable) when utteranceId is available,
 * otherwise falls back to plain string quote (non-expandable).
 */
function examplesToEvidence(examples: PromptPattern['examples']): EvidenceItem[] {
  return examples.map((ex) => {
    if (ex.utteranceId) {
      return {
        utteranceId: ex.utteranceId,
        quote: ex.quote,
        context: ex.analysis,
      };
    }
    return ex.quote;
  });
}

/**
 * Transform a single PromptPattern into a CommunicationStrength.
 * Used for highly_effective and effective patterns.
 */
function toStrength(pattern: PromptPattern): CommunicationStrength {
  return {
    title: pattern.patternName,
    description: pattern.description,
    evidence: examplesToEvidence(pattern.examples),
    _meta: {
      source: 'communication_pattern',
      frequency: pattern.frequency,
      effectiveness: pattern.effectiveness,
    },
  };
}

/**
 * Transform a single PromptPattern into a CommunicationGrowth.
 * Used for could_improve patterns.
 */
function toGrowthArea(pattern: PromptPattern): CommunicationGrowth {
  return {
    title: pattern.patternName,
    description: pattern.description,
    evidence: examplesToEvidence(pattern.examples),
    recommendation: pattern.tip ?? '',
    severity: frequencyToSeverity(pattern.frequency),
    _meta: {
      source: 'communication_pattern',
      frequency: pattern.frequency,
      effectiveness: pattern.effectiveness,
    },
  };
}

/**
 * Result of transforming communication patterns.
 * Contains arrays ready to be merged with Worker insights.
 */
export interface TransformedCommunicationPatterns {
  strengths: CommunicationStrength[];
  growthAreas: CommunicationGrowth[];
}

/**
 * Transform an array of PromptPatterns into WorkerStrength/WorkerGrowth arrays.
 *
 * Classification:
 * - highly_effective → Strengths
 * - effective → Strengths
 * - could_improve → Growth Areas
 *
 * @param patterns - PromptPattern array from ContentWriter output
 * @returns Object with strengths and growthAreas arrays
 */
export function transformCommunicationPatterns(
  patterns: PromptPattern[] | undefined
): TransformedCommunicationPatterns {
  if (!patterns || patterns.length === 0) {
    return { strengths: [], growthAreas: [] };
  }

  const strengths: CommunicationStrength[] = [];
  const growthAreas: CommunicationGrowth[] = [];

  for (const pattern of patterns) {
    if (pattern.effectiveness === 'could_improve') {
      growthAreas.push(toGrowthArea(pattern));
    } else {
      // highly_effective or effective → Strengths
      strengths.push(toStrength(pattern));
    }
  }

  return { strengths, growthAreas };
}
