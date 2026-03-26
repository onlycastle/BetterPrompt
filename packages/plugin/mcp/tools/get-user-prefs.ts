/**
 * get_user_prefs MCP Tool
 *
 * Reads BetterPrompt user preferences from ~/.betterprompt/prefs.json
 * without requiring Claude to request filesystem permissions directly.
 *
 * @module plugin/mcp/tools/get-user-prefs
 */

import { readPrefs } from '../../lib/prefs.js';

export const definition = {
  name: 'get_user_prefs',
  description:
    'Read BetterPrompt user preferences from ~/.betterprompt/prefs.json. ' +
    'Use this instead of direct file reads in setup and analysis skills.',
};

export async function execute(): Promise<string> {
  return JSON.stringify({
    status: 'ok',
    prefs: readPrefs(),
    message: 'Loaded BetterPrompt user preferences.',
  });
}
