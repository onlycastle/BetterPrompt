/**
 * Local Storage Adapters
 *
 * File-based storage for offline-first support.
 *
 * @module infrastructure/storage/local
 */

export {
  createLocalFileCache,
  createSyncQueue,
  type PendingChange,
} from './file-cache';

export {
  createSyncManager,
  createAutoSyncManager,
  checkConnectivity,
} from './sync-manager';
