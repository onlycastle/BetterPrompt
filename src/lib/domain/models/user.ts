/**
 * User Domain Models
 *
 * Zod schemas for user management, tiers, teams, and organizations.
 * Single source of truth for user-related types.
 *
 * @module domain/models/user
 */

import { z } from 'zod';

// ============================================================================
// User Tiers
// ============================================================================

/**
 * User subscription tiers
 */
export const UserTierSchema = z.enum(['free', 'paid', 'pro', 'premium', 'enterprise']);
export type UserTier = z.infer<typeof UserTierSchema>;

/**
 * Tier feature limits and capabilities
 */
export const TIER_LIMITS: Record<
  UserTier,
  {
    analysesPerMonth: number | null; // null = unlimited
    trackingEnabled: boolean;
    knowledgeBaseAccess: boolean;
    teamManagement: boolean;
    customKnowledgeBase: boolean;
    apiAccess: boolean;
  }
> = {
  free: {
    analysesPerMonth: 3,
    trackingEnabled: false,
    knowledgeBaseAccess: false,
    teamManagement: false,
    customKnowledgeBase: false,
    apiAccess: false,
  },
  paid: {
    // Same as free for now - users who made one-time credit purchase
    analysesPerMonth: 3,
    trackingEnabled: false,
    knowledgeBaseAccess: false,
    teamManagement: false,
    customKnowledgeBase: false,
    apiAccess: false,
  },
  pro: {
    analysesPerMonth: null, // unlimited
    trackingEnabled: false,
    knowledgeBaseAccess: false,
    teamManagement: false,
    customKnowledgeBase: false,
    apiAccess: true,
  },
  premium: {
    analysesPerMonth: null,
    trackingEnabled: true,
    knowledgeBaseAccess: true,
    teamManagement: false,
    customKnowledgeBase: false,
    apiAccess: true,
  },
  enterprise: {
    analysesPerMonth: null,
    trackingEnabled: true,
    knowledgeBaseAccess: true,
    teamManagement: true,
    customKnowledgeBase: true,
    apiAccess: true,
  },
};

// ============================================================================
// User Schema
// ============================================================================

/**
 * User profile schema
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),

  // Subscription
  tier: UserTierSchema.default('free'),

  // Usage tracking
  analysesThisMonth: z.number().default(0),
  analysesResetAt: z.string().datetime(),

  // Organization membership (for enterprise)
  organizationId: z.string().uuid().optional(),
  teamIds: z.array(z.string().uuid()).default([]),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastActiveAt: z.string().datetime().optional(),

  // Settings
  settings: z.object({
    emailNotifications: z.boolean().default(true),
    weeklyDigest: z.boolean().default(false),
    publicProfile: z.boolean().default(false),
  }).default({}),
});
export type User = z.infer<typeof UserSchema>;

/**
 * User creation input (without auto-generated fields)
 */
export const CreateUserInputSchema = UserSchema.pick({
  email: true,
  tier: true,
}).partial({ tier: true });
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

// ============================================================================
// Team & Organization Schemas
// ============================================================================

/**
 * Team role within an organization
 */
export const TeamRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

/**
 * Team schema
 */
export const TeamSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  memberCount: z.number().default(0),
});
export type Team = z.infer<typeof TeamSchema>;

/**
 * Team membership
 */
