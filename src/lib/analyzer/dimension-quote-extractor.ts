/**
 * Dimension Quote Extractor
 *
 * Extracts conversation quotes relevant to each analysis dimension.
 * Maps user messages to dimension-specific behavioral patterns.
 */

import type { ParsedSession } from '../models/index';
import type {
  DimensionName,
  ConversationInsight,
  EvidenceQuote,
  EvidenceCategory,
  EvidenceSentiment,
} from '../models/unified-report';

// ============================================
// Dimension Patterns
// ============================================

interface DimensionPattern {
  dimension: DimensionName;
  sentiment: 'positive' | 'negative' | 'neutral';
  patterns: RegExp[];
  explanation: string;
  minLength?: number;
  maxLength?: number;
}

// ============================================
// Constants
// ============================================

const ALL_DIMENSIONS: DimensionName[] = [
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
];

const SENTIMENT_PRIORITY: Record<EvidenceSentiment, number> = {
  positive: 0,
  negative: 1,
  neutral: 2,
};

const WORD_BOUNDARY_THRESHOLD = 0.7;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.8;
const SUBSTRING_SIMILARITY_SCORE = 0.9;
const MAX_QUOTE_LENGTH = 300;
const OVERSAMPLE_FACTOR = 2;

/**
 * Patterns for detecting dimension-relevant behaviors in conversations
 */
