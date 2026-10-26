import type { StorageAdapter } from '@md-reader/core';

function getStorage() {
  return globalThis.browser?.storage?.sync ?? globalThis.chrome?.storage?.sync;
}

export class ChromeStorageAdapter implements StorageAdapter {
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const storage = getStorage();
    const result = await this.promisify<Record<string, T>>(storage?.get?.([key]));
    return result?.[key] ?? defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const storage = getStorage();
    await this.promisify(storage?.set?.({ [key]: value }));
  }

  async remove(key: string): Promise<void> {
    const storage = getStorage();
    await this.promisify(storage?.remove?.([key]));
  }

  async getAll(): Promise<Record<string, unknown>> {
    const storage = getStorage();
    return (await this.promisify(storage?.get?.(null))) ?? {};
  }

  private promisify<T>(call: unknown): Promise<T> {
    if (!call) return Promise.resolve({} as T);
    const maybePromise = call as Promise<T> | undefined;
    if (typeof maybePromise?.then === 'function') return maybePromise;

    return new Promise((resolve) => {
      (call as (cb: (value: T) => void) => void)((value) => resolve(value ?? ({} as T)));
    });
  }
}
