/**
 * YouTube API Utilities
 *
 * Functions for fetching YouTube video transcripts and metadata.
 * Uses youtube-transcript package for caption extraction.
 */

import {
  YouTubeVideo,
  YouTubeTranscript,
  TranscriptSegment,
  YouTubePlaylist,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
} from './types';

/**
 * Transcript fetch error
 */
export class TranscriptError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'DISABLED' | 'FETCH_ERROR' | 'PARSE_ERROR',
    public readonly videoId?: string
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}

/**
 * Raw transcript item from youtube-transcript package
 */
interface RawTranscriptItem {
  text: string;
  offset: number; // milliseconds
  duration: number; // milliseconds
}

/**
 * Fetch transcript for a YouTube video
 *
 * @param videoIdOrUrl - YouTube video ID or URL
 * @returns YouTubeTranscript with video metadata and segments
 */
export async function fetchTranscript(videoIdOrUrl: string): Promise<YouTubeTranscript> {
  const videoId = parseYouTubeVideoId(videoIdOrUrl);
  if (!videoId) {
    throw new TranscriptError(
      `Invalid YouTube URL or video ID: ${videoIdOrUrl}`,
      'PARSE_ERROR'
    );
  }

  try {
    // Dynamic import for youtube-transcript package
    const { YoutubeTranscript } = await import('youtube-transcript');

    // Fetch transcript
    const rawTranscript: RawTranscriptItem[] = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      throw new TranscriptError(
        `No transcript available for video: ${videoId}`,
        'NOT_FOUND',
        videoId
      );
    }

    // Convert to our segment format
    const segments: TranscriptSegment[] = rawTranscript.map((item) => ({
      text: item.text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      start: item.offset / 1000, // Convert ms to seconds
      duration: item.duration / 1000,
    }));

    // Build full text
    const fullText = segments.map((s) => s.text).join(' ');

    // Fetch video metadata via oEmbed API (no API key required)
    const video = await fetchVideoMetadata(videoId);

    return {
      video,
      segments,
      fullText,
      language: 'en', // Default, could be detected
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle common youtube-transcript errors
    if (errorMessage.includes('disabled')) {
      throw new TranscriptError(
        `Transcripts are disabled for video: ${videoId}`,
        'DISABLED',
        videoId
      );
    }

    if (errorMessage.includes('not found') || errorMessage.includes('unavailable')) {
      throw new TranscriptError(
        `Video not found or unavailable: ${videoId}`,
        'NOT_FOUND',
        videoId
      );
    }

    throw new TranscriptError(
      `Failed to fetch transcript: ${errorMessage}`,
      'FETCH_ERROR',
      videoId
    );
  }
}

/**
 * Fetch video metadata using YouTube oEmbed API
 */
async function fetchVideoMetadata(videoId: string): Promise<YouTubeVideo> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  try {
    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      // Return basic metadata if oEmbed fails
      return {
        videoId,
        title: `YouTube Video ${videoId}`,
        channelName: 'Unknown',
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }

    const data = await response.json() as { title?: string; author_name?: string };

    return {
      videoId,
      title: data.title || `YouTube Video ${videoId}`,
      channelName: data.author_name || 'Unknown',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    // Return basic metadata on error
    return {
      videoId,
      title: `YouTube Video ${videoId}`,
      channelName: 'Unknown',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }
}

/**
 * Fetch video IDs from a YouTube playlist
 *
 * Note: This is a simplified implementation that extracts video IDs
 * from the playlist page HTML. For production use, consider using
 * the official YouTube Data API.
 */
export async function fetchPlaylistVideoIds(playlistIdOrUrl: string): Promise<string[]> {
  const playlistId = parseYouTubePlaylistId(playlistIdOrUrl) || playlistIdOrUrl;

  if (!playlistId) {
    throw new TranscriptError(
      `Invalid playlist URL or ID: ${playlistIdOrUrl}`,
      'PARSE_ERROR'
    );
  }

  try {
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const response = await fetch(playlistUrl);

    if (!response.ok) {
      throw new TranscriptError(
        `Playlist not found: ${playlistId}`,
        'NOT_FOUND'
      );
    }

    const html = await response.text();

    // Extract video IDs from playlist page
    // Look for "videoId":"..." patterns in the page data
    const videoIdPattern = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const videoIds = new Set<string>();

    let match;
    while ((match = videoIdPattern.exec(html)) !== null) {
      videoIds.add(match[1]);
    }

    if (videoIds.size === 0) {
      throw new TranscriptError(
        `No videos found in playlist: ${playlistId}`,
        'NOT_FOUND'
      );
    }

    return Array.from(videoIds);
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }

    throw new TranscriptError(
      `Failed to fetch playlist: ${error instanceof Error ? error.message : String(error)}`,
      'FETCH_ERROR'
    );
  }
}

/**
 * Fetch playlist metadata
 */
export async function fetchPlaylistMetadata(playlistIdOrUrl: string): Promise<YouTubePlaylist> {
  const playlistId = parseYouTubePlaylistId(playlistIdOrUrl) || playlistIdOrUrl;

  if (!playlistId) {
    throw new TranscriptError(
      `Invalid playlist URL or ID: ${playlistIdOrUrl}`,
      'PARSE_ERROR'
    );
  }

  try {
    const videoIds = await fetchPlaylistVideoIds(playlistId);

    return {
      playlistId,
      title: `Playlist ${playlistId}`,
      videoCount: videoIds.length,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
    };
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }

    throw new TranscriptError(
      `Failed to fetch playlist metadata: ${error instanceof Error ? error.message : String(error)}`,
      'FETCH_ERROR'
    );
  }
}

/**
 * Chunk transcript text for LLM processing
 *
 * @param fullText - Full transcript text
 * @param maxChars - Maximum characters per chunk
 * @param overlap - Number of characters to overlap between chunks
 */
export function chunkTranscriptText(
  fullText: string,
  maxChars: number = 4000,
  overlap: number = 200
): string[] {
  if (fullText.length <= maxChars) {
    return [fullText];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < fullText.length) {
    let end = start + maxChars;

    // Try to break at a sentence boundary
    if (end < fullText.length) {
      const lastPeriod = fullText.lastIndexOf('.', end);
      const lastQuestion = fullText.lastIndexOf('?', end);
      const lastExclaim = fullText.lastIndexOf('!', end);

      const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);

      // Only use break point if it's reasonably close to our target
      if (breakPoint > start + maxChars * 0.7) {
        end = breakPoint + 1;
      }
    }

    chunks.push(fullText.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks;
}
