/**
 * Cursor Platform Paths
 *
 * Cross-platform path resolution for Cursor's data directories.
 * Cursor stores data in platform-specific locations following each OS's conventions.
 */

import { join } from 'node:path';
import { homedir, platform } from 'node:os';

/**
 * Get the Cursor User data directory for the current platform
 *
 * - macOS: ~/Library/Application Support/Cursor/User
 * - Linux: ~/.config/Cursor/User
 * - Windows: %APPDATA%/Cursor/User
 */
function getCursorUserDir(): string {
  const home = homedir();

  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Cursor', 'User');
    case 'win32':
      return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Cursor', 'User');
    default: // linux, freebsd, etc.
      return join(home, '.config', 'Cursor', 'User');
  }
}

/**
 * Get the globalStorage directory path
 */
export function getCursorGlobalStoragePath(): string {
  return join(getCursorUserDir(), 'globalStorage');
}

/**
 * Get the workspaceStorage directory path
 */
export function getCursorWorkspaceStoragePath(): string {
  return join(getCursorUserDir(), 'workspaceStorage');
}

/**
 * Get the full path to globalStorage/state.vscdb
 */
export function getCursorGlobalStateDbPath(): string {
  return join(getCursorGlobalStoragePath(), 'state.vscdb');
}
