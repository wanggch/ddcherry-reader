import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChromeStorageAdapter } from '../src/adapters/chrome-storage-adapter.ts';

describe('ChromeStorageAdapter', () => {
  let mockStorage;
  let adapter;

  beforeEach(() => {
    mockStorage = {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve())
    };

    Object.defineProperty(globalThis, 'chrome', {
      value: { storage: { sync: mockStorage } },
      writable: true,
      configurable: true
    });

    adapter = new ChromeStorageAdapter();
  });

  it('returns a stored value', async () => {
    mockStorage.get.mockResolvedValue({ theme: 'dark' });
    await expect(adapter.get('theme')).resolves.toBe('dark');
  });

  it('returns default value when key is missing', async () => {
    mockStorage.get.mockResolvedValue({});
    await expect(adapter.get('theme', 'light')).resolves.toBe('light');
  });

  it('sets and removes values', async () => {
    await adapter.set('enabled', false);
    expect(mockStorage.set).toHaveBeenCalledWith({ enabled: false });

    await adapter.remove('enabled');
    expect(mockStorage.remove).toHaveBeenCalledWith(['enabled']);
  });

  it('returns all stored preferences', async () => {
    mockStorage.get.mockResolvedValue({ theme: 'dark', fontSize: 18 });
    await expect(adapter.getAll()).resolves.toEqual({ theme: 'dark', fontSize: 18 });
  });
});
