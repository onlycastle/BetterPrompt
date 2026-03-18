/**
 * Shared SQLite Loader
 *
 * Dynamic import wrapper for better-sqlite3.
 * Used by both CursorSource and CursorComposerSource.
 */
let cachedConstructor = null;
let loadAttempted = false;
/**
 * Dynamically load better-sqlite3 and return the Database constructor.
 * Returns null if better-sqlite3 is not installed.
 * Caches the result after first load attempt.
 */
export async function loadSqlite() {
    if (loadAttempted)
        return cachedConstructor;
    loadAttempted = true;
    try {
        // @ts-ignore - better-sqlite3 may not be installed
        const sqlite = await import('better-sqlite3');
        cachedConstructor = (sqlite.default ?? sqlite);
        return cachedConstructor;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=sqlite-loader.js.map