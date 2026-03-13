import { randomUUID } from 'node:crypto';
import { getDatabase } from './database';

export interface LocalUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  organizationId: string | null;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  organization_id: string | null;
}

function mapUser(row: UserRow): LocalUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    organizationId: row.organization_id ?? null,
  };
}

/**
 * Get or create the single local user.
 *
 * - If users exist, returns the first one (by created_at).
 * - If the table is empty, inserts a default admin user.
 *
 * This is the core of the zero-config local auth model.
 */
export function getOrCreateLocalUser(): LocalUser {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT id, email, role, created_at, organization_id FROM users ORDER BY created_at ASC LIMIT 1')
    .get() as UserRow | undefined;

  if (existing) {
    return mapUser(existing);
  }

  const now = new Date().toISOString();
  const row: UserRow = {
    id: randomUUID(),
    email: 'local@localhost',
    role: 'admin',
    created_at: now,
    organization_id: null,
  };

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
    VALUES (@id, @email, '', @role, @created_at, @created_at)
  `).run(row);

  return mapUser(row);
}

/**
 * Shim for API routes — always returns the local user.
 * The request parameter is accepted but ignored for backward compatibility.
 */
export function getCurrentUserFromRequest(_request?: unknown): LocalUser {
  return getOrCreateLocalUser();
}

export function findUserById(userId: string): LocalUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, email, role, created_at, organization_id FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;

  return row ? mapUser(row) : null;
}

export function findUserByEmail(email: string): LocalUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, email, role, created_at, organization_id FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;

  return row ? mapUser(row) : null;
}
