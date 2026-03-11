/**
 * Debug script to analyze Cursor blob roles
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CURSOR_DIR = process.env.CURSOR_CHATS_DIR || path.join(os.homedir(), '.cursor', 'chats');

// Find latest store.db
const workspaces = fs.readdirSync(CURSOR_DIR);
let latestDb: string | null = null;
let latestMtime = 0;

for (const ws of workspaces) {
  const wsPath = path.join(CURSOR_DIR, ws);
  const wsStat = fs.statSync(wsPath);
  if (!wsStat.isDirectory()) continue;

  const sessions = fs.readdirSync(wsPath);
  for (const sess of sessions) {
    const dbPath = path.join(wsPath, sess, 'store.db');
    try {
      const stat = fs.statSync(dbPath);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestDb = dbPath;
      }
    } catch {
      // ignore
    }
  }
}

// Collect all DBs
const allDbs: { path: string; mtime: number }[] = [];

for (const ws of workspaces) {
  const wsPath = path.join(CURSOR_DIR, ws);
  const wsStat = fs.statSync(wsPath);
  if (!wsStat.isDirectory()) continue;

  const sessions = fs.readdirSync(wsPath);
  for (const sess of sessions) {
    const dbPath = path.join(wsPath, sess, 'store.db');
    try {
      const stat = fs.statSync(dbPath);
      allDbs.push({ path: dbPath, mtime: stat.mtimeMs });
    } catch {
      // ignore
    }
  }
}

allDbs.sort((a, b) => b.mtime - a.mtime);
const dbsToCheck = allDbs.slice(0, 10);

console.log(`Checking ${dbsToCheck.length} latest sessions...\n`);

interface BlobRow {
  id: string;
  data: Buffer;
}

let totalUserMsgs = 0;
let realUserMsgs = 0;

for (const dbInfo of dbsToCheck) {
  const db = new Database(dbInfo.path);
  const rows = db.prepare('SELECT id, data FROM blobs').all() as BlobRow[];
  for (const row of rows) {
    try {
      const json = JSON.parse(row.data.toString('utf-8'));

      if (json.role === 'user') {
        totalUserMsgs++;
        const contentStr = typeof json.content === 'string'
          ? json.content
          : Array.isArray(json.content) && json.content[0]?.text
            ? json.content[0].text
            : JSON.stringify(json.content);

        // Check if it's NOT system metadata
        const isSystemMeta =
          contentStr?.startsWith('<user_info>') ||
          contentStr?.startsWith('[Extension Host]') ||
          contentStr?.startsWith('[{"type":"text","text":"[');

        if (!isSystemMeta && contentStr && contentStr.length > 10) {
          realUserMsgs++;
          if (realUserMsgs <= 5) {
            console.log(`=== REAL USER MESSAGE ${realUserMsgs} ===`);
            console.log('Session:', path.basename(path.dirname(dbInfo.path)));
            console.log('Content:', contentStr.substring(0, 150));
            console.log('');
          }
        }
      }
    } catch {
      // Not JSON
    }
  }

  db.close();
}

console.log('Summary:');
console.log(`- Total user messages: ${totalUserMsgs}`);
console.log(`- Real user messages (not system meta): ${realUserMsgs}`);
