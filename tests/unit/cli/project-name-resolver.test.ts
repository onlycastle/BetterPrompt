import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs before importing the module
vi.mock('node:fs', () => ({
  statSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock node:os to control homedir
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/Users/sungmancho'),
}));

import { statSync, readdirSync } from 'node:fs';
import {
  resolveProjectName,
  resolveProjectNames,
  clearResolverCache,
} from '../../../packages/cli/src/lib/project-name-resolver.js';

const mockStatSync = vi.mocked(statSync);
const mockReaddirSync = vi.mocked(readdirSync);

/**
 * Helper: configure which directories "exist" on the mock filesystem.
 * All other paths will throw ENOENT.
 * Optionally provide a map of parent → child directory names for readdirSync.
 */
function setExistingDirs(dirs: string[], dirContents?: Record<string, string[]>) {
  const dirSet = new Set(dirs);
  mockStatSync.mockImplementation((path: unknown) => {
    if (dirSet.has(String(path))) {
      return { isDirectory: () => true } as ReturnType<typeof statSync>;
    }
    throw new Error('ENOENT');
  });

  mockReaddirSync.mockImplementation((path: unknown) => {
    const p = String(path);
    const children = dirContents?.[p];
    if (children) {
      return children.map(name => ({
        name,
        isDirectory: () => true,
        isFile: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
        parentPath: p,
        path: p,
      })) as unknown as ReturnType<typeof readdirSync>;
    }
    throw new Error('ENOENT');
  });
}

