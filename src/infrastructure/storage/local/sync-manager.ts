/**
 * Sync Manager
 *
 * Manages synchronization between local cache and Supabase.
 * Implements ISyncManager port interface.
 *
 * @module infrastructure/storage/local/sync-manager
 */

import { ok, err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';
import type { ISyncManager } from '../../../application/ports/storage.js';
import { createSyncQueue, type PendingChange } from './file-cache.js';
import { isSupabaseConfigured } from '../supabase/client.js';

type SyncHandler = (change: PendingChange) => Promise<Result<void, StorageError>>;

const MAX_RETRIES = 3;
const DEFAULT_SYNC_INTERVAL_MS = 60000;

function createDefaultHandler(): SyncHandler {
  return async () => {
    console.log('Sync handler not configured');
    return ok(undefined);
  };
}

export function createSyncManager(handlers: {
  onPush?: SyncHandler;
  onStatusChange?: (online: boolean) => void;
}): ISyncManager {
  const syncQueue = createSyncQueue();
  let lastSyncAt: Date | null = null;
  const isOnline = isSupabaseConfigured();
  const pushHandler = handlers.onPush ?? createDefaultHandler();

  return {
    async getStatus(): Promise<{
      lastSyncAt: Date | null;
      pendingChanges: number;
      isOnline: boolean;
    }> {
      const queueResult = await syncQueue.getAll();
      const pendingChanges = queueResult.success ? queueResult.data.length : 0;

      return { lastSyncAt, pendingChanges, isOnline };
    },

    async pushChanges(): Promise<Result<{ pushed: number; failed: number }, StorageError>> {
      if (!isOnline) {
        return err(StorageError.connectionFailed('Supabase', 'Offline'));
      }

      const queueResult = await syncQueue.getAll();
      if (!queueResult.success) {
        return err(queueResult.error);
      }

      let pushed = 0;
      let failed = 0;

      for (const change of queueResult.data) {
        if (change.retryCount >= MAX_RETRIES) {
          console.warn(`Skipping change ${change.id} after ${MAX_RETRIES} retries`);
          failed++;
          continue;
        }

        try {
          const result = await pushHandler(change);

          if (result.success) {
            await syncQueue.remove(change.id);
            pushed++;
          } else {
            await syncQueue.incrementRetry(change.id);
            failed++;
          }
        } catch {
          await syncQueue.incrementRetry(change.id);
          failed++;
        }
      }

      if (pushed > 0) {
        lastSyncAt = new Date();
      }

      return ok({ pushed, failed });
    },

    async pullChanges(_since?: Date): Promise<Result<{ pulled: number }, StorageError>> {
      if (!isOnline) {
        return err(StorageError.connectionFailed('Supabase', 'Offline'));
      }

      lastSyncAt = new Date();
      return ok({ pulled: 0 });
    },

    async fullSync(): Promise<Result<{ pushed: number; pulled: number }, StorageError>> {
      if (!isOnline) {
        return err(StorageError.connectionFailed('Supabase', 'Offline'));
      }

      const pushResult = await this.pushChanges();
      if (!pushResult.success) {
        return err(pushResult.error);
      }

      const pullResult = await this.pullChanges();
      if (!pullResult.success) {
        return err(pullResult.error);
      }

      return ok({
        pushed: pushResult.data.pushed,
        pulled: pullResult.data.pulled,
      });
    },

    async queueChange(type: string, id: string, data: unknown): Promise<void> {
      await syncQueue.add({
        type,
        entityId: id,
        operation: 'update',
        data,
      });
    },

    isOnline(): boolean {
      return isOnline;
    },

    onStatusChange(handler: (online: boolean) => void): void {
      handler(isOnline);
    },
  };
}

export async function checkConnectivity(): Promise<boolean> {
  try {
    return isSupabaseConfigured();
  } catch {
    return false;
  }
}

export function createAutoSyncManager(
  pushHandler: SyncHandler,
  options: {
    syncIntervalMs?: number;
    onStatusChange?: (online: boolean) => void;
  } = {}
): ISyncManager & { start: () => void; stop: () => void } {
  const manager = createSyncManager({
    onPush: pushHandler,
    onStatusChange: options.onStatusChange,
  });

  let syncInterval: ReturnType<typeof setInterval> | null = null;
  const intervalMs = options.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL_MS;

  return {
    ...manager,

    start(): void {
      if (syncInterval) return;

      syncInterval = setInterval(async () => {
        if (manager.isOnline()) {
          const status = await manager.getStatus();
          if (status.pendingChanges > 0) {
            await manager.pushChanges();
          }
        }
      }, intervalMs);
    },

    stop(): void {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    },
  };
}
