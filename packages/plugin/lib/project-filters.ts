/**
 * Normalize project identifiers into canonical names.
 *
 * BetterPrompt tools filter sessions by `projectName`, but setup flows may
 * sometimes persist path-like values. This helper defensively collapses those
 * values back to the terminal project segment so filtering still works.
 */

const TEMP_PROJECT_PREFIXES = [
  'private/tmp/',
  'tmp/',
  'temp/',
  'var/folders/',
  'private/var/',
];

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function normalizeProjectNameValue(value?: string | null): string {
  const normalized = value ? normalizeSlashes(value) : '';
  if (!normalized) {
    return 'unknown';
  }

  const lower = normalized.toLowerCase();
  if (TEMP_PROJECT_PREFIXES.some(prefix => lower.startsWith(prefix))) {
    const segments = normalized.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? normalized;
  }

  return normalized;
}

function normalizeProjectFilter(value: string): string {
  const normalized = normalizeSlashes(value);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

export function normalizeProjectFilters(includeProjects?: string[]): string[] | undefined {
  if (!includeProjects?.length) {
    return includeProjects;
  }

  const normalized = Array.from(
    new Set(includeProjects.map(normalizeProjectFilter).filter(Boolean)),
  );

  return normalized.length ? normalized : undefined;
}
