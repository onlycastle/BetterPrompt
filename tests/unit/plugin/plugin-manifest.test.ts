import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('plugin manifest', () => {
  it('uses only Claude-supported top-level keys', () => {
    const manifestPath = join(
      process.cwd(),
      'packages',
      'plugin',
      '.claude-plugin',
      'plugin.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

    const allowedKeys = new Set([
      'name',
      'version',
      'description',
      'author',
      'repository',
      'homepage',
      'license',
      'keywords',
      'skills',
      'mcpServers',
    ]);

    expect(Object.keys(manifest).every((key) => allowedKeys.has(key))).toBe(true);
    expect(manifest.name).toBe('betterprompt');
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.mcpServers).toBe('./.mcp.json');
  });
});
