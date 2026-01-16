/**
 * Configuration Domain Models
 *
 * Zod schemas for application configuration, environment variables,
 * and user settings. Single source of truth for config-related types.
 *
 * @module domain/models/config
 */

import { z } from 'zod';

// ============================================================================
// Core Configuration
// ============================================================================

/**
 * Configuration schema for NoMoreAISlop
 * Stores application settings
 */
export const ConfigSchema = z.object({
  version: z.literal('1.0.0'),

  // Feature flags
  telemetry: z.boolean().default(true),

  // Storage
  storagePath: z.string().default('~/.nomoreaislop'),

  // LLM settings
  model: z.string().default('claude-sonnet-4-20250514'),
  apiKey: z.string().nullable().default(null),

  // API settings
  apiBaseUrl: z.string().url().default('https://api.nomoreaislop.xyz'),

  // Offline mode
  offlineMode: z.boolean().default(false),
  syncOnReconnect: z.boolean().default(true),
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  telemetry: true,
  storagePath: '~/.nomoreaislop',
  model: 'claude-sonnet-4-20250514',
  apiKey: null,
  apiBaseUrl: 'https://api.nomoreaislop.xyz',
  offlineMode: false,
  syncOnReconnect: true,
};

/**
 * Environment variable mappings
 */
export const ENV_MAPPINGS = {
  apiKey: 'ANTHROPIC_API_KEY',
  telemetry: 'NOSLOP_TELEMETRY',
  storagePath: 'NOSLOP_STORAGE_PATH',
  model: 'NOSLOP_MODEL',
  apiBaseUrl: 'NOSLOP_API_BASE_URL',
  offlineMode: 'NOSLOP_OFFLINE_MODE',
} as const;

/**
 * Runtime environment
 */
export const RuntimeEnvironmentSchema = z.enum(['development', 'staging', 'production']);
export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

// ============================================================================
// Supabase Configuration
// ============================================================================

/**
 * Supabase configuration
 */
export const SupabaseConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string(),
  serviceRoleKey: z.string().optional(),
});
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;

/**
 * Environment variable mappings for Supabase
 */
export const SUPABASE_ENV_MAPPINGS = {
  url: 'SUPABASE_URL',
  anonKey: 'SUPABASE_ANON_KEY',
  serviceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

// ============================================================================
// Telemetry Configuration
// ============================================================================

/**
 * Telemetry event types
 */
export const TelemetryEventTypeSchema = z.enum([
  'plugin_installed',
  'analysis_started',
  'analysis_completed',
  'analysis_failed',
  'sessions_listed',
  'history_viewed',
  'report_shared',
  'knowledge_searched',
]);
export type TelemetryEventType = z.infer<typeof TelemetryEventTypeSchema>;

/**
 * Telemetry event schema
 * All events are anonymous and opt-out
 */
export const TelemetryEventSchema = z.object({
  event: TelemetryEventTypeSchema,
  timestamp: z.string().datetime(),
  anonymousId: z.string().uuid(),
  version: z.string(),
  properties: z.record(z.unknown()).optional(),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

/**
 * Analysis completed event properties
 */
export interface AnalysisCompletedProperties {
  durationMs: number;
  messageCount: number;
  rating_planning: string;
  rating_criticalThinking: string;
  rating_codeUnderstanding: string;
  primaryType?: string;
}

/**
 * Analysis failed event properties
 */
export interface AnalysisFailedProperties {
  errorType: string;
  errorMessage: string;
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flag schema
 */
export const FeatureFlagsSchema = z.object({
  // Analysis features
  enableTypeDetection: z.boolean().default(true),
  enableDimensions: z.boolean().default(true),
  enableRecommendations: z.boolean().default(true),

  // Knowledge features
  enableKnowledgeBase: z.boolean().default(false),
  enableInfluencerDetection: z.boolean().default(false),

  // Sharing features
  enablePublicSharing: z.boolean().default(true),
  enableSocialSharing: z.boolean().default(true),

  // Experimental features
  enableOfflineMode: z.boolean().default(false),
  enableJobQueue: z.boolean().default(false),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Default feature flags
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableTypeDetection: true,
  enableDimensions: true,
  enableRecommendations: true,
  enableKnowledgeBase: false,
  enableInfluencerDetection: false,
  enablePublicSharing: true,
  enableSocialSharing: true,
  enableOfflineMode: false,
  enableJobQueue: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve configuration from environment and defaults
 */
export function resolveConfig(
  envConfig: Partial<Config> = {},
  fileConfig: Partial<Config> = {}
): Config {
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
  };
}

/**
 * Read config value from environment
 */
export function getEnvValue<K extends keyof typeof ENV_MAPPINGS>(
  key: K
): string | undefined {
  const envKey = ENV_MAPPINGS[key];
  return process.env[envKey];
}

/**
 * Parse boolean from environment variable
 */
export function parseEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): SupabaseConfig | null {
  const url = process.env[SUPABASE_ENV_MAPPINGS.url];
  const anonKey = process.env[SUPABASE_ENV_MAPPINGS.anonKey];

  if (!url || !anonKey) return null;

  return {
    url,
    anonKey,
    serviceRoleKey: process.env[SUPABASE_ENV_MAPPINGS.serviceRoleKey],
  };
}