const DIMENSION_PATTERNS: DimensionPattern[] = [
  // ========== AI COLLABORATION ==========
  {
    dimension: 'aiCollaboration',
    sentiment: 'positive',
    patterns: [
      /\blet'?s?\s+(start|begin)\s+with\b/i,
      /\bhere'?s?\s+(the|my)\s+(plan|approach|idea)\b/i,
      /\bfirst,?\s+(i'll?|we)\s+(need|should)\b/i,
      /\bstep\s+[1-3]\b/i,
      /\bbefore\s+(coding|implementing|starting)\b/i,
    ],
    explanation: 'Demonstrates structured AI collaboration approach',
    minLength: 30,
  },
  {
    dimension: 'aiCollaboration',
    sentiment: 'negative',
    patterns: [
      /^(do|make|fix|create)\s+it\s*[.!]?\s*$/i,
      /^(just|simply)\s+(do|fix|make)\s+(it|this)\s*$/i,
      /\bdon'?t\s+explain\b/i,
    ],
    explanation: 'Minimal guidance provided to AI',
    maxLength: 50,
  },

  // ========== CONTEXT ENGINEERING ==========
  {
    dimension: 'contextEngineering',
    sentiment: 'positive',
    patterns: [
      /\bhere'?s?\s+(the|some)\s+(context|background|information)\b/i,
      /\bfor\s+context\b/i,
      /\bthis\s+(file|code|function)\s+(is|does|handles)\b/i,
      /\b(in|from)\s+(the|this)\s+(file|directory|codebase)\b/i,
      /\busing\s+(the|our)\s+(existing|current)\b/i,
    ],
    explanation: 'Provides relevant context to AI',
    minLength: 40,
  },
  {
    dimension: 'contextEngineering',
    sentiment: 'negative',
    patterns: [
      /\bi\s+don'?t\s+know\s+(where|what|how)\b/i,
      /\b(not\s+sure|unsure)\s+(where|what|how)\b/i,
      /\bsomewhere\s+in\s+(the|this)\s+code\b/i,
    ],
    explanation: 'Lacks context awareness',
    minLength: 15,
  },

  // ========== TOOL MASTERY ==========
  {
    dimension: 'toolMastery',
    sentiment: 'positive',
    patterns: [
      /\buse\s+(the\s+)?(glob|grep|read|bash|task)\s+(tool|command)?\b/i,
      /\brun\s+(the\s+)?(tests?|build|lint)\b/i,
      /\bcheck\s+(the\s+)?(logs?|output|result)\b/i,
      /\b(search|find|look)\s+(for|in)\s+(files?|the)\b/i,
    ],
    explanation: 'Effectively directs tool usage',
    minLength: 20,
  },
  {
    dimension: 'toolMastery',
    sentiment: 'neutral',
    patterns: [
      /\bhow\s+do\s+i\s+(use|run)\b/i,
      /\bwhat\s+(tool|command)\s+(should|do)\b/i,
      /\bcan\s+you\s+(run|execute|check)\b/i,
    ],
    explanation: 'Learning tool usage',
    minLength: 15,
  },

  // ========== BURNOUT RISK ==========
  {
    dimension: 'burnoutRisk',
    sentiment: 'positive',
    patterns: [
      /\blet'?s?\s+(take|do)\s+(a\s+)?(break|pause)\b/i,
      /\benough\s+for\s+(today|now)\b/i,
      /\b(save|commit)\s+(this|progress)\s+(first|before)\b/i,
      /\bi'?ll?\s+(think|look)\s+(about|at)\s+(this|it)\s+(later|tomorrow)\b/i,
    ],
    explanation: 'Shows healthy work boundaries',
    minLength: 15,
  },
  {
    dimension: 'burnoutRisk',
    sentiment: 'negative',
    patterns: [
      /\b(still|keeps?)\s+(not|doesn'?t)\s+(work|fix)\b/i,
      /\b(frustrated|annoyed|stuck)\b/i,
      /\b(why|this)\s+(won'?t|doesn'?t)\s+work\b/i,
      /\bnothing\s+(works?|is\s+working)\b/i,
    ],
    explanation: 'Signs of frustration or burnout',
    minLength: 10,
  },

  // ========== AI CONTROL ==========
  {
    dimension: 'aiControl',
    sentiment: 'positive',
    patterns: [
      /\bwait,?\s+(that|this)\s+(looks?|seems?|is)\s+(wrong|incorrect)\b/i,
      /\bthat'?s?\s+not\s+(right|correct|what\s+i)\b/i,
      /\bactually,?\s+(change|make|use)\b/i,
      /\bno,?\s+(use|do|make)\s+(this|it)\s+(instead|differently)\b/i,
      /\blet\s+me\s+(modify|adjust|fix)\s+(this|that)\b/i,
    ],
    explanation: 'Actively corrects and guides AI output',
    minLength: 15,
  },
  {
    dimension: 'aiControl',
    sentiment: 'negative',
    patterns: [
      /^(ok|okay|sure|yes|fine|good|great|thanks?|perfect)[.!]?\s*$/i,
      /\bsounds?\s+good\s*$/i,
      /\bgo\s+ahead\s*$/i,
    ],
    explanation: 'Passive acceptance of AI output',
    maxLength: 30,
  },

  // ========== SKILL RESILIENCE ==========
  {
    dimension: 'skillResilience',
    sentiment: 'positive',
    patterns: [
      /\bi\s+(know|understand|see)\s+(that|how|why)\b/i,
      /\bthis\s+is\s+(like|similar\s+to)\b/i,
      /\bfrom\s+my\s+(experience|understanding)\b/i,
      /\bi'?ve?\s+(done|used|tried)\s+(this|that)\s+before\b/i,
      /\bthe\s+(standard|common|typical)\s+(approach|pattern)\s+is\b/i,
    ],
    explanation: 'Demonstrates independent knowledge',
    minLength: 20,
  },
  {
    dimension: 'skillResilience',
    sentiment: 'negative',
    patterns: [
      /\bi\s+don'?t\s+(know|understand)\s+(how|what|why)\b/i,
      /\bwhat\s+does\s+this\s+(mean|do)\b/i,
      /\bexplain\s+(this|what)\s+(is|means)\b/i,
      /\bi'?m?\s+(lost|confused)\b/i,
    ],
    explanation: 'Knowledge gaps visible',
    minLength: 10,
  },
];

// ============================================
// Quote Extraction
// ============================================

export interface ExtractedQuote {
  quote: string;
  messageIndex: number;
  timestamp?: string;
  dimension: DimensionName;
  sentiment: EvidenceSentiment;
  explanation: string;
}

/**
 * Extract quotes relevant to a specific dimension
 */
export function extractDimensionQuotes(
  sessions: ParsedSession[],
  dimension: DimensionName,
  maxQuotes: number = 5
): ExtractedQuote[] {
  const quotes: ExtractedQuote[] = [];
  const dimensionPatterns = DIMENSION_PATTERNS.filter((p) => p.dimension === dimension);

  let globalMessageIndex = 0;

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role !== 'user') {
        globalMessageIndex++;
        continue;
      }

      const content = message.content.trim();

      for (const pattern of dimensionPatterns) {
        if (!matchesPattern(content, pattern)) continue;

        const quote: ExtractedQuote = {
          quote: truncateQuote(content, MAX_QUOTE_LENGTH),
          messageIndex: globalMessageIndex,
          timestamp: message.timestamp?.toISOString(),
          dimension,
          sentiment: pattern.sentiment,
          explanation: pattern.explanation,
        };

        if (!isDuplicateQuote(quotes, quote)) {
          quotes.push(quote);
        }

        // Collect more quotes than needed, then filter
        if (quotes.length >= maxQuotes * OVERSAMPLE_FACTOR) break;
      }

      globalMessageIndex++;
    }
  }

  return sortAndLimitQuotes(quotes, maxQuotes);
}

