import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const DEFAULT_DB_PATH = join(homedir(), '.nomoreaislop', 'nomoreaislop.db');
const DB_PATH = process.env.NOSLOP_DB_PATH || DEFAULT_DB_PATH;

let db: Database.Database | null = null;

function initializeSchema(database: Database.Database): void {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cli_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_codes (
      device_code TEXT PRIMARY KEY,
      user_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      user_id TEXT,
      cli_token TEXT,
      expires_at TEXT NOT NULL,
      authorized_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      result_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      evaluation_json TEXT NOT NULL,
      phase1_output_json TEXT,
      activity_sessions_json TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      share_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      claimed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
      ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
      ON user_sessions(session_token_hash);
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_user_id
      ON cli_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_token_hash
      ON cli_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_device_codes_user_code
      ON device_codes(user_code);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id
      ON analysis_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_claimed_at
      ON analysis_results(claimed_at DESC);
  `);
}

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  initializeSchema(db);
  return db;
}

export function getDatabasePath(): string {
  return DB_PATH;
}

export function resetDatabaseForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
}
