/**
 * Cursor Platform Paths
 *
 * Cross-platform path resolution for Cursor's data directories.
 * Cursor stores data in platform-specific locations following each OS's conventions.
 */
/**
 * Get the globalStorage directory path
 */
export declare function getCursorGlobalStoragePath(): string;
/**
 * Get the workspaceStorage directory path
 */
export declare function getCursorWorkspaceStoragePath(): string;
/**
 * Get the full path to globalStorage/state.vscdb
 */
export declare function getCursorGlobalStateDbPath(): string;
