/**
 * save_user_prefs MCP Tool
 *
 * Persists BetterPrompt user preferences to ~/.betterprompt/prefs.json
 * with merge semantics. This keeps setup flows from hand-writing JSON
 * and allows setup completion timestamps to be stamped in code.
 *
 * @module plugin/mcp/tools/save-user-prefs
 */

import { z } from 'zod';
import { readPrefs, writePrefs, type UserPrefs } from '../../lib/prefs.js';
import { markAnalysisPending } from '../../lib/debounce.js';

export const definition = {
  name: 'save_user_prefs',
  description:
    'Update BetterPrompt user preferences in ~/.betterprompt/prefs.json. ' +
    'Provided fields are merged with existing prefs. ' +
    'Set markWelcomeCompleted=true to stamp welcomeCompleted with the exact current ISO timestamp.',
};

export const SaveUserPrefsInputSchema = z.object({
  selectedProjects: z.array(z.string()).optional().describe('Project names to analyze. Use [] to mean "all projects".'),
  starAsked: z.boolean().optional().describe('Whether the GitHub star prompt has already been handled.'),
  welcomeShown: z.boolean().optional().describe('Whether the setup welcome has been shown.'),
  welcomeVersion: z.string().optional().describe('Setup flow version, for example "2.0".'),
  markWelcomeCompleted: z.boolean().optional().describe('When true, sets welcomeCompleted to the exact current ISO timestamp.'),
  queueAnalysis: z.boolean().optional().describe('When true, queues a pending analysis for the next session via plugin-state.json.'),
});

function normalizeWelcomeVersion(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export async function execute(args: z.infer<typeof SaveUserPrefsInputSchema>): Promise<string> {
  const parsed = SaveUserPrefsInputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid user prefs payload.',
      errors: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const { markWelcomeCompleted = false, queueAnalysis = false, ...partial } = parsed.data;
  const nextPrefs: Partial<UserPrefs> = {
    ...partial,
    ...(partial.welcomeVersion !== undefined
      ? { welcomeVersion: normalizeWelcomeVersion(partial.welcomeVersion) }
      : {}),
  };

  if (markWelcomeCompleted) {
    nextPrefs.welcomeCompleted = new Date().toISOString();
  }

  if (Object.keys(nextPrefs).length === 0 && !queueAnalysis) {
    return JSON.stringify({
      status: 'noop',
      prefs: readPrefs(),
      message: 'No preference fields were provided.',
    });
  }

  if (Object.keys(nextPrefs).length > 0) {
    writePrefs(nextPrefs);
  }

  if (queueAnalysis) {
    markAnalysisPending();
  }

  return JSON.stringify({
    status: 'ok',
    prefs: readPrefs(),
    ...(queueAnalysis ? { analysisQueued: true } : {}),
    message: queueAnalysis
      ? 'Updated preferences and queued analysis for next session.'
      : 'Updated BetterPrompt user preferences.',
  });
}
