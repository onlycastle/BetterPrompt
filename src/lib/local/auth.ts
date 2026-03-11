import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from './database';

const SESSION_TTL_DAYS = 30;
const CLI_TOKEN_TTL_DAYS = 30;
const SESSION_COOKIE_NAME = 'nomoreaislop_session';
const SESSION_TOKEN_PREFIX = 'sess_';
const CLI_TOKEN_PREFIX = 'cli_';

export interface LocalUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) {
    return false;
  }

  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actual, expectedBuffer);
}

function mapUser(row: Pick<UserRow, 'id' | 'email' | 'role' | 'created_at'>): LocalUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

function getExpiryIso(days: number): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

export function isCliToken(token: string): boolean {
  return token.startsWith(CLI_TOKEN_PREFIX);
}

export function createUser(email: string, password: string): LocalUser {
  const db = getDatabase();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalizedEmail) as { id: string } | undefined;

  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const now = new Date().toISOString();
  const userCount = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
  const role = userCount === 0 ? 'admin' : 'member';
  const row: UserRow = {
    id: randomUUID(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    role,
    created_at: now,
  };

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
    VALUES (@id, @email, @password_hash, @role, @created_at, @created_at)
  `).run(row);

  return mapUser(row);
}

export function authenticateUser(email: string, password: string): LocalUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, email, role, created_at, password_hash FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as UserRow | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return null;
  }

  return mapUser(row);
}

export function findUserById(userId: string): LocalUser | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
    .get(userId) as Pick<UserRow, 'id' | 'email' | 'role' | 'created_at'> | undefined;

  return row ? mapUser(row) : null;
}

export function createWebSession(userId: string): { sessionToken: string; expiresAt: string } {
  const db = getDatabase();
  const sessionToken = `${SESSION_TOKEN_PREFIX}${randomBytes(20).toString('hex')}`;
  const expiresAt = getExpiryIso(SESSION_TTL_DAYS);

  db.prepare(`
    INSERT INTO user_sessions (id, user_id, session_token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, hashOpaqueToken(sessionToken), expiresAt, new Date().toISOString());

  return { sessionToken, expiresAt };
}

export function invalidateWebSession(sessionToken: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM user_sessions WHERE session_token_hash = ?')
    .run(hashOpaqueToken(sessionToken));
}

export function findUserBySessionToken(sessionToken: string): LocalUser | null {
  if (!sessionToken.startsWith(SESSION_TOKEN_PREFIX)) {
    return null;
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT users.id, users.email, users.role, users.created_at, user_sessions.expires_at
    FROM user_sessions
    INNER JOIN users ON users.id = user_sessions.user_id
    WHERE user_sessions.session_token_hash = ?
  `).get(hashOpaqueToken(sessionToken)) as (Pick<UserRow, 'id' | 'email' | 'role' | 'created_at'> & { expires_at: string }) | undefined;

  if (!row || new Date(row.expires_at) < new Date()) {
    return null;
  }

  return mapUser(row);
}

export function createCliTokenForUser(userId: string): string {
  const db = getDatabase();
  const token = `${CLI_TOKEN_PREFIX}${randomBytes(20).toString('hex')}`;

  db.prepare(`
    INSERT INTO cli_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    userId,
    hashOpaqueToken(token),
    getExpiryIso(CLI_TOKEN_TTL_DAYS),
    new Date().toISOString()
  );

  return token;
}

export function validateCliToken(token: string): string | null {
  if (!isCliToken(token)) {
    return null;
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, user_id, expires_at, revoked_at
    FROM cli_tokens
    WHERE token_hash = ?
  `).get(hashOpaqueToken(token)) as ({ id: string; user_id: string; expires_at: string; revoked_at: string | null }) | undefined;

  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    return null;
  }

  db.prepare('UPDATE cli_tokens SET last_used_at = ? WHERE id = ?')
    .run(new Date().toISOString(), row.id);

  return row.user_id;
}

export function createDeviceAuthorization(): {
  deviceCode: string;
  userCode: string;
  expiresAt: string;
} {
  const db = getDatabase();
  const deviceCode = randomBytes(24).toString('base64url');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const bytes = randomBytes(8);
  let userCode = '';
  for (let i = 0; i < 4; i++) {
    userCode += chars.charAt(bytes[i] % chars.length);
  }
  userCode += '-';
  for (let i = 0; i < 4; i++) {
    userCode += nums.charAt(bytes[i + 4] % nums.length);
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO device_codes (device_code, user_code, status, expires_at, created_at)
    VALUES (?, ?, 'pending', ?, ?)
  `).run(deviceCode, userCode, expiresAt, now);

  return { deviceCode, userCode, expiresAt };
}

export function authorizeDeviceCode(userCode: string, userId: string): void {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT device_code, status, expires_at
    FROM device_codes
    WHERE user_code = ?
  `).get(userCode.toUpperCase()) as ({ device_code: string; status: string; expires_at: string }) | undefined;

  if (!row) {
    throw new Error('Invalid device code');
  }

  if (new Date(row.expires_at) < new Date()) {
    throw new Error('Device code has expired');
  }

  if (row.status !== 'pending') {
    throw new Error('Device code has already been used');
  }

  const cliToken = createCliTokenForUser(userId);

  db.prepare(`
    UPDATE device_codes
    SET status = 'authorized',
        user_id = ?,
        cli_token = ?,
        authorized_at = ?
    WHERE device_code = ?
  `).run(userId, cliToken, new Date().toISOString(), row.device_code);
}

export function exchangeDeviceCode(deviceCode: string): {
  status: 'pending' | 'authorized' | 'expired' | 'invalid';
  accessToken?: string;
  userId?: string;
} {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT user_id, status, cli_token, expires_at
    FROM device_codes
    WHERE device_code = ?
  `).get(deviceCode) as ({ user_id: string | null; status: string; cli_token: string | null; expires_at: string }) | undefined;

  if (!row) {
    return { status: 'invalid' };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { status: 'expired' };
  }

  if (row.status !== 'authorized' || !row.user_id || !row.cli_token) {
    return { status: 'pending' };
  }

  db.prepare(`
    UPDATE device_codes
    SET status = 'used'
    WHERE device_code = ?
  `).run(deviceCode);

  return {
    status: 'authorized',
    accessToken: row.cli_token,
    userId: row.user_id,
  };
}

export function getWebSessionCookie(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function getCurrentUserFromRequest(request: NextRequest): LocalUser | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (isCliToken(token)) {
      const userId = validateCliToken(token);
      return userId ? findUserById(userId) : null;
    }
    if (token.startsWith(SESSION_TOKEN_PREFIX)) {
      return findUserBySessionToken(token);
    }
  }

  const sessionToken = getWebSessionCookie(request);
  return sessionToken ? findUserBySessionToken(sessionToken) : null;
}

export function applySessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: string
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
