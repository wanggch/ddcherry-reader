import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn()
  }
}));

describe('export pdf', () => {
  let dom;
  let printSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    dom = new JSDOM('<!doctype html><body><pre># Hello\n\nworld</pre></body>', {
      url: 'file:///C:/docs/test.md',
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

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('Element', dom.window.Element);
    vi.stubGlobal('Node', dom.window.Node);
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('history', dom.window.history);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('setInterval', vi.fn());
    vi.stubGlobal('clearInterval', vi.fn());
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });

    printSpy = vi.fn();
    Object.defineProperty(dom.window, 'print', {
      value: printSpy,
      configurable: true
    });

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path) => `chrome-extension://markdown-reader-pro/${path}`,
        onMessage: {
          addListener: vi.fn()
        },
        sendMessage: vi.fn((message, callback) => {
          if (message?.action === 'readMarkdownSource') {
            callback({ success: true, markdown: '# Hello\n\nworld' });
          }
        })
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
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

  it('triggers window.print when export button is clicked', async () => {
    await import('../src/extension/content-script.js');
    await waitUntil(() => document.querySelector('[data-action="export-pdf"]'));

    const btn = document.querySelector('[data-action="export-pdf"]');
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(printSpy).toHaveBeenCalled();
  });
});

async function waitUntil(condition) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > 3000) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