describe('resolveProjectName', () => {
  beforeEach(() => {
    clearResolverCache();
    mockStatSync.mockReset();
  });

  describe('basic resolution', () => {
    it('should resolve simple project name (no hyphens)', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/nomoreaislop',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-nomoreaislop');
      expect(result).toBe('nomoreaislop');
    });

    it('should resolve hyphenated project name', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/youtube-enlgish-mobile',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-youtube-enlgish-mobile');
      expect(result).toBe('youtube-enlgish-mobile');
    });

    it('should resolve another hyphenated project name', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/single-person-company',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-single-person-company');
      expect(result).toBe('single-person-company');
    });
  });

  describe('nested projects', () => {
    it('should resolve nested project with hyphenated parent', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/single-person-company',
        '/Users/sungmancho/projects/single-person-company/youtube',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-single-person-company-youtube');
      expect(result).toBe('single-person-company/youtube');
    });

    it('should resolve nested project under hyphenated dirs', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/new-idea',
        '/Users/sungmancho/projects/new-idea/wedding-idea',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-new-idea-wedding-idea');
      expect(result).toBe('new-idea/wedding-idea');
    });
  });

  describe('temp directory detection', () => {
    it('should detect /private/var temp directories', () => {
      const result = resolveProjectName('-private-var-folders-xx-abc123-T');
      expect(result).toBe('(temp)');
    });

    it('should detect /tmp directories', () => {
      const result = resolveProjectName('-tmp-some-random-path');
      expect(result).toBe('(temp)');
    });

    it('should detect /temp directories', () => {
      const result = resolveProjectName('-temp-user-workdir');
      expect(result).toBe('(temp)');
    });

    it('should detect /var/folders temp directories', () => {
      const result = resolveProjectName('-var-folders-xx-randomhash-T');
      expect(result).toBe('(temp)');
    });
  });

  describe('container directory stripping', () => {
    it('should strip "projects" container dir', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/my-app',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects-my-app');
      expect(result).toBe('my-app');
    });

    it('should strip "repos" container dir', () => {
      setExistingDirs([
        '/Users/sungmancho/repos',
        '/Users/sungmancho/repos/my-project',
      ]);

      const result = resolveProjectName('-Users-sungmancho-repos-my-project');
      expect(result).toBe('my-project');
    });

    it('should strip "code" container dir', () => {
      setExistingDirs([
        '/Users/sungmancho/code',
        '/Users/sungmancho/code/my-lib',
      ]);

      const result = resolveProjectName('-Users-sungmancho-code-my-lib');
      expect(result).toBe('my-lib');
    });

    it('should strip "workspace" container dir', () => {
      setExistingDirs([
        '/Users/sungmancho/workspace',
        '/Users/sungmancho/workspace/awesome-tool',
      ]);

      const result = resolveProjectName('-Users-sungmancho-workspace-awesome-tool');
      expect(result).toBe('awesome-tool');
    });

    it('should not strip the last remaining dir even if it is a container name', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
      ]);

      const result = resolveProjectName('-Users-sungmancho-projects');
      expect(result).toBe('projects');
    });
  });

  describe('fallback behavior', () => {
    it('should return full remainder when no dirs match', () => {
      // Nothing exists on filesystem
      setExistingDirs([]);

      const result = resolveProjectName('-Users-sungmancho-projects-temp-proejct');
      // Falls back: home prefix matches but filesystem probing fails
      // Should join remaining segments with hyphens
      expect(result).toBe('projects-temp-proejct');
    });

    it('should return non-encoded names as-is', () => {
      const result = resolveProjectName('some-local-dir');
      expect(result).toBe('some-local-dir');
    });

    it('should return "unknown" for empty string', () => {
      const result = resolveProjectName('');
      expect(result).toBe('unknown');
    });

    it('should handle single segment after home prefix', () => {
      setExistingDirs([
        '/Users/sungmancho/nonce',
      ]);

      const result = resolveProjectName('-Users-sungmancho-nonce');
      expect(result).toBe('nonce');
    });
  });

  describe('caching', () => {
    it('should return cached result on second call', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/my-app',
      ]);

      const first = resolveProjectName('-Users-sungmancho-projects-my-app');
      const callCount = mockStatSync.mock.calls.length;

      const second = resolveProjectName('-Users-sungmancho-projects-my-app');

      expect(first).toBe(second);
      // No additional statSync calls on second invocation
      expect(mockStatSync.mock.calls.length).toBe(callCount);
    });

    it('should resolve fresh after cache clear', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/app-v1',
      ]);

      resolveProjectName('-Users-sungmancho-projects-app-v1');
      const callsAfterFirst = mockStatSync.mock.calls.length;

      clearResolverCache();
      resolveProjectName('-Users-sungmancho-projects-app-v1');

      expect(mockStatSync.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  describe('fuzzy matching (renamed directories)', () => {
    it('should fuzzy match a renamed directory with 1-char typo', () => {
      // "alfreadworks" (old, encoded) → "alfredworks" (current on disk)
      // Levenshtein distance = 1 (extra 'a')
      setExistingDirs(
        [
          '/Users/sungmancho/projects',
          // Note: /Users/sungmancho/projects/alfreadworks does NOT exist (renamed)
          '/Users/sungmancho/projects/alfredworks',
        ],
        {
          '/Users/sungmancho/projects': ['alfredworks', 'other-project'],
        },
      );

      const result = resolveProjectName('-Users-sungmancho-projects-alfreadworks');
      expect(result).toBe('alfredworks');
    });

    it('should NOT fuzzy match when distance > 1', () => {
      // "hr-platform" vs "alfredworks" — totally different names
      setExistingDirs(
        [
          '/Users/sungmancho/projects',
          '/Users/sungmancho/projects/alfredworks',
        ],
        {
          '/Users/sungmancho/projects': ['alfredworks'],
        },
      );

      const result = resolveProjectName('-Users-sungmancho-projects-hr-platform');
      // Falls back to joining segments with hyphens
      expect(result).toBe('hr-platform');
    });

    it('should NOT fuzzy match short names (< 4 chars)', () => {
      // Short names are too prone to false positives
      setExistingDirs(
        [
          '/Users/sungmancho/projects',
          '/Users/sungmancho/projects/app',
        ],
        {
          '/Users/sungmancho/projects': ['app'],
        },
      );

      const result = resolveProjectName('-Users-sungmancho-projects-apx');
      // "apx" is 3 chars — too short for fuzzy matching
      expect(result).toBe('apx');
    });

    it('should prefer exact match over fuzzy match', () => {
      setExistingDirs(
        [
          '/Users/sungmancho/projects',
          '/Users/sungmancho/projects/my-app',
        ],
        {
          '/Users/sungmancho/projects': ['my-app', 'my-app'],
        },
      );

      // Exact match should win — fuzzy matching only triggers on exact match failure
      const result = resolveProjectName('-Users-sungmancho-projects-my-app');
      expect(result).toBe('my-app');
    });

    it('should handle parent directory read failure gracefully', () => {
      // readdirSync throws for unreadable directories
      setExistingDirs([
        '/Users/sungmancho/projects',
      ]);
      // No dirContents provided — readdirSync throws ENOENT

      const result = resolveProjectName('-Users-sungmancho-projects-nonexistent-dir');
      // Falls back to joining all remaining segments
      expect(result).toBe('nonexistent-dir');
    });
  });

  describe('batch resolution', () => {
    it('should resolve multiple names', () => {
      setExistingDirs([
        '/Users/sungmancho/projects',
        '/Users/sungmancho/projects/app-a',
        '/Users/sungmancho/projects/app-b',
      ]);

      const results = resolveProjectNames([
        '-Users-sungmancho-projects-app-a',
        '-Users-sungmancho-projects-app-b',
      ]);

      expect(results.get('-Users-sungmancho-projects-app-a')).toBe('app-a');
      expect(results.get('-Users-sungmancho-projects-app-b')).toBe('app-b');
    });
  });
});
