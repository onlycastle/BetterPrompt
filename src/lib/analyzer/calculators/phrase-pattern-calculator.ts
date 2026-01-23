/**
 * Phrase Pattern Calculator - Pure Functions for Repeated Phrase Detection
 *
 * All functions in this module are pure (no side effects, deterministic).
 * They calculate phrase frequency statistics from session data without any LLM involvement.
 *
 * Design principles:
 * - No LLM calls - all metrics are computed deterministically
 * - No side effects - pure functions only
 * - No fallbacks - throws on invalid input (fail fast)
 *
 * @module analyzer/calculators/phrase-pattern-calculator
 */

import type { ParsedSession, ParsedMessage } from '../../models/session';

// ============================================================================
// Types
// ============================================================================

/**
 * A detected phrase pattern with frequency and examples
 */
export interface PhrasePattern {
  /** The normalized phrase (lowercased, trimmed) */
  phrase: string;
  /** Number of occurrences across all sessions */
  frequency: number;
  /** Percentage of total user messages containing this pattern */
  percentageOfMessages: number;
  /** Example sentences where this phrase appeared (up to 3) */
  examples: string[];
  /** Session count where this pattern appeared */
  sessionCount: number;
}

/**
 * A cluster of similar phrases grouped by semantic similarity
 */
export interface PhraseCluster {
  /** Representative phrase for the cluster */
  representative: string;
  /** All phrases in this cluster */
  variations: string[];
  /** Total frequency across all variations */
  totalFrequency: number;
  /** Percentage of total user messages */
  percentageOfMessages: number;
  /** Example sentences (up to 3) */
  examples: string[];
}

/**
 * Complete phrase pattern statistics
 */
