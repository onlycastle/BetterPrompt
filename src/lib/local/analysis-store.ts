import { randomBytes } from 'node:crypto';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';
import type { AnalysisResult as PipelineAnalysisResult } from '@/lib/analyzer/orchestrator/types';
import type { CanonicalAnalysisRun } from '@betterprompt/shared';
import { getDatabase } from './database';

export interface StoredAnalysisResult {
  resultId: string;
  userId: string;
  evaluation: VerboseEvaluation;
  phase1Output: PipelineAnalysisResult['phase1Output'] | null;
  canonicalRun: CanonicalAnalysisRun | null;
  activitySessions: Array<{
    sessionId: string;
    projectName: string;
    startTime: string;
    durationMinutes: number;
    messageCount: number;
    summary: string;
  }> | null;
  createdAt: string;
  claimedAt: string;
  updatedAt: string;
  viewCount: number;
  shareCount: number;
}

interface AnalysisRow {
  result_id: string;
  user_id: string;
  evaluation_json: string;
  phase1_output_json: string | null;
  canonical_run_json: string | null;
  activity_sessions_json: string | null;
  created_at: string;
  claimed_at: string;
  updated_at: string;
  view_count: number;
  share_count: number;
}

function generateResultId(): string {
  return randomBytes(6).toString('base64url');
}

function mapRow(row: AnalysisRow): StoredAnalysisResult {
  return {
    resultId: row.result_id,
    userId: row.user_id,
    evaluation: JSON.parse(row.evaluation_json) as VerboseEvaluation,
    phase1Output: row.phase1_output_json
      ? JSON.parse(row.phase1_output_json) as PipelineAnalysisResult['phase1Output']
      : null,
    canonicalRun: row.canonical_run_json
      ? JSON.parse(row.canonical_run_json) as CanonicalAnalysisRun
      : null,
    activitySessions: row.activity_sessions_json
      ? JSON.parse(row.activity_sessions_json) as StoredAnalysisResult['activitySessions']
      : null,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    updatedAt: row.updated_at,
    viewCount: row.view_count,
    shareCount: row.share_count,
  };
}

export function createAnalysisRecord(params: {
  userId: string;
  evaluation: VerboseEvaluation;
  phase1Output?: PipelineAnalysisResult['phase1Output'];
  canonicalRun?: CanonicalAnalysisRun;
  activitySessions?: StoredAnalysisResult['activitySessions'];
}): StoredAnalysisResult {
  const db = getDatabase();
  const now = new Date().toISOString();
  const resultId = generateResultId();

  db.prepare(`
    INSERT INTO analysis_results (
      result_id,
      user_id,
      evaluation_json,
      phase1_output_json,
      canonical_run_json,
      activity_sessions_json,
      created_at,
      claimed_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    resultId,
    params.userId,
    JSON.stringify(params.evaluation),
    params.phase1Output ? JSON.stringify(params.phase1Output) : null,
    params.canonicalRun ? JSON.stringify(params.canonicalRun) : null,
    params.activitySessions ? JSON.stringify(params.activitySessions) : null,
    now,
    now,
    now
  );

  return getAnalysisRecord(resultId)!;
}

export function getAnalysisRecord(resultId: string): StoredAnalysisResult | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT result_id, user_id, evaluation_json, phase1_output_json, canonical_run_json, activity_sessions_json,
           created_at, claimed_at, updated_at, view_count, share_count
    FROM analysis_results
    WHERE result_id = ?
  `).get(resultId) as AnalysisRow | undefined;

  return row ? mapRow(row) : null;
}

export function listAnalysesForUser(userId: string, limit?: number): StoredAnalysisResult[] {
  const db = getDatabase();
  const query = `
    SELECT result_id, user_id, evaluation_json, phase1_output_json, canonical_run_json, activity_sessions_json,
           created_at, claimed_at, updated_at, view_count, share_count
    FROM analysis_results
    WHERE user_id = ?
    ORDER BY claimed_at DESC
    ${limit ? 'LIMIT ?' : ''}
  `;
  const rows = (limit
    ? db.prepare(query).all(userId, limit)
    : db.prepare(query).all(userId)) as AnalysisRow[];

  return rows.map(mapRow);
}

export function listAllAnalysisRecords(): StoredAnalysisResult[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT result_id, user_id, evaluation_json, phase1_output_json, canonical_run_json, activity_sessions_json,
           created_at, claimed_at, updated_at, view_count, share_count
    FROM analysis_results
    ORDER BY claimed_at DESC
  `).all() as AnalysisRow[];

  return rows.map(mapRow);
}

export function deleteAnalysisRecord(resultId: string, userId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM analysis_results WHERE result_id = ? AND user_id = ?')
    .run(resultId, userId);
  return result.changes > 0;
}

export function incrementAnalysisView(resultId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE analysis_results
    SET view_count = view_count + 1,
        updated_at = ?
    WHERE result_id = ?
  `).run(new Date().toISOString(), resultId);
}

export function incrementAnalysisShare(resultId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE analysis_results
    SET share_count = share_count + 1,
        updated_at = ?
    WHERE result_id = ?
  `).run(new Date().toISOString(), resultId);
}
