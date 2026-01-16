import { z } from 'zod';

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
}

/**
 * Analysis failed event properties
 */
export interface AnalysisFailedProperties {
  errorType: string;
  errorMessage: string;
}
