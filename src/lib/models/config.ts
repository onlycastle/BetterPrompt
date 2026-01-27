import { z } from 'zod';

/**
 * Configuration schema for NoMoreAISlop
 * Stores user preferences and settings
 */
export const ConfigSchema = z.object({
  version: z.literal('1.0.0'),
  telemetry: z.boolean().default(true),
  storagePath: z.string().default('~/.nomoreaislop'),
  apiKey: z.string().nullable().default(null),
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  telemetry: true,
  storagePath: '~/.nomoreaislop',
  apiKey: null,
};

/**
 * Environment variable mappings
 */
export const ENV_MAPPINGS = {
  apiKey: 'ANTHROPIC_API_KEY',
  telemetry: 'NOSLOP_TELEMETRY',
  storagePath: 'NOSLOP_STORAGE_PATH',
} as const;
