import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Compute SHA-256 hash of file content
 *
 * Used for cache invalidation - detects when source session files change.
 *
 * @param filePath - Absolute path to the file
 * @returns Hexadecimal hash string
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}
