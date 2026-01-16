/**
 * Gatherer Skill
 *
 * Collects information from web sources about AI engineering topics.
 * Uses WebSearch results and extracts structured metadata using LLM.
 */

import { randomUUID } from 'node:crypto';
import { BaseSkill, SkillResult, SkillConfig } from '../base-skill';
import {
  SearchQuery,
  SearchExecution,
  RawSearchResult,
  EnhancedSearchResult,
  ExtractedMetadata,
  SourcePlatform,
  detectPlatformFromUrl,
} from '../../models/index';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  EXTRACTION_TOOL,
} from './prompts';

/**
 * Web search result from external search (simulated structure)
 */
export interface WebSearchItem {
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
}

/**
 * Gatherer input - search parameters
 */
export interface GathererInput {
  query: SearchQuery;
  searchResults?: WebSearchItem[]; // Pre-fetched search results (for testing or when results come from WebSearch tool)
}

/**
 * Gatherer output - collected and enhanced results
 */
export interface GathererOutput {
  execution: SearchExecution;
  enhancedResults: EnhancedSearchResult[];
}

/**
 * Gatherer Skill - Collects information from web sources
 *
 * Responsibilities:
 * 1. Process search results (provided via input or mock)
 * 2. Extract structured metadata using LLM
 * 3. Deduplicate by URL
 * 4. Return enhanced results with extracted insights
 *
 * Note: In Claude Code context, WebSearch is called externally
 * and results are passed to this skill for processing.
 */
export class GathererSkill extends BaseSkill<GathererInput, GathererOutput> {
  readonly name = 'gatherer';
  readonly description = 'Gathers information from web sources about AI engineering topics';

  async execute(input: GathererInput): Promise<SkillResult<GathererOutput>> {
    const startTime = Date.now();

    try {
      // Use provided search results or generate mock for testing
      const searchItems = input.searchResults || this.generateMockResults(input.query);

      // Convert to raw results
      const rawResults = this.convertToRawResults(searchItems, input.query.platforms);

      // Deduplicate by URL
      const uniqueResults = this.deduplicateByUrl(rawResults);

      // Enhance results with LLM extraction (if API key available)
      let enhancedResults: EnhancedSearchResult[];
      if (this.hasLLMClient()) {
        enhancedResults = await this.enhanceResults(uniqueResults);
      } else {
        // Without LLM, create basic enhanced results
        enhancedResults = uniqueResults.map((r) => ({
          ...r,
          extracted: {
            mainTopic: 'other',
            keyInsights: [],
            codeSnippets: [],
            referencedTools: [],
          },
        }));
      }

      // Build execution record
      const execution: SearchExecution = {
        queryId: input.query.id,
        executedAt: new Date().toISOString(),
        results: rawResults,
        stats: {
          totalFound: uniqueResults.length,
          platformBreakdown: this.getPlatformBreakdown(uniqueResults),
          executionTimeMs: Date.now() - startTime,
        },
      };

      return {
        success: true,
        data: { execution, enhancedResults },
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Convert web search items to raw results
   */
  private convertToRawResults(
    items: WebSearchItem[],
    platforms: SourcePlatform[]
  ): RawSearchResult[] {
    const now = new Date().toISOString();

    return items.map((item) => ({
      platform: this.detectPlatform(item.url, platforms),
      url: item.url,
      title: item.title,
      content: item.content,
      publishedAt: item.publishedAt,
      fetchedAt: now,
    }));
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string, defaultPlatforms: SourcePlatform[]): SourcePlatform {
    return detectPlatformFromUrl(url, defaultPlatforms[0] || 'web');
  }

  /**
   * Deduplicate results by URL
   */
  private deduplicateByUrl(results: RawSearchResult[]): RawSearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      // Normalize URL for comparison
      const normalizedUrl = r.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(normalizedUrl)) return false;
      seen.add(normalizedUrl);
      return true;
    });
  }

  /**
   * Enhance results with LLM-extracted metadata
   */
  private async enhanceResults(
    results: RawSearchResult[]
  ): Promise<EnhancedSearchResult[]> {
    const enhanced: EnhancedSearchResult[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 3;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const batchPromises = batch.map((result) => this.extractMetadata(result));
      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const extracted = batchResults[j];
        if (extracted.status === 'fulfilled') {
          enhanced.push({
            ...batch[j],
            extracted: extracted.value,
          });
        } else {
          // Include without enhancement if extraction fails
          enhanced.push({
            ...batch[j],
            extracted: {
              mainTopic: 'other',
              keyInsights: [],
              codeSnippets: [],
              referencedTools: [],
            },
          });
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < results.length) {
        await this.sleep(500);
      }
    }

    return enhanced;
  }

  /**
   * Extract metadata from a single result using LLM
   */
  private async extractMetadata(result: RawSearchResult): Promise<ExtractedMetadata> {
    const response = await this.callLLM(
      EXTRACTION_SYSTEM_PROMPT,
      buildExtractionPrompt(result.title, result.content),
      {
        temperature: 0.1,
        maxTokens: 1000,
        tools: [EXTRACTION_TOOL],
        toolChoice: { type: 'tool', name: EXTRACTION_TOOL.name },
      }
    );

    const toolUse = this.extractToolUse(response);
    return toolUse.input as ExtractedMetadata;
  }

  /**
   * Get platform breakdown statistics
   */
  private getPlatformBreakdown(
    results: RawSearchResult[]
  ): Record<SourcePlatform, number> {
    const breakdown: Partial<Record<SourcePlatform, number>> = {};
    for (const result of results) {
      breakdown[result.platform] = (breakdown[result.platform] || 0) + 1;
    }
    return breakdown as Record<SourcePlatform, number>;
  }

  /**
   * Generate mock results for testing (when no real search results provided)
   */
  private generateMockResults(_query: SearchQuery): WebSearchItem[] {
    // This is used only when no search results are provided
    // In real usage, results come from WebSearch tool
    return [];
  }
}

/**
 * Factory function
 */
export function createGatherer(config?: SkillConfig): GathererSkill {
  return new GathererSkill(config);
}

/**
 * Create a search query with defaults
 */
export function createSearchQuery(
  terms: string[],
  options?: Partial<Omit<SearchQuery, 'id' | 'createdAt' | 'terms'>>
): SearchQuery {
  return {
    id: randomUUID(),
    terms,
    platforms: options?.platforms || ['web'],
    maxResults: options?.maxResults || 20,
    language: options?.language || 'en',
    createdAt: new Date().toISOString(),
    ...options,
  };
}