export const TeamMemberSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: TeamRoleSchema,
  joinedAt: z.string().datetime(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/**
 * Organization schema
 */
export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),

  // Subscription
  tier: z.literal('enterprise'),

  // Limits
  maxSeats: z.number().min(1),
  usedSeats: z.number().default(0),

  // Settings
  settings: z.object({
    allowedDomains: z.array(z.string()).default([]), // Email domain restrictions
    ssoEnabled: z.boolean().default(false),
    customKnowledgeBaseEnabled: z.boolean().default(false),
  }).default({}),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ownerId: z.string().uuid(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// ============================================================================
// License Schema (for PRO tier)
// ============================================================================

/**
 * License type
 */
export const LicenseTypeSchema = z.enum(['one_time', 'pro', 'team']);
export type LicenseType = z.infer<typeof LicenseTypeSchema>;

/**
 * License schema
 */
export const LicenseSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(20).max(100),
  type: LicenseTypeSchema,

  // Usage
  maxActivations: z.number().min(1).default(3),
  activationCount: z.number().default(0),

  // Validity
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),

  // Metadata
  createdAt: z.string().datetime(),
  purchasedBy: z.string().email().optional(),
  polarOrderId: z.string().optional(),
});
export type License = z.infer<typeof LicenseSchema>;

/**
 * License activation (device fingerprint)
 */
export const LicenseActivationSchema = z.object({
  id: z.string().uuid(),
  licenseId: z.string().uuid(),
  deviceFingerprint: z.string(),
  activatedAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  deactivatedAt: z.string().datetime().optional(),
});
export type LicenseActivation = z.infer<typeof LicenseActivationSchema>;

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Usage record for rate limiting
 */
export const UsageRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  licenseId: z.string().uuid().optional(),
  deviceFingerprint: z.string().optional(),

  // Action tracked
  action: z.enum(['analysis', 'share', 'api_call']),

  // Metadata
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;

/**
 * Tracking metrics for PREMIUM tier
 */
export const TrackingMetricsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date(), // YYYY-MM-DD

  // Daily metrics
  sessionsAnalyzed: z.number().default(0),
  averageScore: z.number().min(0).max(100).optional(),

  // Dimension averages
  dimensionScores: z.object({
    aiCollaboration: z.number().min(0).max(100).optional(),
    promptEngineering: z.number().min(0).max(100).optional(),
    burnoutRisk: z.number().min(0).max(100).optional(),
    toolMastery: z.number().min(0).max(100).optional(),
    aiControl: z.number().min(0).max(100).optional(),
    skillResilience: z.number().min(0).max(100).optional(),
  }).default({}),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TrackingMetrics = z.infer<typeof TrackingMetricsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get effective tier for a user (supports test override via NOSLOP_TEST_TIER)
 * Only works in non-production environments for testing all features
 */
export function getEffectiveTier(user: User): UserTier {
  const testTier = process.env.NOSLOP_TEST_TIER as UserTier | undefined;
  const isProduction = process.env.NODE_ENV === 'production';

  // Only allow test tier override in non-production environments
  if (testTier && !isProduction && UserTierSchema.safeParse(testTier).success) {
    return testTier;
  }

  return user.tier;
}

/**
 * Check if user can perform an action based on their tier
 */
export function canUserPerformAction(
  user: User,
  action: 'analyze' | 'track' | 'knowledge' | 'team' | 'api'
): boolean {
  const effectiveTier = getEffectiveTier(user);
  const limits = TIER_LIMITS[effectiveTier];

  switch (action) {
    case 'analyze':
      if (limits.analysesPerMonth === null) return true;
      return user.analysesThisMonth < limits.analysesPerMonth;
    case 'track':
      return limits.trackingEnabled;
    case 'knowledge':
      return limits.knowledgeBaseAccess;
    case 'team':
      return limits.teamManagement;
    case 'api':
      return limits.apiAccess;
    default:
      return false;
  }
}

/**
 * Get remaining analyses for the month
 */
export function getRemainingAnalyses(user: User): number | null {
  const effectiveTier = getEffectiveTier(user);
  const limits = TIER_LIMITS[effectiveTier];
  if (limits.analysesPerMonth === null) return null;
  return Math.max(0, limits.analysesPerMonth - user.analysesThisMonth);
}

/**
 * Get effective tier limits (respects test override)
 */
export function getEffectiveTierLimits(user: User) {
  return TIER_LIMITS[getEffectiveTier(user)];
}
