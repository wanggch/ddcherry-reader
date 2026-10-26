import { invoke } from '@tauri-apps/api/core';
import type { StorageAdapter } from '@md-reader/core';

export class TauriStorageAdapter implements StorageAdapter {
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return invoke<T | undefined>('get_preference', { key, defaultValue });
  }

  async set<T>(key: string, value: T): Promise<void> {
    await invoke('set_preference', { key, value });
  }

  async remove(key: string): Promise<void> {
    await invoke('remove_preference', { key });
  }

  async getAll(): Promise<Record<string, unknown>> {
    return invoke<Record<string, unknown>>('get_all_preferences');
  }
}
