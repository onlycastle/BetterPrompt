/**
 * Lightweight KB Loader
 *
 * Loads knowledge items from ~/.betterprompt/knowledge/items/*.json
 * and converts them to the PortableKnowledgeItem format expected by
 * the KB matcher. Designed for use in the plugin's report assembly.
 *
 * Provides both sync and async variants:
 * - Sync: for callers that need synchronous loading (e.g., assembleCanonicalRun)
 * - Async: for callers that can await (future use)
 *
 * This is a simple file-based loader — no database or repository needed.
 * Returns empty arrays if the knowledge directory doesn't exist or has
 * no items (graceful degradation, not an error).
 *
 * @module @betterprompt/shared/matching/kb-loader
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { PortableKnowledgeItem, PortableProfessionalInsight } from './knowledge-resource-matcher.js';

// ============================================================================
// Paths
// ============================================================================

const KNOWLEDGE_BASE_PATH = join(homedir(), '.betterprompt', 'knowledge');
const ITEMS_PATH = join(KNOWLEDGE_BASE_PATH, 'items');

// ============================================================================
// Knowledge Item Parser (shared logic)
// ============================================================================

/**
 * Parse a raw knowledge item JSON object into PortableKnowledgeItem format.
 * Returns null if the item is invalid (missing required fields).
 */
function parseKnowledgeItem(item: Record<string, unknown>): PortableKnowledgeItem | null {
  // Minimal validation: must have id, title, summary
  if (
    typeof item.id !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.summary !== 'string'
  ) return null;

  const source = item.source as Record<string, unknown> | undefined;
  const relevance = item.relevance as Record<string, unknown> | undefined;

  // Extract source credibility metadata for authority scoring.
  // These fields flow through the portable format so the matcher
  // can apply credibility multipliers without re-reading disk.
  const sourcePlatform = (source?.platform as string) ?? undefined;
  const credibilityTier = (source?.credibilityTier as string) ?? undefined;
  const validTiers = ['high', 'medium', 'standard'];

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    sourceUrl: (source?.url as string) ?? '',
    sourceAuthor: (source?.author as string) ?? 'Unknown',
    contentType: (item.contentType as string) ?? 'insight',
    tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string') : [],
    applicableDimensions: Array.isArray(item.applicableDimensions)
      ? item.applicableDimensions.filter((d): d is string => typeof d === 'string')
      : [],
    subCategories: (item.subCategories as Record<string, string[]>) ?? undefined,
    relevanceScore: typeof relevance?.score === 'number' ? relevance.score : 0.5,
    sourcePlatform: sourcePlatform,
    credibilityTier: (credibilityTier && validTiers.includes(credibilityTier))
      ? credibilityTier as 'high' | 'medium' | 'standard'
      : undefined,
  };
}

// ============================================================================
// Sync Loader (for plugin report assembly)
// ============================================================================

/**
 * Load all knowledge items from disk synchronously.
 *
 * Reads ~/.betterprompt/knowledge/items/*.json, validates minimally,
 * and converts to PortableKnowledgeItem[].
 *
 * Returns empty array if the knowledge directory doesn't exist (legitimate
 * "no data" case — not an error). Individual file parse failures are logged
 * to stderr and skipped so one corrupt file doesn't block all KB items.
 */
export function loadKnowledgeItemsFromDiskSync(): PortableKnowledgeItem[] {
  let files: string[];
  try {
    files = readdirSync(ITEMS_PATH);
  } catch {
    // Directory doesn't exist — no KB items available (not an error)
    return [];
  }

  const jsonFiles = files.filter(f => f.endsWith('.json'));
  if (jsonFiles.length === 0) return [];

  const items: PortableKnowledgeItem[] = [];

  for (const file of jsonFiles) {
    try {
      const raw = readFileSync(join(ITEMS_PATH, file), 'utf-8');
      const item = JSON.parse(raw) as Record<string, unknown>;
      const parsed = parseKnowledgeItem(item);
      if (parsed) items.push(parsed);
    } catch (err) {
      // Surface parse failures per No Fallback Policy — log and continue
      // so one corrupt file doesn't block all KB items
      console.warn(`[kb-loader] Failed to parse ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
  }

  return items;
}

// Backward-compatible async wrapper
export async function loadKnowledgeItemsFromDisk(): Promise<PortableKnowledgeItem[]> {
  return loadKnowledgeItemsFromDiskSync();
}

/**
 * Load professional insights from disk (placeholder).
 *
 * Professional insights are currently managed server-side.
 * Returns empty array — the enricher handles empty arrays gracefully.
 */
export function loadProfessionalInsightsFromDiskSync(): PortableProfessionalInsight[] {
  return [];
}

// Backward-compatible async wrapper
export async function loadProfessionalInsightsFromDisk(): Promise<PortableProfessionalInsight[]> {
  return loadProfessionalInsightsFromDiskSync();
}