export interface PhrasePatternStats {
  /** Top N-gram patterns by frequency */
  topNGrams: PhrasePattern[];
  /** Clustered similar phrases */
  clusters: PhraseCluster[];
  /** Total user messages analyzed */
  totalMessages: number;
  /** Total sessions analyzed */
  totalSessions: number;
  /** Analysis metadata */
  analysisMetadata: {
    minNGramSize: number;
    maxNGramSize: number;
    minFrequencyThreshold: number;
    generatedAt: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum N-gram size (words) */
const MIN_NGRAM_SIZE = 2;

/** Maximum N-gram size (words) */
const MAX_NGRAM_SIZE = 5;

/** Minimum frequency to include in results */
const MIN_FREQUENCY_THRESHOLD = 2;

/** Maximum examples to store per pattern */
const MAX_EXAMPLES = 3;

/** Maximum top patterns to return */
const MAX_TOP_PATTERNS = 20;

/** Maximum clusters to return */
const MAX_CLUSTERS = 10;

/** Levenshtein distance threshold for clustering (0-1 ratio) */
const SIMILARITY_THRESHOLD = 0.7;

// ============================================================================
// Main Calculator Function
// ============================================================================

/**
 * Calculate phrase pattern statistics from session data
 *
 * @param sessions - Parsed sessions to analyze
 * @returns Complete phrase pattern statistics
 * @throws Error if sessions array is empty
 */
export function calculatePhrasePatternStats(sessions: ParsedSession[]): PhrasePatternStats {
  if (sessions.length === 0) {
    throw new Error('Cannot calculate phrase patterns: no sessions provided');
  }

  // Extract all user messages
  const userMessages = extractUserMessages(sessions);

  if (userMessages.length === 0) {
    throw new Error('Cannot calculate phrase patterns: no user messages found');
  }

  // Extract N-grams from all messages
  const ngramMap = extractNGrams(userMessages);

  // Filter by minimum frequency and convert to patterns
  const topNGrams = buildTopPatterns(ngramMap, userMessages.length);

  // Cluster similar phrases
  const clusters = clusterSimilarPhrases(topNGrams);

  return {
    topNGrams,
    clusters,
    totalMessages: userMessages.length,
    totalSessions: sessions.length,
    analysisMetadata: {
      minNGramSize: MIN_NGRAM_SIZE,
      maxNGramSize: MAX_NGRAM_SIZE,
      minFrequencyThreshold: MIN_FREQUENCY_THRESHOLD,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// N-gram Extraction
// ============================================================================

interface NGramEntry {
  frequency: number;
  examples: string[];
  sessionIds: Set<string>;
}

/**
 * Extract N-grams from user messages
 */
function extractNGrams(messages: Array<{ content: string; sessionId: string }>): Map<string, NGramEntry> {
  const ngramMap = new Map<string, NGramEntry>();

  for (const msg of messages) {
    const content = msg.content;
    if (!content || content.trim().length === 0) continue;

    // Tokenize into words
    const words = tokenize(content);
    if (words.length < MIN_NGRAM_SIZE) continue;

    // Extract N-grams of various sizes
    for (let n = MIN_NGRAM_SIZE; n <= MAX_NGRAM_SIZE && n <= words.length; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        const normalized = ngram.toLowerCase();

        // Skip if too short or contains only stopwords
        if (isStopwordOnly(normalized)) continue;

        const existing = ngramMap.get(normalized);
        if (existing) {
          existing.frequency++;
          existing.sessionIds.add(msg.sessionId);
          if (existing.examples.length < MAX_EXAMPLES) {
            // Store original sentence context
            existing.examples.push(truncateContext(content, ngram));
          }
        } else {
          ngramMap.set(normalized, {
            frequency: 1,
            examples: [truncateContext(content, ngram)],
            sessionIds: new Set([msg.sessionId]),
          });
        }
      }
    }
  }

  return ngramMap;
}

/**
 * Tokenize text into words, handling multiple languages
 */
function tokenize(text: string): string[] {
  // Remove URLs
  let cleaned = text.replace(/https?:\/\/\S+/g, '');

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`[^`]+`/g, '');

  // Split by whitespace and punctuation, but keep Korean/Japanese/Chinese characters together
  // Korean: \uAC00-\uD7AF
  // Japanese Hiragana: \u3040-\u309F, Katakana: \u30A0-\u30FF
  // Chinese: \u4E00-\u9FFF
  const words: string[] = [];

  // Split by whitespace first
  const parts = cleaned.split(/\s+/);

  for (const part of parts) {
    if (!part) continue;

    // For CJK text, split by non-CJK boundaries but keep CJK phrases together
    // For now, just treat each part as a word
    const trimmed = part.replace(/^[^\w\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+|[^\w\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+$/g, '');
    if (trimmed.length > 0) {
      words.push(trimmed);
    }
  }

  return words;
}

/**
 * Check if N-gram contains only stopwords
 */
function isStopwordOnly(ngram: string): boolean {
  const stopwords = new Set([
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who', 'whom',
    'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
    // Korean particles/endings (common ones)
    '은', '는', '이', '가', '을', '를', '에', '에서', '으로', '로', '와', '과',
    '의', '도', '만', '부터', '까지', '처럼', '같이', '보다', '하고',
    '그', '이', '저', '그것', '이것', '저것',
  ]);

  const words = ngram.split(' ');
  return words.every((w) => stopwords.has(w.toLowerCase()));
}

/**
 * Truncate content to show context around the N-gram
 */
function truncateContext(content: string, ngram: string): string {
  const maxLength = 100;
  const idx = content.toLowerCase().indexOf(ngram.toLowerCase());

  if (idx === -1) {
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + ngram.length + 30);

  let result = content.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < content.length) result = result + '...';

  return result;
}

// ============================================================================
// Pattern Building
// ============================================================================

/**
 * Build top patterns from N-gram map
 */
function buildTopPatterns(
  ngramMap: Map<string, NGramEntry>,
  totalMessages: number
): PhrasePattern[] {
  const patterns: PhrasePattern[] = [];

  for (const [phrase, entry] of ngramMap) {
    if (entry.frequency < MIN_FREQUENCY_THRESHOLD) continue;

    patterns.push({
      phrase,
      frequency: entry.frequency,
      percentageOfMessages: round((entry.frequency / totalMessages) * 100, 1),
      examples: entry.examples,
      sessionCount: entry.sessionIds.size,
    });
  }

  // Sort by frequency descending, then by phrase length (longer = more specific)
  patterns.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return b.phrase.length - a.phrase.length;
  });

  // Remove substrings of more frequent patterns
  const filtered = removeSubstringPatterns(patterns);

  return filtered.slice(0, MAX_TOP_PATTERNS);
}

/**
 * Remove patterns that are substrings of more frequent patterns
 */
function removeSubstringPatterns(patterns: PhrasePattern[]): PhrasePattern[] {
  const result: PhrasePattern[] = [];

  for (const pattern of patterns) {
    // Check if this pattern is a substring of any already-added pattern
    const isSubstring = result.some(
      (existing) =>
        existing.phrase.includes(pattern.phrase) && existing.frequency >= pattern.frequency
    );

    if (!isSubstring) {
      result.push(pattern);
    }
  }

  return result;
}

// ============================================================================
// Phrase Clustering
// ============================================================================

/**
 * Cluster similar phrases using Levenshtein distance
 */
function clusterSimilarPhrases(patterns: PhrasePattern[]): PhraseCluster[] {
  if (patterns.length === 0) return [];

  const clusters: PhraseCluster[] = [];
  const assigned = new Set<string>();

  // Sort by frequency to use most frequent as cluster representative
  const sorted = [...patterns].sort((a, b) => b.frequency - a.frequency);

  for (const pattern of sorted) {
    if (assigned.has(pattern.phrase)) continue;

    // Start a new cluster
    const cluster: PhraseCluster = {
      representative: pattern.phrase,
      variations: [pattern.phrase],
      totalFrequency: pattern.frequency,
      percentageOfMessages: pattern.percentageOfMessages,
      examples: [...pattern.examples],
    };
    assigned.add(pattern.phrase);

    // Find similar patterns
    for (const other of sorted) {
      if (assigned.has(other.phrase)) continue;
      if (pattern.phrase === other.phrase) continue;

      const similarity = calculateSimilarity(pattern.phrase, other.phrase);
      if (similarity >= SIMILARITY_THRESHOLD) {
        cluster.variations.push(other.phrase);
        cluster.totalFrequency += other.frequency;
        assigned.add(other.phrase);

        // Add unique examples
        for (const ex of other.examples) {
          if (cluster.examples.length < MAX_EXAMPLES && !cluster.examples.includes(ex)) {
            cluster.examples.push(ex);
          }
        }
      }
    }

    // Only include clusters with multiple variations OR high frequency
    if (cluster.variations.length > 1 || cluster.totalFrequency >= 3) {
      clusters.push(cluster);
    }
  }

  // Sort by total frequency
  clusters.sort((a, b) => b.totalFrequency - a.totalFrequency);

  return clusters.slice(0, MAX_CLUSTERS);
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

/**
 * Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all user messages from sessions with session ID
 */
function extractUserMessages(sessions: ParsedSession[]): Array<{ content: string; sessionId: string }> {
  const messages: Array<{ content: string; sessionId: string }> = [];

  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.role === 'user' && msg.content) {
        messages.push({
          content: msg.content,
          sessionId: session.sessionId,
        });
      }
    }
  }

  return messages;
}

/**
 * Round to specified decimal places
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// Format for LLM Prompt
// ============================================================================

/**
 * Format phrase pattern stats for inclusion in LLM prompt
 *
 * Returns a concise string summary that can be appended to the user prompt
 * to give the LLM pre-calculated statistics.
 */
export function formatPhraseStatsForPrompt(stats: PhrasePatternStats): string {
  const lines: string[] = [];

  lines.push('## PRE-CALCULATED PHRASE STATISTICS');
  lines.push(`Total messages analyzed: ${stats.totalMessages}`);
  lines.push(`Total sessions: ${stats.totalSessions}`);
  lines.push('');

  // Top patterns
  if (stats.topNGrams.length > 0) {
    lines.push('### Top Repeated Phrases (frequency >= 2)');
    for (const pattern of stats.topNGrams.slice(0, 10)) {
      const sessionInfo = pattern.sessionCount > 1 ? ` (${pattern.sessionCount} sessions)` : '';
      lines.push(`- "${pattern.phrase}": ${pattern.frequency}x${sessionInfo}`);
      if (pattern.examples.length > 0) {
        lines.push(`  Example: "${pattern.examples[0]}"`);
      }
    }
    lines.push('');
  }

  // Clusters
  if (stats.clusters.length > 0) {
    lines.push('### Similar Phrase Clusters');
    for (const cluster of stats.clusters.slice(0, 5)) {
      lines.push(`- "${cluster.representative}" cluster: ${cluster.totalFrequency}x total`);
      if (cluster.variations.length > 1) {
        lines.push(`  Variations: ${cluster.variations.slice(0, 3).map((v) => `"${v}"`).join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('Use these statistics to identify repeated command patterns. The counts are accurate - do not re-count.');

  return lines.join('\n');
}
