/**
 * Shared SQLite Loader
 *
 * Dynamic import wrapper for better-sqlite3.
 * Used by both CursorSource and CursorComposerSource.
 */
/**
 * Minimal SQLite Database interface (from better-sqlite3)
 */
export interface SqliteDatabase {
    prepare(sql: string): SqliteStatement;
    close(): void;
}
export interface SqliteStatement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | undefined;
}
export interface SqliteOpenOptions {
    readonly?: boolean;
}
type DatabaseConstructorType = new (path: string, options?: SqliteOpenOptions) => SqliteDatabase;
/**
 * Dynamically load better-sqlite3 and return the Database constructor.
 * Returns null if better-sqlite3 is not installed.
 * Caches the result after first load attempt.
 */
export declare function loadSqlite(): Promise<DatabaseConstructorType | null>;
export {};
