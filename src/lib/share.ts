/**
 * Share Utilities
 *
 * Helper functions for generating shareable content:
 * - Pre-filled social posts
 * - LinkedIn posts
 * - Copy-to-clipboard text
 */

import type { TypeResult } from './models/coding-style';
import { TYPE_METADATA } from './models/coding-style';

/**
 * Base URL for share links (configure in env)
 */
const BASE_URL = process.env.NOSLOP_BASE_URL || 'http://localhost:3000';

/**
 * Generate Twitter/X share URL with pre-filled tweet
 */
export function generateTwitterShareUrl(
  typeResult: TypeResult,
  reportId: string,
  options: { includeHashtags?: boolean } = {}
): string {
  const { includeHashtags = true } = options;

  const meta = TYPE_METADATA[typeResult.primaryType];
  const shareUrl = `${BASE_URL}/r/${reportId}`;

  // Get top strength from the type
  const topStrength = meta.strengths[0];

  // Build tweet text
  let tweetText = `I'm a ${meta.name} ${meta.emoji} builder!

My self-hosted NoMoreAISlop profile:
"${meta.tagline}"

Top Strength: ${topStrength}

See the full report:
${shareUrl}`;

  if (includeHashtags) {
    tweetText += `

#NoMoreAISlop #AICollaboration #SelfHosted`;
  }

  // Encode for URL
  const encodedText = encodeURIComponent(tweetText);

  return `https://twitter.com/intent/tweet?text=${encodedText}`;
}

/**
 * Generate LinkedIn share URL
 */
export function generateLinkedInShareUrl(reportId: string): string {
  const shareUrl = `${BASE_URL}/r/${reportId}`;
  const encodedUrl = encodeURIComponent(shareUrl);

  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
}

/**
 * Generate copy-to-clipboard text
 */
export function generateCopyText(
  typeResult: TypeResult,
  reportId: string,
  options: { includeStats?: boolean } = {}
): string {
  const { includeStats = false } = options;

  const meta = TYPE_METADATA[typeResult.primaryType];
  const percentage = Math.round(typeResult.distribution[typeResult.primaryType] || 0);
  const shareUrl = `${BASE_URL}/r/${reportId}`;

  let text = `🎯 My NoMoreAISlop profile: ${meta.name} ${meta.emoji}

"${meta.tagline}"`;

  if (includeStats) {
    text += `

Match: ${percentage}%
Top Strength: ${meta.strengths[0]}`;
  }

  text += `

Check out my full analysis: ${shareUrl}

#NoMoreAISlop`;

  return text;
}

/**
 * Generate Open Graph meta tags for HTML head
 */
export function generateOGMetaTags(
  typeResult: TypeResult,
  reportId: string,
  options: { baseUrl?: string } = {}
): string {
  const { baseUrl = BASE_URL } = options;

  const meta = TYPE_METADATA[typeResult.primaryType];
  const shareUrl = `${baseUrl}/r/${reportId}`;
  const ogImageUrl = `${baseUrl}/r/${reportId}/opengraph-image`;

  const title = `I'm a ${meta.name} ${meta.emoji} builder`;
  const description = meta.tagline;

  return `
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Additional meta -->
  <meta name="description" content="${description}">
  <link rel="canonical" href="${shareUrl}">
  `.trim();
}

/**
 * Generate share data for Web Share API
 */
export function generateWebShareData(
  typeResult: TypeResult,
  reportId: string
): { title: string; text: string; url: string } {
  const meta = TYPE_METADATA[typeResult.primaryType];
  const shareUrl = `${BASE_URL}/r/${reportId}`;

  return {
    title: `My NoMoreAISlop Profile: ${meta.name} ${meta.emoji}`,
    text: `${meta.tagline} - What does your workflow look like?`,
    url: shareUrl,
  };
}

/**
 * Generate Instagram-ready caption for clipboard copy
 */
export function generateInstagramCaption(
  typeResult: TypeResult,
  reportId: string
): string {
  const meta = TYPE_METADATA[typeResult.primaryType];
  const shareUrl = `${BASE_URL}/r/${reportId}`;
  const topStrength = meta.strengths[0];

  return `${meta.emoji} I'm a ${meta.name} builder on NoMoreAISlop!

"${meta.tagline}"

💪 Top Strength: ${topStrength}

🔗 See my full analysis: ${shareUrl}

#NoMoreAISlop #AICollaboration #SelfHosted #${meta.name} #DevTools`;
}

/**
 * Generate embed code for blogs/websites
 */
export function generateEmbedCode(
  _typeResult: TypeResult,
  reportId: string,
  options: { width?: number; height?: number } = {}
): string {
  const { width = 400, height = 300 } = options;
  const embedUrl = `${BASE_URL}/embed/${reportId}`;

  return `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #333;"
  title="NoMoreAISlop Analysis"
></iframe>`;
}
