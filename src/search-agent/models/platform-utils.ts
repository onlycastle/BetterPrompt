/**
 * Platform Detection Utilities
 *
 * Shared functions for detecting source platforms from URLs.
 */

import { type SourcePlatform } from './knowledge.js';

/**
 * Detect the source platform from a URL
 *
 * @param url - The URL to analyze
 * @param fallback - Fallback platform if none detected (default: 'web')
 * @returns The detected SourcePlatform
 */
export function detectPlatformFromUrl(
  url: string,
  fallback: SourcePlatform = 'web'
): SourcePlatform {
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('linkedin.com')) return 'linkedin';
  return fallback;
}
