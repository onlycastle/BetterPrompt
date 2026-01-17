/**
 * Gemini Client Abstraction
 *
 * Provides a unified interface for calling Gemini API with structured outputs.
 * Uses the @google/genai SDK (unified SDK for 2025+).
 *
 * @module analyzer/clients/gemini-client
 */

import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';

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
  responseSchema: ZodSchema<T>;
  maxOutputTokens?: number;
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

    this.ai = new GoogleGenAI({ apiKey });
    this.model = config.model || DEFAULT_CONFIG.model;
    this.temperature = config.temperature ?? DEFAULT_CONFIG.temperature;
    this.maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
  }

  /**
   * Generate structured content using Gemini with JSON schema validation
   */
  async generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<T> {
    const jsonSchema = zodToJsonSchema(request.responseSchema, {
      $refStrategy: 'none',
    });

    // Remove $schema field (not needed for Gemini)
    const { $schema: _$schema, ...responseSchema } = jsonSchema as Record<string, unknown>;

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

        return this.parseResponse<T>(response, request.responseSchema);
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError || new Error('Generation failed after retries');
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
    schema: ZodSchema<T>
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
      console.error('[GeminiClient] Schema validation failed:', result.error.errors);

      // Build detailed debug info for error message
      const debugDetails: string[] = [];
      for (const error of result.error.errors) {
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
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on rate limits and server errors
      if (message.includes('rate') || message.includes('429')) return true;
      if (message.includes('500') || message.includes('503')) return true;
      if (message.includes('internal') || message.includes('server error')) return true;
    }
    return false;
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
