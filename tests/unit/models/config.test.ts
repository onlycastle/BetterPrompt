import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  ENV_MAPPINGS,
} from '../../../src/models/config.js';

describe('Config Models', () => {
  describe('ConfigSchema', () => {
    it('should validate complete valid config', () => {
      const config = {
        version: '1.0.0',
        telemetry: true,
        storagePath: '~/.nomoreaislop',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'sk-ant-test-key',
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept null apiKey', () => {
      const config = {
        version: '1.0.0',
        telemetry: true,
        storagePath: '~/.nomoreaislop',
        model: 'claude-sonnet-4-20250514',
        apiKey: null,
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const config = { version: '1.0.0' };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.telemetry).toBe(true);
        expect(result.data.storagePath).toBe('~/.nomoreaislop');
        expect(result.data.model).toBe('claude-sonnet-4-20250514');
        expect(result.data.apiKey).toBeNull();
      }
    });

    it('should reject invalid version', () => {
      const config = {
        version: '2.0.0',  // Must be '1.0.0'
        telemetry: true,
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean telemetry', () => {
      const config = {
        version: '1.0.0',
        telemetry: 'yes',  // Must be boolean
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept custom storage path', () => {
      const config = {
        version: '1.0.0',
        storagePath: '/custom/path/storage',
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storagePath).toBe('/custom/path/storage');
      }
    });

    it('should accept custom model', () => {
      const config = {
        version: '1.0.0',
        model: 'claude-3-opus-20240229',
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('claude-3-opus-20240229');
      }
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have correct version', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0.0');
    });

    it('should have telemetry enabled by default', () => {
      expect(DEFAULT_CONFIG.telemetry).toBe(true);
    });

    it('should have correct default storage path', () => {
      expect(DEFAULT_CONFIG.storagePath).toBe('~/.nomoreaislop');
    });

    it('should have correct default model', () => {
      expect(DEFAULT_CONFIG.model).toBe('claude-sonnet-4-20250514');
    });

    it('should have null apiKey by default', () => {
      expect(DEFAULT_CONFIG.apiKey).toBeNull();
    });

    it('should be a valid config according to schema', () => {
      const result = ConfigSchema.safeParse(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });
  });

  describe('ENV_MAPPINGS', () => {
    it('should have correct API key mapping', () => {
      expect(ENV_MAPPINGS.apiKey).toBe('ANTHROPIC_API_KEY');
    });

    it('should have correct telemetry mapping', () => {
      expect(ENV_MAPPINGS.telemetry).toBe('NOSLOP_TELEMETRY');
    });

    it('should have correct storage path mapping', () => {
      expect(ENV_MAPPINGS.storagePath).toBe('NOSLOP_STORAGE_PATH');
    });

    it('should have correct model mapping', () => {
      expect(ENV_MAPPINGS.model).toBe('NOSLOP_MODEL');
    });

    it('should have all config keys mapped', () => {
      const configKeys = ['apiKey', 'telemetry', 'storagePath', 'model'];
      for (const key of configKeys) {
        expect(ENV_MAPPINGS).toHaveProperty(key);
      }
    });
  });
});
