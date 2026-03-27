/**
 * get-user-prefs CLI command
 *
 * Reads BetterPrompt user preferences.
 *
 * Usage: betterprompt-cli get-user-prefs
 */

import { readPrefs } from '../../lib/prefs.js';

export async function execute(_args: Record<string, unknown>): Promise<string> {
  return JSON.stringify({
    status: 'ok',
    prefs: readPrefs(),
    message: 'Loaded BetterPrompt user preferences.',
  });
}
