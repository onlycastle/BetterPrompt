/**
 * Personality Analyst Stage Implementation (Module B)
 *
 * Stage 1B of the three-stage pipeline.
 * Uses Gemini 3 Flash for personality extraction from behavioral data.
 *
 * Input: Sessions + Module A output (StructuredAnalysisData)
 * Output: PersonalityProfile
 *
 * @module analyzer/stages/personality-analyst
 */

import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import type { ParsedSession } from '../../domain/models/analysis';
import type { StructuredAnalysisData } from '../../models/analysis-data';
import {
  PersonalityProfileSchema,
  type PersonalityProfile,
  createDefaultPersonalityProfile,
} from '../../models/personality';
import {
  PERSONALITY_ANALYST_SYSTEM_PROMPT,
  buildPersonalityAnalystUserPrompt,
} from './personality-analyst-prompts';

/**
 * Configuration for the Personality Analyst stage
 */
export interface PersonalityAnalystConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<PersonalityAnalystConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 8192, // Personality output is smaller than Stage 1
  maxRetries: 2,
};

/**
 * Personality Analyst Stage - Extracts personality profile from behavioral data
 *
 * Uses Gemini 3 Flash with structured JSON output.
 * Takes Module A output as additional input for more accurate analysis.
 */
export class PersonalityAnalystStage {
  private client: GeminiClient;
  private config: Required<Omit<PersonalityAnalystConfig, 'apiKey'>>;

  constructor(config: PersonalityAnalystConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.config = {
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens || DEFAULT_CONFIG.maxOutputTokens,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };
  }

  /**
   * Analyze sessions and Module A output to extract personality profile
   *
   * @param sessions - Raw parsed sessions
   * @param moduleAOutput - Output from Module A (Data Analyst stage)
   */
  async analyze(
    sessions: ParsedSession[],
    moduleAOutput: StructuredAnalysisData
  ): Promise<PersonalityProfile> {
    if (sessions.length === 0) {
      return createDefaultPersonalityProfile();
    }

    // Check if Module A has sufficient data for personality analysis
    if (!this.hasMinimumData(moduleAOutput)) {
      console.warn('Insufficient data from Module A for personality analysis');
      return createDefaultPersonalityProfile();
    }

    const sessionsFormatted = this.formatSessions(sessions);
    const moduleAOutputJson = JSON.stringify(moduleAOutput, null, 2);
    const userPrompt = buildPersonalityAnalystUserPrompt(sessionsFormatted, moduleAOutputJson);

    try {
      const result = await this.client.generateStructured({
        systemPrompt: PERSONALITY_ANALYST_SYSTEM_PROMPT,
        userPrompt,
        responseSchema: PersonalityProfileSchema,
        maxOutputTokens: this.config.maxOutputTokens,
      });

      return this.sanitizeResponse(result);
    } catch (error) {
      console.error('Personality analysis failed:', error);
      return createDefaultPersonalityProfile();
    }
  }

  /**
   * Check if Module A output has minimum data required for personality analysis
   */
  private hasMinimumData(moduleA: StructuredAnalysisData): boolean {
    // Need at least some quotes and patterns for meaningful analysis
    const hasQuotes = moduleA.extractedQuotes && moduleA.extractedQuotes.length >= 5;
    const hasPatterns = moduleA.detectedPatterns && moduleA.detectedPatterns.length >= 1;
    const hasTypeAnalysis = !!(moduleA.typeAnalysis && moduleA.typeAnalysis.primaryType);

    return hasQuotes && hasPatterns && hasTypeAnalysis;
  }

  /**
   * Format sessions for the prompt
   * Simplified version focusing on user messages for personality signals
   */
  private formatSessions(sessions: ParsedSession[]): string {
    return sessions
      .map((session, index) => {
        const date = session.startTime.toISOString().split('T')[0];
        const messages = session.messages
          .filter((msg) => msg.role === 'user') // Focus on user messages for personality
          .map((msg) => {
            const timestamp = msg.timestamp.toISOString().slice(11, 19);
            const content =
              msg.content && msg.content.length > 1500
                ? msg.content.slice(0, 1500) + '...[truncated]'
                : msg.content || '';

            return `[${timestamp}] DEVELOPER:\n${content}`;
          })
          .join('\n\n');

        return `<session index="${index + 1}" date="${date}">
${messages}
</session>`;
      })
      .join('\n\n');
  }

  /**
   * Sanitize response to ensure schema compliance
   */
  private sanitizeResponse(input: PersonalityProfile): PersonalityProfile {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as PersonalityProfile;

    // Ensure all dimensions exist
    const defaultDimension = {
      score: 50,
      signals: [],
      insight: 'Balanced',
    };

    if (!sanitized.dimensions) {
      sanitized.dimensions = {
        ei: defaultDimension,
        sn: defaultDimension,
        tf: defaultDimension,
        jp: defaultDimension,
      };
    }

    // Ensure each dimension has required fields
    for (const key of ['ei', 'sn', 'tf', 'jp'] as const) {
      if (!sanitized.dimensions[key]) {
        sanitized.dimensions[key] = defaultDimension;
      }

      // Clamp scores to valid range
      sanitized.dimensions[key].score = Math.max(
        0,
        Math.min(100, sanitized.dimensions[key].score || 50)
      );

      // Ensure signals is an array
      if (!Array.isArray(sanitized.dimensions[key].signals)) {
        sanitized.dimensions[key].signals = [];
      }

      // Ensure insight is a string
      if (!sanitized.dimensions[key].insight) {
        sanitized.dimensions[key].insight = 'Balanced';
      }
    }

    // Ensure 사주 analysis fields
    sanitized.yongsin = sanitized.yongsin || '';
    sanitized.gisin = sanitized.gisin || '';
    sanitized.gyeokguk = sanitized.gyeokguk || 'Balanced';

    // Ensure arrays
    if (!Array.isArray(sanitized.sangsaeng)) {
      sanitized.sangsaeng = [];
    }
    if (!Array.isArray(sanitized.sanggeuk)) {
      sanitized.sanggeuk = [];
    }

    // Clamp confidence
    sanitized.overallConfidence = Math.max(
      0,
      Math.min(1, sanitized.overallConfidence || 0.5)
    );

    // Truncate string fields to max lengths
    sanitized.yongsin = this.truncate(sanitized.yongsin, 200);
    sanitized.gisin = this.truncate(sanitized.gisin, 200);
    sanitized.gyeokguk = this.truncate(sanitized.gyeokguk, 100);

    for (const key of ['ei', 'sn', 'tf', 'jp'] as const) {
      sanitized.dimensions[key].insight = this.truncate(
        sanitized.dimensions[key].insight,
        200
      );
    }

    return sanitized;
  }

  /**
   * Truncate string to max length with ellipsis
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
  }
}

/**
 * Factory function for creating PersonalityAnalystStage
 */
export function createPersonalityAnalystStage(
  config?: PersonalityAnalystConfig
): PersonalityAnalystStage {
  return new PersonalityAnalystStage(config);
}
