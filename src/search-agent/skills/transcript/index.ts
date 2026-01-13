/**
 * Transcript Skill
 *
 * Fetches and analyzes YouTube video transcripts for AI engineering insights.
 * Converts transcript analysis into KnowledgeItems for storage.
 */

import { BaseSkill, SkillResult, SkillConfig } from '../base-skill.js';
import {
  YouTubeTranscript,
  AnalyzedTranscript,
  AnalyzedTranscriptSchema,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
} from './types.js';
import {
  fetchTranscript,
  fetchPlaylistVideoIds,
  chunkTranscriptText,
  TranscriptError,
} from './youtube-api.js';
import {
  TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT,
  buildTranscriptAnalysisPrompt,
  TRANSCRIPT_ANALYSIS_TOOL,
  CHUNKED_ANALYSIS_SYSTEM_PROMPT,
  buildChunkAnalysisPrompt,
  COMBINE_ANALYSIS_SYSTEM_PROMPT,
  buildCombineAnalysisPrompt,
} from './prompts.js';

/**
 * Input for transcript skill
 */
export interface TranscriptInput {
  url: string; // YouTube video URL or playlist URL
  processPlaylist?: boolean; // If true and URL is playlist, process all videos
  maxPlaylistVideos?: number; // Max videos to process from playlist (default: 10)
}

/**
 * Single video analysis result
 */
export interface VideoAnalysisResult {
  transcript: YouTubeTranscript;
  analysis: AnalyzedTranscript;
}

/**
 * Output from transcript skill
 */
export interface TranscriptOutput {
  results: VideoAnalysisResult[];
  errors: Array<{
    url: string;
    error: string;
  }>;
  stats: {
    videosProcessed: number;
    videosFailed: number;
    totalDurationSeconds: number;
  };
}

/**
 * Transcript Skill - Fetches and analyzes YouTube transcripts
 *
 * Capabilities:
 * - Fetch transcript from single video URL
 * - Process all videos in a playlist
 * - Analyze transcript content using LLM
 * - Handle long transcripts with chunking
 */
export class TranscriptSkill extends BaseSkill<TranscriptInput, TranscriptOutput> {
  readonly name = 'transcript';
  readonly description = 'Fetches and analyzes YouTube video transcripts for AI engineering insights';

  private readonly maxChunkSize = 4000;

  async execute(input: TranscriptInput): Promise<SkillResult<TranscriptOutput>> {
    const startTime = Date.now();

    try {
      this.ensureLLMClient();

      const videoUrls = await this.resolveVideoUrls(input);
      const results: VideoAnalysisResult[] = [];
      const errors: Array<{ url: string; error: string }> = [];

      for (const url of videoUrls) {
        try {
          const result = await this.processVideo(url);
          results.push(result);

          // Small delay between videos to avoid rate limits
          if (videoUrls.length > 1) {
            await this.sleep(500);
          }
        } catch (error) {
          errors.push({
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        success: true,
        data: {
          results,
          errors,
          stats: {
            videosProcessed: results.length,
            videosFailed: errors.length,
            totalDurationSeconds: results.reduce(
              (sum, r) => sum + (r.transcript.video.duration || 0),
              0
            ),
          },
        },
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
   * Resolve input URL to list of video URLs
   */
  private async resolveVideoUrls(input: TranscriptInput): Promise<string[]> {
    const { url, processPlaylist = false, maxPlaylistVideos = 10 } = input;

    // Check if it's a playlist URL
    const playlistId = parseYouTubePlaylistId(url);

    if (playlistId && processPlaylist) {
      const videoIds = await fetchPlaylistVideoIds(url);
      const limitedIds = videoIds.slice(0, maxPlaylistVideos);
      return limitedIds.map((id) => `https://www.youtube.com/watch?v=${id}`);
    }

    // Single video
    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      throw new TranscriptError(`Invalid YouTube URL: ${url}`, 'PARSE_ERROR');
    }

    return [`https://www.youtube.com/watch?v=${videoId}`];
  }

  /**
   * Process a single video: fetch transcript and analyze
   */
  private async processVideo(url: string): Promise<VideoAnalysisResult> {
    // Fetch transcript
    const transcript = await fetchTranscript(url);

    // Analyze transcript
    const analysis = await this.analyzeTranscript(transcript);

    return { transcript, analysis };
  }

  /**
   * Analyze transcript using LLM
   */
  private async analyzeTranscript(transcript: YouTubeTranscript): Promise<AnalyzedTranscript> {
    const { video, fullText } = transcript;

    // Check if we need to chunk the transcript
    if (fullText.length <= this.maxChunkSize * 1.5) {
      // Short enough to analyze in one go
      return this.analyzeSingleChunk(video, fullText);
    }

    // Long transcript - chunk and combine
    return this.analyzeChunkedTranscript(transcript);
  }

  /**
   * Analyze a short transcript in a single LLM call
   */
  private async analyzeSingleChunk(
    video: YouTubeTranscript['video'],
    text: string
  ): Promise<AnalyzedTranscript> {
    const response = await this.callLLM(
      TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT,
      buildTranscriptAnalysisPrompt(video, text),
      {
        temperature: 0.3,
        maxTokens: 2000,
        tools: [TRANSCRIPT_ANALYSIS_TOOL],
        toolChoice: { type: 'tool', name: TRANSCRIPT_ANALYSIS_TOOL.name },
      }
    );

    const toolUse = this.extractToolUse(response);
    const result = AnalyzedTranscriptSchema.parse(toolUse.input);

    return result;
  }

  /**
   * Analyze a long transcript by chunking and combining
   */
  private async analyzeChunkedTranscript(
    transcript: YouTubeTranscript
  ): Promise<AnalyzedTranscript> {
    const { video, fullText } = transcript;
    const chunks = chunkTranscriptText(fullText, this.maxChunkSize);

    // Analyze each chunk
    const chunkAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const response = await this.callLLM(
        CHUNKED_ANALYSIS_SYSTEM_PROMPT,
        buildChunkAnalysisPrompt(video, chunks[i], i, chunks.length),
        {
          temperature: 0.3,
          maxTokens: 1000,
        }
      );

      chunkAnalyses.push(this.extractText(response));

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await this.sleep(300);
      }
    }

    // Combine chunk analyses
    const combineResponse = await this.callLLM(
      COMBINE_ANALYSIS_SYSTEM_PROMPT,
      buildCombineAnalysisPrompt(video, chunkAnalyses),
      {
        temperature: 0.3,
        maxTokens: 2000,
        tools: [TRANSCRIPT_ANALYSIS_TOOL],
        toolChoice: { type: 'tool', name: TRANSCRIPT_ANALYSIS_TOOL.name },
      }
    );

    const toolUse = this.extractToolUse(combineResponse);
    const result = AnalyzedTranscriptSchema.parse(toolUse.input);

    return result;
  }
}

/**
 * Factory function
 */
export function createTranscriptSkill(config?: SkillConfig): TranscriptSkill {
  return new TranscriptSkill(config);
}

// Re-export types and utilities
export type { YouTubeTranscript, AnalyzedTranscript } from './types.js';
export { parseYouTubeVideoId, parseYouTubePlaylistId, isYouTubeUrl } from './types.js';
export { fetchTranscript, fetchPlaylistVideoIds, TranscriptError } from './youtube-api.js';
