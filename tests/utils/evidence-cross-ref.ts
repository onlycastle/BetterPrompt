/**
 * Evidence Cross-Reference Utility
 *
 * Cross-references report evidence quotes against real user utterances
 * from JSONL session files to validate that the analysis pipeline only
 * cites things the user actually said.
 *
 * Reuses the same Dice-coefficient + token-coverage scoring that the
 * plugin's verify-evidence command uses, ensuring consistency between
 * the offline validation and the in-pipeline check.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

// ============================================================================
// Types
// ============================================================================

export interface EvidenceMatch {
  /** The quoted text extracted from the HTML report. */
  quote: string;
  /** The utterance-id from the evidence-meta `<code>` tag. */
  utteranceId: string;
  /** The domain section the evidence belongs to (e.g. "aiPartnership"). */
  domain: string;
  /** Best Dice-coefficient + token-coverage score against all utterances. */
  bestMatchScore: number;
  /** The utterance text that scored highest (undefined if no match). */
  bestMatchUtterance?: string;
}

export interface EvidenceValidationResult {
  totalEvidence: number;
  matched: EvidenceMatch[];
  unmatched: EvidenceMatch[];
  lowConfidence: EvidenceMatch[];
  domainBreakdown: Record<string, { total: number; matched: number; unmatched: number }>;
}

// ============================================================================
// Text scoring (mirrors packages/plugin/cli/commands/verify-evidence.ts)
// ============================================================================

function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter(token => token.length > 1);
}

function bigrams(text: string): string[] {
  const normalized = normalizeText(text).replace(/\s+/g, ' ');
  if (normalized.length < 2) return normalized ? [normalized] : [];
  const grams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    grams.push(normalized.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string): number {
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;

  const rightCounts = new Map<string, number>();
  for (const gram of rightBigrams) {
    rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  }

  let intersection = 0;
  for (const gram of leftBigrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count > 0) {
      intersection += 1;
      rightCounts.set(gram, count - 1);
    }
  }

  return (2 * intersection) / (leftBigrams.length + rightBigrams.length);
}

/**
 * Score how well `quote` matches `utterance`.
 *
 * Returns 0-100 using the same tiered logic as the plugin's verify-evidence
 * command: exact substring inclusion -> 100, high token overlap or bigram
 * similarity -> 85, etc.
 */
function scoreEvidence(quote: string, utterance: string): number {
  const normalizedQuote = normalizeText(quote);
  const normalizedUtterance = normalizeText(utterance);
  if (!normalizedQuote || !normalizedUtterance) return 0;

  // Exact substring match in either direction.
  if (
    normalizedUtterance.includes(normalizedQuote) ||
    normalizedQuote.includes(normalizedUtterance)
  ) {
    return 100;
  }

  const quoteTokens = tokenize(quote);
  const utteranceTokens = new Set(tokenize(utterance));
  if (quoteTokens.length === 0) return 0;

  const sharedTokens = quoteTokens.filter(token => utteranceTokens.has(token)).length;
  const tokenCoverage = sharedTokens / quoteTokens.length;
  const similarity = diceCoefficient(normalizedQuote, normalizedUtterance);

  if (tokenCoverage >= 0.85 || similarity >= 0.82) return 85;
  if (tokenCoverage >= 0.6 || similarity >= 0.65) return 65;
  if (tokenCoverage >= 0.4 || similarity >= 0.5) return 45;
  return 0;
}

// ============================================================================
// HTML Evidence Extraction
// ============================================================================

/**
 * Parse an HTML report string and extract every evidence quote, grouped by
 * the domain section it appears in.
 *
 * Expected HTML structure (from report-template.ts):
 * ```
 * <section class="domain-section" id="domain-aiPartnership">
 *   ...
 *   <details>
 *     <summary>Evidence (N)</summary>
 *     <ul class="evidence-list">
 *       <li class="evidence-item">
 *         <div class="evidence-quote">"quoted text"</div>
 *         <div class="evidence-context">optional context</div>
 *         <div class="evidence-meta"><code>utterance-id</code></div>
 *       </li>
 *     </ul>
 *   </details>
 *   ...
 * </section>
 * ```
 */
export function extractEvidenceFromHTML(html: string): EvidenceMatch[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const evidence: EvidenceMatch[] = [];

  // Iterate over each domain section to tag evidence with the domain name.
  const domainSections = Array.from(doc.querySelectorAll('section.domain-section'));

  for (const section of domainSections) {
    const sectionId = section.getAttribute('id') ?? '';
    // id is "domain-aiPartnership" -> domain is "aiPartnership"
    const domain = sectionId.startsWith('domain-')
      ? sectionId.slice('domain-'.length)
      : sectionId;

    const items = Array.from(section.querySelectorAll('.evidence-item'));
    for (const item of items) {
      const quoteEl = item.querySelector('.evidence-quote');
      const metaCodeEl = item.querySelector('.evidence-meta code');

      const rawQuote = quoteEl?.textContent?.trim() ?? '';
      // Strip surrounding quotes that the template adds.
      const quote = rawQuote.replace(/^"(.*)"$/, '$1');
      const utteranceId = metaCodeEl?.textContent?.trim() ?? '';

      if (quote || utteranceId) {
        evidence.push({
          quote,
          utteranceId,
          domain: domain || 'unknown',
          bestMatchScore: 0,
        });
      }
    }
  }

  return evidence;
}

// ============================================================================
// JSONL Parsing
// ============================================================================

/**
 * Extract plain-text content from a JSONL user message's content field.
 *
 * Content can be either a plain string or an array of content blocks.
 * Only text blocks contribute; tool_use and tool_result are ignored.
 */
