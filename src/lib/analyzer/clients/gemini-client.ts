/**
 * Gemini Client Abstraction
 *
 * Provides a unified interface for calling Gemini API with structured outputs.
 * Uses the @google/genai SDK (unified SDK for 2025+).
 *
 * @module analyzer/clients/gemini-client
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

/** Options for cleanSchemaForGemini */
interface CleanSchemaOptions {
  /** When true, preserve minItems/maxItems array constraints instead of stripping them */
  preserveArrayConstraints?: boolean;
}

/**
 * Recursively clean JSON schema for Gemini API compatibility
 *
 * Removes fields that cause INVALID_ARGUMENT errors:
 * 1. additionalProperties - SDK rejects this even though API supports it since Nov 2025
 * 2. minItems/maxItems - Gemini has undocumented limits on array size constraints
 *    in complex schemas (fails when schema exceeds ~8000 chars with these fields)
 *
 * When `preserveArrayConstraints` is true, minItems/maxItems are kept. This is safe
 * for smaller schemas (< ~8000 chars) like TypeClassifier where array size enforcement
 * is critical for output quality.
 *
 * @see https://github.com/googleapis/python-genai/issues/1815
 */
function cleanSchemaForGemini(obj: unknown, options: CleanSchemaOptions = {}): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanSchemaForGemini(item, options));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip problematic fields
    if (key === 'additionalProperties') continue;
    if (!options.preserveArrayConstraints && key === 'minItems') continue;
    if (!options.preserveArrayConstraints && key === 'maxItems') continue;
    result[key] = cleanSchemaForGemini(value, options);
  }
  return result;
}

/**
 * Configuration for Gemini client
 */
export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

/**
 * Request for structured content generation
 */
export interface GeminiStructuredRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: z.ZodType<T>;
  maxOutputTokens?: number;
  /** Preserve minItems/maxItems in schema (safe for small schemas < ~8000 chars) */
  preserveArrayConstraints?: boolean;
  /** Schema name for error context logging (e.g., 'TranslatorLLMOutput') */
  schemaName?: string;
}

/**
 * Token usage metadata from Gemini API response
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Cached input tokens (if context caching is used) */
  cachedTokens?: number;
}

/**
 * Result of structured generation including parsed data and usage metadata
 */
export interface GeminiStructuredResult<T> {
  data: T;
  usage: TokenUsage;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends keeping at 1.0
  maxRetries: 2,
};

