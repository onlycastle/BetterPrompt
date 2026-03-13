import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const DEFAULT_DB_PATH = join(homedir(), '.betterprompt', 'betterprompt.db');
const DB_PATH = process.env.BETTERPROMPT_DB_PATH || DEFAULT_DB_PATH;

let db: Database.Database | null = null;

function initializeSchema(database: Database.Database): void {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  // Drop legacy auth tables (migration for existing DBs)
  database.exec(`
    DROP TABLE IF EXISTS device_codes;
    DROP TABLE IF EXISTS cli_tokens;
    DROP TABLE IF EXISTS user_sessions;
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id
      ON analysis_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_claimed_at
      ON analysis_results(claimed_at DESC);

    -- Team management tables
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
      invited_by TEXT,
      joined_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(user_id, team_id)
    );

    CREATE INDEX IF NOT EXISTS idx_organizations_slug
      ON organizations(slug);
    CREATE INDEX IF NOT EXISTS idx_teams_organization_id
      ON teams(organization_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user_id
      ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_team_id
      ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_organization_id
      ON team_members(organization_id);
  `);

  // Add organization_id column to users if it doesn't exist (migration for existing DBs)
  const userColumns = database.pragma('table_info(users)') as { name: string }[];
  if (!userColumns.some(c => c.name === 'organization_id')) {
    database.exec(`ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL`);
  }
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
