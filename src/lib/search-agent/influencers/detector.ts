/**
 * Influencer Detector
 *
 * Detects known influencers from content metadata (URLs, author names, handles).
 * Uses the local influencer registry for persistence.
 */

import {
  Influencer,
  InfluencerMatch,
  InfluencerPlatform,
  CredibilityTier,
  normalizeHandle,
  extractHandleFromUrl,
} from '../models/influencer';
import { influencerDb } from '../db/index';
import { SourcePlatform } from '../models/knowledge';

/**
 * Map SourcePlatform to InfluencerPlatform
 */
const PLATFORM_MAP: Record<SourcePlatform, InfluencerPlatform | null> = {
  twitter: 'twitter',
  reddit: 'reddit',
  youtube: 'youtube',
  linkedin: 'linkedin',
  threads: null, // No direct mapping
  web: 'web',
  manual: null,
};

/**
 * Influencer detection result
 */
export interface DetectionResult {
  found: boolean;
  influencer?: Influencer;
  match?: InfluencerMatch;
  credibilityBoost: number; // 0-0.3 boost to add to relevance score
}

/**
 * Influencer Detector
 *
 * Detects tracked influencers from content metadata.
 * All methods are async to support database queries.
 */
export class InfluencerDetector {
  /**
   * Detect influencer from URL
   */
  async detectFromUrl(url: string, platform?: SourcePlatform): Promise<DetectionResult> {
    // Try to detect platform from URL if not provided
    const detectedPlatform = platform || this.detectPlatformFromUrl(url);
    const influencerPlatform = detectedPlatform
      ? PLATFORM_MAP[detectedPlatform]
      : null;

    if (!influencerPlatform) {
      return { found: false, credibilityBoost: 0 };
    }

    // Extract handle from URL
    const handle = extractHandleFromUrl(url, influencerPlatform);
    if (!handle) {
      return { found: false, credibilityBoost: 0 };
    }

    // Search for influencer
    const influencer = await influencerDb.findByHandle(influencerPlatform, handle);
    if (!influencer || !influencer.isActive) {
      return { found: false, credibilityBoost: 0 };
    }

    return this.buildResult(influencer, {
      platform: influencerPlatform,
      handle,
    });
  }

  /**
   * Detect influencer from author name or handle
   */
  async detectFromAuthor(
    author: string,
    authorHandle?: string,
    platform?: SourcePlatform
  ): Promise<DetectionResult> {
    // Try handle first (more precise)
    if (authorHandle && platform) {
      const influencerPlatform = PLATFORM_MAP[platform];
      if (influencerPlatform) {
        const influencer = await influencerDb.findByHandle(
          influencerPlatform,
          authorHandle
        );
        if (influencer && influencer.isActive) {
          return this.buildResult(influencer, {
            platform: influencerPlatform,
            handle: authorHandle,
          });
        }
      }
    }

    // Try name match
    const influencer = await influencerDb.findByName(author);
    if (influencer && influencer.isActive) {
      return this.buildResult(influencer, influencer.identifiers[0]);
    }

    // Try partial name match
    const normalizedAuthor = author.toLowerCase();
    const allInfluencers = await influencerDb.findActive();

    for (const inf of allInfluencers) {
      // Check if author name contains influencer name or vice versa
      if (
        normalizedAuthor.includes(inf.name.toLowerCase()) ||
        inf.name.toLowerCase().includes(normalizedAuthor)
      ) {
        return this.buildResult(inf, inf.identifiers[0], 0.8);
      }

      // Check handles
      for (const identifier of inf.identifiers) {
        if (normalizeHandle(identifier.handle) === normalizeHandle(author)) {
          return this.buildResult(inf, identifier);
        }
      }
    }

    return { found: false, credibilityBoost: 0 };
  }

  /**
   * Detect influencer from multiple signals
   */
  async detect(
    url?: string,
    author?: string,
    authorHandle?: string,
    platform?: SourcePlatform
  ): Promise<DetectionResult> {
    // Try URL first (most reliable)
    if (url) {
      const urlResult = await this.detectFromUrl(url, platform);
      if (urlResult.found) {
        return urlResult;
      }
    }

    // Try author info
    if (author || authorHandle) {
      return this.detectFromAuthor(author || '', authorHandle, platform);
    }

    return { found: false, credibilityBoost: 0 };
  }

  /**
   * Build detection result with credibility boost
   */
  private buildResult(
    influencer: Influencer,
    matchedOn: { platform: InfluencerPlatform; handle: string },
    confidence: number = 1.0
  ): DetectionResult {
    const credibilityBoost = this.calculateCredibilityBoost(
      influencer.credibilityTier,
      confidence
    );

    return {
      found: true,
      influencer,
      match: {
        influencer,
        matchedOn,
        confidence,
      },
      credibilityBoost,
    };
  }

  /**
   * Calculate credibility boost based on tier and confidence
   */
  private calculateCredibilityBoost(
    tier: CredibilityTier,
    confidence: number
  ): number {
    const tierBoosts: Record<CredibilityTier, number> = {
      high: 0.25,
      medium: 0.15,
      standard: 0.05,
    };

    return tierBoosts[tier] * confidence;
  }

  /**
   * Detect platform from URL
   */
  private detectPlatformFromUrl(url: string): SourcePlatform | null {
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('threads.net')) return 'threads';
    return 'web';
  }

  /**
   * Get all tracked influencers for a platform
   */
  async getInfluencersForPlatform(platform: SourcePlatform): Promise<Influencer[]> {
    const influencerPlatform = PLATFORM_MAP[platform];
    if (!influencerPlatform) return [];

    const activeInfluencers = await influencerDb.findActive();
    return activeInfluencers.filter((inf) =>
      inf.identifiers.some((id) => id.platform === influencerPlatform)
    );
  }

  /**
   * Check if a URL or author represents a tracked influencer
   */
  async isTrackedInfluencer(
    url?: string,
    author?: string,
    authorHandle?: string,
    platform?: SourcePlatform
  ): Promise<boolean> {
    const result = await this.detect(url, author, authorHandle, platform);
    return result.found;
  }
}

// Singleton instance
let detectorInstance: InfluencerDetector | null = null;

/**
 * Get the singleton influencer detector
 */
export function getInfluencerDetector(): InfluencerDetector {
  if (!detectorInstance) {
    detectorInstance = new InfluencerDetector();
  }
  return detectorInstance;
}

/**
 * Create a new detector instance (for testing)
 */
export function createInfluencerDetector(): InfluencerDetector {
  return new InfluencerDetector();
}
