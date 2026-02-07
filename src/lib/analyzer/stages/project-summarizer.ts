/**
 * Project Summarizer Stage - LLM-based project-level summary generation
 *
 * Generates 2-3 summary lines per project by grouping session summaries
 * and using LLM to synthesize major work themes.
 *
 * Pipeline position: Runs in parallel with Phase 2 workers
 * (only depends on activitySessions, independent of Phase 1 output)
 *
 * Optimization:
 * - Projects with <=3 sessions: pass summaries through as-is (skip LLM)
 * - Projects with >3 sessions: LLM generates 2-3 line summary
 * - Single LLM call for all projects that need summarization
 *
 * @module analyzer/stages/project-summarizer
 */

import { z } from 'zod';
import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import {
  PROJECT_SUMMARIZER_SYSTEM_PROMPT,
  buildProjectSummarizerUserPrompt,
  type ProjectSessionGroup,
} from './project-summarizer-prompts';
import type { ProjectSummary } from '../../models/verbose-evaluation';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the Project Summarizer stage
 */
export interface ProjectSummarizerConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  maxOutputTokens?: number;
  verbose?: boolean;
}

/**
 * Result of project summarizer stage including token usage
 */
export interface ProjectSummarizerResult {
  data: ProjectSummary[];
  usage: TokenUsage;
}

/**
 * Input session data (from activitySessions)
 */
export interface ProjectSummarizerInput {
  sessionId: string;
  projectName: string;
  summary: string;
}

/**
 * LLM response schema for project summaries batch
 * Gemini nesting: root{} -> projects[] -> item{} = 2 levels (well within 4-level limit)
 */
export const ProjectSummaryBatchLLMSchema = z.object({
  projects: z.array(z.object({
    projectName: z.string(),
    summaryLines: z.array(z.string()),
    sessionCount: z.number(),
  })),
});

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<ProjectSummarizerConfig, 'apiKey' | 'verbose'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
  maxRetries: 2,
  maxOutputTokens: 65536,
};

/** Threshold: projects with this many or fewer sessions get passed through directly */
const PASSTHROUGH_THRESHOLD = 3;

/** Zero token usage (no LLM call was made) */
const ZERO_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

// ============================================================================
// Project Summarizer Stage
// ============================================================================

/**
 * Project Summarizer Stage - LLM-based project summary generation
 *
 * Groups sessions by project, then:
 * - Small projects (<=3 sessions): uses session summaries directly
 * - Large projects (>3 sessions): sends to LLM for 2-3 line synthesis
 *
 * @example
 * ```typescript
 * const summarizer = new ProjectSummarizerStage({
 *   apiKey: process.env.GOOGLE_GEMINI_API_KEY,
 * });
 *
 * const result = await summarizer.summarize([
 *   { sessionId: 'a', projectName: 'my-app', summary: 'Implement auth flow' },
 *   { sessionId: 'b', projectName: 'my-app', summary: 'Fix login bug' },
 * ]);
 * ```
 */
export class ProjectSummarizerStage {
  private client: GeminiClient;
  private maxOutputTokens: number;
  private verbose: boolean;

  constructor(config: ProjectSummarizerConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.maxOutputTokens = config.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens;
    this.verbose = config.verbose ?? false;
  }

  /**
   * Generate 2-3 line project summaries from session data
   *
   * @param sessions - Array of session data with project names and summaries
   * @returns Project summaries with token usage
   */
  async summarize(
    sessions: ProjectSummarizerInput[]
  ): Promise<ProjectSummarizerResult> {
    if (sessions.length === 0) {
      return { data: [], usage: ZERO_USAGE };
    }

    // Group sessions by project
    const projectGroups = this.groupByProject(sessions);

    // Split into passthrough (<=3 sessions) and LLM (>3 sessions)
    const passthroughProjects: ProjectSummary[] = [];
    const llmProjects: ProjectSessionGroup[] = [];

    for (const group of projectGroups) {
      if (group.sessionCount <= PASSTHROUGH_THRESHOLD) {
        // Small projects: use session summaries directly
        passthroughProjects.push({
          projectName: group.projectName,
          summaryLines: group.summaries.slice(0, 3),
          sessionCount: group.sessionCount,
        });
      } else {
        llmProjects.push(group);
      }
    }

    this.log(`Projects: ${projectGroups.length} total, ${passthroughProjects.length} passthrough, ${llmProjects.length} need LLM`);

    // If no projects need LLM summarization, return passthrough only
    if (llmProjects.length === 0) {
      return { data: passthroughProjects, usage: ZERO_USAGE };
    }

    // LLM call for projects with >3 sessions
    const userPrompt = buildProjectSummarizerUserPrompt(llmProjects);

    const result = await this.client.generateStructured({
      systemPrompt: PROJECT_SUMMARIZER_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: ProjectSummaryBatchLLMSchema,
      maxOutputTokens: this.maxOutputTokens,
    });

    // Merge LLM results with passthrough projects
    const allProjects = [
      ...passthroughProjects,
      ...result.data.projects.map(p => ({
        projectName: p.projectName,
        summaryLines: p.summaryLines.slice(0, 3), // Enforce max 3 lines
        sessionCount: p.sessionCount,
      })),
    ];

    this.log(`Generated summaries for ${result.data.projects.length} projects via LLM`);

    return {
      data: allProjects,
      usage: result.usage,
    };
  }

  /**
   * Group sessions by project name
   */
  private groupByProject(sessions: ProjectSummarizerInput[]): ProjectSessionGroup[] {
    const map = new Map<string, string[]>();

    for (const session of sessions) {
      if (!map.has(session.projectName)) {
        map.set(session.projectName, []);
      }
      if (session.summary) {
        map.get(session.projectName)!.push(session.summary);
      }
    }

    return Array.from(map.entries())
      .map(([projectName, summaries]) => ({
        projectName,
        sessionCount: summaries.length,
        summaries,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount); // Most active first
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ProjectSummarizer] ${message}`);
    }
  }
}
