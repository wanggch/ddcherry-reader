import { DEFAULT_PREFERENCES, filterPreferences, normalizePreferences, type ReaderPreferences } from './schema.js';
import type { StorageAdapter } from '../storage/adapter.js';

export class PreferencesManager {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async getAll(): Promise<ReaderPreferences> {
    try {
      const stored = await this.storage.getAll();
      return normalizePreferences(stored);
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async get<K extends keyof ReaderPreferences>(key: K): Promise<ReaderPreferences[K]> {
    const all = await this.getAll();
    return all[key];
  }

  async update(nextPreferences: Partial<ReaderPreferences>): Promise<void> {
    const filtered = filterPreferences(nextPreferences);

    for (const [key, value] of Object.entries(filtered)) {
      await this.storage.set(key, value);
    }
  }
}
