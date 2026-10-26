import { vi } from 'vitest';

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://markdown-reader-pro/${path}`,
    onInstalled: { addListener: vi.fn() },
    openOptionsPage: vi.fn()
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  }
};
