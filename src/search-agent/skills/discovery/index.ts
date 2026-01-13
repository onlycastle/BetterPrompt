/**
 * Discovery Skill
 *
 * Discovers content and potential influencers from social media platforms.
 * Uses web search to find high-engagement content about AI engineering topics.
 */

import { randomUUID } from 'node:crypto';
import { BaseSkill, type SkillResult, type SkillConfig } from '../base-skill.js';
import {
  type SourcePlatform,
  type DiscoveredContent,
  type CandidateInfluencer,
  type DiscoveredAuthor,
  type DiscoveryTopic,
  type InfluencerPlatform,
  DISCOVERY_TOPICS,
  meetsEngagementThreshold,
  calculateEngagementScore,
  suggestCredibilityTier,
} from '../../models/index.js';

/**
 * Input for the Discovery skill
 */
export interface DiscoveryInput {
  // Web search results (from Claude's WebSearch tool or similar)
  searchResults: WebSearchResult[];

  // Discovery query that produced these results
  query: string;

  // Topic category for classification
  topic: DiscoveryTopic;
}

/**
 * Web search result structure
 */
export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  // Optional fields that may be available
  publishedDate?: string;
  author?: string;
}

/**
 * Output from the Discovery skill
 */
export interface DiscoveryOutput {
  // Discovered content items
  content: DiscoveredContent[];

  // Statistics
  stats: {
    totalResults: number;
    processedResults: number;
    contentExtracted: number;
    engagementFiltered: number;
    errors: number;
  };
}

/**
 * Content analysis tool for LLM
 */
const CONTENT_ANALYSIS_TOOL = {
  name: 'analyze_content',
  description: 'Extract structured information from web content',
  input_schema: {
    type: 'object' as const,
    properties: {
      author: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Author name or display name' },
          handle: { type: 'string', description: 'Username/handle (e.g., @username)' },
          profileUrl: { type: 'string', description: 'URL to author profile' },
        },
        required: ['name', 'handle'],
      },
      engagement: {
        type: 'object' as const,
        properties: {
          likes: { type: 'number', description: 'Number of likes/favorites (estimate from context)' },
          comments: { type: 'number', description: 'Number of comments/replies' },
          shares: { type: 'number', description: 'Number of shares/retweets' },
          views: { type: 'number', description: 'Number of views if available' },
        },
        required: ['likes', 'comments', 'shares'],
      },
      content: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Post title or first line' },
          text: { type: 'string', description: 'Main content text (up to 5000 chars)' },
          publishedAt: { type: 'string', description: 'Publication date in ISO format if available' },
        },
        required: ['text'],
      },
      topics: {
        type: 'array' as const,
        items: { type: 'string' },
        description: 'Detected topics/themes in the content',
      },
      isHighQuality: {
        type: 'boolean' as const,
        description: 'Whether this content appears to be high-quality and relevant to AI engineering',
      },
    },
    required: ['author', 'engagement', 'content', 'topics', 'isHighQuality'],
  },
};

/**
 * Discovery Skill implementation
 *
 * Processes web search results to extract:
 * - Author information
 * - Engagement metrics
 * - Content analysis
 * - Topic classification
 */
export class DiscoverySkill extends BaseSkill<DiscoveryInput, DiscoveryOutput> {
  readonly name = 'discovery';
  readonly description = 'Discovers content and influencers from web search results';

  constructor(config: SkillConfig = {}) {
    super(config);
  }