function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: 'text'; text: string } =>
          typeof block === 'object' &&
          block !== null &&
          'type' in block &&
          block.type === 'text' &&
          'text' in block &&
          typeof block.text === 'string',
      )
      .map(block => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Parse all JSONL files in `sessionDir` and return a map of utterance-id to
 * the user's text.
 *
 * Each JSONL line with `type: "user"` is processed. The utterance ID format
 * used by the data extractor is `${sessionId}_${turnIndex}` where turnIndex
 * is the zero-based position of user messages in the session. To rebuild
 * these IDs we track a per-session user-message counter.
 *
 * If `jsonlPath` points to a single `.jsonl` file, only that file is parsed.
 * If it points to a directory, all `*.jsonl` files inside are parsed.
 */
export function parseUtterancesFromJSONL(jsonlPath: string): Map<string, string> {
  const utterances = new Map<string, string>();
  const files = getJSONLFiles(jsonlPath);

  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue; // Skip unreadable files.
    }

    const lines = content.split('\n');
    // Track per-session user turn indices to reconstruct utterance IDs.
    const sessionTurnIndex = new Map<string, number>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (parsed.type !== 'user') continue;

      const sessionId =
        typeof parsed.sessionId === 'string' ? parsed.sessionId : '';
      const message = parsed.message as
        | { role: string; content: unknown }
        | undefined;
      if (!message || message.role !== 'user') continue;

      const text = extractTextFromContent(message.content);
      if (!text.trim()) continue;

      const turnIndex = sessionTurnIndex.get(sessionId) ?? 0;
      sessionTurnIndex.set(sessionId, turnIndex + 1);
      const utteranceId = `${sessionId}_${turnIndex}`;

      utterances.set(utteranceId, text);
    }
  }

  return utterances;
}

/**
 * Resolve the list of JSONL files to parse.
 */
function getJSONLFiles(pathOrDir: string): string[] {
  try {
    const stats = statSync(pathOrDir);
    if (stats.isFile()) return [pathOrDir];
    if (stats.isDirectory()) {
      return readdirSync(pathOrDir)
        .filter((f: string) => f.endsWith('.jsonl'))
        .map((f: string) => join(pathOrDir, f));
    }
  } catch {
    // Path doesn't exist.
  }
  return [];
}

// ============================================================================
// Cross-Reference
// ============================================================================

/**
 * Match each evidence quote against the utterance map to determine whether the
 * quote can be attributed to an actual user utterance.
 *
 * Matching strategy:
 * 1. Direct lookup by utterance ID (fast path).
 * 2. If the direct-lookup score is below threshold, scan all utterances for the
 *    best match (handles cases where the LLM cited the wrong ID).
 *
 * @param threshold  Minimum score (0-100) to count as "matched". Default 50.
 * @param lowConfidenceMin  Scores between `lowConfidenceMin` and `threshold`
 *   are reported in the `lowConfidence` bucket. Default 30.
 */
export function crossReferenceEvidence(
  evidence: EvidenceMatch[],
  utterances: Map<string, string>,
  threshold = 50,
  lowConfidenceMin = 30,
): EvidenceValidationResult {
  const matched: EvidenceMatch[] = [];
  const unmatched: EvidenceMatch[] = [];
  const lowConfidence: EvidenceMatch[] = [];
  const domainBreakdown: Record<string, { total: number; matched: number; unmatched: number }> = {};

  for (const item of evidence) {
    let bestScore = 0;
    let bestUtterance: string | undefined;

    // Fast path: check the cited utterance ID first.
    const directUtterance = utterances.get(item.utteranceId);
    if (directUtterance) {
      bestScore = scoreEvidence(item.quote, directUtterance);
      bestUtterance = directUtterance;
    }

    // If the direct match is below threshold, scan all utterances.
    if (bestScore < threshold) {
      for (const [, text] of Array.from(utterances.entries())) {
        const score = scoreEvidence(item.quote, text);
        if (score > bestScore) {
          bestScore = score;
          bestUtterance = text;
          if (bestScore >= 85) break; // Good enough, stop scanning.
        }
      }
    }

    const result: EvidenceMatch = {
      ...item,
      bestMatchScore: bestScore,
      bestMatchUtterance: bestUtterance,
    };

    if (bestScore >= threshold) {
      matched.push(result);
    } else if (bestScore >= lowConfidenceMin) {
      lowConfidence.push(result);
    } else {
      unmatched.push(result);
    }

    // Update domain breakdown.
    if (!domainBreakdown[item.domain]) {
      domainBreakdown[item.domain] = { total: 0, matched: 0, unmatched: 0 };
    }
    domainBreakdown[item.domain].total += 1;
    if (bestScore >= threshold) {
      domainBreakdown[item.domain].matched += 1;
    } else {
      domainBreakdown[item.domain].unmatched += 1;
    }
  }

  return {
    totalEvidence: evidence.length,
    matched,
    unmatched,
    lowConfidence,
    domainBreakdown,
  };
}

// ============================================================================
// High-Level Convenience
// ============================================================================

/**
 * End-to-end validation: parse the HTML report, parse the JSONL session
 * files, and cross-reference all evidence.
 *
 * @param reportPath   Path to the HTML report file.
 * @param sessionDir   Path to the directory (or single file) containing JSONL
 *                     session data.
 * @param threshold    Minimum match score (0-100) to count as verified.
 */
export async function validateReportEvidence(
  reportPath: string,
  sessionDir: string,
  threshold = 50,
): Promise<EvidenceValidationResult> {
  const html = readFileSync(reportPath, 'utf-8');
  const evidence = extractEvidenceFromHTML(html);
  const utterances = parseUtterancesFromJSONL(sessionDir);
  return crossReferenceEvidence(evidence, utterances, threshold);
}
