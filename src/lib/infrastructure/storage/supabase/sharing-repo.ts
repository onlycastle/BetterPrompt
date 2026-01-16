/**
 * Supabase Sharing Repository
 *
 * Implements ISharingRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/sharing-repo
 */

import { getSupabaseClient } from './client';
import { ok, err, type Result } from '../../../result';
import { StorageError } from '../../../domain/errors/index';
import {
  getErrorMessage,
  isNotFoundError,
  generateShortId,
  generateAccessToken,
} from './helpers';
import type { ISharingRepository } from '../../../application/ports/storage';
import type {
  SharedReport,
  CreateSharedReportInput,
  PublicReportView,
} from '../../../domain/models/index';

interface SharedReportRow {
  id: string;
  report_id: string;
  access_token: string;
  user_id: string | null;
  type_result: SharedReport['typeResult'];
  dimensions: SharedReport['dimensions'];
  user_message: string | null;
  source_analysis_id: string | null;
  view_count: number;
  share_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

function toSharedReport(row: SharedReportRow): SharedReport {
  return {
    id: row.id,
    reportId: row.report_id,
    accessLevel: 'public',
    accessToken: {
      token: row.access_token,
      usageCount: 0,
      expiresAt: row.expires_at || undefined,
    },
    typeResult: row.type_result,
    dimensions: row.dimensions,
    userMessage: row.user_message || undefined,
    viewCount: row.view_count,
    shareCount: row.share_count,
    sourceAnalysisId: row.source_analysis_id || undefined,
    userId: row.user_id || undefined,
    isActive: row.is_active,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicReportView(row: SharedReportRow): PublicReportView {
  return {
    reportId: row.report_id,
    typeResult: row.type_result,
    dimensions: row.dimensions,
    userMessage: row.user_message || undefined,
    createdAt: row.created_at,
    viewCount: row.view_count,
  };
}

export function createSupabaseSharingRepository(): ISharingRepository {
  return {
    async create(
      input: CreateSharedReportInput,
      userId?: string
    ): Promise<Result<SharedReport, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const reportId = generateShortId();
        const accessToken = generateAccessToken();
        const expiresAt = new Date(
          Date.now() + (input.expiresInDays || 7) * 24 * 60 * 60 * 1000
        ).toISOString();
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('shared_reports')
          .insert({
            report_id: reportId,
            access_token: accessToken,
            user_id: userId || null,
            type_result: input.typeResult,
            dimensions: input.dimensions || null,
            user_message: input.userMessage || null,
            view_count: 0,
            share_count: 0,
            is_active: true,
            created_at: now,
            updated_at: now,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (error) {
          return err(StorageError.writeFailed('shared_reports', reportId, error.message));
        }

        return ok(toSharedReport(data as SharedReportRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByReportId(reportId: string): Promise<Result<SharedReport | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('shared_reports')
          .select('*')
          .eq('report_id', reportId)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('shared_reports', reportId, error.message));
        }

        return ok(toSharedReport(data as SharedReportRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getPublicView(reportId: string): Promise<Result<PublicReportView | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('shared_reports')
          .select('*')
          .eq('report_id', reportId)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('shared_reports', reportId, error.message));
        }

        return ok(toPublicReportView(data as SharedReportRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async incrementViews(reportId: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error: rpcError } = await supabase.rpc('increment_report_views', {
          report_uuid: reportId,
        });

        if (rpcError) {
          const { data, error: readError } = await supabase
            .from('shared_reports')
            .select('id, view_count')
            .eq('report_id', reportId)
            .single();

          if (readError) {
            return err(StorageError.readFailed('shared_reports', reportId, readError.message));
          }

          const { error: updateError } = await supabase
            .from('shared_reports')
            .update({
              view_count: (data.view_count || 0) + 1,
              last_viewed_at: new Date().toISOString(),
            })
            .eq('id', data.id);

          if (updateError) {
            return err(StorageError.writeFailed('shared_reports', reportId, updateError.message));
          }
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async incrementShares(reportId: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error: rpcError } = await supabase.rpc('increment_report_shares', {
          report_uuid: reportId,
        });

        if (rpcError) {
          const { data, error: readError } = await supabase
            .from('shared_reports')
            .select('id, share_count')
            .eq('report_id', reportId)
            .single();

          if (readError) {
            return err(StorageError.readFailed('shared_reports', reportId, readError.message));
          }

          const { error: updateError } = await supabase
            .from('shared_reports')
            .update({ share_count: (data.share_count || 0) + 1 })
            .eq('id', data.id);

          if (updateError) {
            return err(StorageError.writeFailed('shared_reports', reportId, updateError.message));
          }
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async deactivate(reportId: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('shared_reports')
          .update({ is_active: false })
          .eq('report_id', reportId);

        if (error) {
          return err(StorageError.writeFailed('shared_reports', reportId, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByUser(userId: string): Promise<Result<SharedReport[], StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('shared_reports')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((data || []).map((row) => toSharedReport(row as SharedReportRow)));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async deleteExpired(): Promise<Result<number, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('shared_reports')
          .delete()
          .lt('expires_at', new Date().toISOString())
          .select('id');

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok(data?.length ?? 0);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
