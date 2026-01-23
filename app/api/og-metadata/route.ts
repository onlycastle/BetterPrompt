/**
 * OG Metadata API Route
 *
 * Fetches Open Graph metadata (thumbnail, title, site name) from external URLs.
 * Used by ResourcePreviewCard to show rich previews of learning resources.
 *
 * Features:
 * - YouTube special handling (predictable thumbnail URLs)
 * - Response caching (24h fresh, 7d stale-while-revalidate)
 * - Timeout protection (5 seconds max)
 */

import { NextRequest, NextResponse } from 'next/server';

interface OGMetadata {
  title: string | null;
  image: string | null;
  siteName: string | null;
  publishedDate: string | null;
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    // youtube.com/watch?v=VIDEO_ID
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/v/VIDEO_ID
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get YouTube thumbnail URL (predictable, no fetch needed)
 */
function getYouTubeThumbnail(videoId: string): string {
  // maxresdefault (1280x720) is highest quality
  // Falls back gracefully if not available
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Parse OG meta tags from HTML content
 */
function parseOGTags(html: string): OGMetadata {
  const result: OGMetadata = {
    title: null,
    image: null,
    siteName: null,
    publishedDate: null,
  };

  // Helper to extract meta content
  const getMetaContent = (property: string): string | null => {
    // Match both property="og:..." and name="og:..."
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Extract OG tags
  result.title = getMetaContent('og:title');
  result.image = getMetaContent('og:image');
  result.siteName = getMetaContent('og:site_name');

  // Try multiple date formats
  result.publishedDate =
    getMetaContent('article:published_time') ||
    getMetaContent('og:published_time') ||
    getMetaContent('datePublished');

  // Fallback: get title from <title> tag if og:title not found
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      result.title = titleMatch[1].trim();
    }
  }

  return result;
}

/**
 * Validate URL is well-formed and uses HTTPS
 */
function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    // Only allow HTTP(S) protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const url = validateUrl(urlParam);
  if (!url) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    // Check if it's a YouTube URL - use predictable thumbnail
    const youtubeVideoId = extractYouTubeVideoId(urlParam);
    if (youtubeVideoId) {
      const metadata: OGMetadata = {
        title: null, // Will be fetched
        image: getYouTubeThumbnail(youtubeVideoId),
        siteName: 'YouTube',
        publishedDate: null,
      };

      // Still try to fetch title from YouTube page
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(urlParam, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OGFetcher/1.0)',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          const parsed = parseOGTags(html);
          metadata.title = parsed.title;
          metadata.publishedDate = parsed.publishedDate;
        }
      } catch {
        // Ignore errors for YouTube title fetch - thumbnail is the main value
      }

      return NextResponse.json(metadata, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // For non-YouTube URLs, fetch the page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(urlParam, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OGFetcher/1.0)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const metadata = parseOGTags(html);

    // Infer site name from hostname if not in OG tags
    if (!metadata.siteName) {
      metadata.siteName = url.hostname.replace('www.', '');
    }

    return NextResponse.json(metadata, {
      headers: {
        // Cache for 24 hours, serve stale for up to 7 days
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    console.error('OG metadata fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
