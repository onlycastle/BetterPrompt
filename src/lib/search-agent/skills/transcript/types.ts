/**
 * YouTube Transcript Types
 *
 * Zod schemas for YouTube video transcripts and analysis.
 */

import { z } from 'zod';

/**
 * YouTube video metadata
 */
export const YouTubeVideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelName: z.string(),
  channelId: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  duration: z.number().optional(), // seconds
  viewCount: z.number().optional(),
  url: z.string().url(),
});
export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

/**
 * Transcript segment (single caption line)
 */
export const TranscriptSegmentSchema = z.object({
  text: z.string(),
  start: z.number(), // seconds from video start
  duration: z.number(), // seconds
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

/**
 * Full YouTube transcript with metadata
 */
export const YouTubeTranscriptSchema = z.object({
  video: YouTubeVideoSchema,
  segments: z.array(TranscriptSegmentSchema),
  fullText: z.string(),
  language: z.string().default('en'),
  fetchedAt: z.string().datetime(),
});
export type YouTubeTranscript = z.infer<typeof YouTubeTranscriptSchema>;

/**
 * Timestamped insight from transcript analysis
 */
export const TimestampedInsightSchema = z.object({
  time: z.number(), // seconds
  timeFormatted: z.string(), // "MM:SS" or "HH:MM:SS"
  topic: z.string(),
  insight: z.string(),
});
export type TimestampedInsight = z.infer<typeof TimestampedInsightSchema>;

/**
 * Analyzed transcript output from LLM
 */
export const AnalyzedTranscriptSchema = z.object({
  summary: z.string().min(50).max(1000),
  keyInsights: z.array(z.string()).min(1).max(10),
  topics: z.array(z.string()).min(1).max(10),
  codeExamples: z.array(z.string()).max(5),
  relevanceToAICoding: z.number().min(0).max(1),
  timestamps: z.array(TimestampedInsightSchema).optional(),
  recommendedFor: z.array(z.string()).max(5).optional(), // e.g., ["beginners", "prompt-engineers"]
});
export type AnalyzedTranscript = z.infer<typeof AnalyzedTranscriptSchema>;

/**
 * Playlist metadata
 */
export const YouTubePlaylistSchema = z.object({
  playlistId: z.string(),
  title: z.string(),
  channelName: z.string().optional(),
  videoCount: z.number(),
  url: z.string().url(),
});
export type YouTubePlaylist = z.infer<typeof YouTubePlaylistSchema>;

/**
 * Helper to format seconds to timestamp string
 */
export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper to parse video ID from various YouTube URL formats
 */
export function parseYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Check if it's already just a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Helper to parse playlist ID from YouTube URL
 */
export function parseYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}
