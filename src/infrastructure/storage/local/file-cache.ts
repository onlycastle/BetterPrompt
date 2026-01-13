/**
 * Local File Cache
 *
 * File-based cache for offline-first support.
 * Stores data locally and tracks sync status.
 *
 * @module infrastructure/storage/local/file-cache
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';

const BASE_DIR = path.join(os.homedir(), '.nomoreaislop');

interface CacheEntry<T> {
  data: T;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  pendingSync: boolean;
}

export interface PendingChange {
  id: string;
  type: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
  retryCount: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (e) {
    if (isNotFoundError(e)) {
      return null;
    }
    throw e;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (e) {
    if (!isNotFoundError(e)) {
      throw e;
    }
  }
}

async function readJsonFilesFromDir<T>(
  dir: string,
  filter?: (entry: T) => boolean
): Promise<T[]> {
  await ensureDir(dir);
  const files = await fs.readdir(dir);
  const items: T[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const content = await fs.readFile(path.join(dir, file), 'utf-8');
      const entry = JSON.parse(content) as T;
      if (!filter || filter(entry)) {
        items.push(entry);
      }
    } catch {
      // Skip invalid files
    }
  }

  return items;
}

async function clearDir(dir: string): Promise<void> {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      await fs.unlink(path.join(dir, file));
    }
  } catch (e) {
    if (!isNotFoundError(e)) {
      throw e;
    }
  }
}

export function createLocalFileCache<T extends { id: string }>(
  entityType: string
): {
  get: (id: string) => Promise<Result<T | null, StorageError>>;
  set: (entity: T, synced?: boolean) => Promise<Result<void, StorageError>>;
  delete: (id: string) => Promise<Result<void, StorageError>>;
  list: () => Promise<Result<T[], StorageError>>;
  getPending: () => Promise<Result<T[], StorageError>>;
  markSynced: (id: string) => Promise<Result<void, StorageError>>;
  clear: () => Promise<Result<void, StorageError>>;
} {
  const cacheDir = path.join(BASE_DIR, 'cache', entityType);

  return {
    async get(id: string): Promise<Result<T | null, StorageError>> {
      try {
        const filePath = path.join(cacheDir, `${id}.json`);
        const entry = await readJsonFile<CacheEntry<T>>(filePath);
        return ok(entry?.data ?? null);
      } catch (e) {
        return err(StorageError.readFailed('local-cache', id, getErrorMessage(e)));
      }
    },

    async set(entity: T, synced: boolean = false): Promise<Result<void, StorageError>> {
      try {
        await ensureDir(cacheDir);
        const filePath = path.join(cacheDir, `${entity.id}.json`);

        const existing = await readJsonFile<CacheEntry<T>>(filePath);
        const now = new Date().toISOString();

        const entry: CacheEntry<T> = {
          data: entity,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          syncedAt: synced ? now : (existing?.syncedAt || null),
          pendingSync: !synced,
        };

        await writeJsonFile(filePath, entry);
        return ok(undefined);
      } catch (e) {
        return err(StorageError.writeFailed('local-cache', entity.id, getErrorMessage(e)));
      }
    },

    async delete(id: string): Promise<Result<void, StorageError>> {
      try {
        await deleteFile(path.join(cacheDir, `${id}.json`));
        return ok(undefined);
      } catch (e) {
        return err(StorageError.deleteFailed('local-cache', id, getErrorMessage(e)));
      }
    },

    async list(): Promise<Result<T[], StorageError>> {
      try {
        const entries = await readJsonFilesFromDir<CacheEntry<T>>(cacheDir);
        return ok(entries.map((e) => e.data));
      } catch (e) {
        return err(StorageError.queryFailed(getErrorMessage(e)));
      }
    },

    async getPending(): Promise<Result<T[], StorageError>> {
      try {
        const entries = await readJsonFilesFromDir<CacheEntry<T>>(
          cacheDir,
          (entry) => entry.pendingSync
        );
        return ok(entries.map((e) => e.data));
      } catch (e) {
        return err(StorageError.queryFailed(getErrorMessage(e)));
      }
    },

    async markSynced(id: string): Promise<Result<void, StorageError>> {
      try {
        const filePath = path.join(cacheDir, `${id}.json`);
        const entry = await readJsonFile<CacheEntry<T>>(filePath);

        if (entry) {
          entry.syncedAt = new Date().toISOString();
          entry.pendingSync = false;
          await writeJsonFile(filePath, entry);
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.writeFailed('local-cache', id, getErrorMessage(e)));
      }
    },

    async clear(): Promise<Result<void, StorageError>> {
      try {
        await clearDir(cacheDir);
        return ok(undefined);
      } catch (e) {
        return err(StorageError.queryFailed(getErrorMessage(e)));
      }
    },
  };
}

export function createSyncQueue(): {
  add: (change: Omit<PendingChange, 'id' | 'createdAt' | 'retryCount'>) => Promise<Result<void, StorageError>>;
  getAll: () => Promise<Result<PendingChange[], StorageError>>;
  remove: (id: string) => Promise<Result<void, StorageError>>;
  incrementRetry: (id: string) => Promise<Result<void, StorageError>>;
  clear: () => Promise<Result<void, StorageError>>;
} {
  const queueDir = path.join(BASE_DIR, 'sync-queue');

  return {
    async add(
      change: Omit<PendingChange, 'id' | 'createdAt' | 'retryCount'>
    ): Promise<Result<void, StorageError>> {
      try {
        await ensureDir(queueDir);

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const entry: PendingChange = {
          ...change,
          id,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };

        await writeJsonFile(path.join(queueDir, `${id}.json`), entry);
        return ok(undefined);
      } catch (e) {
        return err(StorageError.writeFailed('sync-queue', 'new', getErrorMessage(e)));
      }
    },

    async getAll(): Promise<Result<PendingChange[], StorageError>> {
      try {
        const changes = await readJsonFilesFromDir<PendingChange>(queueDir);
        changes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return ok(changes);
      } catch (e) {
        return err(StorageError.queryFailed(getErrorMessage(e)));
      }
    },

    async remove(id: string): Promise<Result<void, StorageError>> {
      try {
        await deleteFile(path.join(queueDir, `${id}.json`));
        return ok(undefined);
      } catch (e) {
        return err(StorageError.deleteFailed('sync-queue', id, getErrorMessage(e)));
      }
    },

    async incrementRetry(id: string): Promise<Result<void, StorageError>> {
      try {
        const filePath = path.join(queueDir, `${id}.json`);
        const change = await readJsonFile<PendingChange>(filePath);

        if (change) {
          change.retryCount += 1;
          await writeJsonFile(filePath, change);
        }

        return ok(undefined);
      } catch (e) {
        return err(StorageError.writeFailed('sync-queue', id, getErrorMessage(e)));
      }
    },

    async clear(): Promise<Result<void, StorageError>> {
      try {
        await clearDir(queueDir);
        return ok(undefined);
      } catch (e) {
        return err(StorageError.queryFailed(getErrorMessage(e)));
      }
    },
  };
}
