/**
 * Supabase Analysis Repository
 *
 * Implements IAnalysisRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/analysis-repo
 */

import { getSupabaseClient } from './client.js';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import {
  getErrorMessage,
  isNotFoundError,
  hasMoreResults,
  getFirstOfMonth,
  getPaginationRange,
} from './helpers.js';
import type {
  IAnalysisRepository,
  PaginatedResult,
  QueryOptions,
} from '../../../application/ports/storage.js';
import type {
  StoredAnalysis,
  AnalysisSummary,
  Evaluation,
  TypeResult,
  Dimensions,
} from '../../../domain/models/index.js';

interface AnalysisRow {
  id: string;
  user_id: string | null;
  session_id: string;
  project_path: string;
  project_name: string;
  evaluation: Evaluation;
  type_result: TypeResult | null;
  dimensions: Dimensions | null;
  metadata: {
    durationSeconds?: number;
    messageCount?: number;
    toolCallCount?: number;
    model?: string;
  };
  created_at: string;
  updated_at: string | null;
}

function toStoredAnalysis(row: AnalysisRow): StoredAnalysis {
  return {
    version: '1.0.0',
    createdAt: row.created_at,
    evaluation: row.evaluation,
    metadata: {
      projectPath: row.project_path,
      projectName: row.project_name,
      durationSeconds: row.metadata?.durationSeconds || 0,
      messageCount: row.metadata?.messageCount || 0,
      toolCallCount: row.metadata?.toolCallCount || 0,
      claudeCodeVersion:
        (row.metadata as Record<string, unknown>)?.claudeCodeVersion as string || 'unknown',
    },
    typeResult: row.type_result || undefined,
    dimensions: row.dimensions || undefined,
  };
}

function toAnalysisSummary(row: AnalysisRow): AnalysisSummary {
  return {
    sessionId: row.session_id,
    projectName: row.project_name,
    analyzedAt: new Date(row.created_at),
    ratings: {
      planning: row.evaluation?.planning?.rating || 'Needs Work',
      criticalThinking: row.evaluation?.criticalThinking?.rating || 'Needs Work',
      codeUnderstanding: row.evaluation?.codeUnderstanding?.rating || 'Needs Work',
    },
    filePath: '',
  };
}

function toDbRow(analysis: StoredAnalysis, userId?: string): Omit<AnalysisRow, 'updated_at'> {
  return {
    id: analysis.evaluation.sessionId,
    user_id: userId || null,
    session_id: analysis.evaluation.sessionId,
    project_path: analysis.metadata.projectPath,
    project_name: analysis.metadata.projectName,
    evaluation: analysis.evaluation,
    type_result: analysis.typeResult || null,
    dimensions: analysis.dimensions || null,
    metadata: {
      durationSeconds: analysis.metadata.durationSeconds,
      messageCount: analysis.metadata.messageCount,
      toolCallCount: analysis.metadata.toolCallCount,
    },
    created_at: analysis.createdAt,
  };
}

function getSortColumn(field?: 'createdAt' | 'projectName'): string {
  return field === 'projectName' ? 'project_name' : 'created_at';
}

export function createSupabaseAnalysisRepository(): IAnalysisRepository {
  return {
    async save(analysis: StoredAnalysis): Promise<Result<string, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const row = toDbRow(analysis);

        const { data, error } = await supabase
          .from('analyses')
          .upsert(row)
          .select('id')
          .single();

        if (error) {
          return err(StorageError.writeFailed('analyses', analysis.evaluation.sessionId, error.message));
        }

        return ok(data.id);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findBySessionId(sessionId: string): Promise<Result<StoredAnalysis | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('analyses', sessionId, error.message));
        }

        return ok(toStoredAnalysis(data as AnalysisRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findById(id: string): Promise<Result<StoredAnalysis | null, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (isNotFoundError(error)) {
            return ok(null);
          }
          return err(StorageError.readFailed('analyses', id, error.message));
        }

        return ok(toStoredAnalysis(data as AnalysisRow));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByUser(
      userId: string,
      options?: QueryOptions<'createdAt' | 'projectName'>
    ): Promise<Result<PaginatedResult<AnalysisSummary>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options?.pagination);
        const sortField = getSortColumn(options?.sort?.field);
        const ascending = options?.sort?.direction === 'asc';

        const { data, error, count } = await supabase
          .from('analyses')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order(sortField, { ascending })
          .range(offset, end);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok({
          items: (data as AnalysisRow[]).map(toAnalysisSummary),
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async findByTeam(
      teamId: string,
      options?: QueryOptions<'createdAt' | 'projectName'>
    ): Promise<Result<PaginatedResult<AnalysisSummary>, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const { limit, offset, end } = getPaginationRange(options?.pagination);
        const sortField = getSortColumn(options?.sort?.field);
        const ascending = options?.sort?.direction === 'asc';

        const { data: members, error: memberError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId);

        if (memberError) {
          return err(StorageError.queryFailed(memberError.message));
        }

        const userIds = members?.map((m) => m.user_id) || [];

        if (userIds.length === 0) {
          return ok({ items: [], total: 0, hasMore: false });
        }

        const { data, error, count } = await supabase
          .from('analyses')
          .select('*', { count: 'exact' })
          .in('user_id', userIds)
          .order(sortField, { ascending })
          .range(offset, end);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok({
          items: (data as AnalysisRow[]).map(toAnalysisSummary),
          total: count ?? 0,
          hasMore: hasMoreResults(count, offset, limit),
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { error } = await supabase.from('analyses').delete().eq('id', id);

        if (error) {
          return err(StorageError.deleteFailed('analyses', id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async countThisMonth(userId: string): Promise<Result<number, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const firstOfMonth = getFirstOfMonth();

        const { count, error } = await supabase
          .from('analyses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', firstOfMonth);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok(count ?? 0);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async exists(sessionId: string): Promise<Result<boolean, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        const { count, error } = await supabase
          .from('analyses')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);

        if (error) {
          return err(StorageError.queryFailed(error.message));
        }

        return ok((count ?? 0) > 0);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
