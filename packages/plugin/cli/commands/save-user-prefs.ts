/**
 * save-user-prefs CLI command
 *
 * Persists BetterPrompt user preferences with merge semantics.
 *
 * Usage: betterprompt-cli save-user-prefs --json '{"selectedProjects":[]}'
 *   OR:  betterprompt-cli save-user-prefs --file /path/to/prefs.json
 *   OR:  betterprompt-cli save-user-prefs --selectedProjects '[]' --starAsked true --markWelcomeCompleted true
 *
 * Note: --json and --file are input channels, not persisted fields. They are
 * stripped before validation — unrecognized keys in the JSON payload are ignored.
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { readPrefs, writePrefs, type UserPrefs } from '../../lib/prefs.js';
import { markAnalysisPending } from '../../lib/debounce.js';

const SaveUserPrefsInputSchema = z.object({
  selectedProjects: z.array(z.string()).optional(),
  starAsked: z.boolean().optional(),
  welcomeShown: z.boolean().optional(),
  welcomeVersion: z.string().optional(),
  markWelcomeCompleted: z.boolean().optional(),
  queueAnalysis: z.boolean().optional(),
});

function normalizeWelcomeVersion(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  // Read from --json or --file if provided
  let inputArgs = args;

  if (args.json !== undefined) {
    try {
      // CLI parser may have already parsed the JSON string into an object
      const parsed = typeof args.json === 'string' ? JSON.parse(args.json) : args.json;
      if (typeof parsed === 'object' && parsed !== null) {
        inputArgs = { ...args, ...parsed };
      }
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
      });
    }
  }

  if (typeof args.file === 'string') {
    try {
      inputArgs = { ...args, ...JSON.parse(readFileSync(args.file, 'utf-8')) };
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        message: `Failed to read input file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // Remove CLI-only args before validation
  const { json: _j, file: _f, ...cleanArgs } = inputArgs;

  const parsed = SaveUserPrefsInputSchema.safeParse(cleanArgs);
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