  async execute(input: DiscoveryInput): Promise<SkillResult<DiscoveryOutput>> {
    const startTime = Date.now();
    const content: DiscoveredContent[] = [];
    const stats = {
      totalResults: input.searchResults.length,
      processedResults: 0,
      contentExtracted: 0,
      engagementFiltered: 0,
      errors: 0,
    };

    try {
      // Process each search result
      for (const result of input.searchResults) {
        stats.processedResults++;

        try {
          const extracted = await this.analyzeContent(result, input.query, input.topic);

          if (extracted) {
            stats.contentExtracted++;

            // Check engagement threshold
            const platform = this.detectPlatform(result.url);
            if (meetsEngagementThreshold(extracted.engagement, platform)) {
              content.push(extracted);
              stats.engagementFiltered++;
            }
          }
        } catch (error) {
          stats.errors++;
          // Continue processing other results
        }

        // Add delay between LLM calls to avoid rate limiting
        if (this.hasLLMClient() && stats.processedResults % 3 === 0) {
          await this.sleep(500);
        }
      }

      return {
        success: true,
        data: { content, stats },
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Analyze a single search result to extract structured content
   */
  private async analyzeContent(
    result: WebSearchResult,
    query: string,
    topic: DiscoveryTopic
  ): Promise<DiscoveredContent | null> {
    if (!this.hasLLMClient()) {
      // Without LLM, create basic content from search result
      return this.createBasicContent(result, query, topic);
    }

    const systemPrompt = `You are analyzing web content to extract structured information about AI engineering topics.

The content is from a search for: "${query}"
Topic category: ${DISCOVERY_TOPICS[topic].displayName}

Extract the author information, engagement metrics, and content details.
If engagement numbers aren't explicitly shown, estimate based on context clues (e.g., "viral post" = high engagement, "reply" = lower engagement).

For tweets/X posts: likes typically range from 0-10000+, with 500+ being notable.
For Reddit: upvotes range from 0-50000+, with 500+ being notable.
For YouTube: views range from hundreds to millions.

Be conservative in estimates if unsure.`;

    const userPrompt = `URL: ${result.url}
Title: ${result.title}
Snippet: ${result.snippet}
${result.publishedDate ? `Published: ${result.publishedDate}` : ''}
${result.author ? `Author: ${result.author}` : ''}

Analyze this content and extract structured information.`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, {
        tools: [CONTENT_ANALYSIS_TOOL],
        toolChoice: { type: 'tool', name: 'analyze_content' },
        temperature: 0.2,
        maxTokens: 2000,
      });

      const toolUse = this.extractToolUse(response);
      const analysis = toolUse.input as {
        author: { name: string; handle: string; profileUrl?: string };
        engagement: { likes: number; comments: number; shares: number; views?: number };
        content: { title?: string; text: string; publishedAt?: string };
        topics: string[];
        isHighQuality: boolean;
      };

      // Skip low-quality content
      if (!analysis.isHighQuality) {
        return null;
      }

      return {
        id: randomUUID(),
        url: result.url,
        platform: this.detectPlatform(result.url),
        author: {
          name: analysis.author.name,
          handle: analysis.author.handle.replace('@', ''),
          profileUrl: analysis.author.profileUrl,
        },
        engagement: {
          likes: analysis.engagement.likes,
          comments: analysis.engagement.comments,
          shares: analysis.engagement.shares,
          views: analysis.engagement.views,
        },
        title: analysis.content.title || result.title,
        text: analysis.content.text,
        publishedAt: analysis.content.publishedAt || new Date().toISOString(),
        discoveryQuery: query,
        discoveryTopic: topic,
        fetchedAt: new Date().toISOString(),
        detectedTopics: analysis.topics,
        processed: false,
      };
    } catch {
      // Fallback to basic content on error
      return this.createBasicContent(result, query, topic);
    }
  }

  /**
   * Create basic content without LLM analysis
   */
  private createBasicContent(
    result: WebSearchResult,
    query: string,
    topic: DiscoveryTopic
  ): DiscoveredContent {
    const platform = this.detectPlatform(result.url);
    const author = this.extractAuthorFromUrl(result.url, platform) || {
      name: result.author || 'Unknown',
      handle: 'unknown',
    };

    return {
      id: randomUUID(),
      url: result.url,
      platform,
      author,
      engagement: {
        likes: 0,
        comments: 0,
        shares: 0,
      },
      title: result.title,
      text: result.snippet,
      publishedAt: result.publishedDate || new Date().toISOString(),
      discoveryQuery: query,
      discoveryTopic: topic,
      fetchedAt: new Date().toISOString(),
      detectedTopics: [],
      processed: false,
    };
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): SourcePlatform {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'twitter';
    }
    if (urlLower.includes('reddit.com')) {
      return 'reddit';
    }
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'youtube';
    }
    if (urlLower.includes('linkedin.com')) {
      return 'linkedin';
    }
    if (urlLower.includes('threads.net')) {
      return 'threads';
    }

    return 'web';
  }

  /**
   * Extract author handle from URL
   */
  private extractAuthorFromUrl(
    url: string,
    platform: SourcePlatform
  ): DiscoveredAuthor | null {
    const patterns: Record<string, RegExp> = {
      twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
      reddit: /reddit\.com\/(?:user|u)\/([a-zA-Z0-9_-]+)/,
      youtube: /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      linkedin: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/,
    };

    const pattern = patterns[platform];
    if (!pattern) return null;

    const match = url.match(pattern);
    if (!match) return null;

    return {
      name: match[1],
      handle: match[1],
      profileUrl: url.split('/').slice(0, 4).join('/'),
    };
  }
}

