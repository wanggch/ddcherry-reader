import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn()
  }
}));

describe('content script auto-refresh', () => {
  let dom;
  let messageListener;
  let refreshTick;
  let sourceMarkdown;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    dom = new JSDOM('<!doctype html><body><pre># Old Title\n\nold body</pre></body>', {
      url: 'file:///C:/docs/live.md',
      pretendToBeVisual: true
    });
    Object.defineProperty(dom.window, 'scrollTo', {
      value: vi.fn(),
      configurable: true
    });
    Object.defineProperty(globalThis.window, 'scrollTo', {
      value: vi.fn(),
      configurable: true
    });
    dom.window.setInterval = vi.fn((callback) => {
      refreshTick = callback;
      return 1;
    });
    dom.window.clearInterval = vi.fn();
    sourceMarkdown = '# Old Title\n\nold body';

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('setInterval', dom.window.setInterval);
    vi.stubGlobal('clearInterval', dom.window.clearInterval);
    vi.stubGlobal('history', dom.window.history);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('Element', dom.window.Element);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Node', dom.window.Node);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path) => `chrome-extension://markdown-reader-pro/${path}`,
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          })
        },
        sendMessage: vi.fn((message, callback) => {
          if (message?.action === 'readMarkdownSource') {
            callback({ success: true, markdown: sourceMarkdown });
          }
        }),
        openOptionsPage: vi.fn()
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ autoRefresh: true }),
          set: vi.fn((_value, callback) => {
            callback?.();
          })
        }
      }
    });
  });

  afterEach(() => {
    dom?.window?.close();
    vi.unstubAllGlobals();
  });

  it('re-renders the reader from background-provided local Markdown when the file hash changes', async () => {
    const contentFetch = vi.fn(() => {
      throw new Error('content script direct file:// fetch failed');
    });
    vi.stubGlobal('fetch', contentFetch);

    await import('../src/extension/content-script.js');
    await waitUntil(() => document.body.dataset.mdReaderRendered === 'true');

    expect(document.querySelector('.markdown-body')?.textContent).toContain('old body');

    await sendCheckFileChange();
    sourceMarkdown = '# New Title\n\nnew body';
    const result = await sendCheckFileChange();

    expect(result).toEqual({ changed: true });
    expect(document.querySelector('.markdown-body')?.textContent).toContain('new body');
    expect(contentFetch).not.toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'readMarkdownSource', url: 'file:///C:/docs/live.md' },
      expect.any(Function)
    );
  });

  it('polls the background reader on the auto-refresh interval', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('content script direct file:// fetch failed');
    }));

    await import('../src/extension/content-script.js');
    await waitUntil(() => document.body.dataset.mdReaderRendered === 'true');

    expect(refreshTick).toEqual(expect.any(Function));

    await refreshTick();
    sourceMarkdown = '# Timer Title\n\ntimer body';
    await refreshTick();

    expect(document.querySelector('.markdown-body')?.textContent).toContain('timer body');
  });

  it('updates on the first auto-refresh check when the file changed before polling starts', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('content script direct file:// fetch failed');
    }));

    await import('../src/extension/content-script.js');
    await waitUntil(() => document.body.dataset.mdReaderRendered === 'true');

    sourceMarkdown = '# First Poll Title\n\nfirst poll body';
    await refreshTick();

    expect(document.querySelector('.markdown-body')?.textContent).toContain('first poll body');
  });

  it('refreshes the currently selected folder file instead of the address-bar file', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('content script direct file:// fetch failed');
    }));

    await import('../src/extension/content-script.js');
    await waitUntil(() => document.body.dataset.mdReaderRendered === 'true');

    let folderMarkdown = '# Folder File\n\nfolder body';
    const folder = createDirectoryEntry('docs', [
      [createFileEntry('side.md', () => folderMarkdown)],
      []
    ]);

    dispatchFolderDrop(folder);
    await waitUntil(() => document.querySelector('[data-file-path="side.md"]'));

    document.querySelector('[data-file-path="side.md"]').dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }));
    await waitUntil(() => document.querySelector('.markdown-body')?.textContent.includes('folder body'));

    vi.mocked(chrome.runtime.sendMessage).mockClear();
    sourceMarkdown = '# Address File\n\naddress body';
    folderMarkdown = '# Folder File\n\nfolder body changed';
    await refreshTick();

    expect(document.querySelector('.markdown-body')?.textContent).toContain('folder body changed');
    expect(document.querySelector('.markdown-body')?.textContent).not.toContain('address body');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'readMarkdownSource' }),
      expect.any(Function)
    );
  });

  function sendCheckFileChange() {
    return new Promise((resolve) => {
      messageListener({ action: 'checkFileChange' }, {}, resolve);
    });
  }

  function dispatchFolderDrop(folderEntry) {
    const event = new dom.window.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        items: [{ webkitGetAsEntry: () => folderEntry }]
      }
    });
    document.dispatchEvent(event);
  }
});

function createFileEntry(name, getContent) {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (resolve) => resolve({ name, text: async () => getContent() })
  };
}

function createDirectoryEntry(name, batches) {
  let index = 0;

  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries: (resolve) => {
        resolve(batches[index++] ?? []);
      }
    })
  };
}

async function waitUntil(condition) {
  const started = Date.now();

  while (!condition()) {
    if (Date.now() - started > 3000) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
