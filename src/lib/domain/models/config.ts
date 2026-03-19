/**
 * Configuration Domain Models
 *
 * Zod schemas for application configuration and user settings.
 * Single source of truth for config-related types.
 *
 * @module domain/models/config
 */

import { z } from 'zod';

// ============================================================================
// Core Configuration
// ============================================================================

/**
 * Configuration schema for BetterPrompt
 * Stores application settings
 */
export const ConfigSchema = z.object({
  version: z.literal('1.0.0'),

  // Feature flags
  telemetry: z.boolean().default(true),

  // Storage
  storagePath: z.string().default('~/.betterprompt'),

  // API settings
  apiKey: z.string().nullable().default(null),

  // API settings
  apiBaseUrl: z.string().url().default('http://localhost:3000'),

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
  storagePath: '~/.betterprompt',
  apiKey: null,
  apiBaseUrl: 'http://localhost:3000',
  offlineMode: false,
  syncOnReconnect: true,
};

/**
 * Runtime environment
 */
export const RuntimeEnvironmentSchema = z.enum(['development', 'staging', 'production']);
export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

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
  properties: z.record(z.string(), z.unknown()).optional(),
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
 * Resolve configuration from defaults plus persisted overrides.
 */
export function resolveConfig(
  configOverrides: Partial<Config> = {},
  fileConfig: Partial<Config> = {}
): Config {
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...configOverrides,
  };
}