/**
 * Gemini Client for structured output generation
 *
 * Uses Gemini 3 Flash with JSON schema-based structured outputs.
 * Temperature is kept at 1.0 per Gemini best practices to avoid
 * unexpected looping or performance degradation.
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  private model: string;
  private temperature: number;
  private maxRetries: number;

  constructor(config: GeminiClientConfig = {}) {
    const apiKey = config.apiKey || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is required');
    }

    this.ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 300_000 } });
    this.model = config.model || DEFAULT_CONFIG.model;
    this.temperature = config.temperature ?? DEFAULT_CONFIG.temperature;
    this.maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
  }

  /**
   * Generate structured content using Gemini with JSON schema validation
   * Returns both the parsed data and token usage metadata
   */
  async generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<GeminiStructuredResult<T>> {
    const schemaName = request.schemaName ?? 'unknown';
    const jsonSchema = z.toJSONSchema(request.responseSchema, { io: 'input' });

    // Remove $schema and clean problematic fields
    // Gemini SDK rejects additionalProperties, and minItems/maxItems cause issues in large schemas
    const { $schema: _$schema, ...schemaWithoutMeta } = jsonSchema as Record<string, unknown>;
    const responseSchema = cleanSchemaForGemini(schemaWithoutMeta, {
      preserveArrayConstraints: request.preserveArrayConstraints,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: this.buildContents(request.systemPrompt, request.userPrompt),
          config: {
            temperature: this.temperature,
            maxOutputTokens: request.maxOutputTokens || 65536,
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
          },
        });

        const data = this.parseResponse<T>(response, request.responseSchema);
        const usage = this.extractUsageMetadata(response);

        return { data, usage };
      } catch (error) {
        lastError = error as Error;
        console.error(`[GeminiClient] Schema "${schemaName}" failed (attempt ${attempt + 1}): ${lastError.message}`);

        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `[GeminiClient] Retryable error (attempt ${attempt + 1}/${this.maxRetries}): ${(error as Error).message}. Retrying in ${delay}ms...`
        );

        // Exponential backoff
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Generation failed after retries');
  }

  /**
   * Extract token usage metadata from Gemini response
   */
  private extractUsageMetadata(response: {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
      cachedContentTokenCount?: number;
    };
  }): TokenUsage {
    const metadata = response.usageMetadata;
    return {
      promptTokens: metadata?.promptTokenCount ?? 0,
      completionTokens: metadata?.candidatesTokenCount ?? 0,
      totalTokens: metadata?.totalTokenCount ?? 0,
      cachedTokens: metadata?.cachedContentTokenCount,
    };
  }

  /**
   * Build contents array for Gemini API
   * Gemini uses a different format than Claude - system prompt goes in system instruction
   */
  private buildContents(
    systemPrompt: string,
    userPrompt: string
  ): { role: 'user'; parts: { text: string }[] }[] {
    // For Gemini, we combine system + user prompts in a specific format
    // The system instruction is prepended to the user content
    const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    return [
      {
        role: 'user',
        parts: [{ text: combinedPrompt }],
      },
    ];
  }

  /**
   * Parse and validate the response
   * Also checks for truncation via finishReason
   */
  private parseResponse<T>(
    response: { text?: string; candidates?: Array<{ finishReason?: string }> },
    schema: z.ZodType<T>
  ): T {
    // Check for truncation before attempting to parse
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        'Response truncated: Output exceeded maxOutputTokens limit. ' +
          'The AI generated more content than allowed. Try analyzing fewer sessions or contact support.'
      );
    }

    if (!response.text) {
      throw new Error('Empty response from Gemini');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      // If JSON parsing fails, check if it looks like truncation
      if (response.text.length > 100 && !response.text.trim().endsWith('}')) {
        throw new Error(
          'Response truncated: JSON output was cut off before completion. ' +
            'This usually means the analysis is too large. Try analyzing fewer sessions.'
        );
      }
      throw new Error(`Failed to parse JSON response: ${response.text.slice(0, 200)}`);
    }

    // Validate against Zod schema
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.error('[GeminiClient] Schema validation failed:', result.error.issues);

      // Build detailed debug info for error message
      const debugDetails: string[] = [];
      for (const error of result.error.issues) {
        const path = error.path.join('.');
        let actualValue: unknown = parsed;
        for (const key of error.path) {
          if (actualValue && typeof actualValue === 'object') {
            actualValue = (actualValue as Record<string, unknown>)[key as string];
          }
        }
        const valueInfo = typeof actualValue === 'string'
          ? `"${actualValue.slice(0, 50)}${actualValue.length > 50 ? '...' : ''}" (${actualValue.length} chars)`
          : JSON.stringify(actualValue)?.slice(0, 100);
        debugDetails.push(`${path}: ${valueInfo}`);
        console.error(`[GeminiClient] Field "${path}" value:`, valueInfo);
      }

      throw new Error(
        `Invalid response structure: ${result.error.message}\n\nDebug info:\n${debugDetails.join('\n')}`
      );
    }

    return result.data;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();

    // Retryable patterns: rate limits, server errors, and transient network issues
    const retryablePatterns = [
      'rate', '429',                           // Rate limits
      '500', '503', 'internal', 'server error', // Server errors
      'fetch failed',                           // Network errors (TypeError)
      'econnreset', 'etimedout',               // Connection errors
      'socket hang up', 'network error',       // Other network issues
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a Gemini client with default configuration
 */
export function createGeminiClient(config?: GeminiClientConfig): GeminiClient {
  return new GeminiClient(config);
}
