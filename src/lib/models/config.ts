import { z } from 'zod';

/**
 * Configuration schema for BetterPrompt
 * Stores user preferences and settings
 */
export const ConfigSchema = z.object({
  version: z.literal('1.0.0'),
  telemetry: z.boolean().default(true),
  storagePath: z.string().default('~/.betterprompt'),
  apiKey: z.string().nullable().default(null),
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
};

/**
 * Environment variable mappings
 */
export const ENV_MAPPINGS = {
  apiKey: 'ANTHROPIC_API_KEY',
  telemetry: 'BETTERPROMPT_TELEMETRY',
  storagePath: 'BETTERPROMPT_STORAGE_PATH',
} as const;
