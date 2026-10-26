import { vi } from 'vitest';

Object.defineProperty(globalThis, 'chrome', {
  value: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() }
    },
    storage: {
      sync: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve())
      }
    }
  },
  writable: true,
  configurable: true
});

Object.defineProperty(globalThis, 'browser', {
  value: undefined,
  writable: true,
  configurable: true
});
