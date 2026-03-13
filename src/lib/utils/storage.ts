import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  type StoredAnalysis,
  type Evaluation,
  type AnalysisSummary,
  type ParsedSession,
  StoredAnalysisSchema,
} from '../models/index';
import { getProjectName } from '../parser/jsonl-reader';

/**
 * Default storage directory
 */
export const DEFAULT_STORAGE_PATH = join(homedir(), '.betterprompt');

/**
 * StorageManager - Handles persistence of analysis results
 */
export class StorageManager {
  private basePath: string;
  private analysesPath: string;

  constructor(basePath: string = DEFAULT_STORAGE_PATH) {
    this.basePath = basePath.startsWith('~')
      ? basePath.replace('~', homedir())
      : basePath;
    this.analysesPath = join(this.basePath, 'analyses');
  }

  /**
   * Ensure storage directories exist
   */
  async initialize(): Promise<void> {
    await mkdir(this.analysesPath, { recursive: true });
  }

  /**
   * Save an analysis result
   *
   * @param evaluation - The evaluation result from LLM analysis
   * @param session - The parsed session data
   * @param sourceHash - Optional SHA-256 hash of source JSONL for cache invalidation
   */
  async saveAnalysis(
    evaluation: Evaluation,
    session: ParsedSession,
    sourceHash?: string
  ): Promise<string> {
    await this.initialize();

    const stored: StoredAnalysis = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      evaluation,
      metadata: {
        projectPath: session.projectPath,
        projectName: getProjectName(session.projectPath),
        durationSeconds: session.durationSeconds,
        messageCount:
          session.stats.userMessageCount + session.stats.assistantMessageCount,
        toolCallCount: session.stats.toolCallCount,
        claudeCodeVersion: session.claudeCodeVersion,
        sourceHash,
      },
    };

    const filePath = join(this.analysesPath, `${evaluation.sessionId}.json`);
    await writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * Load an analysis by session ID
   */
  async loadAnalysis(sessionId: string): Promise<StoredAnalysis | null> {
    const filePath = join(this.analysesPath, `${sessionId}.json`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const result = StoredAnalysisSchema.safeParse(parsed);

      if (result.success) {
        return result.data;
      }

      console.warn(`Invalid analysis file: ${filePath}`);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if an analysis exists for a session
   */
  async hasAnalysis(sessionId: string): Promise<boolean> {
    const filePath = join(this.analysesPath, `${sessionId}.json`);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if cached analysis is valid (exists and hash matches if available)
   *
   * @param sessionId - The session ID to check
   * @param currentHash - Current hash of the source file (if available)
   * @returns Object with validity status and cached analysis if valid
   */
  async checkCacheValidity(
    sessionId: string,
    currentHash?: string
  ): Promise<{
    valid: boolean;
    analysis: StoredAnalysis | null;
    reason: 'not_found' | 'hash_mismatch' | 'valid' | 'valid_no_hash';
  }> {
    const analysis = await this.loadAnalysis(sessionId);

    if (!analysis) {
      return { valid: false, analysis: null, reason: 'not_found' };
    }

    // If we have both hashes, compare them
    const storedHash = analysis.metadata.sourceHash;
    if (currentHash && storedHash && currentHash !== storedHash) {
      return { valid: false, analysis: null, reason: 'hash_mismatch' };
    }

    // Valid cache hit
    const reason = storedHash ? 'valid' : 'valid_no_hash';
    return { valid: true, analysis, reason };
  }

  /**
   * List all saved analyses
   */
  async listAnalyses(): Promise<AnalysisSummary[]> {
    try {
      await this.initialize();
      const files = await readdir(this.analysesPath);
      const analyses: AnalysisSummary[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const sessionId = basename(file, '.json');
        const stored = await this.loadAnalysis(sessionId);

        if (stored) {
          analyses.push({
            sessionId,
            projectName: stored.metadata.projectName,
            analyzedAt: new Date(stored.evaluation.analyzedAt),
            ratings: {
              planning: stored.evaluation.planning.rating,
              criticalThinking: stored.evaluation.criticalThinking.rating,
              codeUnderstanding: stored.evaluation.codeUnderstanding.rating,
            },
            filePath: join(this.analysesPath, file),
          });
        }
      }

      // Sort by date, most recent first
      analyses.sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime());

      return analyses;
    } catch {
      return [];
    }
  }

  /**
   * Get the base storage path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get the analyses directory path
   */
  getAnalysesPath(): string {
    return this.analysesPath;
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
