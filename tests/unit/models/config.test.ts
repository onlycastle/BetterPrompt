import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  DEFAULT_CONFIG,
} from '../../../src/lib/models/config.js';

describe('Config Models', () => {
  describe('ConfigSchema', () => {
    it('should validate complete valid config', () => {
      const config = {
        version: '1.0.0',
        telemetry: true,
        storagePath: '~/.betterprompt',
        apiKey: 'sk-ant-test-key',
      };
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept null apiKey', () => {
      const config = {
        version: '1.0.0',
        telemetry: true,
        storagePath: '~/.betterprompt',
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
        expect(result.data.storagePath).toBe('~/.betterprompt');
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
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have correct version', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0.0');
    });

    it('should have telemetry enabled by default', () => {
      expect(DEFAULT_CONFIG.telemetry).toBe(true);
    });

    it('should have correct default storage path', () => {
      expect(DEFAULT_CONFIG.storagePath).toBe('~/.betterprompt');
    });

    it('should have null apiKey by default', () => {
      expect(DEFAULT_CONFIG.apiKey).toBeNull();
    });

    it('should be a valid config according to schema', () => {
      const result = ConfigSchema.safeParse(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });
  });

});