/**
 * Aggregate discovered content into candidate influencers
 */
export function aggregateInfluencers(
  content: DiscoveredContent[]
): CandidateInfluencer[] {
  // Group content by author handle
  const authorMap = new Map<
    string,
    {
      contents: DiscoveredContent[];
      platforms: Set<SourcePlatform>;
    }
  >();

  for (const item of content) {
    const key = item.author.handle.toLowerCase();
    if (!authorMap.has(key)) {
      authorMap.set(key, { contents: [], platforms: new Set() });
    }
    const entry = authorMap.get(key)!;
    entry.contents.push(item);
    entry.platforms.add(item.platform);
  }

  // Convert to candidate influencers
  const candidates: CandidateInfluencer[] = [];

  for (const [handle, data] of authorMap.entries()) {
    // Need at least 2 high-engagement posts to be a candidate
    if (data.contents.length < 2) continue;

    const totalEngagement = data.contents.reduce(
      (sum, c) => sum + calculateEngagementScore(c.engagement),
      0
    );
    const avgEngagement = totalEngagement / data.contents.length;

    // Aggregate topics
    const topicCounts = new Map<string, number>();
    for (const item of data.contents) {
      for (const topic of item.detectedTopics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    }
    const sortedTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topTopics = sortedTopics.map(([topic]) => topic);
    const topicBreakdown: Record<string, number> = {};
    const totalTopicMentions = sortedTopics.reduce((sum, [, count]) => sum + count, 0);
    for (const [topic, count] of sortedTopics) {
      topicBreakdown[topic] = Math.round((count / totalTopicMentions) * 100);
    }

    // Build platform identifiers (map SourcePlatform to InfluencerPlatform)
    const platformMap: Record<SourcePlatform, InfluencerPlatform | null> = {
      twitter: 'twitter',
      reddit: 'reddit',
      youtube: 'youtube',
      linkedin: 'linkedin',
      web: 'web',
      threads: null, // Not supported in InfluencerPlatform
      manual: null,  // Not supported in InfluencerPlatform
    };

    const identifiers = Array.from(data.platforms)
      .map((platform) => {
        const mappedPlatform = platformMap[platform];
        if (!mappedPlatform) return null;
        return { platform: mappedPlatform, handle };
      })
      .filter((id): id is { platform: InfluencerPlatform; handle: string } => id !== null);

    // Skip if no valid identifiers
    if (identifiers.length === 0) continue;

    // Get sample content
    const sortedContent = [...data.contents].sort(
      (a, b) =>
        calculateEngagementScore(b.engagement) -
        calculateEngagementScore(a.engagement)
    );

    // Get most recent content date
    const dates = data.contents
      .map((c) => new Date(c.publishedAt).getTime())
      .filter((d) => !isNaN(d));
    const lastContentAt = dates.length > 0
      ? new Date(Math.max(...dates)).toISOString()
      : new Date().toISOString();

    // Get first content's follower count if available
    const followerCount = data.contents[0]?.author.followerCount;

    candidates.push({
      name: data.contents[0].author.name,
      handles: identifiers,
      contentCount: data.contents.length,
      totalEngagement,
      avgEngagement,
      topTopics,
      topicBreakdown,
      suggestedTier: suggestCredibilityTier(avgEngagement, data.contents.length, followerCount),
      tierReasoning: `Based on ${data.contents.length} posts with avg engagement of ${Math.round(avgEngagement)}`,
      sampleUrls: sortedContent.slice(0, 5).map((c) => c.url),
      sampleTitles: sortedContent.slice(0, 5).map((c) => c.title || ''),
      discoveredAt: new Date().toISOString(),
      lastContentAt,
    });
  }

  // Sort by average engagement
  return candidates.sort((a, b) => b.avgEngagement - a.avgEngagement);
}

/**
 * Create a new Discovery skill instance
 */
export function createDiscoverySkill(config?: SkillConfig): DiscoverySkill {
  return new DiscoverySkill(config);
}

// Re-export queries module
export { generateSearchQueries, getTopicQueries, estimateQueryCount } from './queries.js';
export type { SearchQueryDef } from './queries.js';
