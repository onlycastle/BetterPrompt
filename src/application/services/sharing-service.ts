/**
 * Sharing Service
 *
 * Manages viral report sharing for the freemium model.
 * Handles creation, retrieval, and analytics of shared reports.
 *
 * @module application/services/sharing-service
 */

import { ok, err, type Result } from '../../lib/result.js';
import { StorageError, AnalysisError } from '../../domain/errors/index.js';
import type { ISharingRepository, IUserRepository } from '../ports/storage.js';
import type {
  SharedReport,
  CreateSharedReportInput,
  PublicReportView,
  TypeResult,
  Dimensions,
} from '../../domain/models/index.js';
import { TIER_LIMITS } from '../../domain/models/index.js';

const STYLE_EMOJI: Record<string, string> = {
  architect: '\u{1F3D7}\u{FE0F}',
  scientist: '\u{1F52C}',
  collaborator: '\u{1F91D}',
  speedrunner: '\u{26A1}',
  craftsman: '\u{1F527}',
};

/**
 * Share link result
 */
export interface ShareLinkResult {
  reportId: string;
  shareUrl: string;
  accessToken: string;
  expiresAt: string;
  twitterLink: string;
  linkedInLink: string;
}

/**
 * Sharing service dependencies
 */
export interface SharingServiceDeps {
  sharingRepo: ISharingRepository;
  userRepo?: IUserRepository;
  baseUrl?: string;
}

/**
 * Create Sharing Service
 */
export function createSharingService(deps: SharingServiceDeps) {
  const { sharingRepo, userRepo } = deps;
  const baseUrl = deps.baseUrl || process.env.NOSLOP_BASE_URL || 'https://nomoreaislop.xyz';

  return {
    /**
     * Create a shareable report
     */
    async createShare(
      input: {
        typeResult: TypeResult;
        dimensions?: Dimensions;
        userMessage?: string;
        expiresInDays?: number;
      },
      userId?: string
    ): Promise<Result<ShareLinkResult, StorageError | AnalysisError>> {
      // 1. Check user's share limit if user provided
      if (userId && userRepo) {
        const userResult = await userRepo.findById(userId);
        if (userResult.success && userResult.data) {
          const user = userResult.data;
          // For now, shares don't have strict limits - just track for analytics
          // In future, could add per-tier share limits using TIER_LIMITS[user.tier]
          void TIER_LIMITS[user.tier]; // Acknowledge usage
        }
      }

      // 2. Create the shared report
      const createInput: CreateSharedReportInput = {
        typeResult: input.typeResult,
        dimensions: input.dimensions,
        userMessage: input.userMessage,
        expiresInDays: input.expiresInDays ?? 7,
      };

      const result = await sharingRepo.create(createInput, userId);
      if (!result.success) {
        return err(result.error);
      }

      const report = result.data;

      // 3. Build share links
      const shareUrl = `${baseUrl}/r/${report.reportId}`;
      const shareText = this.buildShareText(input.typeResult);

      return ok({
        reportId: report.reportId,
        shareUrl,
        accessToken: report.accessToken?.token || '',
        expiresAt: report.expiresAt || '',
        twitterLink: this.buildTwitterLink(shareUrl, shareText),
        linkedInLink: this.buildLinkedInLink(shareUrl, shareText),
      });
    },

    /**
     * Get public report view (for viewing shared reports)
     */
    async getPublicReport(
      reportId: string
    ): Promise<Result<PublicReportView | null, StorageError>> {
      // 1. Get the report
      const result = await sharingRepo.getPublicView(reportId);
      if (!result.success) {
        return err(result.error);
      }

      if (!result.data) {
        return ok(null);
      }

      // 2. Increment view count
      await sharingRepo.incrementViews(reportId);

      return ok(result.data);
    },

    /**
     * Record a share action (when someone shares to social)
     */
    async recordShare(reportId: string): Promise<Result<void, StorageError>> {
      return sharingRepo.incrementShares(reportId);
    },

    /**
     * Deactivate a shared report
     */
    async deactivate(
      reportId: string,
      accessToken: string
    ): Promise<Result<void, StorageError | AnalysisError>> {
      // 1. Get the report and verify access token
      const reportResult = await sharingRepo.findByReportId(reportId);
      if (!reportResult.success) {
        return err(reportResult.error);
      }

      if (!reportResult.data) {
        return err(new AnalysisError(
          'REPORT_NOT_FOUND',
          `Report not found: ${reportId}`,
          'The requested report could not be found.',
          false,
          404
        ));
      }

      if (reportResult.data.accessToken?.token !== accessToken) {
        return err(new AnalysisError(
          'INVALID_TOKEN',
          'Invalid access token',
          'You do not have permission to modify this report.',
          false,
          403
        ));
      }

      // 2. Deactivate
      return sharingRepo.deactivate(reportId);
    },

    /**
     * Get user's shared reports
     */
    async getUserReports(userId: string): Promise<Result<SharedReport[], StorageError>> {
      return sharingRepo.findByUser(userId);
    },

    /**
     * Clean up expired reports
     */
    async cleanupExpired(): Promise<Result<number, StorageError>> {
      return sharingRepo.deleteExpired();
    },

    /**
     * Get report stats for admin
     */
    async getReportStats(
      reportId: string
    ): Promise<Result<{ views: number; shares: number } | null, StorageError>> {
      const result = await sharingRepo.findByReportId(reportId);
      if (!result.success) {
        return err(result.error);
      }

      if (!result.data) {
        return ok(null);
      }

      return ok({
        views: result.data.viewCount,
        shares: result.data.shareCount,
      });
    },

    /**
     * Build share text based on type result
     */
    buildShareText(typeResult: TypeResult): string {
      const styleName = typeResult.primaryType.charAt(0).toUpperCase() + typeResult.primaryType.slice(1);
      const emoji = this.getStyleEmoji(typeResult.primaryType);
      const percentage = Math.round(typeResult.distribution[typeResult.primaryType] * 100);

      return `${emoji} I'm a ${percentage}% ${styleName} developer when working with AI! What's your coding style? Find out at`;
    },

    /**
     * Get emoji for coding style
     */
    getStyleEmoji(style: string): string {
      return STYLE_EMOJI[style] || '\u{1F4BB}';
    },

    /**
     * Build Twitter share link
     */
    buildTwitterLink(shareUrl: string, text: string): string {
      const params = new URLSearchParams({
        text,
        url: shareUrl,
        hashtags: 'AICode,DevLife,NoMoreAISlop',
      });
      return `https://twitter.com/intent/tweet?${params.toString()}`;
    },

    /**
     * Build LinkedIn share link
     */
    buildLinkedInLink(shareUrl: string, text: string): string {
      const params = new URLSearchParams({
        url: shareUrl,
        title: 'My AI Coding Style',
        summary: text,
      });
      return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
    },

    /**
     * Generate OG image URL
     */
    getOgImageUrl(reportId: string): string {
      return `${baseUrl}/api/reports/${reportId}/og-image`;
    },
  };
}

/**
 * Sharing Service type
 */
export type SharingService = ReturnType<typeof createSharingService>;
