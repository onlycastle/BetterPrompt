/**
 * Supabase Tracking Repository
 *
 * Implements ITrackingRepository using Supabase.
 *
 * @module infrastructure/storage/supabase/tracking-repo
 */

import { getSupabaseClient } from './client.js';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import { getErrorMessage } from './helpers.js';
import type { ITrackingRepository } from '../../../application/ports/storage.js';
import type { TrackingMetrics } from '../../../domain/models/index.js';

interface TrackingMetricsRow {
  id: string;
  user_id: string;
  date: string;
  sessions_analyzed: number;
  average_score: number | null;
  dimension_scores: {
    aiCollaboration?: number;
    promptEngineering?: number;
    burnoutRisk?: number;
    toolMastery?: number;
    aiControl?: number;
    skillResilience?: number;
  };
  created_at: string;
  updated_at: string;
}

function toTrackingMetrics(row: TrackingMetricsRow): TrackingMetrics {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    sessionsAnalyzed: row.sessions_analyzed,
    averageScore: row.average_score ?? undefined,
    dimensionScores: {
      aiCollaboration: row.dimension_scores?.aiCollaboration,
      promptEngineering: row.dimension_scores?.promptEngineering,
      burnoutRisk: row.dimension_scores?.burnoutRisk,
      toolMastery: row.dimension_scores?.toolMastery,
      aiControl: row.dimension_scores?.aiControl,
      skillResilience: row.dimension_scores?.skillResilience,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseTrackingRepository(): ITrackingRepository {
  return {
    async saveDailyMetrics(metrics: TrackingMetrics): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        const { error } = await supabase
          .from('tracking_metrics')
          .upsert({
            id: metrics.id,
            user_id: metrics.userId,
            date: metrics.date,
            sessions_analyzed: metrics.sessionsAnalyzed,
            average_score: metrics.averageScore ?? null,
            dimension_scores: metrics.dimensionScores,
            created_at: metrics.createdAt ?? now,
            updated_at: now,
          }, {
            onConflict: 'user_id,date',
          });

        if (error) {
          return err(StorageError.writeFailed('tracking_metrics', metrics.id, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getMetrics(
      userId: string,
      startDate: Date,
      endDate: Date
    ): Promise<Result<TrackingMetrics[], StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('tracking_metrics')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: true });

        if (error) {
          return err(StorageError.readFailed('tracking_metrics', userId, error.message));
        }

        return ok((data || []).map((row) => toTrackingMetrics(row as TrackingMetricsRow)));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getLatest(userId: string, days: number = 30): Promise<Result<TrackingMetrics[], StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startStr = startDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('tracking_metrics')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startStr)
          .order('date', { ascending: false })
          .limit(days);

        if (error) {
          return err(StorageError.readFailed('tracking_metrics', userId, error.message));
        }

        return ok((data || []).map((row) => toTrackingMetrics(row as TrackingMetricsRow)));
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async getSummary(userId: string): Promise<Result<{
      totalSessions: number;
      avgScore: number;
      dimensionAverages: Record<string, number>;
      streak: number;
    }, StorageError>> {
      try {
        const supabase = getSupabaseClient();

        // Get all metrics for this user
        const { data, error } = await supabase
          .from('tracking_metrics')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (error) {
          return err(StorageError.readFailed('tracking_metrics', userId, error.message));
        }

        const metrics = (data || []).map((row) => toTrackingMetrics(row as TrackingMetricsRow));

        if (metrics.length === 0) {
          return ok({
            totalSessions: 0,
            avgScore: 0,
            dimensionAverages: {},
            streak: 0,
          });
        }

        // Calculate total sessions
        const totalSessions = metrics.reduce((sum, m) => sum + m.sessionsAnalyzed, 0);

        // Calculate average score
        const validScores = metrics.filter((m) => m.averageScore !== undefined);
        const avgScore = validScores.length > 0
          ? validScores.reduce((sum, m) => sum + (m.averageScore ?? 0), 0) / validScores.length
          : 0;

        // Calculate dimension averages
        const dimensionAverages: Record<string, number> = {};
        const dimensionKeys = [
          'aiCollaboration',
          'promptEngineering',
          'burnoutRisk',
          'toolMastery',
          'aiControl',
          'skillResilience',
        ];

        for (const key of dimensionKeys) {
          const validValues = metrics
            .map((m) => m.dimensionScores[key as keyof typeof m.dimensionScores])
            .filter((v): v is number => v !== undefined);

          if (validValues.length > 0) {
            dimensionAverages[key] = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
          }
        }

        // Calculate current streak (consecutive days from most recent)
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if there's activity today or yesterday (to allow for timezone differences)
        const mostRecentDate = new Date(metrics[0].date);
        const daysDiff = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 1) {
          // Start counting streak
          streak = 1;
          let currentDate = new Date(metrics[0].date);

          for (let i = 1; i < metrics.length; i++) {
            const prevDate = new Date(metrics[i].date);
            const expectedPrevDate = new Date(currentDate);
            expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);

            const prevDateStr = prevDate.toISOString().split('T')[0];
            const expectedStr = expectedPrevDate.toISOString().split('T')[0];

            if (prevDateStr === expectedStr) {
              streak++;
              currentDate = prevDate;
            } else {
              break;
            }
          }
        }

        return ok({
          totalSessions,
          avgScore,
          dimensionAverages,
          streak,
        });
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },

    async updateToday(userId: string, updates: Partial<TrackingMetrics>): Promise<Result<void, StorageError>> {
      try {
        const supabase = getSupabaseClient();
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // Build update object
        const dbUpdates: Record<string, unknown> = { updated_at: now };

        if (updates.sessionsAnalyzed !== undefined) {
          dbUpdates.sessions_analyzed = updates.sessionsAnalyzed;
        }
        if (updates.averageScore !== undefined) {
          dbUpdates.average_score = updates.averageScore;
        }
        if (updates.dimensionScores !== undefined) {
          dbUpdates.dimension_scores = updates.dimensionScores;
        }

        const { error } = await supabase
          .from('tracking_metrics')
          .update(dbUpdates)
          .eq('user_id', userId)
          .eq('date', today);

        if (error) {
          return err(StorageError.writeFailed('tracking_metrics', userId, error.message));
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
      }
    },
  };
}
