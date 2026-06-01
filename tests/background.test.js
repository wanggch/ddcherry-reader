import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('background Markdown source reader', () => {
  let backgroundMessageListener;
  let alarmListener;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener) => {
            backgroundMessageListener = listener;
          })
        },
        openOptionsPage: vi.fn()
      },
      storage: {
        sync: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      alarms: {
        getAll: vi.fn(),
        create: vi.fn(),
        onAlarm: {
          addListener: vi.fn((listener) => {
            alarmListener = listener;
          })
        }
      },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads Markdown from the sender file tab instead of trusting a message URL', async () => {
    const fetchMarkdown = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sender file'
    }));
    vi.stubGlobal('fetch', fetchMarkdown);

    await import('../src/extension/background.js');

    const response = await sendBackgroundMessage(
      { action: 'readMarkdownSource', url: 'file:///C:/other/ignored.md' },
      { tab: { url: 'file:///C:/docs/live.md' } }
    );

    expect(response).toEqual({ success: true, markdown: '# Sender file' });
    expect(fetchMarkdown).toHaveBeenCalledWith('file:///C:/docs/live.md', { cache: 'reload' });
  });

  it('sends refresh checks from alarms with Chrome callback-style tab APIs', async () => {
    chrome.tabs.query.mockImplementation((_query, callback) => {
      callback?.([{ id: 101 }, { id: 102 }]);
    });
    chrome.tabs.sendMessage.mockImplementation((_tabId, _message, callback) => {
      callback?.();
    });

    await import('../src/extension/background.js');
    alarmListener({ name: 'mdReaderAutoRefresh' });
    await Promise.resolve();

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      101,
      { action: 'checkFileChange' },
      expect.any(Function)
    );
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      102,
      { action: 'checkFileChange' },
      expect.any(Function)
    );
  });

  function sendBackgroundMessage(message, sender) {
    return new Promise((resolve) => {
      const isAsync = backgroundMessageListener(message, sender, resolve);
      expect(isAsync).toBe(true);
    });
  }
});
