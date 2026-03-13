/**
 * Sharing Domain Models
 *
 * Zod schemas for report sharing, viral distribution, and public reports.
 * Single source of truth for sharing-related types.
 *
 * @module domain/models/sharing
 */

import { z } from 'zod';
import { TypeResultSchema, DimensionsSchema } from './analysis';

// ============================================================================
// Share Token & Access
// ============================================================================

/**
 * Share access level
 */
export const ShareAccessLevelSchema = z.enum([
  'public',     // Anyone with link can view
  'protected',  // Requires access token
  'private',    // Only owner can view
]);
export type ShareAccessLevel = z.infer<typeof ShareAccessLevelSchema>;

/**
 * Share token schema
 */
export const ShareTokenSchema = z.object({
  token: z.string().min(20).max(3000),
  expiresAt: z.string().datetime().optional(),
  usageCount: z.number().default(0),
  maxUsage: z.number().optional(),
});
export type ShareToken = z.infer<typeof ShareTokenSchema>;

// ============================================================================
// Shared Report Schema
// ============================================================================

/**
 * Shared report schema - public-facing analysis result
 */
export const SharedReportSchema = z.object({
  id: z.string().uuid(),

  // Short URL identifier (e.g., "abc123" for /r/abc123)
  reportId: z.string().min(6).max(20),

  // Access control
  accessLevel: ShareAccessLevelSchema.default('public'),
  accessToken: ShareTokenSchema.optional(),

  // Analysis results (denormalized for fast access)
  typeResult: TypeResultSchema,
  dimensions: DimensionsSchema.optional(),

  // Optional custom message from user
  userMessage: z.string().max(500).optional(),

  // Analytics
  viewCount: z.number().default(0),
  shareCount: z.number().default(0),

  // Source tracking
  sourceAnalysisId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),

  // Status
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SharedReport = z.infer<typeof SharedReportSchema>;

/**
 * Create shared report input
 */
export const CreateSharedReportInputSchema = z.object({
  typeResult: TypeResultSchema,
  dimensions: DimensionsSchema.optional(),
  userMessage: z.string().max(500).optional(),
  accessLevel: ShareAccessLevelSchema.optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});
export type CreateSharedReportInput = z.infer<typeof CreateSharedReportInputSchema>;

/**
 * Public report view (what external viewers see)
 */
export const PublicReportViewSchema = z.object({
  reportId: z.string(),
  typeResult: TypeResultSchema,
  dimensions: DimensionsSchema.optional(),
  userMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  viewCount: z.number(),
});
export type PublicReportView = z.infer<typeof PublicReportViewSchema>;

// ============================================================================
// Share Links & Social
// ============================================================================

/**
 * Social platform for sharing
 */
export const SocialPlatformSchema = z.enum([
  'twitter',
  'linkedin',
  'facebook',
  'reddit',
  'email',
  'copy',
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

/**
 * Share link generation result
 */
export const ShareLinkSchema = z.object({
  platform: SocialPlatformSchema,
  url: z.string().url(),
  text: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

/**
 * Share event tracking
 */
export const ShareEventSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string(),
  platform: SocialPlatformSchema,
  timestamp: z.string().datetime(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
});
export type ShareEvent = z.infer<typeof ShareEventSchema>;

// ============================================================================
// Aggregate Statistics (for peer comparison)
// ============================================================================

/**
 * Aggregate stats for comparison
 */
export const AggregateStatsSchema = z.object({
  id: z.string().uuid(),

  // What this stat represents
  category: z.enum(['global', 'by_type', 'by_dimension']),
  key: z.string(), // e.g., 'architect', 'aiCollaboration'

  // Statistical data
  totalSamples: z.number(),
  mean: z.number(),
  median: z.number(),
  stdDev: z.number(),

  // Percentiles
  percentiles: z.object({
    p10: z.number(),
    p25: z.number(),
    p50: z.number(),
    p75: z.number(),
    p90: z.number(),
  }),

  // Metadata
  updatedAt: z.string().datetime(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});
export type AggregateStats = z.infer<typeof AggregateStatsSchema>;

// ============================================================================
// OG Tags & Embed
// ============================================================================

/**
 * OpenGraph metadata for shared reports
 */
export const OGMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  image: z.string().url().optional(),
  url: z.string().url(),
  type: z.literal('website').default('website'),
  siteName: z.literal('BetterPrompt').default('BetterPrompt'),
});
export type OGMetadata = z.infer<typeof OGMetadataSchema>;

/**
 * Embed code for external sites
 */
export const EmbedCodeSchema = z.object({
  html: z.string(),
  width: z.number().default(600),
  height: z.number().default(400),
  responsive: z.boolean().default(true),
});
export type EmbedCode = z.infer<typeof EmbedCodeSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a short report ID
 */
export function generateReportId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Build share URL for a report
 */
export function buildShareUrl(reportId: string, baseUrl = 'http://localhost:3000'): string {
  return `${baseUrl}/r/${reportId}`;
}

/**
 * Generate Twitter share link
 */
export function generateTwitterShareLink(reportId: string, typeResult: { primaryType: string }): ShareLink {
  const url = buildShareUrl(reportId);
  const text = `I analyzed my AI workflow with BetterPrompt.`;
  const hashtags = ['BetterPrompt', 'AICoding', 'SelfHosted'];

  const twitterUrl = new URL('https://twitter.com/intent/tweet');
  twitterUrl.searchParams.set('text', text);
  twitterUrl.searchParams.set('url', url);
  twitterUrl.searchParams.set('hashtags', hashtags.join(','));

  return {
    platform: 'twitter',
    url: twitterUrl.toString(),
    text,
    hashtags,
  };
}

/**
 * Generate LinkedIn share link
 */
export function generateLinkedInShareLink(reportId: string): ShareLink {
  const url = buildShareUrl(reportId);

  const linkedInUrl = new URL('https://www.linkedin.com/sharing/share-offsite/');
  linkedInUrl.searchParams.set('url', url);

  return {
    platform: 'linkedin',
    url: linkedInUrl.toString(),
  };
}

/**
 * Generate OG metadata for a report
 */
export function generateOGMetadata(
  reportId: string,
  typeResult: { primaryType: string; distribution: Record<string, number> }
): OGMetadata {
  const typeNames: Record<string, string> = {
    architect: 'Architect',
    analyst: 'Analyst',
    conductor: 'Conductor',
    speedrunner: 'Speedrunner',
    trendsetter: 'Trendsetter',
  };

  const typeName = typeNames[typeResult.primaryType] || typeResult.primaryType;

  return {
    title: `I'm a ${typeName} - BetterPrompt`,
    description: 'I analyzed my AI workflow with BetterPrompt.',
    url: buildShareUrl(reportId),
    type: 'website',
    siteName: 'BetterPrompt',
  };
}

/**
 * Generate embed code for a report
 */
export function generateEmbedCode(reportId: string): EmbedCode {
  const url = buildShareUrl(reportId);

  return {
    html: `<iframe src="${url}/embed" width="600" height="400" frameborder="0" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></iframe>`,
    width: 600,
    height: 400,
    responsive: true,
  };
}
