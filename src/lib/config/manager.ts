import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  type Config,
  ConfigSchema,
  DEFAULT_CONFIG,
  ENV_MAPPINGS,
} from '../models/index';

/**
 * Default config file path
 */
export const DEFAULT_CONFIG_PATH = join(homedir(), '.betterprompt', 'config.json');

/**
 * ConfigManager - Handles user configuration
 *
 * Configuration resolution order:
 * 1. Environment variables (highest priority)
 * 2. Config file
 * 3. Default values
 */
export class ConfigManager {
  private configPath: string;
  private config: Config | null = null;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath.startsWith('~')
      ? configPath.replace('~', homedir())
      : configPath;
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<Partial<Config>> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      return {};
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): Partial<Config> {
    const env: Partial<Config> = {};

    // API Key
    const apiKey = process.env[ENV_MAPPINGS.apiKey];
    if (apiKey) {
      env.apiKey = apiKey;
    }

    // Telemetry
    const telemetry = process.env[ENV_MAPPINGS.telemetry];
    if (telemetry !== undefined) {
      env.telemetry = telemetry.toLowerCase() !== 'false' && telemetry !== '0';
    }

    // Storage path
    const storagePath = process.env[ENV_MAPPINGS.storagePath];
    if (storagePath) {
      env.storagePath = storagePath;
    }

    return env;
  }

  /**
   * Get full resolved configuration
   */
  async getConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    const fileConfig = await this.loadFromFile();
    const envConfig = this.loadFromEnv();

    // Merge: defaults < file < env
    const merged = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...envConfig,
    };

    // Validate
    const result = ConfigSchema.safeParse(merged);
    if (result.success) {
      this.config = result.data;
      return this.config;
    }

    // Fall back to defaults on validation error
    this.config = DEFAULT_CONFIG;
    return this.config;
  }

  /**
   * Get a specific configuration value
   */
  async get<K extends keyof Config>(key: K): Promise<Config[K]> {
    const config = await this.getConfig();
    return config[key];
  }

  /**
   * Set a configuration value and persist
   */
  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    const config = await this.getConfig();
    config[key] = value;

    await this.save(config);
    this.config = config;
  }

  /**
   * Save configuration to file
   */
  async save(config: Config): Promise<void> {
    // Ensure directory exists
    await mkdir(dirname(this.configPath), { recursive: true });

    await writeFile(
      this.configPath,
      JSON.stringify(config, null, 2),
      'utf-8'
    );
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    await this.save(DEFAULT_CONFIG);
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Get API key (convenience method)
   */
  async getApiKey(): Promise<string | null> {
    return this.get('apiKey');
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return apiKey !== null && apiKey.length > 0;
  }

  /**
   * Check if telemetry is enabled
   */
  async isTelemetryEnabled(): Promise<boolean> {
    return this.get('telemetry');
  }

  /**
   * Get storage path
   */
  async getStoragePath(): Promise<string> {
    const path = await this.get('storagePath');
    return path.startsWith('~') ? path.replace('~', homedir()) : path;
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
