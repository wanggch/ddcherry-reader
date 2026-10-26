import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderCore } from '../src/reader-core.js';
import type { AssetResolver } from '../src/assets/resolver.js';
import type { FileProvider } from '../src/file/provider.js';
import type { StorageAdapter } from '../src/storage/adapter.js';

class MemoryStorage implements StorageAdapter {
  readonly values: Record<string, unknown>;

  constructor(values: Record<string, unknown> = {}) {
    this.values = { ...values };
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return (this.values[key] as T | undefined) ?? defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values[key] = value;
  }

  async remove(key: string): Promise<void> {
    delete this.values[key];
  }

  async getAll(): Promise<Record<string, unknown>> {
    return { ...this.values };
  }
}

const fileProvider: FileProvider = {
  readFile: vi.fn(async () => ({ content: '', encoding: 'utf-8' as const })),
  readAsset: vi.fn(async () => ''),
  watchFile: vi.fn(() => () => {}),
  resolveAssetPath: vi.fn((_filePath, relativePath) => relativePath),
  canRead: vi.fn(async () => true),
  listDirectory: vi.fn(async () => [])
};

const assetResolver: AssetResolver = {
  resolve: (path) => path
};

function createReader(storage = new MemoryStorage()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const reader = new ReaderCore({ container, fileProvider, storageAdapter: storage, assetResolver });
  return { container, reader, storage };
}

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false }))
  });
});

describe('ReaderCore toolbar modes', () => {
  it('shows the original file content through the Source Mode icon', async () => {
    const { container, reader, storage } = createReader();
    const markdown = '# Title\n\n    indented <value>';

    await reader.init();
    await reader.openMarkdown(markdown);

    expect(container.querySelector('[data-action="toggle-raw"]')).toBeNull();
    expect(container.querySelector('[data-action="refresh"]')).toBeNull();

    const sourceButton = container.querySelector('[data-action="toggle-source"]') as HTMLButtonElement;
    expect(sourceButton.querySelector('svg')).not.toBeNull();
    sourceButton.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.md-reader-source')?.textContent).toBe(markdown);
    });
    expect(storage.values.rawMode).toBe(true);
    expect(container.querySelector('[data-action="toggle-source"]')?.getAttribute('aria-pressed')).toBe('true');

    (container.querySelector('[data-action="toggle-source"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(container.querySelector('.md-reader-content h1')?.textContent).toContain('Title');
    });
  });

  it('toggles and persists full-width layout', async () => {
    const { container, reader, storage } = createReader();

    await reader.init();
    await reader.openMarkdown('# Layout');

    const layoutButton = container.querySelector('[data-action="toggle-layout"]') as HTMLButtonElement;
    expect(layoutButton.title).toBe('满屏布局');
    layoutButton.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.md-reader')?.classList.contains('md-reader--layout-full')).toBe(true);
    });
    expect(storage.values.layoutMode).toBe('full');
    expect((container.querySelector('[data-action="toggle-layout"]') as HTMLButtonElement).title).toBe('正常布局');
  });

  it('restores persisted source and layout modes', async () => {
    const storage = new MemoryStorage({ rawMode: true, layoutMode: 'full' });
    const { container, reader } = createReader(storage);

    await reader.init();
    await reader.openMarkdown('raw\nsource');

    expect(container.querySelector('.md-reader-source')?.textContent).toBe('raw\nsource');
    expect(container.querySelector('.md-reader')?.classList.contains('md-reader--layout-full')).toBe(true);
  });
});

describe('ReaderCore highlight theme injection', () => {
  it('injects the light highlight stylesheet without an assets/ prefix', async () => {
    const resolve = vi.fn((path: string) => `/resolved/${path}`);
    const container = document.createElement('div');
    document.body.appendChild(container);

    const reader = new ReaderCore({
      container,
      fileProvider,
      storageAdapter: new MemoryStorage({ theme: 'light' }),
      assetResolver: { resolve }
    });

    await reader.init();
    await reader.openMarkdown('```js\nconst x = 1;\n```');

    expect(resolve).toHaveBeenCalledWith('highlight-github.css');
    const link = document.querySelector('link[data-md-reader-highlight]') as HTMLLinkElement | null;
    expect(link?.href).toContain('/resolved/highlight-github.css');
    expect(container.querySelector('pre code .hljs-keyword')).not.toBeNull();
  });

  it('switches to the dark highlight stylesheet for dark themes', async () => {
    const resolve = vi.fn((path: string) => `/resolved/${path}`);
    const container = document.createElement('div');
    document.body.appendChild(container);

    const reader = new ReaderCore({
      container,
      fileProvider,
      storageAdapter: new MemoryStorage({ theme: 'dark' }),
      assetResolver: { resolve }
    });

    await reader.init();
    await reader.openMarkdown('# Dark');

    expect(resolve).toHaveBeenCalledWith('highlight-github-dark.css');
    const link = document.querySelector('link[data-md-reader-highlight]') as HTMLLinkElement | null;
    expect(link?.getAttribute('data-md-reader-highlight')).toBe('/resolved/highlight-github-dark.css');
  });
});