/**
 * Extract quotes for all dimensions
 */
export function extractAllDimensionQuotes(
  sessions: ParsedSession[],
  quotesPerDimension: number = 3
): Map<DimensionName, ExtractedQuote[]> {
  const result = new Map<DimensionName, ExtractedQuote[]>();

  for (const dimension of ALL_DIMENSIONS) {
    result.set(dimension, extractDimensionQuotes(sessions, dimension, quotesPerDimension));
  }

  return result;
}

/**
 * Convert extracted quotes to ConversationInsight format
 */
export function toConversationInsight(
  quote: ExtractedQuote,
  advice: string
): ConversationInsight {
  return {
    quote: quote.quote,
    messageIndex: quote.messageIndex,
    advice,
    sentiment: mapSentimentToInsightSentiment(quote.sentiment),
  };
}

/**
 * Convert extracted quotes to EvidenceQuote format
 */
export function toEvidenceQuote(
  quote: ExtractedQuote,
  category: EvidenceCategory = 'pattern',
  analysis: string = ''
): EvidenceQuote {
  return {
    quote: quote.quote,
    messageIndex: quote.messageIndex,
    timestamp: quote.timestamp,
    category,
    dimension: quote.dimension,
    sentiment: quote.sentiment,
    analysis: analysis || quote.explanation,
  };
}

// ============================================
// Helper Functions
// ============================================

function matchesPattern(content: string, pattern: DimensionPattern): boolean {
  if (pattern.minLength && content.length < pattern.minLength) {
    return false;
  }
  if (pattern.maxLength && content.length > pattern.maxLength) {
    return false;
  }
  return pattern.patterns.some((regex) => regex.test(content));
}

function truncateQuote(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const wordBoundaryThreshold = maxLength * WORD_BOUNDARY_THRESHOLD;

  if (lastSpace > wordBoundaryThreshold) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

function isDuplicateQuote(existing: ExtractedQuote[], candidate: ExtractedQuote): boolean {
  return existing.some(
    (q) =>
      q.quote === candidate.quote ||
      calculateSimilarity(q.quote, candidate.quote) > DUPLICATE_SIMILARITY_THRESHOLD
  );
}

function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Exact match
  if (aLower === bLower) return 1;

  // Substring match
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return SUBSTRING_SIMILARITY_SCORE;
  }

  // Jaccard similarity on words
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));

  let overlap = 0;
  for (const word of aWords) {
    if (bWords.has(word)) overlap++;
  }

  return (2 * overlap) / (aWords.size + bWords.size);
}

function sortAndLimitQuotes(quotes: ExtractedQuote[], limit: number): ExtractedQuote[] {
  // Sort: positive first, then negative, then neutral
  // Within same sentiment, prefer longer (more informative) quotes
  return quotes
    .sort((a, b) => {
      const priorityDiff = SENTIMENT_PRIORITY[a.sentiment] - SENTIMENT_PRIORITY[b.sentiment];
      if (priorityDiff !== 0) return priorityDiff;
      return b.quote.length - a.quote.length;
    })
    .slice(0, limit);
}

const SENTIMENT_TO_INSIGHT: Record<EvidenceSentiment, 'praise' | 'encouragement' | 'suggestion'> = {
  positive: 'praise',
  negative: 'encouragement',
  neutral: 'suggestion',
};

function mapSentimentToInsightSentiment(
  sentiment: EvidenceSentiment
): 'praise' | 'encouragement' | 'suggestion' {
  return SENTIMENT_TO_INSIGHT[sentiment];
}
