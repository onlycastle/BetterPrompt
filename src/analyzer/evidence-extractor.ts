/**
 * Evidence Extractor - Finds conversation samples that demonstrate each type
 *
 * Extracts actual quotes from user messages that exemplify
 * the behavioral patterns of each AI Coding Style type.
 */

import {
  type ParsedSession,
  type ParsedMessage,
  type CodingStyleType,
  type ConversationEvidence,
} from '../models/index.js';

// ============================================================================
// Evidence Patterns - What to look for in conversations
// ============================================================================

interface EvidencePattern {
  type: CodingStyleType;
  patterns: RegExp[];
  explanation: string;
  minLength?: number;
  maxLength?: number;
}

const EVIDENCE_PATTERNS: EvidencePattern[] = [
  // ========== ARCHITECT PATTERNS ==========
  {
    type: 'architect',
    patterns: [
      /\b(first|1\.?)\b[^.]*\b(then|2\.?|next|second)\b/i,
      /\bstep\s*[1-3]\b/i,
      /\blet's\s+(start|begin)\s+with\b/i,
      /\bbefore\s+we\s+(implement|start|begin)\b/i,
      /\bplan\s+(out|the|this)\b/i,
      /\bdesign\s+(the|a)\s+\w+\s+(first|before)\b/i,
      /\barchitecture\s+(of|for)\b/i,
      /\bapproach\s+(this|the|to)\b/i,
    ],
    explanation: 'Shows strategic, step-by-step planning approach',
    minLength: 80,
  },
  {
    type: 'architect',
    patterns: [
      /\bhere'?s?\s+the\s+(structure|plan|approach|overview)\b/i,
      /\bwe\s+need\s+to\s+\d+\s+(things?|steps?)\b/i,
      /\blet\s+me\s+(outline|explain|describe)\s+the\b/i,
    ],
    explanation: 'Demonstrates clear upfront communication and structure',
    minLength: 100,
  },

  // ========== SCIENTIST PATTERNS ==========
  {
    type: 'scientist',
    patterns: [
      /\bwhy\s+(did|do|does|would|is|are|isn't|aren't)\s+\w+/i,
      /\bwhy\s+not\s+\w+/i,
      /\bcan\s+you\s+explain\s+(why|how)\b/i,
    ],
    explanation: 'Actively questions and verifies AI reasoning',
    minLength: 20,
  },
  {
    type: 'scientist',
    patterns: [
      /\bwait,?\s+(this|that)\s+(looks?|seems?)\s+(wrong|incorrect|off)\b/i,
      /\bthat's?\s+not\s+(right|correct|what)\b/i,
      /\bI\s+(don't|do\s+not)\s+think\s+that's\s+right\b/i,
      /\bactually,?\s+this\s+(should|needs)\b/i,
    ],
    explanation: 'Catches and corrects AI mistakes',
    minLength: 30,
  },
  {
    type: 'scientist',
    patterns: [
      /\bis\s+there\s+(a|another)\s+(better|alternative)\s+(way|approach)\b/i,
      /\bwhat\s+are\s+the\s+(alternatives?|options?|trade-?offs?)\b/i,
      /\bexplain\s+the\s+(difference|performance|trade-?off)\b/i,
    ],
    explanation: 'Explores alternatives and evaluates options',
    minLength: 40,
  },

  // ========== COLLABORATOR PATTERNS ==========
  {
    type: 'collaborator',
    patterns: [
      /\b(nice|good|great|perfect),?\s+(but|now|and)\s+(add|change|also)\b/i,
      /\balmost\s+(there|perfect|done)\b/i,
      /\bjust\s+(fix|change|update|add)\s+(the|this)\b/i,
    ],
    explanation: 'Shows iterative refinement through dialogue',
    minLength: 20,
  },
  {
    type: 'collaborator',
    patterns: [
      /\bthank(s| you)[.!]?\s*\w/i,
      /\bthat'?s?\s+(exactly|perfect|great)\b/i,
      /\bawesome[,!]?\s+(now|but|and)\b/i,
    ],
    explanation: 'Provides positive feedback to guide collaboration',
    minLength: 15,
  },
  {
    type: 'collaborator',
    patterns: [
      /\bcan\s+you\s+also\b/i,
      /\b(one|another)\s+more\s+thing\b/i,
      /\badditionally,?\s/i,
      /\bwhile\s+you'?re?\s+(at\s+it|there)\b/i,
    ],
    explanation: 'Builds on AI output through incremental requests',
    minLength: 25,
  },

  // ========== SPEEDRUNNER PATTERNS ==========
  {
    type: 'speedrunner',
    patterns: [
      /^(make|create|add|build|write)\s+(a|the)\s+\w+\s*$/i,
      /^(fix|run|test|deploy)\s+(it|this|that|the)?\s*$/i,
      /^(done|next|ok|okay|continue|go)\s*[.!]?\s*$/i,
    ],
    explanation: 'Uses short, action-oriented commands',
    maxLength: 60,
  },
  {
    type: 'speedrunner',
    patterns: [
      /\bjust\s+(do|make|run)\s+it\b/i,
      /\bquick(ly)?\s/i,
      /\bdon'?t\s+worry\s+about\b/i,
      /\bship\s+it\b/i,
    ],
    explanation: 'Prioritizes speed and execution over perfection',
    maxLength: 80,
  },

  // ========== CRAFTSMAN PATTERNS ==========
  {
    type: 'craftsman',
    patterns: [
      /\b(refactor|clean\s+up|restructure)\s+(this|the)\b/i,
      /\bmake\s+(this|it)\s+(cleaner|more\s+readable|better)\b/i,
      /\bsimplify\s+(this|the)\b/i,
    ],
    explanation: 'Focuses on code quality and maintainability',
    minLength: 30,
  },
  {
    type: 'craftsman',
    patterns: [
      /\b(rename|name)\s+(this|the|it)\s+(to|as)\s+(something)?\s*(more)?\s*(descriptive|clear|better)\b/i,
      /\bthis\s+(function|variable|name)\s+(is|seems)\s+(unclear|confusing)\b/i,
      /\bfollow\s+(our|the|existing)\s+(pattern|convention|style)\b/i,
    ],
    explanation: 'Cares about naming, patterns, and conventions',
    minLength: 40,
  },
  {
    type: 'craftsman',
    patterns: [
      /\badd\s+(tests?|types?|docs?|documentation)\b/i,
      /\bensure\s+(type\s+safety|test\s+coverage)\b/i,
      /\bmatch\s+(our|the|existing)\s+(code\s+)?style\b/i,
    ],
    explanation: 'Values tests, types, and documentation',
    minLength: 25,
  },
];

// ============================================================================
// Evidence Extraction
// ============================================================================

/**
 * Extract evidence samples from sessions for a given primary type
 * Returns up to `maxEvidence` samples, prioritizing the primary type
 */
export function extractEvidence(
  sessions: ParsedSession[],
  primaryType: CodingStyleType,
  maxEvidence: number = 8
): ConversationEvidence[] {
  const allEvidence: ConversationEvidence[] = [];

  // Collect all user messages across sessions
  const allMessages: Array<{ message: ParsedMessage; session: ParsedSession }> =
    [];

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === 'user') {
        allMessages.push({ message, session });
      }
    }
  }

  // Find evidence for each pattern
  for (const pattern of EVIDENCE_PATTERNS) {
    for (const { message } of allMessages) {
      const content = message.content.trim();

      // Check length constraints
      if (pattern.minLength && content.length < pattern.minLength) continue;
      if (pattern.maxLength && content.length > pattern.maxLength) continue;

      // Check if any pattern matches
      const matches = pattern.patterns.some((regex) => regex.test(content));
      if (!matches) continue;

      // Found a match! Create evidence
      const evidence: ConversationEvidence = {
        type: pattern.type,
        quote: truncateQuote(content, 200),
        timestamp: message.timestamp,
        explanation: pattern.explanation,
      };

      // Avoid duplicates
      const isDuplicate = allEvidence.some(
        (e) => e.quote === evidence.quote || similarity(e.quote, evidence.quote) > 0.8
      );

      if (!isDuplicate) {
        allEvidence.push(evidence);
      }
    }
  }

  // Sort: primary type first, then by timestamp (most recent first)
  allEvidence.sort((a, b) => {
    if (a.type === primaryType && b.type !== primaryType) return -1;
    if (a.type !== primaryType && b.type === primaryType) return 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Take top N, ensuring we have at least some from primary type
  const primaryEvidence = allEvidence.filter((e) => e.type === primaryType);
  const otherEvidence = allEvidence.filter((e) => e.type !== primaryType);

  // Aim for at least 50% primary type evidence
  const primaryCount = Math.min(
    primaryEvidence.length,
    Math.ceil(maxEvidence * 0.6)
  );
  const otherCount = Math.min(
    otherEvidence.length,
    maxEvidence - primaryCount
  );

  return [
    ...primaryEvidence.slice(0, primaryCount),
    ...otherEvidence.slice(0, otherCount),
  ];
}

/**
 * Find evidence for a specific type (for locked content preview)
 */
export function findTypeEvidence(
  sessions: ParsedSession[],
  targetType: CodingStyleType,
  maxEvidence: number = 3
): ConversationEvidence[] {
  const patterns = EVIDENCE_PATTERNS.filter((p) => p.type === targetType);
  const evidence: ConversationEvidence[] = [];

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role !== 'user') continue;

      const content = message.content.trim();

      for (const pattern of patterns) {
        if (pattern.minLength && content.length < pattern.minLength) continue;
        if (pattern.maxLength && content.length > pattern.maxLength) continue;

        const matches = pattern.patterns.some((regex) => regex.test(content));
        if (!matches) continue;

        evidence.push({
          type: targetType,
          quote: truncateQuote(content, 200),
          timestamp: message.timestamp,
          explanation: pattern.explanation,
        });

        if (evidence.length >= maxEvidence) {
          return evidence;
        }
      }
    }
  }

  return evidence;
}

/**
 * Get a single best evidence sample for each type
 * Useful for showing type distribution with examples
 */
export function getBestEvidencePerType(
  sessions: ParsedSession[]
): Record<CodingStyleType, ConversationEvidence | null> {
  const result: Record<CodingStyleType, ConversationEvidence | null> = {
    architect: null,
    scientist: null,
    collaborator: null,
    speedrunner: null,
    craftsman: null,
  };

  const types: CodingStyleType[] = [
    'architect',
    'scientist',
    'collaborator',
    'speedrunner',
    'craftsman',
  ];

  for (const type of types) {
    const evidence = findTypeEvidence(sessions, type, 1);
    result[type] = evidence.length > 0 ? evidence[0] : null;
  }

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate a quote to max length, preserving word boundaries
 */
function truncateQuote(text: string, maxLength: number): string {
  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Find last space before maxLength
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Simple similarity check to avoid near-duplicate quotes
 */
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;

  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.9;
  }

  // Simple word overlap
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));

  let overlap = 0;
  for (const word of aWords) {
    if (bWords.has(word)) overlap++;
  }

  return (2 * overlap) / (aWords.size + bWords.size);
}
