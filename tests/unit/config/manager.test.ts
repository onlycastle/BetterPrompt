import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigManager, DEFAULT_CONFIG_PATH } from '../../../src/config/manager.js';
import { DEFAULT_CONFIG } from '../../../src/models/config.js';
import { homedir } from 'node:os';
import * as fs from 'node:fs/promises';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env };
    // Clear mocks
    vi.clearAllMocks();
    // Reset env vars used by config
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.NOSLOP_TELEMETRY;
    delete process.env.NOSLOP_STORAGE_PATH;
    delete process.env.NOSLOP_MODEL;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use default path when none provided', () => {
      const manager = new ConfigManager();
      expect(manager.getConfigPath()).toBe(DEFAULT_CONFIG_PATH);
    });

    it('should expand ~ in custom path', () => {
      const manager = new ConfigManager('~/.custom/config.json');
      expect(manager.getConfigPath()).toBe(`${homedir()}/.custom/config.json`);
    });

    it('should use absolute path as-is', () => {
      const manager = new ConfigManager('/absolute/path/config.json');
      expect(manager.getConfigPath()).toBe('/absolute/path/config.json');
    });
  });

  describe('getConfig', () => {
    it('should return default config when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const manager = new ConfigManager();
      const config = await manager.getConfig();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge file config with defaults', async () => {
      const fileConfig = {
        telemetry: false,
        model: 'custom-model',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      const manager = new ConfigManager();
      const config = await manager.getConfig();

      expect(config.telemetry).toBe(false);
      expect(config.model).toBe('custom-model');
      expect(config.version).toBe(DEFAULT_CONFIG.version);
      expect(config.storagePath).toBe(DEFAULT_CONFIG.storagePath);
    });

    it('should prioritize environment variables over file config', async () => {
      const fileConfig = {
        apiKey: 'file-api-key',
        model: 'file-model',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));

      process.env.ANTHROPIC_API_KEY = 'env-api-key';
      process.env.NOSLOP_MODEL = 'env-model';

      const manager = new ConfigManager();
      const config = await manager.getConfig();

      expect(config.apiKey).toBe('env-api-key');
      expect(config.model).toBe('env-model');
    });

    it('should cache config after first load', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

      const manager = new ConfigManager();
      await manager.getConfig();
      await manager.getConfig();
      await manager.getConfig();

      // readFile should only be called once due to caching
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should fall back to defaults on validation error', async () => {
      const invalidConfig = {
        version: 'invalid-version', // Should be '1.0.0'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));

      const manager = new ConfigManager();
      const config = await manager.getConfig();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should handle telemetry env var correctly', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      // Test 'false' string
      process.env.NOSLOP_TELEMETRY = 'false';
      let manager = new ConfigManager();
      let config = await manager.getConfig();
      expect(config.telemetry).toBe(false);

      // Test '0' string
      process.env.NOSLOP_TELEMETRY = '0';
      manager = new ConfigManager();
      config = await manager.getConfig();
      expect(config.telemetry).toBe(false);

      // Test 'true' string
      process.env.NOSLOP_TELEMETRY = 'true';
      manager = new ConfigManager();
      config = await manager.getConfig();
      expect(config.telemetry).toBe(true);

      // Test any other value
      process.env.NOSLOP_TELEMETRY = 'yes';
      manager = new ConfigManager();
      config = await manager.getConfig();
      expect(config.telemetry).toBe(true);
    });
  });

  describe('get', () => {
    it('should get specific config value', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const manager = new ConfigManager();

      expect(await manager.get('version')).toBe('1.0.0');
      expect(await manager.get('telemetry')).toBe(true);
      expect(await manager.get('storagePath')).toBe('~/.nomoreaislop');
    });
  });

  describe('set', () => {
    it('should update config value and persist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const manager = new ConfigManager();
      await manager.set('telemetry', false);

      expect(fs.writeFile).toHaveBeenCalled();

      // Verify the updated value
      expect(await manager.get('telemetry')).toBe(false);
    });
  });

  describe('save', () => {
    it('should create directory if needed and write file', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const manager = new ConfigManager('/path/to/config.json');
      await manager.save(DEFAULT_CONFIG);

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/config.json',
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        'utf-8'
      );
    });
  });

  describe('reset', () => {
    it('should reset to default config', async () => {
      const fileConfig = {
        telemetry: false,
        model: 'custom-model',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fileConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const manager = new ConfigManager();

      // Load custom config first
      let config = await manager.getConfig();
      expect(config.telemetry).toBe(false);

      // Reset
      await manager.reset();

      // Should now be default
      config = await manager.getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    });

    describe('getApiKey', () => {
      it('should return null when not set', async () => {
        const manager = new ConfigManager();
        expect(await manager.getApiKey()).toBeNull();
      });

      it('should return api key from env', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        const manager = new ConfigManager();
        expect(await manager.getApiKey()).toBe('test-key');
      });
    });

    describe('hasApiKey', () => {
      it('should return false when not set', async () => {
        const manager = new ConfigManager();
        expect(await manager.hasApiKey()).toBe(false);
      });

      it('should return true when set', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        const manager = new ConfigManager();
        expect(await manager.hasApiKey()).toBe(true);
      });

      it('should return false for empty string', async () => {
        process.env.ANTHROPIC_API_KEY = '';
        const manager = new ConfigManager();
        expect(await manager.hasApiKey()).toBe(false);
      });
    });

    describe('isTelemetryEnabled', () => {
      it('should return true by default', async () => {
        const manager = new ConfigManager();
        expect(await manager.isTelemetryEnabled()).toBe(true);
      });

      it('should return false when disabled', async () => {
        process.env.NOSLOP_TELEMETRY = 'false';
        const manager = new ConfigManager();
        expect(await manager.isTelemetryEnabled()).toBe(false);
      });
    });

    describe('getModel', () => {
      it('should return default model', async () => {
        const manager = new ConfigManager();
        expect(await manager.getModel()).toBe('claude-sonnet-4-20250514');
      });

      it('should return custom model from env', async () => {
        process.env.NOSLOP_MODEL = 'custom-model';
        const manager = new ConfigManager();
        expect(await manager.getModel()).toBe('custom-model');
      });
    });

    describe('getStoragePath', () => {
      it('should expand ~ in storage path', async () => {
        const manager = new ConfigManager();
        const path = await manager.getStoragePath();
        expect(path).toBe(`${homedir()}/.nomoreaislop`);
      });

      it('should return absolute path as-is', async () => {
        process.env.NOSLOP_STORAGE_PATH = '/absolute/storage';
        const manager = new ConfigManager();
        const path = await manager.getStoragePath();
        expect(path).toBe('/absolute/storage');
      });
    });
  });

  describe('exists', () => {
    it('should return true when config file exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const manager = new ConfigManager();
      expect(await manager.exists()).toBe(true);
    });

    it('should return false when config file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const manager = new ConfigManager();
      expect(await manager.exists()).toBe(false);
    });
  });
});
